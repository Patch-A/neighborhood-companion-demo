export const events = [
  {id:'chess',type:'棋类',title:'下午下象棋',day:'今天',time:'15:00',place:'松柏社区活动室',host:'社区活动员 王阿姨',seats:6,duration:'约 1 小时',desc:'从一盘轻松的棋开始，认识住在附近的老朋友。初学者也欢迎，可以先坐在旁边看看。',tip:'活动室有座椅和饮水，请按自己的节奏参加。',color:'orange'},
  {id:'dance',type:'舞蹈',title:'晚饭后广场舞',day:'今天',time:'18:30',place:'松柏社区小广场',host:'广场舞小组 李阿姨',seats:12,duration:'约 40 分钟',desc:'跟着慢节奏的音乐动一动。不用记住所有动作，第一次来可以先看看。',tip:'穿舒适的鞋子，觉得累了就休息。',color:'purple'},
  {id:'walk',type:'运动',title:'一起散步',day:'明天',time:'08:00',place:'松柏社区南门',host:'邻里散步小组',seats:0,duration:'约 30 分钟',desc:'沿社区步道慢慢走，聊聊家常。这场活动已满员，可以看看其他活动。',tip:'请根据自己的身体情况安排活动。',color:'green'},
  {id:'tea',type:'聊天',title:'社区茶话会',day:'周五',time:'14:00',place:'松柏社区阅览室',host:'社区志愿者 陈叔叔',seats:10,duration:'约 1 小时',desc:'一杯温茶，几个邻居。聊聊家常，也可以带一个自己的小故事来。',tip:'可以先听听大家聊天，无需准备发言。',color:'blue'},
] as const;

export const groups = [
  {id:'chess-group',title:'下棋搭子',type:'棋类',desc:'会不会下都没关系，一起慢慢学。',next:'下午下象棋 · 今天 15:00',eventId:'chess',color:'orange'},
  {id:'move-group',title:'晚饭后动一动',type:'运动',desc:'散步、跳舞，按自己的节奏来。',next:'晚饭后广场舞 · 今天 18:30',eventId:'dance',color:'green'},
  {id:'talk-group',title:'邻里聊天',type:'聊天',desc:'喝杯茶，聊聊生活里的小事情。',next:'社区茶话会 · 周五 14:00',eventId:'tea',color:'blue'},
] as const;

export const MODES=['看不清小字','听不清语音','不方便说话','更习惯手语或文字','需要家人帮忙'];
export const INTERESTS=['棋类','舞蹈','散步','聊天'];
export const HELP_TYPES=['帮我看看','帮我办点事','陪我出去','想找人聊聊'] as const;
export type HelpType=typeof HELP_TYPES[number];
export type HelpRisk='low'|'medium'|'high';
export type HelpStatus='pending_family'|'family_accepted'|'family_declined'|'family_forwarded'|'volunteer_accepted'|'arranged'|'awaiting_confirmation'|'completed'|'not_resolved'|'cancelled';
export type Role='elder'|'family'|'volunteer';
// File bytes stay on this device in this demo; only references reach D1.
export type MediaRef={id:string;kind:'image'|'audio';mime:string;name:string;size:number};
export type HelpReply={id:string;clientId:string;role:Role;text:string;media:MediaRef[];time:string};

export type Entry={id:string;text:string;time:string;kind:string};
export type Message={id:string;text:string;time:string;incoming:boolean};
export type HelpRequest={
  id:string; type:HelpType; title:string; icon:string; description:string;
  createdAt:string; updatedAt:string; status:HelpStatus; risk:HelpRisk; place:string;
  schedule?:string; createdBy:'elder'; createdByName:string; familyApproved:boolean;
  familyMessage?:string; volunteerName?:string; source:'demo'|'user';
  media?:MediaRef[]; replies?:HelpReply[]; clientId?:string;
  familyViewedAt?:string; resolvedAt?:string;
};
export type CareState={
  profile:{name:string;age:number;modes:string[];interests:string[];setupComplete:boolean;companion:{name:string;memory:string}};
  joined:string[]; joinedGroups:string[]; messages:Message[]; checkins:Entry[];
  notifications:Entry[]; requests:HelpRequest[]; revision:number;
};

const demoTime='2026-10-08T11:20:00.000Z';
export function initialState():CareState{return {
  profile:{name:'李奶奶',age:72,modes:['看不清小字'],interests:['棋类','散步'],setupComplete:true,companion:{name:'老伴',memory:'我们以前每天晚饭后一起散步。'}},
  joined:[], joinedGroups:[], messages:[], checkins:[],
  notifications:[{id:'notice-welcome',text:'可以先试试“帮我看看”，体验家人回应流程。',time:demoTime,kind:'help'}],
  requests:[{id:'req-demo-1',type:'帮我看看',title:'帮我看看这张通知',icon:'看',description:'我收到一张纸条，不太看得清上面的字。',createdAt:demoTime,updatedAt:demoTime,status:'pending_family',risk:'low',place:'松柏社区附近',createdBy:'elder',createdByName:'李奶奶',familyApproved:false,source:'demo'}],
  revision:0,
};}
