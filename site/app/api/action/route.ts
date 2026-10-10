import {sessionId,readState,writeState,reply,failure,CareError} from '@/lib/care-store';
import {events,groups,initialState,MODES,INTERESTS} from '@/lib/care-data';
import {HELP_ACTIONS,applyHelpAction} from '@/lib/help-workflow';

function text(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.length>max)throw new CareError(`请填写 1–${max} 字的内容。`);return value.trim();}
function optionalText(value:unknown,max:number){if(value===undefined||value===null||value==='')return '';if(typeof value!=='string'||value.length>max)throw new CareError(`内容最多填写 ${max} 字。`);return value.trim();}
function choices(value:unknown,allowed:string[]){if(!Array.isArray(value)||value.length>allowed.length||!value.every(x=>typeof x==='string'&&allowed.includes(x)))throw new CareError('请重新检查选择项。');return [...new Set(value)] as string[];}
function notify(state:Awaited<ReturnType<typeof readState>>,kind:string,message:string,time:string){state.notifications.unshift({id:crypto.randomUUID(),text:message,time,kind});state.notifications=state.notifications.slice(0,100);}
export async function POST(request:Request){try{
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new CareError('请在应用中完成这个操作。',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw new CareError('提交格式不正确。',415);
  const raw=await request.text();if(raw.length>12000)throw new CareError('提交内容过长。',413);
  let data:Record<string,unknown>;try{data=JSON.parse(raw);}catch{throw new CareError('提交内容无法读取。');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new CareError('提交内容无法读取。');
  const id=sessionId(request);let state=await readState(id);const revision=state.revision;
  if(data.revision!==revision)throw new CareError('记录已更新，请刷新后再试。',409);
  const time=new Date().toISOString();
  if(HELP_ACTIONS.includes(String(data.action)))applyHelpAction(state,data,time);
  else switch(data.action){
    case 'profile':{const name=text(data.name,40);const age=Number(data.age);if(!Number.isInteger(age)||age<50||age>110)throw new CareError('年龄请填写 50–110 之间的整数。');state.profile={...state.profile,name,age,modes:choices(data.modes,MODES),interests:choices(data.interests,INTERESTS),setupComplete:true};notify(state,'profile','个人设置已保存',time);break;}
    case 'companion':{const name=text(data.name,40);const memory=optionalText(data.memory,240);state.profile.companion={name,memory};notify(state,'companion','陪伴称呼与便签已保存',time);break;}
    case 'join-event':case 'cancel-event':{const event=events.find(x=>x.id===data.eventId);if(!event)throw new CareError('活动不存在。',404);if(data.action==='join-event'){if(!event.seats)throw new CareError('这场活动已满员，看看其他活动吧。',409);if(!state.joined.includes(event.id)){state.joined.push(event.id);notify(state,'activity',`已记下「${event.title}」参加意愿`,time);}}else{state.joined=state.joined.filter(x=>x!==event.id);notify(state,'activity',`已撤销「${event.title}」参加意愿`,time);}break;}
    case 'join-group':case 'leave-group':{const group=groups.find(x=>x.id===data.groupId);if(!group)throw new CareError('兴趣小组不存在。',404);if(data.action==='join-group'){if(!state.joinedGroups.includes(group.id)){state.joinedGroups.push(group.id);notify(state,'group',`已记下加入「${group.title}」的意愿`,time);}}else{state.joinedGroups=state.joinedGroups.filter(x=>x!==group.id);notify(state,'group',`已撤销「${group.title}」加入意愿`,time);}break;}
    case 'message':{const message=text(data.text,240);state.messages.push({id:crypto.randomUUID(),text:message,time,incoming:false},{id:crypto.randomUUID(),text:'自动演示提示：内容已记录，并非家人回复。',time,incoming:true});state.messages=state.messages.slice(-100);notify(state,'message','文字卡已保存，演示中未实际发送',time);break;}
    case 'checkin':{if(!['到家了','今天一切都好'].includes(String(data.text)))throw new CareError('请重新选择平安状态。');state.checkins.unshift({id:crypto.randomUUID(),text:String(data.text),time,kind:'safety'});state.checkins=state.checkins.slice(0,100);notify(state,'safety',`已记录平安：${data.text}`,time);break;}
    case 'reset':state=initialState();break;
    default:throw new CareError('暂不支持这个操作。',404);
  }
  return reply(request,id,await writeState(id,state,revision));
}catch(error){return failure(error);}}
