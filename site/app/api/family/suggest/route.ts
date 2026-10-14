import {env} from 'cloudflare:workers';
import {FamilyError,jsonBody,cleanText} from '@/lib/picture-cards';
import {context,familyOnly,database,okay,failed} from '@/lib/family-store';
import {requestCardSuggestion} from '@/lib/family-ai';
export async function POST(request:Request){try{
  const data=await jsonBody(request);const ctx=await context();familyOnly(ctx);const input=cleanText(data.text,500,true);
  if(!env.FAMILY_AI_API_KEY||!env.FAMILY_AI_BASE_URL||!env.FAMILY_AI_MODEL)throw new FamilyError('AI ������δ���룬�����ֶ�ѡ��ͼ������������ģ�� AI �����',503);
  const day=new Date().toISOString().slice(0,10);const db=database();
  // Global reservation first bounds aggregate cost even if a family quota is exhausted.
  for(const [scope,limit] of [[`global:${day}`,200],[`${ctx.householdId}:${day}`,20]] as const){
    const result=await db.prepare(`INSERT INTO family_ai_usage(scope,count) VALUES(?,1)
      ON CONFLICT(scope) DO UPDATE SET count=count+1 WHERE count<?`).bind(scope,limit).run();
    if(!result.meta.changes)throw new FamilyError('����� AI ʹ�ô����ѵ����ޣ����ֶ�ѡ��ͼ����',429);
  }
  await db.prepare('DELETE FROM family_ai_usage WHERE substr(scope,-10)<?').bind(new Date(Date.now()-7*86400000).toISOString().slice(0,10)).run();
  const cards=await requestCardSuggestion({baseUrl:env.FAMILY_AI_BASE_URL,apiKey:env.FAMILY_AI_API_KEY,model:env.FAMILY_AI_MODEL},input);
  return okay({cards,source:'model',requiresReview:true});
}catch(error){return failed(error,request);}}
