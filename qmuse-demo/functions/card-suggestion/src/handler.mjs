import {dayAt,reserve} from './quota.mjs';
import {requestCardSuggestion} from './model.mjs';
const reject=(message,status)=>Object.assign(new Error(message),{status});

export function createHandler({clock=()=>Date.now(),suggest=requestCardSuggestion}={}){
  return async ({req,res},{apiKey,store})=>{
    try{
      // Set by the platform session; never read actor/user identity from request JSON.
      const userId=req.headers?.['x-appwrite-user-id'];
      if(typeof userId!=='string'||!userId||userId.length>128)throw reject('请刷新作品页面以建立访客会话。',403);
      const raw=req.bodyText;
      if(typeof raw==='string'&&Buffer.byteLength(raw)>8000)throw reject('输入过长，请缩短后重试。',413);
      const body=req.bodyJson;
      if(!body||typeof body!=='object'||Array.isArray(body))throw reject('提交内容无法读取。',400);
      if(!['status','suggest'].includes(body.action))throw reject('没有这个操作。',400);
      const now=clock();
      if(body.action==='status'){
        if(!apiKey)return res.json({aiAvailable:false,usedToday:0,dailyLimit:50},200);
        await store.purge(now);
        return res.json({aiAvailable:true,usedToday:await store.count(`g:${dayAt(now)}`),dailyLimit:50},200);
      }
      if(!apiKey)throw reject('作者尚未开放本作品的AI，请先手动选图卡。',503);
      if(body.consent!==true||typeof body.text!=='string'||!body.text.trim()||body.text.length>500)throw reject('请填写1–500字，并同意处理这句示例文字。',400);
      if(!await reserve(store,apiKey,userId,now))throw reject('本演示的AI次数暂时用完，请稍后或明天再试，也可以手动选图卡。',429);
      const cards=await suggest({apiKey,model:'deepseek-flash'},body.text.trim());
      return res.json({cards,usedToday:await store.count(`g:${dayAt(now)}`),dailyLimit:50},200);
    }catch(error){
      const status=Number.isInteger(error.status)?error.status:503;
      return res.json({error:error.status?error.message:'服务暂时无法完成，请稍后重试或手动选图卡。'},status);
    }
  };
}
