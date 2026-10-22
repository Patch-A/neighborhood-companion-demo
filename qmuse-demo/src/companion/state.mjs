import {CARDS} from './cards.mjs';
export const ROLES={elder:{name:'示例老人',other:'family'},family:{name:'示例女儿',other:'elder'}};
export function emptyDraft(){return {cards:[],text:'',photo:null,replyTo:null,ai:false,reviewed:false,consent:false};}
export function freshState(){return {version:1,role:'elder',messages:[],drafts:{elder:emptyDraft(),family:emptyDraft()},large:false};}
export function validateCards(value){
  if(!Array.isArray(value)||value.length>3||!value.every(id=>CARDS.some(c=>c.id===id)))throw Error('请选择最多三张已有图卡。');
  return [...new Set(value)];
}
export function restoredState(raw,now=Date.now()){
  const value=JSON.parse(raw);if(value?.version!==1||!ROLES[value.role]||!Array.isArray(value.messages)||value.messages.length>60)throw Error('旧演示记录无法读取。');
  const state=freshState();state.role=value.role;state.large=value.large===true;
  state.messages=value.messages.filter(m=>m&&typeof m.id==='string'&&ROLES[m.sender]&&ROLES[m.recipient]&&m.sender!==m.recipient&&typeof m.text==='string'&&m.text.length<=500&&Number.isFinite(m.sentAt)&&m.sentAt<=now&&now-m.sentAt<86400000).map(m=>({...m,cards:validateCards(m.cards),photo:validPhoto(m.photo)?m.photo:null,opened:m.opened===true,withdrawn:m.withdrawn===true}));
  for(const role of ['elder','family']){
    const draft=value.drafts?.[role];if(!draft||typeof draft.text!=='string'||draft.text.length>500)continue;
    state.drafts[role]={...emptyDraft(),cards:validateCards(draft.cards),text:draft.text,photo:validPhoto(draft.photo)?draft.photo:null,replyTo:typeof draft.replyTo==='string'?draft.replyTo:null,ai:draft.ai===true,reviewed:false};
  }
  return state;
}
export function validPhoto(value){return typeof value==='string'&&value.length<=600000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);}
export function addMessage(state,id,now=Date.now()){
  if(state.messages.length>=60)throw Error('演示已有60条消息，请先重置演示再继续。');
  const draft=state.drafts[state.role],cards=validateCards(draft.cards);
  if(!cards.length&&!draft.text.trim()&&!draft.photo)throw Error('请先选图卡、添加示例文字或照片。');
  if(draft.ai&&!draft.reviewed)throw Error('请先检查 AI 图卡含义，再确认发送。');
  if(draft.photo&&!validPhoto(draft.photo))throw Error('照片无法读取，请重新选择。');
  const next={...state,messages:[{id,sender:state.role,recipient:ROLES[state.role].other,cards,text:draft.text,photo:draft.photo,replyTo:draft.replyTo,sentAt:now,opened:false,withdrawn:false},...state.messages],drafts:{...state.drafts,[state.role]:emptyDraft()}};
  return next;
}
export function messageStatus(m){return m.withdrawn?'演示已撤回':m.opened?'示例对方已打开 · 不代表理解':'已存本页 · 等切换示例对方查看';}
