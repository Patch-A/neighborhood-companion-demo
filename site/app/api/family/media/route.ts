import {MAX_MEDIA_BYTES,FamilyError,checkMutation,mediaType} from '@/lib/picture-cards';
import {context,database,bucket,okay,failed,cleanup} from '@/lib/family-store';
export async function POST(request: Request){try{
  checkMutation(request);const ctx=await context();
  if(Number(request.headers.get('content-length'))>MAX_MEDIA_BYTES)throw new FamilyError('����̫��ÿ����� 8 MB��',413);
  if(!request.body)throw new FamilyError('û�ж�ȡ��������');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;
    if(size>MAX_MEDIA_BYTES){await reader.cancel();throw new FamilyError('����̫��ÿ����� 8 MB��',413);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  if(!size)throw new FamilyError('�����ǿյģ����������ӡ�');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const file=mediaType(bytes,request.headers.get('content-type')||'');
  const store=bucket();await cleanup(ctx.householdId);
  const id=crypto.randomUUID();
  const result=await database().prepare(`INSERT INTO family_media(id,household_id,owner_id,kind,mime,bytes,created_at)
    SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM family_media WHERE household_id=?)<100
    AND EXISTS(SELECT 1 FROM family_members m JOIN family_households h ON h.id=m.household_id WHERE m.user_id=? AND h.id=? AND h.state='active')`)
    .bind(id,ctx.householdId,ctx.userId,file.kind,file.mime,size,new Date().toISOString(),ctx.householdId,ctx.userId,ctx.householdId).run();
  if(!result.meta.changes)throw new FamilyError('��ͥ�����ռ��������������������ϡ�',429);
  try{await store.put(`${ctx.householdId}/${id}`,bytes,{httpMetadata:{contentType:file.mime}});}
  catch{await database().prepare("UPDATE family_media SET state='deleting' WHERE id=?").bind(id).run();throw new FamilyError('����û���ϴ��ɹ����ݸ廹�ڱ����������ԡ�',503);}
  const stillActive=await database().prepare("SELECT f.id FROM family_media f JOIN family_households h ON h.id=f.household_id WHERE f.id=? AND f.state='staged' AND h.state='active'").bind(id).first();
  if(!stillActive){await store.delete(`${ctx.householdId}/${id}`);throw new FamilyError('��ͥ�󶨸ոշ����仯������δ���ͣ������´򿪼�ͥ��',409);}
  return okay({id,kind:file.kind},201);
}catch(error){return failed(error,request);}}
