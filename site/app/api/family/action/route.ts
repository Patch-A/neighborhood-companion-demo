import {FamilyError,cardIds,cleanText,ids,jsonBody,MAX_HOUSEHOLD_MEMBERS} from '@/lib/picture-cards';
import {context,database,familyOnly,ownerOnly,hashToken,identity,okay,failed,cleanup,bucket} from '@/lib/family-store';

export async function POST(request: Request){try{
  const data=await jsonBody(request);const db=database();const now=new Date().toISOString();
  if(data.action==='create'){
    const userId=await identity();const householdId=crypto.randomUUID();
    const name=cleanText(data.name,40,true);const memberName=cleanText(data.memberName,24,true);
    const existing=await db.prepare('SELECT household_id FROM family_members WHERE user_id=?').bind(userId).first();
    if(existing)throw new FamilyError('你已经加入一个家庭，请先退出或打开现有家庭。',409);
    try{await db.batch([
      db.prepare('INSERT INTO family_households(id,owner_id,name,created_at) VALUES(?,?,?,?)').bind(householdId,userId,name,now),
      db.prepare("INSERT INTO family_members(user_id,household_id,role,name) VALUES(?,?,'family',?)").bind(userId,householdId,memberName),
    ]);}catch{throw new FamilyError('家庭可能已在另一设备创建，请刷新后查看。',409);}
    return okay({created:true});
  }
  if(data.action==='join'){
    const userId=await identity();const token=cleanText(data.token,80,true);const name=cleanText(data.name,24,true);
    const tokenHash=await hashToken(token);
    const invite=await db.prepare(`SELECT i.household_id,i.role FROM family_invites i JOIN family_households h ON h.id=i.household_id
      WHERE i.token_hash=? AND i.used_by IS NULL AND i.expires_at>? AND h.state='active'`)
      .bind(tokenHash,now).first<{household_id:string;role:string}>();
    if(!invite)throw new FamilyError('邀请已失效或已使用，请让家人重新生成。',410);
    if(await db.prepare('SELECT user_id FROM family_members WHERE user_id=?').bind(userId).first())throw new FamilyError('你已加入一个家庭；无需再次加入。',409);
    const result=await db.batch([
      db.prepare(`UPDATE family_invites SET used_by=? WHERE token_hash=? AND used_by IS NULL AND expires_at>?
        AND (SELECT COUNT(*) FROM family_members WHERE household_id=?)<?`)
        .bind(userId,tokenHash,now,invite.household_id,MAX_HOUSEHOLD_MEMBERS),
      db.prepare(`INSERT INTO family_members(user_id,household_id,role,name)
        SELECT ?,household_id,role,? FROM family_invites WHERE token_hash=? AND used_by=?`)
        .bind(userId,name,tokenHash,userId),
    ]);
    if(!result[1].meta.changes)throw new FamilyError('邀请已使用或家庭成员已满，请让家人检查。',409);
    return okay({joined:true});
  }
  const ctx=await context(data.action==='delete-household');
  switch(data.action){
    case 'invite':{
      ownerOnly(ctx);if(!['family','elder'].includes(String(data.role)))throw new FamilyError('请选择邀请对象。');
      const count=await db.prepare('SELECT COUNT(*) AS count FROM family_invites WHERE household_id=? AND used_by IS NULL AND expires_at>?').bind(ctx.householdId,now).first<{count:number}>();
      if((count?.count||0)>=10)throw new FamilyError('已有较多未使用邀请，请先撤销旧邀请。',429);
      const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
      const expires=new Date(Date.now()+48*3600000).toISOString();
      await db.prepare('INSERT INTO family_invites(token_hash,household_id,role,expires_at) VALUES(?,?,?,?)').bind(await hashToken(token),ctx.householdId,data.role,expires).run();
      return okay({token,expiresAt:expires});
    }
    case 'revoke-invites':ownerOnly(ctx);await db.prepare('DELETE FROM family_invites WHERE household_id=? AND used_by IS NULL').bind(ctx.householdId).run();return okay({revoked:true});
    case 'review-cards':{
      familyOnly(ctx);if(typeof data.reviewed!=='boolean')throw new FamilyError('请检查图卡设置。');
      await db.prepare('UPDATE family_households SET cards_reviewed=? WHERE id=? AND state=\'active\'').bind(data.reviewed?1:0,ctx.householdId).run();return okay({saved:true});
    }
    case 'profile':{
      const name=cleanText(data.name,24,true);const avatar=typeof data.avatarId==='string'?data.avatarId:null;
      if(avatar){ids([avatar]);const file=await db.prepare("SELECT id FROM family_media WHERE id=? AND household_id=? AND owner_id=? AND kind='image' AND state IN('staged','avatar')").bind(avatar,ctx.householdId,ctx.userId).first();if(!file)throw new FamilyError('请选择自己上传的照片。');}
      const current=await db.prepare('SELECT avatar_id FROM family_members WHERE user_id=?').bind(ctx.userId).first<{avatar_id:string|null}>();
      const statements=[db.prepare('UPDATE family_members SET name=?,avatar_id=? WHERE user_id=?').bind(name,avatar,ctx.userId)];
      if(avatar)statements.push(db.prepare("UPDATE family_media SET state='avatar' WHERE id=? AND owner_id=?").bind(avatar,ctx.userId));
      if(current?.avatar_id&&current.avatar_id!==avatar)statements.push(db.prepare("UPDATE family_media SET state='deleting' WHERE id=?").bind(current.avatar_id));
      await db.batch(statements);await cleanup(ctx.householdId);return okay({saved:true});
    }
    case 'send':{
      const cards=cardIds(data.cards);const text=cleanText(data.text??'',500);const mediaIds=ids(data.mediaIds??[]);
      const clientId=ids([data.clientId],1)[0];const recipient=cleanText(data.recipientId,120,true);
      if(recipient===ctx.userId)throw new FamilyError('请选择另一位家人。');
      if(!cards.length&&!text&&!mediaIds.length)throw new FamilyError('先选一张图卡或添加照片、语音。');
      if(ctx.role==='elder'&&!ctx.cardsReviewed)throw new FamilyError('请先和家人一起熟悉图卡，家人在设置中确认后即可发送。',409);
      const clientKey=`${ctx.householdId}:${ctx.userId}:${clientId}`;
      const previous=await db.prepare('SELECT id FROM family_messages WHERE client_key=?').bind(clientKey).first<{id:string}>();
      if(previous)return okay({id:previous.id,duplicate:true});
      if(!await db.prepare('SELECT user_id FROM family_members WHERE user_id=? AND household_id=?').bind(recipient,ctx.householdId).first())throw new FamilyError('这位家人不在当前家庭中。',403);
      const files=[];
      for(const id of mediaIds){
        const file=await db.prepare("SELECT id,kind,created_at,state FROM family_media WHERE id=? AND household_id=? AND owner_id=? AND state IN('staged','sent')").bind(id,ctx.householdId,ctx.userId).first<{id:string;kind:string;created_at:string;state:string}>();
        if(!file||Date.now()-Date.parse(file.created_at)>(file.state==='staged'?86400000:30*86400000))throw new FamilyError('附件已失效，请移除后重新添加。',410);files.push(file);
      }
      if(files.filter(f=>f.kind==='image').length>3||files.filter(f=>f.kind==='audio').length>1)throw new FamilyError('最多发送 3 张照片和 1 段语音。');
      const replyTo=typeof data.replyTo==='string'?ids([data.replyTo],1)[0]:null;
      if(replyTo&&!await db.prepare('SELECT id FROM family_messages WHERE id=? AND household_id=? AND recipient_id=? AND sender_id=? AND withdrawn_at IS NULL').bind(replyTo,ctx.householdId,ctx.userId,recipient).first())throw new FamilyError('原消息已撤回或无法回应，请重新选择。',409);
      const id=crypto.randomUUID();
      const results=await db.batch([
        db.prepare(`INSERT OR IGNORE INTO family_messages(id,household_id,sender_id,recipient_id,client_key,cards,text,media_ids,reply_to,sent_at)
          SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM family_messages WHERE household_id=?)<1000
          AND (SELECT COUNT(*) FROM family_messages WHERE household_id=? AND sent_at>?)<100
          AND EXISTS(SELECT 1 FROM family_households WHERE id=? AND state='active')
          AND EXISTS(SELECT 1 FROM family_members WHERE user_id=? AND household_id=?)
          AND EXISTS(SELECT 1 FROM family_members WHERE user_id=? AND household_id=?)`)
          .bind(id,ctx.householdId,ctx.userId,recipient,clientKey,JSON.stringify(cards),text,JSON.stringify(mediaIds),replyTo,now,ctx.householdId,ctx.householdId,new Date(Date.now()-3600000).toISOString(),ctx.householdId,ctx.userId,ctx.householdId,recipient,ctx.householdId),
        ...mediaIds.map(mediaId=>db.prepare("UPDATE family_media SET state='sent' WHERE id=? AND EXISTS(SELECT 1 FROM family_messages WHERE client_key=?)").bind(mediaId,clientKey)),
      ]);
      if(!results[0].meta.changes){const duplicate=await db.prepare('SELECT id FROM family_messages WHERE client_key=?').bind(clientKey).first<{id:string}>();if(duplicate)return okay({id:duplicate.id,duplicate:true});throw new FamilyError('发送过于频繁或记录已满，请稍后重试或清理旧记录。',429);}
      return okay({id});
    }
    case 'receipt':{
      const messageIds=ids(data.ids,50);if(!['received','opened'].includes(String(data.kind)))throw new FamilyError('回应状态不正确。');
      if(messageIds.length)await db.batch(messageIds.map(id=>db.prepare(`UPDATE family_messages SET received_at=COALESCE(received_at,?),
        opened_at=${data.kind==='opened'?'COALESCE(opened_at,?)':'opened_at'} WHERE id=? AND household_id=? AND recipient_id=? AND withdrawn_at IS NULL`)
        .bind(...(data.kind==='opened'?[now,now,id,ctx.householdId,ctx.userId]:[now,id,ctx.householdId,ctx.userId]))));
      return okay({saved:true});
    }
    case 'withdraw':{
      const id=ids([data.id],1)[0];const row=await db.prepare('SELECT media_ids FROM family_messages WHERE id=? AND household_id=? AND sender_id=?').bind(id,ctx.householdId,ctx.userId).first<{media_ids:string}>();
      if(!row)throw new FamilyError('只能撤回自己发送的消息。',403);
      await db.prepare("UPDATE family_messages SET withdrawn_at=COALESCE(withdrawn_at,?),text='',cards='[]',media_ids='[]' WHERE id=? AND sender_id=?").bind(now,id,ctx.userId).run();
      for(const mediaId of JSON.parse(row.media_ids) as string[]){
        const others=await db.prepare('SELECT media_ids FROM family_messages WHERE household_id=? AND withdrawn_at IS NULL').bind(ctx.householdId).all<{media_ids:string}>();
        if(!others.results.some(r=>(JSON.parse(r.media_ids) as string[]).includes(mediaId)))await db.prepare("UPDATE family_media SET state='deleting' WHERE id=? AND state!='avatar'").bind(mediaId).run();
      }
      await cleanup(ctx.householdId);return okay({withdrawn:true});
    }
    case 'discard-media':{
      const mediaIds=ids(data.ids);
      if(mediaIds.length)await db.batch(mediaIds.map(id=>db.prepare("UPDATE family_media SET state='deleting' WHERE id=? AND household_id=? AND owner_id=? AND state='staged'").bind(id,ctx.householdId,ctx.userId)));
      await cleanup(ctx.householdId);return okay({discarded:true});
    }
    case 'feedback':{
      if(!['没看懂','点不了','没有回应','其他问题'].includes(String(data.category)))throw new FamilyError('请选择问题类型。');
      const detail=cleanText(data.detail??'',240);
      const results=await db.prepare(`INSERT INTO family_feedback(id,household_id,user_id,category,detail,created_at)
        SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM family_feedback WHERE household_id=? AND created_at>?)<30`)
        .bind(crypto.randomUUID(),ctx.householdId,ctx.userId,data.category,detail,now,ctx.householdId,new Date(Date.now()-86400000).toISOString()).run();
      if(!results.meta.changes)throw new FamilyError('今天已经收到较多反馈，请稍后再试。',429);return okay({saved:true});
    }
    case 'delete-household':{
      ownerOnly(ctx);await db.prepare("UPDATE family_households SET state='deleting' WHERE id=?").bind(ctx.householdId).run();
      await db.prepare("UPDATE family_media SET state='deleting' WHERE household_id=?").bind(ctx.householdId).run();
      const files=await db.prepare('SELECT id FROM family_media WHERE household_id=?').bind(ctx.householdId).all<{id:string}>();
      if(files.results.length)await bucket().delete(files.results.map(f=>`${ctx.householdId}/${f.id}`));
      await db.batch(['family_media','family_messages','family_feedback','family_invites','family_members'].map(table=>db.prepare(`DELETE FROM ${table} WHERE household_id=?`).bind(ctx.householdId))
        .concat([db.prepare('DELETE FROM family_ai_usage WHERE scope LIKE ?').bind(`${ctx.householdId}:%`),db.prepare('DELETE FROM family_households WHERE id=?').bind(ctx.householdId)]));
      return okay({deleted:true});
    }
    case 'leave':{
      if(ctx.userId===ctx.ownerId)throw new FamilyError('设置家庭的家人请使用删除家庭资料。');
      const files=await db.prepare('SELECT id FROM family_media WHERE household_id=? AND owner_id=?').bind(ctx.householdId,ctx.userId).all<{id:string}>();
      await db.prepare("UPDATE family_media SET state='deleting' WHERE household_id=? AND owner_id=?").bind(ctx.householdId,ctx.userId).run();
      if(files.results.length)await bucket().delete(files.results.map(f=>`${ctx.householdId}/${f.id}`));
      await db.batch([
        db.prepare('DELETE FROM family_media WHERE household_id=? AND owner_id=?').bind(ctx.householdId,ctx.userId),
        db.prepare('DELETE FROM family_messages WHERE household_id=? AND (sender_id=? OR recipient_id=?)').bind(ctx.householdId,ctx.userId,ctx.userId),
        db.prepare('DELETE FROM family_feedback WHERE household_id=? AND user_id=?').bind(ctx.householdId,ctx.userId),
        db.prepare('DELETE FROM family_members WHERE user_id=?').bind(ctx.userId),
      ]);return okay({left:true});
    }
    default:throw new FamilyError('不支持这个操作。',404);
  }
}catch(error){return failed(error,request);}}
