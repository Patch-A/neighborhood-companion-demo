import type {FamilySnapshot,FamilyMessage} from './picture-cards';
export function demoSnapshot(viewer='demo-elder'):FamilySnapshot{
  return {viewer:{userId:viewer},household:{id:'demo',name:'示例家庭',ownerId:'demo-family',cardsReviewed:true},
    members:[{userId:'demo-family',role:'family',name:'示例家人',avatarId:null},{userId:'demo-elder',role:'elder',name:'示例老人',avatarId:null}],
    messages:[],aiAvailable:false,retentionDays:30};
}
export function demoMessage(sender:string,recipient:string,cards:FamilyMessage['cards'],text:string,replyTo:string|null,clientId:string):FamilyMessage{
  return {id:crypto.randomUUID(),senderId:sender,recipientId:recipient,cards,text,replyTo,clientId,mediaIds:[],media:[],
    sentAt:new Date().toISOString(),receivedAt:null,openedAt:null,withdrawnAt:null};
}
