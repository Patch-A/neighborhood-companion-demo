import {createHash,createHmac} from 'node:crypto';
export const dayAt=now=>new Date(now+8*3600000).toISOString().slice(0,10);
export const slotId=(scope,slot)=>createHash('sha256').update(`${scope}:${slot}`).digest('hex').slice(0,36);
export function userScope(secret,userId,day){return createHmac('sha256',secret).update(`companion-qmuse:${day}:${userId}`).digest('hex').slice(0,48);}

// A deterministic row ID is a unique, durable slot. Concurrent creates must conflict.
// Never release partial reservations: conservatively spent slots cannot cause overspend.
async function take(store,scope,limit,expiresAt){
  const count=await store.count(scope);
  if(!Number.isSafeInteger(count)||count<0)throw Error('Quota unavailable');
  for(let slot=count+1;slot<=limit;slot++){
    try{await store.create(slotId(scope,slot),{scope,expiresAt});return true;}
    catch(error){if(Number(error.code)!==409)throw error;}
  }
  return false;
}
export async function reserve(store,secret,userId,now){
  const day=dayAt(now),minute=Math.floor(now/60000),user=userScope(secret,userId,day),expiry=now+3*86400000;
  for(const [scope,limit] of [[`g:${day}`,50],[`gm:${minute}`,10],[`u:${day}:${user}`,5],[`um:${minute}:${user}`,2]]){
    if(!await take(store,scope,limit,expiry))return false;
  }
  return true;
}
