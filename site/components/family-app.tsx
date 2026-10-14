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
  const data=await response.json() as T & {error?:string};if(!response.ok)throw new Error(data.error||'��ʱû����ɣ������ԡ�');return data as T;
}
function time(value:string){return new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}
function MemberPhoto({member}:{member:FamilyMember}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[member.avatarId]);
  return member.avatarId&&!failed?<img className="family-avatar" src={`/api/family/media/${member.avatarId}`} alt={member.name} onError={()=>setFailed(true)}/>:<span className="family-avatar empty"><Users size={40}/><small>{member.avatarId?'��Ƭδ��':'����˷���Ƭ'}</small></span>;
}
export default function FamilyApp(){
  const [data,setData]=useState<FamilySnapshot|null>(null);const [loading,setLoading]=useState(true);const [demo,setDemo]=useState(false);
  const [view,setView]=useState<'home'|'settings'|'compose'|'message'|'feedback'>('home');const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);const [mediaBusy,setMediaBusy]=useState(false);const lock=useRef(false);
  const [draft,setDraft]=useState<Draft>(freshDraft);const draftRef=useRef(draft);draftRef.current=draft;
  const [pendingDraft,setPendingDraft]=useState<Draft|null>(null);const [draftReady,setDraftReady]=useState(false);const [saved,setSaved]=useState(true);
  const [selected,setSelected]=useState<string|null>(null);const [large,setLarge]=useState(false);const [aiSuggested,setAiSuggested]=useState(false);const [aiChecked,setAiChecked]=useState(false);
  const [inviteToken,setInviteToken]=useState('');const [generatedInvite,setGeneratedInvite]=useState('');const [consent,setConsent]=useState(false);
  const [householdName,setHouseholdName]=useState('�ҵļ���');const [memberName,setMemberName]=useState('');
  const [profileName,setProfileName]=useState('');const [profileAvatar,setProfileAvatar]=useState<string|null>(null);
  const [feedbackCategory,setFeedbackCategory]=useState('û����');const [feedbackDetail,setFeedbackDetail]=useState('');const [feedbackItems,setFeedbackItems]=useState<{id:string;category:string;detail:string;created_at:string}[]>([]);
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
    }catch(e){if(!silent||stateRef.current)setError(e instanceof Error?e.message:'��ʱû�������ϣ������ԡ�');}
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
    }catch{setNotice('�ɲݸ��޷���ȡ���Ѵ��µ����ݡ�');}
    setDraftReady(true);
  },[draftKey,demo,data?.viewer?.userId]);
  useEffect(()=>{if(!draftKey||!draftReady||pendingDraft)return;try{
    if(draft.cards.length||draft.text||draft.media.length)localStorage.setItem(draftKey,JSON.stringify({...draft,aiSuggested}));else localStorage.removeItem(draftKey);setSaved(true);
  }catch{setSaved(false);}},[draftKey,draft,draftReady,pendingDraft,aiSuggested]);
  useEffect(()=>{if(me){setProfileName(me.name);setProfileAvatar(me.avatarId);}setCardsConfirmed(!!data?.household?.cardsReviewed);},[me?.name,me?.avatarId,data?.household?.cardsReviewed]);
  async function work(task:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await task();}catch(e){setError(e instanceof Error?e.message:'��ʱû����ɣ������ԡ�');}finally{lock.current=false;setBusy(false);}}
  async function action(body:unknown){await api('/api/family/action',body);const next=await api<FamilySnapshot>('/api/family');setData(next);}
  function go(next:typeof view){if(busy||mediaBusy)return;setError('');setNotice('');setView(next);}
  function chooseCard(id:CardId){setDraft(value=>({...value,cards:value.cards.includes(id)?value.cards.filter(x=>x!==id):value.cards.length<3?[...value.cards,id]:value.cards}));setAiChecked(false);}
  function compose(recipientId:string,replyTo:string|null=null){
    if(pendingDraft){setNotice('���Ⱦ��������ϴ����ݣ��������¿�ʼ��');return;}
    if(draft.cards.length||draft.text||draft.media.length){setNotice('�ѱ���δ�������ݣ����ȼ������ͻ���գ��ٿ�ʼ�µĻ�Ӧ��');setView('compose');return;}
    setDraft({...freshDraft(),recipientId,replyTo});setAiSuggested(false);setAiChecked(false);setView('compose');setError('');setNotice('');
  }
  async function upload(blob:Blob){const response=await fetch('/api/family/media',{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(45000)});const result=await response.json() as {id:string;kind:string;error?:string};if(!response.ok)throw new Error(result.error||'����û���ϴ��ɹ���');return result;}
  async function send(){await work(async()=>{
    const current=draftRef.current;const recipient=current.recipientId||others[0]?.userId;if(!recipient)throw new Error('��������һλ���˼��룬�ٷ��͡�');
    if(!current.cards.length&&!current.text.trim()&&!current.media.length)throw new Error('����ѡһ��ͼ����������Ƭ��');
    if(aiSuggested&&!aiChecked)throw new Error('���ȼ�� AI �����ͼ�����塣');
    if(demo){if(current.media.length)throw new Error('��ʾģʽ���ϴ�˽�˸�������ͥ���ú����ʹ�á�');
      setData(value=>value?{...value,messages:[demoMessage(value.viewer!.userId,recipient,current.cards,current.text,current.replyTo,current.clientId),...value.messages]}:value);
    }else{
      const uploaded={...current.uploaded};
      for(const item of current.media){if(uploaded[item.id])continue;const blob=await readMedia(item.id,86400000);if(!blob)throw new Error('�����ݸ帽���ѹ��ڻ��Ҳ��������Ƴ����������ӡ�');uploaded[item.id]=(await upload(blob)).id;setDraft(value=>({...value,uploaded:{...uploaded}}));}
      try{await api('/api/family/action',{action:'send',clientId:current.clientId,cards:current.cards,text:current.text,mediaIds:current.media.map(m=>uploaded[m.id]),recipientId:recipient,replyTo:current.replyTo});}
      catch(e){if(e instanceof Error&&e.message.includes('������ʧЧ'))setDraft(value=>({...value,uploaded:{}}));throw e;}
      setData(await api<FamilySnapshot>('/api/family'));
      for(const item of current.media)void deleteMedia(item.id).catch(()=>{});
    }
    setDraft(freshDraft());setPendingDraft(null);setAiSuggested(false);setAiChecked(false);setView('home');setNotice(demo?'�ѱ�����ʾ��Ϣ�����л�ʾ�����˲鿴��':'�ѱ��档�Է�����ҳ�����գ��������Ѿ��鿴��');
  });}
  async function openMessage(message:FamilyMessage){setSelected(message.id);setView('message');setNotice('');setError('');
    if(message.recipientId!==data?.viewer?.userId||message.withdrawnAt)return;
    if(demo)setData(value=>value?{...value,messages:value.messages.map(m=>m.id===message.id?{...m,receivedAt:m.receivedAt||new Date().toISOString(),openedAt:m.openedAt||new Date().toISOString()}:m)}:value);
    else try{await api('/api/family/action',{action:'receipt',kind:'opened',ids:[message.id]});}catch{setError('��Ϣ�Ѵ򿪣����鿴״̬��δͬ�������Ժ�ˢ�¡�');}
  }
  async function saveAvatar(file:File|null){if(!file)return;await work(async()=>{
    if(!file.type.startsWith('image/'))throw new Error('��ѡ����Ƭ��');if(file.size>8*1024*1024)throw new Error('��Ƭ̫����ѡ�񲻳��� 8 MB ��ͼƬ��');
    const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('������Ƭ�򲻿����뻻 JPG��PNG �� WebP ͼƬ��');});
    try{const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('��Ƭ����ʧ�ܣ������ԡ�')),'image/jpeg',.82));
      const result=await upload(blob);setProfileAvatar(result.id);setNotice('��Ƭ���ϴ�����㡰�����ҵ���Ƭ�ͳƺ���������á�');
    }finally{bitmap.close();}
  });}
  async function clearDraft(value=draft){await work(async()=>{
    if(!demo&&Object.values(value.uploaded).length)await api('/api/family/action',{action:'discard-media',ids:Object.values(value.uploaded)});
    for(const item of value.media)await deleteMedia(item.id);
    setDraft(freshDraft());setPendingDraft(null);setAiSuggested(false);setAiChecked(false);setNotice('�����δ���͵����ݺͱ���������');
  });}
  function cardPicker(home=false){return <div className="family-card-grid">{PICTURE_CARDS.filter(c=>!home||!['again','later'].includes(c.id)).map(card=><button type="button" className={`family-card-choice${draft.cards.includes(card.id)?' selected':''}`} key={card.id} aria-pressed={draft.cards.includes(card.id)} disabled={busy||!!pendingDraft||(!draft.cards.includes(card.id)&&draft.cards.length>=3)} onClick={()=>chooseCard(card.id)}><PictureCard id={card.id}/>{draft.cards.includes(card.id)&&<span className="card-check"><Check size={20}/>��ѡ</span>}</button>)}</div>;}
  function mediaView(message:FamilyMessage){return <div className="family-attachments">{message.media.map(file=>file.kind==='image'?<a key={file.id} href={`/api/family/media/${file.id}`} target="_blank" rel="noopener noreferrer" aria-label="�򿪼�����Ƭ�鿴��ͼ"><img src={`/api/family/media/${file.id}`} alt="���˷�������Ƭ" loading="lazy"/></a>:<div key={file.id}><p>�����ǲ��䷽ʽ������ѡ�񲥷�</p><audio controls preload="none" src={`/api/family/media/${file.id}`} aria-label="���ż�������"/></div>)}{message.mediaIds.length>message.media.length&&<p className="family-warning">���ָ����ѹ��������ޣ����ü������·��͡�</p>}</div>;}
  const selectedMessage=data?.messages.find(m=>m.id===selected);
  const latestIncoming=data?.messages.find(m=>m.recipientId===data.viewer?.userId&&!m.openedAt&&!m.withdrawnAt);
  return <div className={`family-shell${large?' family-large':''}`}>
    <header className="family-top"><a href="/" className="family-brand"><span>��</span><strong>�����а�</strong></a><div className="family-top-actions"><button type="button" aria-pressed={large} onClick={()=>setLarge(!large)}><Expand size={20}/>{large?'�ָ��ֺ�':'�ִ�һ��'}</button>{data?.household&&<button type="button" onClick={()=>go(view==='settings'?'home':'settings')} aria-label="��ͥ����"><Settings size={24}/></button>}</div></header>
    <main className="family-main" id="main-content">
      {demo&&<aside className="family-demo-banner"><strong>��ʾ���� �� ͬһ�����ģ��</strong><p>ʹ���鹹���ϣ���������ʵ��Ϣ�����ϴ���������ʾģʽ������ AI��</p><div><button type="button" disabled={busy} onClick={()=>{setData(value=>value?{...value,viewer:{userId:'demo-elder'}}:value);setView('home');}}>ʾ������</button><button type="button" disabled={busy} onClick={()=>{setData(value=>value?{...value,viewer:{userId:'demo-family'}}:value);setView('home');}}>ʾ������</button><a href="/">���ؼ�ͥ����</a></div></aside>}
      {view!=='home'&&<button type="button" className="family-back" disabled={busy||mediaBusy} onClick={()=>go('home')}><ArrowLeft size={22}/>�ص���ҳ</button>}
      {error&&<div className="family-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={()=>demo?setError(''):void load()}><RefreshCw size={20}/>����ͬ��</button></div>}
      {notice&&<p className="family-notice" role="status">{notice}</p>}
      {loading?<div className="family-loading" role="status"><h1>���ڴ򿪼�ͥ��¼</h1><div/><p>�Ե�һ�£����ܿ������˵���Ϣ��</p></div>:!data?<section className="family-onboarding"><h1>��ʱû�д򿪼�¼</h1><button type="button" className="family-primary" onClick={()=>void load()}>����һ��</button><a href="/?demo=1">�ȿ���ͼ����ʾ</a></section>:!data.household?<section className="family-onboarding">
        <span className="family-intro-icon"><Heart size={38}/></span><h1>�ͼ��ˣ�������ʽ˵��</h1><p>����Ϥ����Ƭ������ͼ���������⡣���ɼ������ã���һ����Ϥͼ����</p>
        {!data.viewer?<><a className="family-primary" href="/signin-with-chatgpt?return_to=%2F" target="_top"><LogIn size={22}/>���˵�¼������</a><a className="family-secondary" href="/?demo=1">������ͼ����ʾ</a><p className="family-help">�����ҳ���ð�ʹ�� ChatGPT ��¼��֧������ʽ�������ں����׶Ρ�</p></>:<form onSubmit={(e:FormEvent)=>{e.preventDefault();void work(async()=>{
          if(!consent)throw new Error('�����Ķ���ȷ�ϼ�ͥ����˵����');
          await action(inviteToken?{action:'join',token:inviteToken,name:memberName}:{action:'create',name:householdName,memberName});
          if(inviteToken){history.replaceState(null,'',location.pathname);setInviteToken('');}setNotice('��ͥ���ú��ˣ���ͼ���һ����Ϥͼ����');
        });}}><h2>{inviteToken?'�����������':'�ɼ������ü�ͥ'}</h2><label>���ڼ�ͥ�еĳƺ�<input required maxLength={24} value={memberName} disabled={busy} onChange={e=>setMemberName(e.target.value)} placeholder="���磺Ů��������" autoComplete="off"/></label>{!inviteToken&&<label>��ͥ����<input required maxLength={40} value={householdName} disabled={busy} onChange={e=>setHouseholdName(e.target.value)}/></label>}
          <p className="family-help">��ͥ��Ա�ɿ����ƺ�����Ƭ����Ϣֻ�ڷ���˫��֮��չʾ������ 30 �죻δ���͸������� 24 Сʱ�����˳���ɾ����ͥ���ϡ�����û�ж��Ż��̨���ͣ���Ҫ��������ҳ�鿴��</p>
          <label className="family-checkbox"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>�����˽����÷�Χ�����ϱ��淽ʽ������ò�����ͬ��</label>
          <button className="family-primary" disabled={busy||!consent}>{busy?'�������á�':inviteToken?'���������ͥ':'���ü�ͥ'}</button><a href="/?demo=1">Ҳ������������ʾ</a>
        </form>}
        {data.viewer&&data.aiAvailable&&<AiPractice provider={data.aiProvider||'AI'}/>}
      </section>:<>
        {pendingDraft&&<aside className="family-warning"><p>����һ��δ���͵����ݡ����������������¿�ʼ��</p><div className="family-button-row"><button type="button" disabled={busy} onClick={()=>{setDraft(pendingDraft);setAiSuggested(!!pendingDraft.aiSuggested);setAiChecked(false);setPendingDraft(null);setView('compose');}}>�����ϴ�����</button><button type="button" disabled={busy} onClick={()=>void clearDraft(pendingDraft)}>���¿�ʼ</button></div></aside>}
        {view==='home'&&<>
          <div className="family-heading"><div><p>{me?.role==='elder'?'����Ϥ������ϵ':data.household.name}</p><h1>{me?.role==='elder'?'��ͼ���˵ʲô��':'�������͸�����'}</h1></div><button type="button" aria-label="ˢ�¼�ͥ��Ϣ" disabled={busy} onClick={()=>demo?setNotice('��ʾ��Ϣ�����ڴ�ҳ���С�'):void load()}><RefreshCw size={24}/></button></div>
          {latestIncoming&&<button type="button" className="family-new-message" onClick={()=>void openMessage(latestIncoming)}><MessageCircle size={32}/><span><strong>{data.members.find(m=>m.userId===latestIncoming.senderId)?.name||'����'}������Ϣ</strong><small>������������˵Ļ�Ӧ</small></span><ImagePlus size={28}/></button>}
          {!others.length?<section className="family-empty"><Users size={44}/><h2>���ü��˼���</h2><p>��������󣬶Է�����Ҫ�����վ��ķ���Ȩ�ޣ������Լ����˺ż��롣</p><button type="button" className="family-primary" onClick={()=>go('settings')}>���ü�ͥ����</button></section>:<section className="family-people" aria-label="�ҵļ���">{others.map(member=><button type="button" className="family-person" key={member.userId} disabled={busy} onClick={()=>compose(member.userId)}><MemberPhoto member={member}/><span><strong>{member.name}</strong><small>ѡ��Ƭ��ͼ����ϵ</small></span><Send size={24}/></button>)}</section>}
          {!data.household.cardsReviewed&&<aside className="family-warning">ͼ����ûһ����Ϥ������������������ã�ȷ�Ϻ�����ڼ�ͥ�����п������˷��͡�</aside>}
          {others.length>0&&<section className="family-section"><h2>ѡһ�ţ���������</h2><p className="family-help">ͼ��������ͼ���һ��ȷ�ϣ����ѡ 3 �š�</p>{cardPicker(true)}<button type="button" className="family-primary family-wide" disabled={!draft.cards.length||busy} onClick={()=>{setDraft(value=>({...value,recipientId:value.recipientId||others[0].userId}));go('compose');}}>�������ٷ���<Send size={22}/></button></section>}
          <section className="family-section"><h2>���˵���Ϣ</h2>{!data.messages.length?<div className="family-empty"><MessageCircle size={38}/><p>��û����Ϣ����һ��ͼ������ʼ��һ��������</p></div>:<div className="family-message-list">{data.messages.filter(m=>m.senderId===data.viewer?.userId||m.recipientId===data.viewer?.userId).map(message=>{
            const incoming=message.recipientId===data.viewer?.userId;const member=data.members.find(m=>m.userId===(incoming?message.senderId:message.recipientId));
            return <article className="family-message" key={message.id}><div className="family-message-heading"><strong>{incoming?`${member?.name||'����'}������`:`����${member?.name||'����'}`}</strong><small>{time(message.sentAt)}</small></div>{message.withdrawnAt?<p>������Ϣ�ѳ���</p>:<><div className="family-card-preview">{message.cards.map(id=><PictureCard key={id} id={id} compact/>)}</div>{!message.cards.length&&<p>{message.media.length?'���˷�������Ƭ������':'���˷�����һ�仰'}</p>}<button type="button" className="family-secondary family-wide" onClick={()=>void openMessage(message)}>{incoming?'�򿪿���':'�鿴����'}<ImagePlus size={22}/></button></>}<p className="family-delivery">{incoming?(message.openedAt?'���Ѵ�������Ϣ':'�򿪺���Ի�Ӧ'):messageStatus(message)}</p></article>;
          })}</div>}</section>
          <button type="button" className="family-secondary family-wide" onClick={()=>go('feedback')}>�������⣬���߼���</button>
        </>}
        {view==='compose'&&<section className="family-section"><h1>{draft.replyTo?'��Ӧ����':'׼����������'}</h1><label>���͸�<select value={draft.recipientId||others[0]?.userId||''} disabled={busy||!!draft.replyTo} onChange={e=>setDraft(value=>({...value,recipientId:e.target.value}))}>{others.map(m=><option value={m.userId} key={m.userId}>{m.name}</option>)}</select></label>{cardPicker()}
          {me?.role==='family'&&<div className="family-text-input"><label>���˲���һ�仰���ɲ��<textarea maxLength={500} rows={3} value={draft.text} disabled={busy} onChange={e=>{setDraft(value=>({...value,text:e.target.value}));setAiChecked(false);}} placeholder="ͼ�����ﲻ�˵ľ��尲�ţ�������Ϥ��Ƭ����ȷ��"/></label><p className="family-help">���˿��ܲ�ʶ�֣�����ֻ�ܲ��䣬���ܴ��������Ļ�Ӧ��</p>
            <button type="button" className="family-secondary family-wide" disabled={busy||demo||!data.aiAvailable||!draft.text.trim()} onClick={()=>void work(async()=>{const result=await api<{cards:CardId[]}>('/api/family/suggest',{text:draft.text});setDraft(value=>({...value,cards:result.cards}));setAiSuggested(true);setAiChecked(false);setNotice('AI ֻ������ѡ�������ź˶ԡ���û�з��͡�');})}>�� AI ����ѡͼ��</button>
            {!data.aiAvailable&&<p className="family-help">{demo?'��ʾģʽ�ֶ�ѡ��ͼ���������� AI��':'AI ��δ���룬���ڿ����ֶ�ѡͼ����'}</p>}
            {data.aiAvailable&&<p className="family-help">�������仰������{data.aiProvider}��������������֤����סַ��ҽ�Ƶ��������ϣ�AI ÿ��ͥÿ����� 20 �Ρ�</p>}
          </div>}
          {aiSuggested&&<label className="family-checkbox"><input type="checkbox" checked={aiChecked} disabled={busy} onChange={e=>setAiChecked(e.target.checked)}/>���Ѻ˶�ͼ�����壬û������ԭ��δ����ĳ�ŵ</label>}
          {!demo&&<details className="family-more"><summary>Ҳ���Լ���Ƭ������</summary><MediaComposer value={draft.media} onChange={media=>setDraft(value=>({...value,media,uploaded:Object.fromEntries(Object.entries(value.uploaded).filter(([id])=>media.some(m=>m.id===id)))}))} onBusyChange={setMediaBusy} disabled={busy} storageNote="δ���͵ĸ����ȴ��ڱ�����������ͺ��ϴ�����ͥ˽�ܴ洢���������ߴ򿪡������ǿ�ѡ���䡣"/></details>}
          <div className="family-send-preview"><h2>����ǰ��һ��</h2><p>�����ˣ�{others.find(m=>m.userId===(draft.recipientId||others[0]?.userId))?.name||'�����������'}</p><div className="family-card-preview">{draft.cards.map(id=><PictureCard key={id} id={id} compact/>)}</div><p>{draft.media.length?`���� ${draft.media.length} ����Ƭ������`:draft.cards.length?'ֻ����ѡ�е�ͼ��':'��û��ѡͼ��'}</p></div>
          <p className={saved?'family-help':'family-warning'} role="status">{demo?'��ʾ���ݽ��ڵ�ǰҳ���б���':saved?'�ݸ屣���ڱ���������ʧ�ܿ������ԣ�ͬһ����Ϣ��ȥ�ء�':'�����ݸ屣��ʧ�ܣ��뱣��ҳ��򿪡�'}</p>
          <button type="button" className="family-primary family-wide" disabled={busy||mediaBusy||!others.length||(!draft.cards.length&&!draft.text.trim()&&!draft.media.length)||(aiSuggested&&!aiChecked)||(me?.role==='elder'&&!data.household.cardsReviewed)} onClick={()=>void send()}><Send size={24}/>{busy?'���ڷ��ͣ����Եȡ�':'ȷ�Ϸ��͸�����'}</button>
          <button type="button" className="family-plain family-wide" disabled={busy||mediaBusy} onClick={()=>void clearDraft()}>����������</button>
        </section>}
        {view==='message'&&selectedMessage&&<section className="family-section"><h1>{data.members.find(m=>m.userId===selectedMessage.senderId)?.name||'����'}����Ϣ</h1><p className="family-help">{time(selectedMessage.sentAt)}{selectedMessage.replyTo?' �� ��Ӧ֮ǰ����Ϣ':''}</p>{selectedMessage.withdrawnAt?<p className="family-warning">��Ϣ�ѳ���</p>:<><div className="family-card-full">{selectedMessage.cards.map(id=><PictureCard key={id} id={id}/>)}</div>{mediaView(selectedMessage)}{selectedMessage.text&&<details className="family-more"><summary>��������</summary><p>{selectedMessage.text}</p></details>}
          {selectedMessage.recipientId===data.viewer?.userId?<><h2>��������Ӧ��</h2><button type="button" className="family-primary family-wide" onClick={()=>compose(selectedMessage.senderId,selectedMessage.id)}>ѡһ��ͼ����Ӧ<Send size={22}/></button><button type="button" className="family-secondary family-wide" onClick={()=>{if(draft.cards.length||draft.text||draft.media.length){compose(selectedMessage.senderId,selectedMessage.id);return;}setDraft({...freshDraft(),cards:['again'],recipientId:selectedMessage.senderId,replyTo:selectedMessage.id});setView('compose');}}>û�������뻻����ʽ˵</button></>:<button type="button" className="family-secondary family-wide" disabled={busy} onClick={()=>void work(async()=>{if(demo)setData(value=>value?{...value,messages:value.messages.map(m=>m.id===selectedMessage.id?{...m,withdrawnAt:new Date().toISOString(),cards:[],text:'',media:[],mediaIds:[]}:m)}:value);else await action({action:'withdraw',id:selectedMessage.id});setNotice('��Ϣ�ѳ��أ��Է��ѿ����������޷��ջء�');})}>�����Լ�������Ϣ</button>}
        </>}</section>}
        {view==='settings'&&<section className="family-settings"><h1>��ͥ����</h1><p className="family-help">{me?.name} �� {me?.role==='elder'?'�����˺�':'�����˺�'}�������ɼ�ͥ����ȷ����</p>
          {demo?<p className="family-warning">��������ʾ��ɫ����ʵ�󶨡���Ƭ�ϴ�������ɾ����ص���ͥ���ú�ʹ�á�</p>:<>
            <section><h2>�ü����ϳ���</h2><label>�ҵĳƺ�<input maxLength={24} value={profileName} disabled={busy} onChange={e=>setProfileName(e.target.value)}/></label>{profileAvatar&&<img className="family-profile-preview" src={`/api/family/media/${profileAvatar}`} alt="��������ҵ���Ƭ"/>}<label className="family-upload"><ImagePlus size={24}/>��һ����Ϥ����Ƭ<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void saveAvatar(e.target.files?.[0]||null);e.target.value='';}}/></label><button type="button" className="family-primary family-wide" disabled={busy||!profileName.trim()} onClick={()=>void work(async()=>{await action({action:'profile',name:profileName,avatarId:profileAvatar});setNotice('��Ƭ�ͳƺ��ѱ��档');})}>�����ҵ���Ƭ�ͳƺ�</button><button type="button" className="family-plain" disabled={busy} onClick={()=>setProfileAvatar(null)}>�Ƴ���Ƭ���ٱ���</button></section>
            {me?.role==='family'&&<section><h2>һ����Ϥͼ��</h2><p>��������������һ�飬�˶Ժ��壻����ֻ���᲻������������⣬�ȼ�����ͬʹ�á�</p><label className="family-checkbox"><input type="checkbox" checked={cardsConfirmed} disabled={busy} onChange={e=>setCardsConfirmed(e.target.checked)}/>����һ��ȷ������Щͼ���ĺ���</label><button type="button" className="family-primary family-wide" disabled={busy} onClick={()=>void work(async()=>{await action({action:'review-cards',reviewed:cardsConfirmed});setNotice(cardsConfirmed?'�ѿ�������ͼ�����ͣ��Կ���ʱ�رա�':'�ѹر����˶������ͣ������һ����Ϥͼ����');})}>����ͼ��ʹ������</button></section>}
            {data.household.ownerId===data.viewer?.userId&&<section><h2>�����ͥ��Ա</h2><p>���� 48 Сʱ��Ч��һ��ʹ�á�ֻ��������Ϥ�ļ��ˣ��Է�������վ�����Ȩ�ޣ���ʹ���Լ����˺š�</p><div className="family-button-row">{(['elder','family'] as const).map(role=><button type="button" className="family-secondary" key={role} disabled={busy} onClick={()=>void work(async()=>{const result=await api<{token:string}>('/api/family/action',{action:'invite',role});setGeneratedInvite(`${location.origin}/#join=${result.token}`);})}>����{role==='elder'?'����':'����'}����</button>)}</div>{generatedInvite&&<><label>��������<input readOnly value={generatedInvite} onFocus={e=>e.target.select()}/></label><button type="button" className="family-primary" onClick={()=>void work(async()=>{try{await navigator.clipboard.writeText(generatedInvite);setNotice('�����Ѹ��ƣ���ֻ������ָ�����ˡ�');}catch{throw new Error('�޷��Զ����ƣ���������������ֶ����ơ�');}})}>������������</button></>}<button type="button" className="family-plain" disabled={busy} onClick={()=>void work(async()=>{await action({action:'revoke-invites'});setGeneratedInvite('');setNotice('δʹ�������ѳ�����');})}>��������δʹ������</button></section>}
            {me?.role==='family'&&<section><h2>��ͥ����</h2><p>����ֻ�����������ͥ�ڡ����˿ɲ鿴������Ҫ�����������ֶ�ת��ά���ߣ����������Զ����ϡ�</p><button type="button" className="family-secondary" disabled={busy} onClick={()=>void work(async()=>{const result=await api<{items:typeof feedbackItems}>('/api/family/feedback');setFeedbackItems(result.items);setNotice(result.items.length?'�Ѵ򿪼�ͥ������':'��ǰû�з�����');})}>�鿴��ͥ����</button>{feedbackItems.map(item=><div className="family-feedback-item" key={item.id}><strong>{item.category}</strong><p>{item.detail||'û�в���˵��'}</p><small>{time(item.created_at)}</small></div>)}</section>}
            <section><h2>���ϱ������˳�</h2><p>��Ϣ���ѷ��͸������������� 30 �졣δ���͸��� 24 Сʱ��������ͷ�������Ƴ����˳�����¼���ڼ�ֹͣ���ʣ��ļ��ں�����ͥ����ʱ����������δ����ҳʱ�����յ���̨���͡�</p>
              <label className="family-checkbox"><input type="checkbox" checked={deleteConfirmed} disabled={busy} onChange={e=>setDeleteConfirmed(e.target.checked)}/>{data.household.ownerId===data.viewer?.userId?'��ȷ��ɾ��������ͥ�ļ�¼����Ա�󶨺͸������޷��ָ�':'��ȷ���˳���ͥ��ɾ��������ص���Ϣ���ϴ��������޷��ָ�'}</label>
              <button type="button" className="family-danger family-wide" disabled={busy||!deleteConfirmed} onClick={()=>void work(async()=>{await action({action:data.household!.ownerId===data.viewer?.userId?'delete-household':'leave'});setDraft(freshDraft());if(draftKey)try{localStorage.removeItem(draftKey);}catch{}setGeneratedInvite('');setDeleteConfirmed(false);setView('home');setNotice('������ɾ�������ѽ����');})}>{data.household.ownerId===data.viewer?.userId?'ɾ����ͥ����':'�˳���ɾ���ҵ�����'}</button>
            </section>
          </>}
          <a className="family-secondary family-wide" href="/demo">�鿴�ɰ��������ʾ</a>
        </section>}
        {view==='feedback'&&<section className="family-section"><h1>�������������ˣ�</h1><div className="family-feedback-choices">{['û����','�㲻��','û�л�Ӧ','��������'].map(category=><button type="button" key={category} aria-pressed={feedbackCategory===category} className={feedbackCategory===category?'selected':''} onClick={()=>setFeedbackCategory(category)}>{category}</button>)}</div>{me?.role==='family'&&<label>����˵�����ɲ��<textarea maxLength={240} rows={3} value={feedbackDetail} onChange={e=>setFeedbackDetail(e.target.value)} placeholder="����㲻�ˡ�������ʲô��ʾ������д������˽"/></label>}<button type="button" className="family-primary family-wide" disabled={busy} onClick={()=>void work(async()=>{if(!demo)await api('/api/family/action',{action:'feedback',category:feedbackCategory,detail:feedbackDetail});setFeedbackDetail('');setNotice(demo?'����ʾ��¼���������ᷢ�͸���ʵ�û���':'�����Ѽ��ڼ�ͥ�ڣ����˿��ڼ�ͥ���ò鿴��');})}>�����������</button></section>}
      </>}
      <footer className="family-footer">ͼ����Ҫһ����Ϥ����ʵ������˫����������ҳ��<br/>��������������ͨ���ã����ṩ����������</footer>
    </main>
  </div>;
}
