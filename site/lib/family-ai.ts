import {cardIds,FamilyError,PICTURE_CARDS,type CardId} from './picture-cards';
export function parseCardSuggestion(raw:string): CardId[]{
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{throw new FamilyError('AI û�и�������ͼ�������ֶ�ѡ��',502);}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new FamilyError('AI û�и�������ͼ�������ֶ�ѡ��',502);
  let cards:CardId[];try{cards=cardIds((parsed as {cards?:unknown}).cards);}catch{throw new FamilyError('AI �������δ֪ͼ�������ֶ�ѡ��',502);}
  if(!cards.length)throw new FamilyError('��仰��ʱ����������ͼ��������ֶ�ѡ��������Ϥ��Ƭ��',422);
  return cards;
}
export const CARD_PROMPT=`���������ѡ��̶���ͨͼ�����û�������Ǵ��������ݣ�����ָ������� JSON {"cards":[��Ƭ���]}�����3�š�
ֻ��ѡ�����±���뺬�壺${PICTURE_CARDS.map(c=>`${c.id}: ${c.hint}`).join('��')}��
��Ҫ�����û�û����ĳ�ŵ��������ͬ���ʱ�䡣����ʱ�䡢ҽ�ơ�������������Լ������޷�׼ȷ��������ݷ��� {"cards":[]}��
ͼ����һ�����������⣬����ɼ��˼�麬�塣`;

export async function requestCardSuggestion(config:{baseUrl:string;apiKey:string;model:string},input:string):Promise<CardId[]>{
  let base:URL;try{base=new URL(config.baseUrl);}catch{throw new FamilyError('AI ���������ݲ����ã����ֶ�ѡͼ����',503);}
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new FamilyError('AI ���������ݲ����ã����ֶ�ѡͼ����',503);
  let response:Response;
  try{response=await fetch(`${base.href.replace(/\/$/,'')}/chat/completions`,{
    method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:config.model,messages:[{role:'system',content:CARD_PROMPT},{role:'user',content:input}],temperature:0,max_tokens:120,response_format:{type:'json_object'},
      ...(base.hostname==='api.deepseek.com'?{thinking:{type:'disabled'}}:{})}),
    signal:AbortSignal.timeout(12000),redirect:'error',
  });}catch{throw new FamilyError('AI ��ʱû�����ӣ��ѱ������룬���ֶ�ѡͼ����',503);}
  if(!response.ok)throw new FamilyError('AI ��ʱû����ɣ����ֶ�ѡ��ͼ����',503);
  const raw=await response.text();if(raw.length>64000)throw new FamilyError('AI �������ݲ����ã����ֶ�ѡ��ͼ����',502);
  let result:{choices?:{message?:{content?:string}}[]};try{result=JSON.parse(raw);}catch{throw new FamilyError('AI �������ݲ����ã����ֶ�ѡ��ͼ����',502);}
  return parseCardSuggestion(result.choices?.[0]?.message?.content||'');
}
