'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,Check,Heart,ImagePlus,RefreshCw,Send,Settings,Users,MessageCircle,Expand,LogIn} from 'lucide-react';
import {PictureCard} from './picture-card';
import {MediaComposer} from './care-media';
import {readMedia,deleteMedia} from '@/lib/local-media';
import {PICTURE_CARDS,messageStatus,type CardId,type FamilySnapshot,type FamilyMember,type FamilyMessage} from '@/lib/picture-cards';
import type {MediaRef} from '@/lib/care-data';
import {demoSnapshot,demoMessage} from '@/lib/family-demo';
import {AiPractice} from './ai-practice';

type Draft={clientId:string;cards:CardId[];text:string;media:MediaRef[];recipientId:string;replyTo:string|null;uploaded:Record<string,string>;aiSuggested?:boolean};
const freshDraft=():Draft=>({clientId:crypto.randomUUID(),cards:[],text:'',media:[],recipientId:'',replyTo:null,uploaded:{}});
async function api<T>(path:string,body?:unknown):Promise<T>{
  const response=await fetch(path,{cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const data=await response.json() as T & {error?:string};if(!response.ok)throw new Error(data.error||'暂时没有完成，请重试。');return data as T;
}
function time(value:string){return new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}
function MemberPhoto({member}:{member:FamilyMember}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[member.avatarId]);
  return member.avatarId&&!failed?<img className="family-avatar" src={`/api/family/media/${member.avatarId}`} alt={member.name} onError={()=>setFailed(true)}/>:<span className="family-avatar empty"><Users size={40}/><small>{member.avatarId?'照片未打开':'请家人放照片'}</small></span>;
}
export default function FamilyApp(){
  const [data,setData]=useState<FamilySnapshot|null>(null);const [loading,setLoading]=useState(true);const [demo,setDemo]=useState(false);
  const [view,setView]=useState<'home'|'settings'|'compose'|'message'|'feedback'>('home');const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);const [mediaBusy,setMediaBusy]=useState(false);const lock=useRef(false);
  const [draft,setDraft]=useState<Draft>(freshDraft);const draftRef=useRef(draft);draftRef.current=draft;
  const [pendingDraft,setPendingDraft]=useState<Draft|null>(null);const [draftReady,setDraftReady]=useState(false);const [saved,setSaved]=useState(true);
  const [selected,setSelected]=useState<string|null>(null);const [large,setLarge]=useState(false);const [aiSuggested,setAiSuggested]=useState(false);const [aiChecked,setAiChecked]=useState(false);
  const [inviteToken,setInviteToken]=useState('');const [generatedInvite,setGeneratedInvite]=useState('');const [consent,setConsent]=useState(false);
  const [householdName,setHouseholdName]=useState('我的家人');const [memberName,setMemberName]=useState('');
  const [profileName,setProfileName]=useState('');const [profileAvatar,setProfileAvatar]=useState<string|null>(null);
  const [feedbackCategory,setFeedbackCategory]=useState('没看懂');const [feedbackDetail,setFeedbackDetail]=useState('');const [feedbackItems,setFeedbackItems]=useState<{id:string;category:string;detail:string;created_at:string}[]>([]);
  const [deleteConfirmed,setDeleteConfirmed]=useState(false);const [cardsConfirmed,setCardsConfirmed]=useState(false);
  const stateRef=useRef(data);stateRef.current=data;
  const me=data?.members.find(m=>m.userId===data.viewer?.userId);const others=data?.members.filter(m=>m.userId!==data.viewer?.userId)||[];
  const draftKey=data?.household&&data.viewer&&!demo?`family-draft-v1:${data.household.id}:${data.viewer.userId}`:'';
  const load=useCallback(async(silent=false)=>{
    if(lock.current)return;
    try{const next=await api<FamilySnapshot>('/api/family');setData(next);setError('');
      if(document.visibilityState==='visible'){
        const unseen=next.messages.filter(m=>m.recipientId===next.viewer?.userId&&!m.receivedAt&&!m.withdrawnAt).map(m=>m.id);
        if(unseen.length)await api('/api/family/action',{action:'receipt',kind:'received',ids:unseen});
      }
    }catch(e){if(!silent||stateRef.current)setError(e instanceof Error?e.message:'暂时没有连接上，请重试。');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    const isDemo=new URL(location.href).searchParams.get('demo')==='1';setDemo(isDemo);
    const hash=new URLSearchParams(location.hash.slice(1));setInviteToken(hash.get('join')||'');
    try{setLarge(localStorage.getItem('family-large')==='true');}catch{}
    if(isDemo){setData(demoSnapshot());setLoading(false);}else void load();
  },[load]);
  useEffect(()=>{if(demo)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')void load(true);},10000);return()=>clearInterval(timer);},[demo,load]);
  useEffect(()=>{try{localStorage.setItem('family-large',String(large));}catch{}},[large]);
  useEffect(()=>{
    setDraftReady(false);setPendingDraft(null);setDraft(freshDraft());setAiSuggested(false);setAiChecked(false);
    if(draftKey)try{const raw=JSON.parse(localStorage.getItem(draftKey)||'null');
      if(raw&&typeof raw.clientId==='string'&&typeof raw.text==='string'&&Array.isArray(raw.cards)&&Array.isArray(raw.media)){
        const safeCards=raw.cards.filter((id:unknown)=>PICTURE_CARDS.some(c=>c.id===id)).slice(0,3);
        setPendingDraft({...freshDraft(),...raw,cards:safeCards,uploaded:raw.uploaded||{}});
      }
    }catch{setNotice('旧草稿无法读取，已打开新的内容。');}
    setDraftReady(true);
  },[draftKey,demo,data?.viewer?.userId]);
  useEffect(()=>{if(!draftKey||!draftReady||pendingDraft)return;try{
    if(draft.cards.length||draft.text||draft.media.length)localStorage.setItem(draftKey,JSON.stringify({...draft,aiSuggested}));else localStorage.removeItem(draftKey);setSaved(true);
  }catch{setSaved(false);}},[draftKey,draft,draftReady,pendingDraft,aiSuggested]);
  useEffect(()=>{if(me){setProfileName(me.name);setProfileAvatar(me.avatarId);}setCardsConfirmed(!!data?.household?.cardsReviewed);},[me?.name,me?.avatarId,data?.household?.cardsReviewed]);
  async function work(task:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await task();}catch(e){setError(e instanceof Error?e.message:'暂时没有完成，请重试。');}finally{lock.current=false;setBusy(false);}}
  async function action(body:unknown){await api('/api/family/action',body);const next=await api<FamilySnapshot>('/api/family');setData(next);}
  function go(next:typeof view){if(busy||mediaBusy)return;setError('');setNotice('');setView(next);}
  function chooseCard(id:CardId){setDraft(value=>({...value,cards:value.cards.includes(id)?value.cards.filter(x=>x!==id):value.cards.length<3?[...value.cards,id]:value.cards}));setAiChecked(false);}
  function compose(recipientId:string,replyTo:string|null=null){
    if(pendingDraft){setNotice('请先决定继续上次内容，还是重新开始。');return;}
    if(draft.cards.length||draft.text||draft.media.length){setNotice('已保留未发送内容；请先继续发送或清空，再开始新的回应。');setView('compose');return;}
    setDraft({...freshDraft(),recipientId,replyTo});setAiSuggested(false);setAiChecked(false);setView('compose');setError('');setNotice('');
  }
  async function upload(blob:Blob){const response=await fetch('/api/family/media',{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(45000)});const result=await response.json() as {id:string;kind:string;error?:string};if(!response.ok)throw new Error(result.error||'附件没有上传成功。');return result;}
  async function send(){await work(async()=>{
    const current=draftRef.current;const recipient=current.recipientId||others[0]?.userId;if(!recipient)throw new Error('请先让另一位家人加入，再发送。');
    if(!current.cards.length&&!current.text.trim()&&!current.media.length)throw new Error('请先选一张图卡或添加照片。');
    if(aiSuggested&&!aiChecked)throw new Error('请先检查 AI 建议的图卡含义。');
    if(demo){if(current.media.length)throw new Error('演示模式不上传私人附件；家庭设置后可以使用。');
      setData(value=>value?{...value,messages:[demoMessage(value.viewer!.userId,recipient,current.cards,current.text,current.replyTo,current.clientId),...value.messages]}:value);
    }else{
      const uploaded={...current.uploaded};
      for(const item of current.media){if(uploaded[item.id])continue;const blob=await readMedia(item.id,86400000);if(!blob)throw new Error('本机草稿附件已过期或找不到，请移除后重新添加。');uploaded[item.id]=(await upload(blob)).id;setDraft(value=>({...value,uploaded:{...uploaded}}));}
      try{await api('/api/family/action',{action:'send',clientId:current.clientId,cards:current.cards,text:current.text,mediaIds:current.media.map(m=>uploaded[m.id]),recipientId:recipient,replyTo:current.replyTo});}
      catch(e){if(e instanceof Error&&e.message.includes('附件已失效'))setDraft(value=>({...value,uploaded:{}}));throw e;}
      setData(await api<FamilySnapshot>('/api/family'));
      for(const item of current.media)void deleteMedia(item.id).catch(()=>{});
    }
    setDraft(freshDraft());setPendingDraft(null);setAiSuggested(false);setAiChecked(false);setView('home');setNotice(demo?'已保存演示消息，请切换示例家人查看。':'已保存。对方打开网页后会接收，不代表已经查看。');
  });}
  async function openMessage(message:FamilyMessage){setSelected(message.id);setView('message');setNotice('');setError('');
    if(message.recipientId!==data?.viewer?.userId||message.withdrawnAt)return;
    if(demo)setData(value=>value?{...value,messages:value.messages.map(m=>m.id===message.id?{...m,receivedAt:m.receivedAt||new Date().toISOString(),openedAt:m.openedAt||new Date().toISOString()}:m)}:value);
    else try{await api('/api/family/action',{action:'receipt',kind:'opened',ids:[message.id]});}catch{setError('消息已打开，但查看状态尚未同步，请稍后刷新。');}
  }
  async function saveAvatar(file:File|null){if(!file)return;await work(async()=>{
    if(!file.type.startsWith('image/'))throw new Error('请选择照片。');if(file.size>8*1024*1024)throw new Error('照片太大，请选择不超过 8 MB 的图片。');
    const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('这张照片打不开，请换 JPG、PNG 或 WebP 图片。');});
    try{const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('照片处理失败，请重试。')),'image/jpeg',.82));
      const result=await upload(blob);setProfileAvatar(result.id);setNotice('照片已上传，请点“保存我的照片和称呼”完成设置。');
    }finally{bitmap.close();}
  });}
  async function clearDraft(value=draft){await work(async()=>{
    if(!demo&&Object.values(value.uploaded).length)await api('/api/family/action',{action:'discard-media',ids:Object.values(value.uploaded)});
    for(const item of value.media)await deleteMedia(item.id);
    setDraft(freshDraft());setPendingDraft(null);setAiSuggested(false);setAiChecked(false);setNotice('已清空未发送的内容和本机附件。');
  });}
  function cardPicker(home=false){return <div className="family-card-grid">{PICTURE_CARDS.filter(c=>!home||!['again','later'].includes(c.id)).map(card=><button type="button" className={`family-card-choice${draft.cards.includes(card.id)?' selected':''}`} key={card.id} aria-pressed={draft.cards.includes(card.id)} disabled={busy||!!pendingDraft||(!draft.cards.includes(card.id)&&draft.cards.length>=3)} onClick={()=>chooseCard(card.id)}><PictureCard id={card.id}/>{draft.cards.includes(card.id)&&<span className="card-check"><Check size={20}/>已选</span>}</button>)}</div>;}
  function mediaView(message:FamilyMessage){return <div className="family-attachments">{message.media.map(file=>file.kind==='image'?<a key={file.id} href={`/api/family/media/${file.id}`} target="_blank" rel="noopener noreferrer" aria-label="打开家人照片查看大图"><img src={`/api/family/media/${file.id}`} alt="家人分享的照片" loading="lazy"/></a>:<div key={file.id}><p>语音是补充方式，可以选择播放</p><audio controls preload="none" src={`/api/family/media/${file.id}`} aria-label="播放家人语音"/></div>)}{message.mediaIds.length>message.media.length&&<p className="family-warning">部分附件已过保存期限，请让家人重新发送。</p>}</div>;}
  const selectedMessage=data?.messages.find(m=>m.id===selected);
  const latestIncoming=data?.messages.find(m=>m.recipientId===data.viewer?.userId&&!m.openedAt&&!m.withdrawnAt);
  return <div className={`family-shell${large?' family-large':''}`}>
    <header className="family-top"><a href="/" className="family-brand"><span>伴</span><strong>邻里有伴</strong></a><div className="family-top-actions"><button type="button" aria-pressed={large} onClick={()=>setLarge(!large)}><Expand size={20}/>{large?'恢复字号':'字大一点'}</button>{data?.household&&<button type="button" onClick={()=>go(view==='settings'?'home':'settings')} aria-label="家庭设置"><Settings size={24}/></button>}</div></header>
    <main className="family-main" id="main-content">
      {demo&&<aside className="family-demo-banner"><strong>演示体验 · 同一浏览器模拟</strong><p>使用虚构资料；不发送真实消息，不上传附件，演示模式不调用 AI。</p><div><button type="button" disabled={busy} onClick={()=>{setData(value=>value?{...value,viewer:{userId:'demo-elder'}}:value);setView('home');}}>示例老人</button><button type="button" disabled={busy} onClick={()=>{setData(value=>value?{...value,viewer:{userId:'demo-family'}}:value);setView('home');}}>示例家人</button><a href="/">返回家庭设置</a></div></aside>}
      {view!=='home'&&<button type="button" className="family-back" disabled={busy||mediaBusy} onClick={()=>go('home')}><ArrowLeft size={22}/>回到首页</button>}
      {error&&<div className="family-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={()=>demo?setError(''):void load()}><RefreshCw size={20}/>重新同步</button></div>}
      {notice&&<p className="family-notice" role="status">{notice}</p>}
      {loading?<div className="family-loading" role="status"><h1>正在打开家庭记录</h1><div/><p>稍等一下，就能看到家人的消息。</p></div>:!data?<section className="family-onboarding"><h1>暂时没有打开记录</h1><button type="button" className="family-primary" onClick={()=>void load()}>再试一次</button><a href="/?demo=1">先看看图卡演示</a></section>:!data.household?<section className="family-onboarding">
        <span className="family-intro-icon"><Heart size={38}/></span><h1>和家人，换个方式说话</h1><p>用熟悉的照片和少量图卡传递心意。先由家人设置，再一起熟悉图卡。</p>
        {!data.viewer?<><a className="family-primary" href="/signin-with-chatgpt?return_to=%2F" target="_top"><LogIn size={22}/>家人登录后设置</a><a className="family-secondary" href="/?demo=1">先体验图卡演示</a><p className="family-help">这份网页试用版使用 ChatGPT 登录。支付宝正式接入仍在后续阶段。</p></>:<form onSubmit={(e:FormEvent)=>{e.preventDefault();void work(async()=>{
          if(!consent)throw new Error('请先阅读并确认家庭试用说明。');
          await action(inviteToken?{action:'join',token:inviteToken,name:memberName}:{action:'create',name:householdName,memberName});
          if(inviteToken){history.replaceState(null,'',location.pathname);setInviteToken('');}setNotice('家庭设置好了，请和家人一起熟悉图卡。');
        });}}><h2>{inviteToken?'加入家人邀请':'由家人设置家庭'}</h2><label>我在家庭中的称呼<input required maxLength={24} value={memberName} disabled={busy} onChange={e=>setMemberName(e.target.value)} placeholder="例如：女儿、妈妈" autoComplete="off"/></label>{!inviteToken&&<label>家庭名称<input required maxLength={40} value={householdName} disabled={busy} onChange={e=>setHouseholdName(e.target.value)}/></label>}
          <p className="family-help">家庭成员可看到称呼和照片。消息只在发送双方之间展示，保留 30 天；未发送附件保留 24 小时。可退出或删除家庭资料。本版没有短信或后台推送，需要主动打开网页查看。</p>
          <label className="family-checkbox"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>我已了解试用范围与资料保存方式，并获得参与者同意</label>
          <button className="family-primary" disabled={busy||!consent}>{busy?'正在设置…':inviteToken?'加入这个家庭':'设置家庭'}</button><a href="/?demo=1">也可以先体验演示</a>
        </form>}
        {data.viewer&&data.aiAvailable&&<AiPractice provider={data.aiProvider||'AI'}/>}
      </section>:<>
        {pendingDraft&&<aside className="family-warning"><p>发现一份未发送的内容。继续它，还是重新开始？</p><div className="family-button-row"><button type="button" disabled={busy} onClick={()=>{setDraft(pendingDraft);setAiSuggested(!!pendingDraft.aiSuggested);setAiChecked(false);setPendingDraft(null);setView('compose');}}>继续上次内容</button><button type="button" disabled={busy} onClick={()=>void clearDraft(pendingDraft)}>重新开始</button></div></aside>}
        {view==='home'&&<>
          <div className="family-heading"><div><p>{me?.role==='elder'?'和熟悉的人联系':data.household.name}</p><h1>{me?.role==='elder'?'想和家人说什么？':'把心意送给家人'}</h1></div><button type="button" aria-label="刷新家庭消息" disabled={busy} onClick={()=>demo?setNotice('演示消息保存在此页面中。'):void load()}><RefreshCw size={24}/></button></div>
          {latestIncoming&&<button type="button" className="family-new-message" onClick={()=>void openMessage(latestIncoming)}><MessageCircle size={32}/><span><strong>{data.members.find(m=>m.userId===latestIncoming.senderId)?.name||'家人'}有新消息</strong><small>点这里，看看家人的回应</small></span><ImagePlus size={28}/></button>}
          {!others.length?<section className="family-empty"><Users size={44}/><h2>先让家人加入</h2><p>生成邀请后，对方还需要有这个站点的访问权限，再用自己的账号加入。</p><button type="button" className="family-primary" onClick={()=>go('settings')}>设置家庭邀请</button></section>:<section className="family-people" aria-label="我的家人">{others.map(member=><button type="button" className="family-person" key={member.userId} disabled={busy} onClick={()=>compose(member.userId)}><MemberPhoto member={member}/><span><strong>{member.name}</strong><small>选照片或图卡联系</small></span><Send size={24}/></button>)}</section>}
          {!data.household.cardsReviewed&&<aside className="family-warning">图卡还没一起熟悉过。请家人陪老人试用，确认含义后在家庭设置中开启老人发送。</aside>}
          {others.length>0&&<section className="family-section"><h2>选一张，传递心意</h2><p className="family-help">图卡含义需和家人一起确认，最多选 3 张。</p>{cardPicker(true)}<button type="button" className="family-primary family-wide" disabled={!draft.cards.length||busy} onClick={()=>{setDraft(value=>({...value,recipientId:value.recipientId||others[0].userId}));go('compose');}}>看看，再发送<Send size={22}/></button></section>}
          <section className="family-section"><h2>家人的消息</h2>{!data.messages.length?<div className="family-empty"><MessageCircle size={38}/><p>还没有消息。发一张图卡，开始第一次往返。</p></div>:<div className="family-message-list">{data.messages.filter(m=>m.senderId===data.viewer?.userId||m.recipientId===data.viewer?.userId).map(message=>{
            const incoming=message.recipientId===data.viewer?.userId;const member=data.members.find(m=>m.userId===(incoming?message.senderId:message.recipientId));
            return <article className="family-message" key={message.id}><div className="family-message-heading"><strong>{incoming?`${member?.name||'家人'}发来的`:`发给${member?.name||'家人'}`}</strong><small>{time(message.sentAt)}</small></div>{message.withdrawnAt?<p>这条消息已撤回</p>:<><div className="family-card-preview">{message.cards.map(id=><PictureCard key={id} id={id} compact/>)}</div>{!message.cards.length&&<p>{message.media.length?'家人分享了照片或语音':'家人发来了一句话'}</p>}<button type="button" className="family-secondary family-wide" onClick={()=>void openMessage(message)}>{incoming?'打开看看':'查看内容'}<ImagePlus size={22}/></button></>}<p className="family-delivery">{incoming?(message.openedAt?'你已打开这条消息':'打开后可以回应'):messageStatus(message)}</p></article>;
          })}</div>}</section>
          <button type="button" className="family-secondary family-wide" onClick={()=>go('feedback')}>遇到问题，告诉家人</button>
        </>}
        {view==='compose'&&<section className="family-section"><h1>{draft.replyTo?'回应家人':'准备发给家人'}</h1><label>发送给<select value={draft.recipientId||others[0]?.userId||''} disabled={busy||!!draft.replyTo} onChange={e=>setDraft(value=>({...value,recipientId:e.target.value}))}>{others.map(m=><option value={m.userId} key={m.userId}>{m.name}</option>)}</select></label>{cardPicker()}
          {me?.role==='family'&&<div className="family-text-input"><label>家人补充一句话（可不填）<textarea maxLength={500} rows={3} value={draft.text} disabled={busy} onChange={e=>{setDraft(value=>({...value,text:e.target.value}));setAiChecked(false);}} placeholder="图卡表达不了的具体安排，请用熟悉照片辅助确认"/></label><p className="family-help">老人可能不识字，文字只能补充，不能代替可理解的回应。</p>
            <button type="button" className="family-secondary family-wide" disabled={busy||demo||!data.aiAvailable||!draft.text.trim()} onClick={()=>void work(async()=>{const result=await api<{cards:CardId[]}>('/api/family/suggest',{text:draft.text});setDraft(value=>({...value,cards:result.cards}));setAiSuggested(true);setAiChecked(false);setNotice('AI 只给出候选，请逐张核对。还没有发送。');})}>请 AI 帮我选图卡</button>
            {!data.aiAvailable&&<p className="family-help">{demo?'演示模式手动选择图卡，不调用 AI。':'AI 尚未接入，现在可以手动选图卡。'}</p>}
            {data.aiAvailable&&<p className="family-help">点击后，这句话将交给{data.aiProvider}处理。请勿输入证件、住址或医疗等敏感资料；AI 每家庭每天最多 20 次。</p>}
          </div>}
          {aiSuggested&&<label className="family-checkbox"><input type="checkbox" checked={aiChecked} disabled={busy} onChange={e=>setAiChecked(e.target.checked)}/>我已核对图卡含义，没有增加原话未表达的承诺</label>}
          {!demo&&<details className="family-more"><summary>也可以加照片或语音</summary><MediaComposer value={draft.media} onChange={media=>setDraft(value=>({...value,media,uploaded:Object.fromEntries(Object.entries(value.uploaded).filter(([id])=>media.some(m=>m.id===id)))}))} onBusyChange={setMediaBusy} disabled={busy} storageNote="未发送的附件先存在本机；点击发送后上传到家庭私密存储，供接收者打开。语音是可选补充。"/></details>}
          <div className="family-send-preview"><h2>发送前看一眼</h2><p>接收人：{others.find(m=>m.userId===(draft.recipientId||others[0]?.userId))?.name||'请先邀请家人'}</p><div className="family-card-preview">{draft.cards.map(id=><PictureCard key={id} id={id} compact/>)}</div><p>{draft.media.length?`还有 ${draft.media.length} 份照片或语音`:draft.cards.length?'只发送选中的图卡':'还没有选图卡'}</p></div>
          <p className={saved?'family-help':'family-warning'} role="status">{demo?'演示内容仅在当前页面中保存':saved?'草稿保留在本机。发送失败可以重试，同一条消息会去重。':'本机草稿保存失败，请保持页面打开。'}</p>
          <button type="button" className="family-primary family-wide" disabled={busy||mediaBusy||!others.length||(!draft.cards.length&&!draft.text.trim()&&!draft.media.length)||(aiSuggested&&!aiChecked)||(me?.role==='elder'&&!data.household.cardsReviewed)} onClick={()=>void send()}><Send size={24}/>{busy?'正在发送，请稍等…':'确认发送给家人'}</button>
          <button type="button" className="family-plain family-wide" disabled={busy||mediaBusy} onClick={()=>void clearDraft()}>清空这次内容</button>
        </section>}
        {view==='message'&&selectedMessage&&<section className="family-section"><h1>{data.members.find(m=>m.userId===selectedMessage.senderId)?.name||'家人'}的消息</h1><p className="family-help">{time(selectedMessage.sentAt)}{selectedMessage.replyTo?' · 回应之前的消息':''}</p>{selectedMessage.withdrawnAt?<p className="family-warning">消息已撤回</p>:<><div className="family-card-full">{selectedMessage.cards.map(id=><PictureCard key={id} id={id}/>)}</div>{mediaView(selectedMessage)}{selectedMessage.text&&<details className="family-more"><summary>补充文字</summary><p>{selectedMessage.text}</p></details>}
          {selectedMessage.recipientId===data.viewer?.userId?<><h2>想怎样回应？</h2><button type="button" className="family-primary family-wide" onClick={()=>compose(selectedMessage.senderId,selectedMessage.id)}>选一张图卡回应<Send size={22}/></button><button type="button" className="family-secondary family-wide" onClick={()=>{if(draft.cards.length||draft.text||draft.media.length){compose(selectedMessage.senderId,selectedMessage.id);return;}setDraft({...freshDraft(),cards:['again'],recipientId:selectedMessage.senderId,replyTo:selectedMessage.id});setView('compose');}}>没看懂，请换个方式说</button></>:<button type="button" className="family-secondary family-wide" disabled={busy} onClick={()=>void work(async()=>{if(demo)setData(value=>value?{...value,messages:value.messages.map(m=>m.id===selectedMessage.id?{...m,withdrawnAt:new Date().toISOString(),cards:[],text:'',media:[],mediaIds:[]}:m)}:value);else await action({action:'withdraw',id:selectedMessage.id});setNotice('消息已撤回，对方已看见的内容无法收回。');})}>撤回自己这条消息</button>}
        </>}</section>}
        {view==='settings'&&<section className="family-settings"><h1>家庭设置</h1><p className="family-help">{me?.name} · {me?.role==='elder'?'老人账号':'家人账号'}。身份由家庭邀请确定。</p>
          {demo?<p className="family-warning">这里是演示角色。真实绑定、照片上传与资料删除请回到家庭设置后使用。</p>:<>
            <section><h2>让家人认出你</h2><label>我的称呼<input maxLength={24} value={profileName} disabled={busy} onChange={e=>setProfileName(e.target.value)}/></label>{profileAvatar&&<img className="family-profile-preview" src={`/api/family/media/${profileAvatar}`} alt="待保存的我的照片"/>}<label className="family-upload"><ImagePlus size={24}/>放一张熟悉的照片<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void saveAvatar(e.target.files?.[0]||null);e.target.value='';}}/></label><button type="button" className="family-primary family-wide" disabled={busy||!profileName.trim()} onClick={()=>void work(async()=>{await action({action:'profile',name:profileName,avatarId:profileAvatar});setNotice('照片和称呼已保存。');})}>保存我的照片和称呼</button><button type="button" className="family-plain" disabled={busy} onClick={()=>setProfileAvatar(null)}>移除照片后再保存</button></section>
            {me?.role==='family'&&<section><h2>一起熟悉图卡</h2><p>请陪老人逐张试一遍，核对含义；不能只看会不会点击。若有误解，先继续陪同使用。</p><label className="family-checkbox"><input type="checkbox" checked={cardsConfirmed} disabled={busy} onChange={e=>setCardsConfirmed(e.target.checked)}/>我们一起确认了这些图卡的含义</label><button type="button" className="family-primary family-wide" disabled={busy} onClick={()=>void work(async()=>{await action({action:'review-cards',reviewed:cardsConfirmed});setNotice(cardsConfirmed?'已开启老人图卡发送；仍可随时关闭。':'已关闭老人独立发送，请继续一起熟悉图卡。');})}>保存图卡使用设置</button></section>}
            {data.household.ownerId===data.viewer?.userId&&<section><h2>邀请家庭成员</h2><p>邀请 48 小时有效，一次使用。只分享给熟悉的家人；对方还需获得站点访问权限，并使用自己的账号。</p><div className="family-button-row">{(['elder','family'] as const).map(role=><button type="button" className="family-secondary" key={role} disabled={busy} onClick={()=>void work(async()=>{const result=await api<{token:string}>('/api/family/action',{action:'invite',role});setGeneratedInvite(`${location.origin}/#join=${result.token}`);})}>生成{role==='elder'?'老人':'家人'}邀请</button>)}</div>{generatedInvite&&<><label>邀请链接<input readOnly value={generatedInvite} onFocus={e=>e.target.select()}/></label><button type="button" className="family-primary" onClick={()=>void work(async()=>{try{await navigator.clipboard.writeText(generatedInvite);setNotice('链接已复制，请只分享给指定家人。');}catch{throw new Error('无法自动复制，请点链接输入框后手动复制。');}})}>复制邀请链接</button></>}<button type="button" className="family-plain" disabled={busy} onClick={()=>void work(async()=>{await action({action:'revoke-invites'});setGeneratedInvite('');setNotice('未使用邀请已撤销。');})}>撤销所有未使用邀请</button></section>}
            {me?.role==='family'&&<section><h2>家庭反馈</h2><p>反馈只保存在这个家庭内。家人可查看并将必要的匿名问题手动转交维护者，附件不会自动附上。</p><button type="button" className="family-secondary" disabled={busy} onClick={()=>void work(async()=>{const result=await api<{items:typeof feedbackItems}>('/api/family/feedback');setFeedbackItems(result.items);setNotice(result.items.length?'已打开家庭反馈。':'当前没有反馈。');})}>查看家庭反馈</button>{feedbackItems.map(item=><div className="family-feedback-item" key={item.id}><strong>{item.category}</strong><p>{item.detail||'没有补充说明'}</p><small>{time(item.created_at)}</small></div>)}</section>}
            <section><h2>资料保存与退出</h2><p>消息、已发送附件及反馈保存 30 天。未发送附件 24 小时后清理，头像保留到移除或退出。记录过期即停止访问；文件在后续家庭访问时分批清理。未打开网页时不会收到后台推送。</p>
              <label className="family-checkbox"><input type="checkbox" checked={deleteConfirmed} disabled={busy} onChange={e=>setDeleteConfirmed(e.target.checked)}/>{data.household.ownerId===data.viewer?.userId?'我确认删除整个家庭的记录、成员绑定和附件，无法恢复':'我确认退出家庭并删除与我相关的消息和上传附件，无法恢复'}</label>
              <button type="button" className="family-danger family-wide" disabled={busy||!deleteConfirmed} onClick={()=>void work(async()=>{await action({action:data.household!.ownerId===data.viewer?.userId?'delete-household':'leave'});setDraft(freshDraft());if(draftKey)try{localStorage.removeItem(draftKey);}catch{}setGeneratedInvite('');setDeleteConfirmed(false);setView('home');setNotice('资料已删除，绑定已解除。');})}>{data.household.ownerId===data.viewer?.userId?'删除家庭资料':'退出并删除我的资料'}</button>
            </section>
          </>}
          <a className="family-secondary family-wide" href="/demo">查看旧版生活互助演示</a>
        </section>}
        {view==='feedback'&&<section className="family-section"><h1>哪里遇到问题了？</h1><div className="family-feedback-choices">{['没看懂','点不了','没有回应','其他问题'].map(category=><button type="button" key={category} aria-pressed={feedbackCategory===category} className={feedbackCategory===category?'selected':''} onClick={()=>setFeedbackCategory(category)}>{category}</button>)}</div>{me?.role==='family'&&<label>补充说明（可不填）<textarea maxLength={240} rows={3} value={feedbackDetail} onChange={e=>setFeedbackDetail(e.target.value)} placeholder="哪里点不了、出现了什么提示；请勿写个人隐私"/></label>}<button type="button" className="family-primary family-wide" disabled={busy} onClick={()=>void work(async()=>{if(!demo)await api('/api/family/action',{action:'feedback',category:feedbackCategory,detail:feedbackDetail});setFeedbackDetail('');setNotice(demo?'已演示记录反馈，不会发送给真实用户。':'反馈已记在家庭内，家人可在家庭设置查看。');})}>记下这个问题</button></section>}
      </>}
      <footer className="family-footer">图卡需要一起熟悉。真实往返需双方主动打开网页。<br/>本版用于轻量沟通试用，不提供紧急救助。</footer>
    </main>
  </div>;
}
