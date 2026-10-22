import {executeQmuseFunction} from "./appwrite";
import {cloudFailure} from "./cloudDiagnostics";
type Reply={aiAvailable:boolean;usedToday:number;dailyLimit:number;cards:string[];error?:string};
async function call(action:string,text?:string,consent?:boolean):Promise<Reply>{
 const execution=await executeQmuseFunction({functionId:"card-suggestion",body:JSON.stringify({action,text,consent})});
 if(execution.status!=="completed")throw cloudFailure("FUNCTION",{code:execution.responseStatusCode});
 let result:Reply;try{result=JSON.parse(execution.responseBody);}catch{throw cloudFailure("RESPONSE",{code:execution.responseStatusCode});}
 if(execution.responseStatusCode<200||execution.responseStatusCode>=300){
   if(action==="status")throw cloudFailure("RESPONSE",{code:execution.responseStatusCode});
   const messages:Record<number,string>={400:"请检查示例文字和处理同意后重试。",403:"请刷新作品页面以建立访客会话。",422:"这句话暂时无法准确对应已有图卡，请手动选择或换种表达。",429:"本演示的AI次数暂时用完，请稍后或明天再试，也可以手动选图卡。",503:"AI暂时无法完成，原文仍保留，请手动选图卡。"};
   throw new Error(messages[execution.responseStatusCode]||"AI暂不可用，请手选图卡。");
 }
 return result;
}
export const companionService={getStatus:()=>call("status"),suggest:(text:string,consent:boolean)=>call("suggest",text,consent)};
