import {CARD_IMAGES} from './images';
import {CARDS} from './cards.mjs';
import {ROLES,freshState,restoredState,emptyDraft,addMessage,messageStatus,validateCards} from './state.mjs';
export function mountCompanion(api){
let alive=true;
const $=id=>document.getElementById(id),KEY='companion-qmuse-demo-v1';
let state=freshState(),busy=false,photoBusy=false,token='',aiAvailable=false,used=0,activeMessage=null,photoGeneration=0;
try{const saved=sessionStorage.getItem(KEY);if(saved)state=restoredState(saved);}catch{notice('旧演示内容无法恢复，已打开新演示。');}
const draft=()=>state.drafts[state.role];
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
function error(text){$('error').textContent=text;$('error').hidden=!text;}
function save(){try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{notice('浏览器空间不足或不允许保存；内容仍在本页，刷新会丢失。可移除照片后再试。');}}
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function cardPreview(id){const card=CARDS.find(c=>c.id===id),node=element('span',undefined,'card-preview'),img=element('img');img.src=CARD_IMAGES[id];img.alt=card.hint;node.append(img,element('span',card.label));return node;}
function button(text,action){const b=element('button',text);b.type='button';b.disabled=busy||photoBusy;b.addEventListener('click',action);return b;}
function refreshSelection(){
  const d=draft();$('selection').replaceChildren(...d.cards.map(cardPreview));if(!d.cards.length)$('selection').append(element('p',d.photo?'已添加一张本机照片。':'还没有选图卡。','help'));
  $('original').hidden=!d.text.trim();$('original').textContent=`原文保留：${d.text}`;
  $('review-box').hidden=!d.ai;$('review').checked=d.reviewed;
  $('send').disabled=busy||photoBusy||(!d.cards.length&&!d.text.trim()&&!d.photo)||(d.ai&&!d.reviewed);
  $('clear-draft').disabled=busy||photoBusy;
  $('reply-note').hidden=!d.replyTo;$('reply-note').textContent='正在回应刚才的示例消息。';
  for(const node of $('card-grid').children){const selected=d.cards.includes(node.dataset.card);node.setAttribute('aria-pressed',String(selected));node.disabled=busy||photoBusy||(!selected&&d.cards.length>=3);node.querySelector('.selected-mark').hidden=!selected;}
  $('suggest').disabled=busy||photoBusy||!aiAvailable||!d.text.trim()||!d.consent;
  $('text-count').textContent=`${d.text.length} / 500 字`;
}
function render(){
  const me=ROLES[state.role],d=draft();document.documentElement.classList.toggle('large',state.large);
  $('large').textContent=state.large?'恢复字号':'字大一点';$('large').setAttribute('aria-pressed',String(state.large));
  for(const b of document.querySelectorAll('[data-role]')){b.setAttribute('aria-pressed',String(b.dataset.role===state.role));b.disabled=busy||photoBusy;}
  $('recipient').textContent=`${me.name} · 想和${ROLES[me.other].name}联系`;
  $('compose-title').textContent=state.role==='elder'?'想和家人说什么？':'把心意送给家人';$('send').textContent=`确认发给${ROLES[me.other].name}`;
  $('text').value=d.text;$('text').disabled=busy||photoBusy;$('consent').checked=d.consent;$('consent').disabled=busy||photoBusy;$('photo').disabled=busy||photoBusy;$('remove-photo').disabled=busy||photoBusy;
  $('photo-preview').hidden=!d.photo;if(d.photo)$('photo-preview').src=d.photo;else $('photo-preview').removeAttribute('src');$('remove-photo').hidden=!d.photo;
  $('card-grid').replaceChildren(...CARDS.map((card,index)=>{const b=button('',()=>{
    d.cards=d.cards.includes(card.id)?d.cards.filter(x=>x!==card.id):[...d.cards,card.id];d.reviewed=false;save();refreshSelection();
  });b.dataset.card=card.id;b.className=`picture-choice${index>3?' reply-card':''}`;b.setAttribute('aria-label',`${card.label}，${card.hint}`);
    const img=element('img');img.src=CARD_IMAGES[card.id];img.alt='';const mark=element('span','✓ 已选','selected-mark');mark.hidden=true;b.append(img,element('span',card.label),mark);return b;}));
  refreshSelection();renderMessages();
}
function renderMessages(){
  $('message-count').textContent=`${state.messages.length} 条`;
  if(!state.messages.length){const empty=element('div',undefined,'empty'),img=element('img');img.src=CARD_IMAGES.hello;img.alt='挥手打招呼';empty.append(img,element('h3','从一张图卡开始'),element('p','选一张卡发出，再切换到示例对方查看。','help'));$('messages').replaceChildren(empty);return;}
  $('messages').replaceChildren(...state.messages.map(m=>{
    const article=element('article',undefined,'message');article.dataset.message=m.id;
    const heading=element('div',undefined,'message-title');heading.append(element('h3',m.sender===state.role?'我发出的演示消息':`${ROLES[m.sender].name}的演示消息`));
    const time=element('time',new Date(m.sentAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai',hour12:false}));time.dateTime=new Date(m.sentAt).toISOString();heading.append(time);article.append(heading,element('p',messageStatus(m),'message-status'));
    if(m.withdrawn){article.append(element('p','这条演示消息已撤回。','help'));return article;}
    if(m.sender!==state.role&&!m.opened){article.append(button('打开这条演示消息',()=>{m.opened=true;activeMessage=m.id;save();renderMessages();notice('示例消息已打开；打开不代表理解。');}));return article;}
    const cards=element('div',undefined,'selected-cards');cards.append(...m.cards.map(cardPreview));article.append(cards);
    if(m.replyTo)article.append(element('p','这是对上一条演示消息的回应。','help'));
    if(m.text)article.append(element('p',m.text,'message-text'));
    if(m.photo){const img=element('img',undefined,'message-photo');img.src=m.photo;img.alt='仅保存在本页的演示照片';article.append(img);}
    const actions=element('div',undefined,'message-actions');
    if(m.recipient===state.role){actions.append(button('没看懂，请再说说',()=>{
      if(hasDraft()){error('先发送或清空当前未发送内容，再回应这条消息。');return;}
      state.drafts[state.role]={...emptyDraft(),cards:['again'],replyTo:m.id};notice('已选“没看懂”。请在左侧或上方确认发送。');save();render();$('send').focus();
    }),button('选图卡回应',()=>{
      if(hasDraft()){error('先发送或清空当前未发送内容，再开始新的回应。');return;}
      draft().replyTo=m.id;notice('请选图卡或补充照片，再确认回应。');save();render();$('compose-title').scrollIntoView({block:'start'});
    }));}else actions.append(button('撤回这条演示消息',()=>{m.withdrawn=true;m.photo=null;m.text='';m.cards=[];save();renderMessages();notice('已撤回本页演示消息；已经看过的内容无法收回。');}));
    article.append(actions);return article;
  }));
}
function hasDraft(){const d=draft();return d.cards.length||d.text.trim()||d.photo;}
for(const b of document.querySelectorAll('[data-role]'))b.addEventListener('click',()=>{state.role=b.dataset.role;activeMessage=null;error('');notice('已切换示例角色，双方草稿分别保留。');save();render();});
$('large').addEventListener('click',()=>{state.large=!state.large;save();render();});
$('text').addEventListener('input',()=>{const d=draft();d.text=$('text').value;if(d.ai){d.ai=false;d.reviewed=false;d.cards=[];notice('原文已修改，请重新请 AI 建议，或手动选卡。');}d.consent=false;$('consent').checked=false;save();refreshSelection();});
$('consent').addEventListener('change',()=>{draft().consent=$('consent').checked;refreshSelection();});
$('review').addEventListener('change',()=>{draft().reviewed=$('review').checked;save();refreshSelection();});
$('clear-draft').addEventListener('click',()=>{state.drafts[state.role]=emptyDraft();error('');notice('未发送的内容已清空。');save();render();});
$('send').addEventListener('click',()=>{try{state=addMessage(state,crypto.randomUUID());save();error('');notice('已存本页。请切换示例对方，打开消息并回应。');render();}catch(e){error(e.message);}});
$('suggest').addEventListener('click',async()=>{
  busy=true;error('');notice('正在请 DeepSeek 选择图卡，请稍等。');render();$('suggest').textContent='正在建议图卡…';
  const d=draft();
  try{
    const result=await api.suggest(d.text,d.consent);if(!alive)return;
    d.cards=validateCards(result.cards);d.ai=true;d.reviewed=false;used=result.usedToday;notice('AI 候选已放在发送确认区。原文保留，请核对含义后再确认。');save();
  }catch(e){if(alive){error(e.name==='TimeoutError'?'AI 等待超时，原文仍保留，请手动选图卡。':e.message||'暂时无法连接，请手动选图卡。');notice('没有自动发送任何消息。');}}
  finally{if(alive){busy=false;$('suggest').textContent='请 AI 建议图卡';render();await readAiStatus();}}
});
function updateAiStatus(){
  $('ai-status').textContent=aiAvailable?'DeepSeek 已配置 · 只生成候选':'AI 未配置 · 图卡可以直接手选';
  $('ai-help').textContent=aiAvailable?`本服务每日最多50次，同一访客身份每日最多5次、每分钟2次，今天已尝试${used}次；失败及部分限额预留也计入。模型不会接收照片或消息历史，也不会自动发送。`:'作者尚未开放在线 AI；图卡、照片和示例回应仍可体验。未配置时不会用规则冒充 AI。';refreshSelection();
}
$('photo').addEventListener('change',async()=>{
  const file=$('photo').files[0];$('photo').value='';if(!file)return;
  const generation=++photoGeneration;photoBusy=true;render();error('');
  try{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('请选择8 MB以内的 JPG、PNG 或 WebP 照片。');
    const bitmap=await createImageBitmap(file);if(!alive){bitmap.close();return;}
    try{if(bitmap.width*bitmap.height>40000000)throw Error('照片尺寸太大，请换一张较小的图片。');
      const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/jpeg',.75);if(data.length>600000)throw Error('照片仍然太大，请换一张简单、较小的图片。');
      if(generation===photoGeneration){draft().photo=data;save();notice('照片已加入本页草稿，没有上传。');}
    }finally{bitmap.close();}
  }catch(e){error(e.message||'照片打不开，请换一张重试。');}finally{if(alive){photoBusy=false;render();}}
});
$('remove-photo').addEventListener('click',()=>{draft().photo=null;save();render();});
$('reset').addEventListener('click',()=>{if(busy||photoBusy){error('请等待当前处理结束，再重置演示。');return;}$('reset-dialog').showModal();});
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('confirm-reset').addEventListener('click',()=>{state=freshState();activeMessage=null;photoGeneration++;try{sessionStorage.removeItem(KEY);}catch{}error('');notice('演示已清空，可以重新开始。');$('extra').open=false;$('reset-dialog').close();render();});
async function readAiStatus(){try{const status=await api.getStatus();if(!alive)return;token='';aiAvailable=status.aiAvailable;used=status.usedToday;updateAiStatus();}catch{if(!alive)return;aiAvailable=false;refreshSelection();error('QMuse云服务暂时未连接，请刷新或先手动选择图卡。');$('ai-status').textContent='AI 服务未连接';}}
render();void readAiStatus();
return ()=>{alive=false;photoGeneration++;};
}
