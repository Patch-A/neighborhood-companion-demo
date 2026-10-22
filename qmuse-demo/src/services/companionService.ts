import {executeQmuseFunction} from "./appwrite";
type Reply={aiAvailable:boolean;usedToday:number;dailyLimit:number;cards:string[];error?:string};
async function call(action:string,text?:string,consent?:boolean):Promise<Reply>{
 const execution=await executeQmuseFunction({functionId:"card-suggestion",body:JSON.stringify({action,text,consent})});
 if(execution.status!=="completed")throw new Error("QMuse云服务暂未完成，请稍后重试或手选图卡。");
 let result:Reply;try{result=JSON.parse(execution.responseBody);}catch{throw new Error("AI返回内容暂不可用，请手选图卡。");}
 if(execution.responseStatusCode<200||execution.responseStatusCode>=300)throw new Error(result.error||"AI暂不可用，请手选图卡。");
 return result;
}
export const companionService={getStatus:()=>call("status"),suggest:(text:string,consent:boolean)=>call("suggest",text,consent)};
