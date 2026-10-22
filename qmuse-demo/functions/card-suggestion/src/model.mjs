import {CARD_PROMPT,parseCardSuggestion} from './lib/family-ai.mjs';
import {FamilyError} from './lib/picture-cards.mjs';

// workerd rejects redirect:'error'. Manual mode keeps credentials on the fixed provider.
export async function requestCardSuggestion(config,input){
  let response;
  try{
    response=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:config.model,messages:[{role:'system',content:CARD_PROMPT},{role:'user',content:input}],
        temperature:0,max_tokens:120,response_format:{type:'json_object'},thinking:{type:'disabled'}}),
      signal:AbortSignal.timeout(12000),redirect:'manual',
    });
  }catch{throw new FamilyError('AI 暂时没能连接，已保留输入，请手动选图卡。',503);}
  if(!response.ok)throw new FamilyError('AI 暂时没能完成，请手动选择图卡。',503);
  let raw;
  try{raw=await response.text();}catch{throw new FamilyError('AI 返回内容不可用，请手动选择图卡。',502);}
  if(raw.length>64000)throw new FamilyError('AI 返回内容不可用，请手动选择图卡。',502);
  let result;try{result=JSON.parse(raw);}catch{throw new FamilyError('AI 返回内容不可用，请手动选择图卡。',502);}
  return parseCardSuggestion(result.choices?.[0]?.message?.content||'');
}
