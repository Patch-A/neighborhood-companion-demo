import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {FamilyError,RETENTION_DAYS,MAX_MEDIA_BYTES,type FamilyRole,type FamilyMessage,type FamilyMember,type FamilySnapshot} from './picture-cards';

export function database(): D1Database {
  if (!env.DB) throw new FamilyError('家庭记录服务暂时不可用，请稍后重试。',503);
  return env.DB;
}
export function bucket(): R2Bucket {
  if (!env.BUCKET) throw new FamilyError('照片与语音服务尚未就绪，请先使用图卡。',503);
  return env.BUCKET;
}
export function okay(data: unknown, status = 200) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function failed(error: unknown,request?:Request) {
  // Drain small rejected bodies without buffering them. Cancelling an unread
  // upstream stream can stall the following request in the local Worker runtime.
  if(request?.body&&!request.body.locked){const reader=request.body.getReader();let discarded=0;
    try{for(;;){const part=await reader.read();if(part.done)break;discarded+=part.value.length;
      if(discarded>MAX_MEDIA_BYTES){void reader.cancel().catch(()=>{});break;}}}catch{}finally{reader.releaseLock();}}
  // Never log raw user input, recording, model response or credentials.
  if (!(error instanceof FamilyError)) console.error('Family operation failed',error instanceof Error?{name:error.name,frames:error.stack?.split('\n').slice(1,4)}:{name:'UnknownError'});
  return okay({error: error instanceof FamilyError ? error.message : '暂时没有完成，请重试。'},error instanceof FamilyError ? error.status : 503);
}
export async function identity() {
  const user = await getChatGPTUser();
  if (!user) throw new FamilyError('请先登录，再设置或加入家庭。',401);
  return user.userId;
}
export type Context = {userId: string; householdId: string; ownerId: string; role: FamilyRole; cardsReviewed: boolean; state: string};
export async function context(allowDeleting = false): Promise<Context> {
  const userId = await identity();
  const row = await database().prepare(`SELECT m.household_id,m.role,h.owner_id,h.cards_reviewed,h.state
    FROM family_members m JOIN family_households h ON h.id=m.household_id WHERE m.user_id=?`).bind(userId)
    .first<{household_id: string; role: FamilyRole; owner_id: string; cards_reviewed: number; state: string}>();
  if (!row) throw new FamilyError('请先让家人设置，或用邀请链接加入家庭。',403);
  if (row.state !== 'active' && !allowDeleting) throw new FamilyError('家庭资料正在清理，请设置家庭的家人重试删除。',409);
  return {userId,householdId:row.household_id,role:row.role,ownerId:row.owner_id,cardsReviewed:!!row.cards_reviewed,state:row.state};
}
export function familyOnly(ctx: Context) {
  if (ctx.role !== 'family') throw new FamilyError('请让家人完成这个设置。',403);
}
export function ownerOnly(ctx: Context) {
  if (ctx.userId !== ctx.ownerId) throw new FamilyError('只有设置这个家庭的家人能完成此操作。',403);
}
export async function hashToken(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function cleanup(householdId: string) {
  const db=database();
  const now=Date.now();
  const cutoff=new Date(now-RETENTION_DAYS*86400000).toISOString();
  const draftCutoff=new Date(now-86400000).toISOString();
  await db.prepare('DELETE FROM family_messages WHERE household_id=? AND sent_at<?').bind(householdId,cutoff).run();
  await db.prepare('DELETE FROM family_feedback WHERE household_id=? AND created_at<?').bind(householdId,cutoff).run();
  await db.prepare('DELETE FROM family_invites WHERE household_id=? AND expires_at<?').bind(householdId,new Date(now).toISOString()).run();
  const rows=await db.prepare(`SELECT id FROM family_media WHERE household_id=? AND
    (state='deleting' OR (state='staged' AND created_at<?) OR (state='sent' AND created_at<?)) LIMIT 12`)
    .bind(householdId,draftCutoff,cutoff).all<{id:string}>();
  if (!env.BUCKET) return;
  for (const row of rows.results) {
    await db.prepare("UPDATE family_media SET state='deleting' WHERE id=?").bind(row.id).run();
    try {
      await bucket().delete(`${householdId}/${row.id}`);
      await db.prepare('DELETE FROM family_media WHERE id=? AND household_id=?').bind(row.id,householdId).run();
    } catch { /* Tombstone denies access immediately; subsequent cleanup retries physical deletion. */ }
  }
}
type MessageRow = {
  id:string;sender_id:string;recipient_id:string;client_key:string;cards:string;text:string;media_ids:string;
  reply_to:string|null;sent_at:string;received_at:string|null;opened_at:string|null;withdrawn_at:string|null;
};
export async function snapshot(): Promise<FamilySnapshot> {
  const user=await getChatGPTUser();
  const base: FamilySnapshot={viewer:user?{userId:user.userId}:null,household:null,members:[],messages:[],aiAvailable:!!(env.FAMILY_AI_API_KEY&&env.FAMILY_AI_BASE_URL&&env.FAMILY_AI_MODEL),aiProvider:env.FAMILY_AI_BASE_URL?.startsWith('https://api.deepseek.com')?'DeepSeek':'配置的模型服务',retentionDays:RETENTION_DAYS};
  if (!user) return base;
  const row=await database().prepare(`SELECT h.* FROM family_members m JOIN family_households h ON h.id=m.household_id WHERE m.user_id=?`)
    .bind(user.userId).first<{id:string;name:string;owner_id:string;cards_reviewed:number;state:string}>();
  if (!row) return base;
  if (row.state !== 'active') throw new FamilyError('家庭资料正在清理，请设置家庭的家人重试删除。',409);
  await cleanup(row.id);
  const members=await database().prepare('SELECT user_id,name,role,avatar_id FROM family_members WHERE household_id=? ORDER BY role,name')
    .bind(row.id).all<{user_id:string;name:string;role:FamilyRole;avatar_id:string|null}>();
  const rows=await database().prepare(`SELECT * FROM family_messages WHERE household_id=? AND (sender_id=? OR recipient_id=?) ORDER BY sent_at DESC,id DESC LIMIT 50`)
    .bind(row.id,user.userId,user.userId).all<MessageRow>();
  const media=await database().prepare("SELECT id,kind FROM family_media WHERE household_id=? AND state='sent'")
    .bind(row.id).all<{id:string;kind:'image'|'audio'}>();
  const messages: FamilyMessage[]=rows.results.map(m=>{
    const mediaIds=m.withdrawn_at?[]:JSON.parse(m.media_ids) as string[];
    return {id:m.id,senderId:m.sender_id,recipientId:m.recipient_id,clientId:m.client_key.split(':').at(-1)!,
      cards:m.withdrawn_at?[]:JSON.parse(m.cards),text:m.withdrawn_at?'':m.text,mediaIds,
      replyTo:m.reply_to,sentAt:m.sent_at,receivedAt:m.received_at,openedAt:m.opened_at,withdrawnAt:m.withdrawn_at,
      media:media.results.filter(x=>mediaIds.includes(x.id))};
  });
  return {...base,household:{id:row.id,name:row.name,ownerId:row.owner_id,cardsReviewed:!!row.cards_reviewed},
    members:members.results.map(m=>({userId:m.user_id,name:m.name,role:m.role,avatarId:m.avatar_id}) as FamilyMember),messages};
}
export async function canReadMedia(ctx: Context,id: string) {
  const item=await database().prepare("SELECT * FROM family_media WHERE id=? AND household_id=? AND state!='deleting'")
    .bind(id,ctx.householdId).first<{id:string;owner_id:string;kind:'image'|'audio';mime:string;bytes:number;state:string;created_at:string}>();
  if (!item) throw new FamilyError('这份照片或语音已移除，或你没有访问权限。',404);
  if (item.state==='avatar') return item;
  const lifetime=item.state==='staged'?86400000:RETENTION_DAYS*86400000;
  if (Date.now()-Date.parse(item.created_at)>lifetime) throw new FamilyError('附件保存期限已过，请重新发送。',410);
  if (item.owner_id===ctx.userId) return item;
  const rows=await database().prepare(`SELECT media_ids FROM family_messages WHERE household_id=? AND withdrawn_at IS NULL AND (sender_id=? OR recipient_id=?)`)
    .bind(ctx.householdId,ctx.userId,ctx.userId).all<{media_ids:string}>();
  if (!rows.results.some(r=>(JSON.parse(r.media_ids) as string[]).includes(id))) throw new FamilyError('你没有访问这份附件的权限。',404);
  return item;
}
