import {CareError} from './care-errors';
import {HELP_TYPES,type CareState,type HelpRisk,type HelpType,type MediaRef,type Role} from './care-data';

export const HELP_ACTIONS = ['create-help','family-view','family-accept','family-decline','family-forward','volunteer-accept','arrange-help','complete-help','confirm-help','not-resolved','cancel-help','reply-help'];
export function optionalText(value:unknown,max:number){
  if(value===undefined||value===null||value==='')return '';
  if(typeof value!=='string'||value.length>max)throw new CareError(`内容最多填写 ${max} 字。`);
  return value.trim();
}
export function mediaRefs(value:unknown):MediaRef[]{
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>4)throw new CareError('最多添加 3 张照片和 1 段语音。');
  const refs=value.map((raw:unknown)=>{
    if(!raw||typeof raw!=='object')throw new CareError('附件信息不完整。');
    const x=raw as Record<string,unknown>;
    if(typeof x.id!=='string'||!/^local-[a-f\d-]{36}$/.test(x.id))throw new CareError('附件标识不正确。');
    if(x.kind!=='image'&&x.kind!=='audio')throw new CareError('只支持照片或语音。');
    if(typeof x.mime!=='string'||!(x.kind==='image'?/^image\/(jpeg|png|webp)$/:/^audio\/(webm|mp4|ogg)(;.*)?$/).test(x.mime))throw new CareError('附件格式暂不支持。');
    if(typeof x.size!=='number'||!Number.isInteger(x.size)||x.size<=0||x.size>8*1024*1024)throw new CareError('每个附件需小于 8 MB。');
    return {id:x.id,kind:x.kind,mime:x.mime,name:optionalText(x.name,80)||'本机附件',size:x.size} as MediaRef;
  });
  if(refs.filter(x=>x.kind==='image').length>3||refs.filter(x=>x.kind==='audio').length>1||new Set(refs.map(x=>x.id)).size!==refs.length)throw new CareError('最多添加 3 张照片和 1 段语音，请勿重复添加。');
  return refs;
}
function clientId(value:unknown){if(typeof value!=='string'||! /^[a-f\d-]{36}$/.test(value))throw new CareError('操作标识不完整，请重新打开后重试。');return value;}
function riskFor(data:Record<string,unknown>,description:string):HelpRisk{
  if(data.payment==='yes'||data.distant==='yes'||data.risk==='high'||/转账|付款|付费|支付|旅游|远途|银行卡|验证码/.test(description))return 'high';
  if(data.payment!=='no'||data.distant!=='no'||data.type==='帮我办点事')return 'medium';
  return 'low';
}
function requireRole(actor:Role,roles:Role[]){if(!roles.includes(actor))throw new CareError('请切换到对应的演示角色再操作。',403);}
export function applyHelpAction(state:CareState,data:Record<string,unknown>,time:string):void{
  const action=String(data.action);
  if(!HELP_ACTIONS.includes(action))throw new CareError('不支持这个求助操作。',404);
  if(!['elder','family','volunteer'].includes(String(data.actor)))throw new CareError('请选择演示角色。');
  const actor=data.actor as Role;
  const notify=(message:string)=>{state.notifications.unshift({id:crypto.randomUUID(),kind:'help',text:`演示记录：${message}`,time});state.notifications=state.notifications.slice(0,100);};
  if(action==='create-help'){
    requireRole(actor,['elder']);const cid=clientId(data.clientId);
    if(state.requests.some(x=>x.clientId===cid))return;
    if(!HELP_TYPES.includes(data.type as HelpType))throw new CareError('请选择求助类型。');
    const media=mediaRefs(data.media);const description=optionalText(data.description,240);
    if(!description&&!media.length)throw new CareError('说一句话、添加照片或填写文字后再保存。');
    state.requests.unshift({id:crypto.randomUUID(),clientId:cid,type:data.type as HelpType,title:optionalText(data.title,80)||String(data.type),icon:media.some(x=>x.kind==='image')?'看':'帮',description:description|| (media.some(x=>x.kind==='audio')?'我用语音说了这次需要。':'请帮我看看这张照片。'),media,replies:[],createdAt:time,updatedAt:time,status:'pending_family',risk:riskFor(data,description),place:'位置未分享',schedule:optionalText(data.schedule,80),createdBy:'elder',createdByName:state.profile.name,familyApproved:false,source:'user'});
    notify('求助已保存，尚未通知真实家人');return;
  }
  const item=state.requests.find(x=>x.id===data.requestId);if(!item)throw new CareError('没有找到这条求助。',404);
  const check=(statuses:string[])=>{if(!statuses.includes(item.status))throw new CareError('这条求助的状态已变化，请查看最新记录。',409);};
  switch(action){
    case 'family-view':requireRole(actor,['family']);check(['pending_family','family_declined','not_resolved']);item.familyViewedAt=time;notify('家人演示角色已查看，还没有接下');break;
    case 'family-accept':requireRole(actor,['family']);check(['pending_family','family_declined','not_resolved']);item.status='family_accepted';item.familyViewedAt=time;item.familyApproved=true;item.familyMessage=optionalText(data.message,120)||'我来处理，接下来会与你确认安排。';notify('家人演示角色已接下');break;
    case 'family-decline':requireRole(actor,['family']);check(['pending_family','family_accepted','family_declined','not_resolved']);item.status='family_declined';item.familyApproved=false;item.familyMessage='我暂时没空，可以稍后处理或确认后转派。';notify('家人演示角色暂时没空，求助仍未结束');break;
    case 'family-forward':requireRole(actor,['family']);check(['family_accepted','family_declined','not_resolved']);if(item.risk==='high')throw new CareError('涉及远途、付费或敏感事项，不能转派义工。',403);if(data.riskChecked!==true)throw new CareError('请先确认已核对任务内容和风险。');item.familyApproved=true;item.status='family_forwarded';notify('模拟转给验证义工，未联系真实义工');break;
    case 'volunteer-accept':requireRole(actor,['volunteer']);check(['family_forwarded']);item.status='volunteer_accepted';item.volunteerName='陈叔叔 · 示例义工（未真实验证）';notify('义工演示角色已接下');break;
    case 'arrange-help':requireRole(actor,['family','volunteer']);check(actor==='volunteer'?['volunteer_accepted']:['family_accepted','volunteer_accepted']);{const schedule=optionalText(data.schedule,80);if(!schedule)throw new CareError('请填写或用语音回复说明安排，再记下约定时间。');item.schedule=schedule;item.status='arranged';notify('已记录安排，尚未实际通知');}break;
    case 'complete-help':requireRole(actor,['family','volunteer']);check(actor==='volunteer'?['volunteer_accepted','arranged']:['family_accepted','volunteer_accepted','arranged']);if(actor==='volunteer'&&!item.volunteerName)throw new CareError('这条求助不是义工任务。',403);item.status='awaiting_confirmation';notify('已标记处理完成，仍需老人确认');break;
    case 'confirm-help':requireRole(actor,['elder']);check(['awaiting_confirmation']);item.status='completed';item.resolvedAt=time;notify('老人演示角色确认已经解决');break;
    case 'not-resolved':requireRole(actor,['elder']);check(['awaiting_confirmation','arranged']);item.status='not_resolved';item.familyApproved=false;notify('老人反馈还没解决，家人可重新接下');break;
    case 'cancel-help':requireRole(actor,['elder']);check(['pending_family','family_accepted','family_declined','family_forwarded','volunteer_accepted','arranged','not_resolved']);item.status='cancelled';notify('求助已撤销');break;
    case 'reply-help':{
      check(['pending_family','family_accepted','family_declined','family_forwarded','volunteer_accepted','arranged','awaiting_confirmation','not_resolved']);
      if(actor==='volunteer'&&!item.volunteerName)throw new CareError('请先接下家人转派的任务。',403);
      const cid=clientId(data.clientId);if(item.replies?.some(x=>x.clientId===cid))return;
      const text=optionalText(data.text,240);const media=mediaRefs(data.media);if(!text&&!media.length)throw new CareError('先说一句话或填写回复。');
      item.replies=[...(item.replies||[]),{id:crypto.randomUUID(),clientId:cid,role:actor,text,media,time}].slice(-30);notify('已保存回复（仅演示，附件仅在本机）');break;
    }
  }
  item.updatedAt=time;
}
