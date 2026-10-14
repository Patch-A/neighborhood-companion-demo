'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,Mic,Square,Trash2} from 'lucide-react';
import type {MediaRef} from '@/lib/care-data';
import {deleteMedia,readMedia,saveMedia} from '@/lib/local-media';

export function LocalAttachment({item}:{item:MediaRef}){
  const [url,setUrl]=useState('');const [missing,setMissing]=useState(false);
  useEffect(()=>{let disposed=false;let objectUrl='';setMissing(false);
    readMedia(item.id).then(blob=>{if(disposed)return;if(!blob){setMissing(true);return;}objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(()=>{if(!disposed)setMissing(true);});
    return()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[item.id]);
  if(missing)return <p className="media-missing">{item.kind==='audio'?'����':'��Ƭ'}������ԭ�����豸�������Ҳ�����δ�ϴ������˶ˡ�</p>;
  if(!url)return <p className="media-note">���ڴ򿪱���{item.kind==='audio'?'����':'��Ƭ'}��</p>;
  return item.kind==='audio'?<div className="audio-attachment"><span>�㲥�ţ���������һ��</span><audio controls preload="metadata" src={url} aria-label="������������"/><small>�������� �� ���Զ�����</small></div>:<a className="photo-attachment" href={url} target="_blank" rel="noopener noreferrer" aria-label="����Ƭ�鿴��ͼ"><img src={url} alt="������������Ƭ"/><span>����Ƭ����ͼ</span></a>;
}

export function MediaComposer({value,onChange,onBusyChange,photos=true,disabled=false,storageNote='����������������������δ�ϴ����͸���ʵ���ˡ�����ʾ���������顣'}:{value:MediaRef[];onChange:(v:MediaRef[])=>void;onBusyChange?:(busy:boolean)=>void;photos?:boolean;disabled?:boolean;storageNote?:string}){
  const [phase,setPhase]=useState<'idle'|'permission'|'recording'|'saving'>('idle');
  const [seconds,setSeconds]=useState(0);const [error,setError]=useState('');
  const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);const timer=useRef<ReturnType<typeof setInterval>|null>(null);const mounted=useRef(true);
  const latest=useRef({value,onChange,onBusyChange});latest.current={value,onChange,onBusyChange};
  const busy=phase!=='idle';
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(timer.current)clearInterval(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());latest.current.onBusyChange?.(false);};},[]);
  const stop=()=>{if(recorder.current?.state==='recording'){setPhase('saving');recorder.current.stop();}if(timer.current){clearInterval(timer.current);timer.current=null;}stream.current?.getTracks().forEach(t=>t.stop());};
  async function start(){
    if(busy||disabled)return;setError('');
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('��ǰ�������֧��¼�����뻻�ֻ����������������Ƭ�����֡��绰��');return;}
    setPhase('permission');
    try{
      const tracks=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){tracks.getTracks().forEach(t=>t.stop());return;}stream.current=tracks;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));
      if(!mime)throw new Error('��ǰ�豸¼����ʽ�ݲ�֧�֣��������Ƭ�����ֻ�绰��');
      const rec=new MediaRecorder(tracks,{mimeType:mime});recorder.current=rec;const chunks:BlobPart[]=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onerror=()=>{setError('¼���жϣ�û�з��͡�����¼����õ绰��');stop();};
      rec.onstop=async()=>{
        tracks.getTracks().forEach(t=>t.stop());if(timer.current)clearInterval(timer.current);timer.current=null;
        if(!mounted.current)return;
        setPhase('saving');
        try{const attachment=await saveMedia(new Blob(chunks,{type:rec.mimeType}),'audio','��������');if(mounted.current)latest.current.onChange([...latest.current.value.filter(x=>x.kind!=='audio'),attachment]);}
        catch(e){if(mounted.current)setError(e instanceof Error?e.message:'¼��û�б��棬����¼��');}
        finally{if(mounted.current)setPhase('idle');recorder.current=null;stream.current=null;}
      };
      rec.start();setSeconds(0);setPhase('recording');let elapsed=0;
      timer.current=setInterval(()=>{elapsed++;setSeconds(elapsed);if(elapsed>=60)stop();},1000);
    }catch(e){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(mounted.current){setPhase('idle');setError(e instanceof Error&&e.name==='NotAllowedError'?'û����˷�Ȩ�ޡ���������������������������������Ƭ�����֡��绰��':e instanceof Error?e.message:'¼��û�������������ԡ�');}}
  }
  async function addPhotos(files:FileList|null){
    if(!files?.length)return;setError('');const count=value.filter(x=>x.kind==='image').length;
    if(count+files.length>3){setError('������� 3 ����Ƭ�������Ƴ��������Ƭ��');return;}
    setPhase('saving');const added:MediaRef[]=[];
    try{for(const file of Array.from(files))added.push(await saveMedia(file,'image','������Ƭ'));if(mounted.current)latest.current.onChange([...latest.current.value,...added]);}
    catch(e){for(const ref of added)await deleteMedia(ref.id).catch(()=>{});if(mounted.current)setError(e instanceof Error?e.message:'��Ƭû�б��棬�����ԡ�');}
    finally{if(mounted.current)setPhase('idle');}
  }
  async function remove(item:MediaRef){try{await deleteMedia(item.id);onChange(value.filter(x=>x.id!==item.id));setError('');}catch(e){setError(e instanceof Error?e.message:'û���Ƴ��������ԡ�');}}
  const audio=value.some(x=>x.kind==='audio');
  return <div className="media-composer">
    <div className="media-controls">
      {phase==='recording'?<button type="button" className="btn recording-button" onClick={stop}><Square size={22}/>˵���� �� {seconds} ��</button>:<button type="button" className="btn btn-primary" onClick={()=>void start()} disabled={busy||disabled||audio}><Mic size={22}/>{phase==='permission'?'��������˷�':phase==='saving'?'���ڱ��桭':audio?'������¼��':'��ʼ˵��'}</button>}
      {photos&&<><label className="btn btn-secondary file-button"><Camera size={22}/>����Ƭ<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy||disabled} onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label><label className="btn btn-secondary file-button">ѡ��Ƭ<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||disabled} onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label></>}
    </div>
    <p className="media-note" role="status">{phase==='recording'?'����¼����� 60 �룻˵���������İ�ť��':'����һֱ��ס��˵��������������������Ƴ���¼��'}</p>
    {value.map(item=><div className="attachment-edit" key={item.id}><LocalAttachment item={item}/><button type="button" className="btn btn-secondary" disabled={busy||disabled} onClick={()=>void remove(item)}><Trash2 size={18}/>�Ƴ�{item.kind==='audio'?'����������¼':'��Ƭ'}</button></div>)}
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <p className="media-note">{storageNote}</p>
  </div>;
}
