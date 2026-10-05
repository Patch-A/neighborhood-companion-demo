const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PUBLIC_DIR = path.join(__dirname, "prototype");
const PORT = Number(process.env.PORT || 4173);
const MAX_BODY_BYTES = 32 * 1024;
const sessions = new Map();

const makeState = () => ({
  profile: { setupComplete: false, name: "李奶奶", age: 72, modes: ["看不清小字"], interests: ["棋类", "散步"], companion: { name: "老伴", relation: "我的老伴", tone: "温和、慢一点", memory: "我们以前每天晚饭后一起散步。" } },
  events: [
    { id: "chess", icon: "棋", type: "棋类", title: "下午下象棋", time: "今天 15:00", place: "松柏社区活动室", host: "社区活动员 王阿姨", seats: "还有 6 个位置", status: "open", desc: "适合初学者，可以先坐旁边看看。", group: "下棋搭子" },
    { id: "dance", icon: "舞", type: "舞蹈", title: "晚饭后广场舞", time: "今天 18:30", place: "松柏社区小广场", host: "广场舞小组 李阿姨", seats: "还有 12 个位置", status: "open", desc: "慢节奏，第一次来可以先看看。", group: "晚饭后动一动" },
    { id: "walk", icon: "步", type: "运动", title: "一起散步", time: "明天 08:00", place: "松柏社区南门", host: "邻里小组", seats: "名额已满", status: "full", desc: "约 30 分钟，已经有 8 位邻居参加。", group: "晚饭后动一动" },
    { id: "tea", icon: "茶", type: "聊天", title: "社区茶话会", time: "周五 14:00", place: "松柏社区阅览室", host: "社区志愿者 陈叔叔", seats: "还有 10 个位置", status: "open", desc: "聊聊家常，也可以带自己的故事来。", group: "邻里聊天" }
  ],
  groups: [{ id: "chess-group", icon: "棋", title: "下棋搭子", next: "今天 15:00 有活动" }, { id: "move-group", icon: "步", title: "晚饭后动一动", next: "今天 18:30 广场见" }, { id: "talk-group", icon: "茶", title: "邻里聊天", next: "周五茶话会" }],
  joined: [],
  joinedGroups: [],
  messages: [{ id: "m1", name: "示例联系人", text: "今天吃饭了吗？", time: "今天 11:20", incoming: true }, { id: "m2", name: "老伴陪伴", text: "下午要不要出去走走？慢慢来就好。", time: "今天 09:00", incoming: true }],
  checkins: [], notifications: []
});

function session(req) { const match = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || ""); const sid = match ? match[1] : crypto.randomUUID(); if (!sessions.has(sid)) sessions.set(sid, makeState()); return { sid, state: sessions.get(sid) }; }
function json(res, status, body, sid) { const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }; if (sid) headers["Set-Cookie"] = "sid=" + sid + "; Path=/; HttpOnly; SameSite=Lax"; res.writeHead(status, headers); res.end(JSON.stringify(body)); }
function body(req) { return new Promise((resolve, reject) => { const length = Number(req.headers["content-length"] || 0); if (Number.isFinite(length) && length > MAX_BODY_BYTES) return reject(new Error("body_too_large")); let raw = ""; let settled = false; const fail = (error) => { if (!settled) { settled = true; reject(error); } }; req.on("data", chunk => { raw += chunk; if (Buffer.byteLength(raw) > MAX_BODY_BYTES) fail(new Error("body_too_large")); }); req.on("end", () => { if (settled) return; try { const value = raw ? JSON.parse(raw) : {}; if (!value || typeof value !== "object" || Array.isArray(value)) return fail(new Error("object_required")); settled = true; resolve(value); } catch { fail(new Error("invalid_json")); } }); req.on("error", fail); }); }
function text(value, max = 120) { return typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null; }
const ALLOWED_MODES = new Set(["看不清小字", "听不清语音", "不方便说话", "更习惯手语或文字", "需要家人帮忙"]);
const ALLOWED_INTERESTS = new Set(["棋类", "舞蹈", "散步", "聊天"]);
function validAge(value) { const age = Number(value); return Number.isInteger(age) && age >= 50 && age <= 110 ? age : null; }
function sendFile(req, res) {
  let requested;
  try { requested = decodeURIComponent((req.url || "/").split("?")[0]); } catch { return json(res, 400, { error: "malformed_url" }); }
  const relative = requested === "/" ? "index.html" : requested.replace("/prototype", "").replace(/^\/+/, "") || "index.html";
  const file = path.resolve(PUBLIC_DIR, relative);
  const publicRoot = path.resolve(PUBLIC_DIR);
  const relativeFile = path.relative(publicRoot, file);
  if (relativeFile.startsWith("..") || path.isAbsolute(relativeFile)) return json(res, 403, { error: "forbidden" });
  fs.stat(file, (error, info) => {
    if (error || !info.isFile()) return json(res, 404, { error: "not_found" });
    const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" }[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" }); fs.createReadStream(file).pipe(res);
  });
}
async function api(req, res, url, current) {
  const { state, sid } = current;
  if (req.method === "GET" && url.pathname === "/api/state") return json(res, 200, state, sid);
  if (req.method !== "POST" && req.method !== "PUT") return json(res, 405, { error: "method_not_allowed" }, sid);
  let data; try { data = await body(req); } catch (error) { return json(res, error.message === "body_too_large" ? 413 : 400, { error: error.message }, sid); }
  if (url.pathname === "/api/profile") { const name = text(data.name, 40); const age = validAge(data.age); const modes = Array.isArray(data.modes) && data.modes.length <= 8 && data.modes.every(item => typeof item === "string" && ALLOWED_MODES.has(item)) ? data.modes.slice(0, 8) : null; const interests = Array.isArray(data.interests) && data.interests.length <= 8 && data.interests.every(item => typeof item === "string" && ALLOWED_INTERESTS.has(item)) ? data.interests.slice(0, 8) : null; if (!name || age === null || !modes || !interests) return json(res, 400, { error: "invalid_profile" }, sid); state.profile = { ...state.profile, name, age, modes, interests, setupComplete: true }; }
  else if (url.pathname === "/api/companion") { const name = text(data.name, 40); const memory = typeof data.memory === "string" && data.memory.length <= 240 ? data.memory.trim() : null; if (!name || memory === null) return json(res, 400, { error: "invalid_companion" }, sid); state.profile.companion = { ...state.profile.companion, name, memory }; }
  else if (url.pathname === "/api/join-event") { const event = state.events.find(item => item.id === data.eventId); if (!event) return json(res, 404, { error: "event_not_found" }, sid); if (event.status !== "open") return json(res, 409, { error: "event_full" }, sid); if (!state.joined.includes(event.id)) state.joined.push(event.id); state.notifications.unshift({ id: crypto.randomUUID(), kind: "activity", text: "已记下你的参加意愿，当前是演示状态。", time: "刚刚" }); }
  else if (url.pathname === "/api/join-group") { const group = state.groups.find(item => item.id === data.groupId); if (!group) return json(res, 404, { error: "group_not_found" }, sid); if (!state.joinedGroups.includes(group.id)) state.joinedGroups.push(group.id); state.notifications.unshift({ id: crypto.randomUUID(), kind: "group", text: "已记下加入兴趣小组的意愿，当前是演示状态。", time: "刚刚" }); }
  else if (url.pathname === "/api/message") { const message = text(data.text, 240); if (!message) return json(res, 400, { error: "message_required" }, sid); state.messages.push({ id: crypto.randomUUID(), name: "我", text: message, time: "刚刚", incoming: false }); state.messages.push({ id: crypto.randomUUID(), name: "示例联系人（演示回复）", text: "我看到了，晚一点和你说。", time: "刚刚", incoming: true }); state.notifications.unshift({ id: crypto.randomUUID(), kind: "message", text: "文字卡已准备好，并显示一条本机模拟回复。", time: "刚刚" }); }
  else if (url.pathname === "/api/checkin") { state.checkins.unshift({ id: crypto.randomUUID(), type: "到家报平安", place: "松柏社区活动室附近", time: "刚刚", status: "演示：已记录" }); state.notifications.unshift({ id: crypto.randomUUID(), kind: "safety", text: "已记录一次演示报平安。", time: "刚刚" }); }
  else if (url.pathname === "/api/assist") { const input = text(data.text, 240); if (!input) return json(res, 400, { error: "assist_text_required" }, sid); const candidates = []; if (/棋|下下|象棋/.test(input)) candidates.push({ title: "看看附近的下棋活动", action: "activities" }); if (/家|女儿|儿子|说话|联系/.test(input)) candidates.push({ title: "做一张话给家人的文字卡", action: "family" }); if (/走|散步|舞|运动|出去/.test(input)) candidates.push({ title: "看看附近的活动", action: "activities" }); if (!candidates.length) candidates.push({ title: "把这句话交给家人看看", action: "family" }, { title: "请社区联系人帮我看看", action: "safety" }); return json(res, 200, { provider: "local-rule", fallback: true, text: input, candidates: candidates.slice(0, 2) }, sid); }
  else if (url.pathname === "/api/reset") { sessions.set(sid, makeState()); return json(res, 200, sessions.get(sid), sid); }
  else return json(res, 404, { error: "unknown_endpoint" }, sid);
  return json(res, 200, state, sid);
}
const server = http.createServer((req, res) => { let url; try { url = new URL(req.url || "/", "http://localhost"); } catch { return json(res, 400, { error: "malformed_url" }); } const current = session(req); if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "neighborhood-companion-demo" }, current.sid); if (url.pathname.startsWith("/api/")) return api(req, res, url, current); return sendFile(req, res); });
server.listen(PORT, "127.0.0.1", () => console.log("邻里有伴功能版运行中: http://localhost:" + PORT + "/"));
