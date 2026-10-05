const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let state = null;
let route = "home";
let selectedFilter = "全部";
let drawerReturnFocus = null;
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }

async function request(path, options) {
  const response = await fetch(path, Object.assign({ headers: { "Content-Type": "application/json" } }, options || {}));
  if (!response.ok) { const payload = await response.json().catch(() => ({})); const messages = { event_full: "这个活动已经满员了", event_not_found: "活动不存在或已下架", message_required: "先选一句或写几个字", invalid_profile: "请检查姓名、年龄和选择项", invalid_json: "请求格式不正确" }; throw new Error(messages[payload.error] || "请求没有成功，请稍后再试"); }
  return response.json();
}
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
}
function showRoute(next) {
  route = next;
  $$('[data-view]').forEach((view) => view.classList.toggle("active", view.dataset.view === next));
  $$('.bottom-nav [data-route]').forEach((button) => button.classList.toggle("active", button.dataset.route === next));
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderRoute(next);
}
function eventCard(item, compact) {
  const joined = state.joined.includes(item.id);
  const full = item.seats.includes("满");
  const image = item.type === "棋类" ? "activity-chess.svg" : item.type === "运动" ? "activity-walk.svg" : item.type === "舞蹈" ? "activity-walk.svg" : "activity-walk.svg";
  return '<button class="event-card ' + (compact ? "compact" : "") + '" data-event-id="' + escapeHtml(item.id) + '"><span class="event-image"><img src="assets/' + image + '" alt=""></span><span class="event-info"><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.time) + ' · ' + escapeHtml(item.place) + '</small><small>' + escapeHtml(item.host) + '</small><em class="' + (full ? "full" : "") + '">' + escapeHtml(joined ? "已记下参加意愿" : item.seats) + '</em></span><span class="event-arrow">›</span></button>';
}
function renderHome() {
  $("#user-name").textContent = state.profile.name;
  const companion = state.profile.companion;
  const initial = (companion.name || "老伴").slice(0, 1);
  [$("#hero-face"), $("#avatar-face"), $("#editor-face"), $("#mine-avatar")].forEach((node) => { if (node) node.textContent = initial; });
  $("#companion-greeting").textContent = companion.name + "，下午要不要出去走走？";
  $("#companion-memory-preview").textContent = companion.memory || "慢慢来，我会陪你。";
  if ($("#mine-name")) $("#mine-name").textContent = state.profile.name;
  if ($("#home-date")) { const now = new Date(); const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]; $("#home-date").textContent = (now.getMonth() + 1) + "月" + now.getDate() + "日 · " + weekdays[now.getDay()]; }
  $("#home-events").innerHTML = state.events.slice(0, 3).map((item) => eventCard(item, true)).join("");
}
function renderActivities() {
  const filters = [{ value: "全部", label: "全部" }, { value: "热门", label: "热门" }, { value: "运动", label: "运动" }, { value: "文化", label: "文化" }, { value: "兴趣", label: "兴趣" }];
  const matches = (item, filter) => filter === "全部" || filter === "热门" && item.status === "open" || filter === "运动" && /运动|舞蹈/.test(item.type) || filter === "文化" && /聊天/.test(item.type) || filter === "兴趣" && /棋类/.test(item.type);
  $("#event-filters").innerHTML = filters.map((filter) => '<button class="filter ' + (selectedFilter === filter.value ? "selected" : "") + '" data-filter="' + escapeHtml(filter.value) + '">' + escapeHtml(filter.label) + '</button>').join("");
  const events = state.events.filter((item) => matches(item, selectedFilter));
  $("#all-events").innerHTML = events.map((item) => eventCard(item, false)).join("");
}
function renderGroups() {
  const joinedGroups = state.joinedGroups || [];
  $("#groups-list").innerHTML = state.groups.map((group) => { const joined = joinedGroups.includes(group.id); return '<button class="group-card" data-group-id="' + escapeHtml(group.id) + '"><span class="group-icon">' + escapeHtml(group.icon) + '</span><span><strong>' + escapeHtml(group.title) + '</strong><small>' + escapeHtml(group.next) + '</small></span><span class="group-status">' + (joined ? '已加入' : '加入') + '</span></button>'; }).join("");
}
function renderFamily() {
  const contact = $(".contact-card");
  if (contact) { const avatar = contact.querySelector(".contact-avatar"); const name = contact.querySelector("strong"); const status = contact.querySelector(".status-dot"); const note = contact.querySelector("small"); if (avatar) avatar.textContent = "联"; if (name) name.textContent = "示例联系人"; if (note) note.textContent = "本机演示联系人 · 未真实连接"; if (status) status.textContent = "演示状态"; }
  $("#message-history").innerHTML = state.messages.slice(-4).map((message) => '<div class="message-bubble ' + (message.incoming ? "incoming" : "outgoing") + '"><small>' + escapeHtml(message.name) + ' · ' + escapeHtml(message.time) + '</small><p>' + escapeHtml(message.text) + '</p></div>').join("");
}
function renderCompanion() {
  const companion = state.profile.companion;
  $("#companion-name").value = companion.name;
  $("#companion-memory").value = companion.memory || "";
  $("#editor-face").textContent = (companion.name || "老伴").slice(0, 1);
  if ($("#companion-space-name")) $("#companion-space-name").textContent = companion.name || "老伴";
  if ($("#companion-space-memory")) $("#companion-space-memory").textContent = "“" + (companion.memory || "慢慢来，我会陪你。") + "”";
}
function renderSafety() {
  $("#checkin-history").innerHTML = state.checkins.slice(0, 3).map((item) => '<div class="checkin-row"><span>✓</span><div><strong>' + escapeHtml(item.type) + '</strong><small>' + escapeHtml(item.place) + ' · ' + escapeHtml(item.time) + '</small></div><em>' + escapeHtml(item.status) + '</em></div>').join("");
}
function renderNotifications() {
  const rows = state.notifications.length ? state.notifications : [{ text: "还没有新的记录，完成一个动作后会显示在这里。", time: "现在", kind: "info" }];
  $("#notification-list").innerHTML = rows.map((item) => '<div class="notification-row"><span>' + (item.kind === "safety" ? "安" : item.kind === "message" ? "字" : item.kind === "group" ? "群" : "伴") + '</span><div><strong>' + escapeHtml(item.text) + '</strong><small>' + escapeHtml(item.time) + '</small></div></div>').join("");
  $("#notification-count").hidden = !state.notifications.length;
}
function renderRoute(view) {
  if (view === "home") renderHome();
  if (view === "activities") renderActivities();
  if (view === "groups") renderGroups();
  if (view === "family") renderFamily();
  if (view === "companion") renderCompanion();
  if (view === "safety") renderSafety();
  if (view === "notifications") renderNotifications();
  if (view === "mine") renderHome();
}
function openEvent(id) {
  const item = state.events.find((event) => event.id === id);
  if (!item) return;
  const full = item.seats.includes("满");
  $("#event-detail").innerHTML = '<p class="kicker">活动详情 · 演示数据</p><h2>' + escapeHtml(item.icon) + ' ' + escapeHtml(item.title) + '</h2><div class="detail-list"><div><span>时间</span><b>' + escapeHtml(item.time) + '</b></div><div><span>地点</span><b>' + escapeHtml(item.place) + '</b></div><div><span>组织者</span><b>' + escapeHtml(item.host) + '</b></div><div><span>适合</span><b>' + escapeHtml(item.desc) + '</b></div></div><p class="demo-copy">当前是功能版演示，未连接真实社区、报名或导航。</p><button class="button ' + (full ? "secondary" : "primary") + ' wide" data-action="prepare-join" data-id="' + escapeHtml(item.id) + '" ' + (full ? "disabled" : "") + '>' + (full ? "名额已满" : state.joined.includes(item.id) ? "已记下参加意愿" : "我想参加") + '</button>';
  drawerReturnFocus = document.activeElement;
  $("#event-drawer").hidden = false;
  $("#event-drawer .close-button").focus();
}
function prepareEventJoin(id) {
  const item = state.events.find((event) => event.id === id);
  if (!item) return;
  $("#event-detail").innerHTML = '<p class="kicker">请确认 · 功能版演示</p><h2>你要记下这个活动吗？</h2><div class="confirm-card"><strong>' + escapeHtml(item.icon) + ' ' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.time) + '</span><span>' + escapeHtml(item.place) + '</span></div><p class="demo-copy">确认后只会在本机记录参加意愿，不会真实报名或通知任何人。</p><div class="confirm-actions"><button class="button secondary" data-action="close-drawer">算了</button><button class="button primary" data-action="join-event" data-id="' + escapeHtml(item.id) + '">确认记下</button></div>';
}
async function refresh() {
  state = await request("/api/state");
  if (state.profile.setupComplete) { $("#setup-view").hidden = true; $("#app").hidden = false; renderRoute(route); }
  else { $("#setup-view").hidden = false; $("#app").hidden = true; }
}
async function saveProfile(form) {
  const data = Object.fromEntries(new FormData(form));
  data.modes = $$('input[name="mode"]:checked').map((item) => item.value);
  data.interests = $$('input[name="interest"]:checked').map((item) => item.value);
  state = await request("/api/profile", { method: "POST", body: JSON.stringify(data) });
  toast("已经记住了，可以随时修改");
  await refresh();
}
document.addEventListener("click", async (event) => {
  const routeButton = event.target.closest("[data-route]");
  const action = event.target.closest("[data-action]");
  const eventButton = event.target.closest("[data-event-id]");
  const filter = event.target.closest("[data-filter]");
    const message = event.target.closest("[data-message]");
    const companionName = event.target.closest("[data-companion-name]");
    const groupButton = event.target.closest("[data-group-id]");
  try {
    if (routeButton) { showRoute(routeButton.dataset.route); return; }
    if (filter) { selectedFilter = filter.dataset.filter; renderActivities(); return; }
    if (eventButton && !action) { openEvent(eventButton.dataset.eventId); return; }
    if (message) { $("#message-input").value = message.dataset.message; $("#message-input").focus(); return; }
    if (companionName) { $("#companion-name").value = companionName.dataset.companionName; return; }
    if (groupButton) { state = await request("/api/join-group", { method: "POST", body: JSON.stringify({ groupId: groupButton.dataset.groupId }) }); toast("已记下加入意愿，当前是演示状态"); renderGroups(); renderNotifications(); return; }
    if (!action) return;
    if (action.dataset.action === "close-drawer") { $("#event-drawer").hidden = true; if (drawerReturnFocus && drawerReturnFocus.focus) drawerReturnFocus.focus(); return; }
    if (action.dataset.action === "prepare-join") { prepareEventJoin(action.dataset.id); return; }
    if (action.dataset.action === "font") { document.documentElement.classList.toggle("large-type"); toast("已切换文字大小"); return; }
    if (action.dataset.action === "reset") { state = await request("/api/reset", { method: "POST", body: "{}" }); toast("演示数据已重置"); await refresh(); return; }
    if (action.dataset.action === "join-event") { action.disabled = true; action.classList.add("is-loading"); try { state = await request("/api/join-event", { method: "POST", body: JSON.stringify({ eventId: action.dataset.id }) }); $("#event-drawer").hidden = true; toast("已记下参加意愿，当前是演示状态"); renderRoute(route); renderNotifications(); } finally { action.disabled = false; action.classList.remove("is-loading"); } return; }
    if (action.dataset.action === "send-message") { const input = $("#message-input"); const text = input.value.trim(); if (!text) return toast("先选一句或写几个字"); action.disabled = true; action.classList.add("is-loading"); try { state = await request("/api/message", { method: "POST", body: JSON.stringify({ text }) }); input.value = ""; toast("文字卡已准备好，演示中未真实发送"); renderFamily(); renderNotifications(); } finally { action.disabled = false; action.classList.remove("is-loading"); } return; }
    if (action.dataset.action === "save-companion") { action.disabled = true; action.classList.add("is-loading"); try { state = await request("/api/companion", { method: "POST", body: JSON.stringify({ name: $("#companion-name").value || "老伴", memory: $("#companion-memory").value }) }); toast("陪伴形象已保存"); renderCompanion(); renderHome(); renderNotifications(); } finally { action.disabled = false; action.classList.remove("is-loading"); } return; }
    if (action.dataset.action === "companion-talk") { showRoute("companion"); toast("这是陪伴形象演示"); return; }
    if (action.dataset.action === "checkin") { action.disabled = true; action.classList.add("is-loading"); try { state = await request("/api/checkin", { method: "POST", body: JSON.stringify({ type: "到家报平安", place: "松柏社区活动室附近" }) }); toast("已记录一次演示报平安"); renderSafety(); renderNotifications(); } finally { action.disabled = false; action.classList.remove("is-loading"); } return; }
    if (action.dataset.action === "family-help") { showRoute("family"); $("#message-input").value = "我需要家人帮我确认一下位置。"; toast("已准备一张给家人的文字卡"); }
  } catch (error) { toast(error.message || "功能版演示暂时没有回应，请重试"); console.error(error); }
});
$("#setup-form").addEventListener("submit", async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button[type=submit]"); button.disabled = true; button.classList.add("is-loading"); try { await saveProfile(event.currentTarget); } catch (error) { toast(error.message || "设置没有保存成功"); } finally { button.disabled = false; button.classList.remove("is-loading"); } });
$("#ai-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = $("#ai-input").value.trim();
  if (!text) return toast("先说一句，我才能帮你选");
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true; button.classList.add("is-loading");
  try { const result = await request("/api/assist", { method: "POST", body: JSON.stringify({ text }) }); $("#ai-result").hidden = false; $("#ai-result").innerHTML = '<p class="kicker">我先给两个本地规则建议</p><div class="ai-quote">“' + escapeHtml(result.text) + '”</div>' + result.candidates.map((item) => '<button class="ai-option" data-route="' + escapeHtml(item.action) + '"><strong>' + escapeHtml(item.title) + '</strong><small>点这里继续</small></button>').join("") + '<button class="text-link" data-action="clear-ai">都不是，换一句</button>'; } catch (error) { toast(error.message || "本地规则建议暂时没有回应"); } finally { button.disabled = false; button.classList.remove("is-loading"); }
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#event-drawer").hidden) { $("#event-drawer").hidden = true; if (drawerReturnFocus && drawerReturnFocus.focus) drawerReturnFocus.focus(); } });
document.addEventListener("click", (event) => { if (event.target.closest('[data-action="clear-ai"]')) { $("#ai-result").hidden = true; $("#ai-input").value = ""; } });
refresh().catch(() => { $("#setup-view").hidden = false; });
