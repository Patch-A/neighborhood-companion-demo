import {env} from 'cloudflare:workers';
import {FamilyError,jsonBody,cleanText} from '@/lib/picture-cards';
import {identity,database,okay,failed,hashToken} from '@/lib/family-store';
import {requestCardSuggestion} from '@/lib/family-ai';
// An authorized reviewer can try the actual model before creating a household.
// This endpoint cannot send messages, create members or expose any family data.
export async function POST(request:Request){try{
  const data=await jsonBody(request);const userId=await identity();
  const db=database();const membership=await db.prepare('SELECT role FROM family_members WHERE user_id=?').bind(userId).first<{role:string}>();
  if(membership?.role==='elder')throw new FamilyError('���ü��˼�� AI ͼ�����顣',403);
  const text=cleanText(data.text,500,true);
  if(!env.FAMILY_AI_API_KEY||!env.FAMILY_AI_BASE_URL||!env.FAMILY_AI_MODEL)throw new FamilyError('AI ������δ���룬������ѡͼ����',503);
  const day=new Date().toISOString().slice(0,10);
  for(const [scope,limit] of [[`global:${day}`,200],[`preview:${await hashToken(userId)}:${day}`,5]] as const){
    const result=await db.prepare(`INSERT INTO family_ai_usage(scope,count) VALUES(?,1) ON CONFLICT(scope) DO UPDATE SET count=count+1 WHERE count<?`).bind(scope,limit).run();
    if(!result.meta.changes)throw new FamilyError('��������ô����ѵ����ޣ������ֶ�ѡͼ����',429);
  }
  await db.prepare('DELETE FROM family_ai_usage WHERE substr(scope,-10)<?').bind(new Date(Date.now()-7*86400000).toISOString().slice(0,10)).run();
  const cards=await requestCardSuggestion({baseUrl:env.FAMILY_AI_BASE_URL,apiKey:env.FAMILY_AI_API_KEY,model:env.FAMILY_AI_MODEL},text);
  return okay({cards,source:'model',requiresReview:true});
}catch(error){return failed(error,request);}}
