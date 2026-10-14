import {FamilyError,ids} from '@/lib/picture-cards';
import {context,canReadMedia,bucket,failed} from '@/lib/family-store';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
  const id=ids([(await params).id],1)[0];const ctx=await context();const file=await canReadMedia(ctx,id);
  const range=request.headers.get('range');let requested:{offset:number;length:number}|undefined;
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.bytes}`,'Cache-Control':'no-store'}});
    const start=match[1]?Number(match[1]):Math.max(0,file.bytes-Number(match[2]));
    const end=match[1]&&match[2]?Math.min(Number(match[2]),file.bytes-1):file.bytes-1;
    if(start>end||start>=file.bytes)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.bytes}`,'Cache-Control':'no-store'}});
    requested={offset:start,length:end-start+1};
  }
  const object=await bucket().get(`${ctx.householdId}/${id}`,requested?{range:requested}:undefined);
  if(!object)throw new FamilyError('附件已移除，请让家人重新发送。',404);
  const headers=new Headers({'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Length':String(requested?.length??file.bytes)});
  if(requested)headers.set('Content-Range',`bytes ${requested.offset}-${requested.offset+requested.length-1}/${file.bytes}`);
  return new Response(object.body,{status:requested?206:200,headers});
}catch(error){return failed(error);}}
