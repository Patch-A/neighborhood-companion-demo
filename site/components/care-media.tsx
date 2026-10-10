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
  if(missing)return <p className="media-missing">{item.kind==='audio'?'语音':'照片'}仅存在原来的设备；本机找不到，未上传到家人端。</p>;
  if(!url)return <p className="media-note">正在打开本机{item.kind==='audio'?'语音':'照片'}…</p>;
  return item.kind==='audio'?<div className="audio-attachment"><span>点播放，可以再听一遍</span><audio controls preload="metadata" src={url} aria-label="播放语音留言"/><small>本机语音 · 不自动播放</small></div>:<a className="photo-attachment" href={url} target="_blank" rel="noopener noreferrer" aria-label="打开照片查看大图"><img src={url} alt="求助附带的照片"/><span>点照片看大图</span></a>;
}

export function MediaComposer({value,onChange,onBusyChange,photos=true,disabled=false}:{value:MediaRef[];onChange:(v:MediaRef[])=>void;onBusyChange?:(busy:boolean)=>void;photos?:boolean;disabled?:boolean}){
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
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('当前浏览器不支持录音，请换手机浏览器，或先用照片、文字、电话。');return;}
    setPhase('permission');
    try{
      const tracks=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){tracks.getTracks().forEach(t=>t.stop());return;}stream.current=tracks;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));
      if(!mime)throw new Error('当前设备录音格式暂不支持，请改用照片、文字或电话。');
      const rec=new MediaRecorder(tracks,{mimeType:mime});recorder.current=rec;const chunks:BlobPart[]=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onerror=()=>{setError('录音中断，没有发送。请重录或改用电话。');stop();};
      rec.onstop=async()=>{
        tracks.getTracks().forEach(t=>t.stop());if(timer.current)clearInterval(timer.current);timer.current=null;
        if(!mounted.current)return;
        setPhase('saving');
        try{const attachment=await saveMedia(new Blob(chunks,{type:rec.mimeType}),'audio','语音留言');if(mounted.current)latest.current.onChange([...latest.current.value.filter(x=>x.kind!=='audio'),attachment]);}
        catch(e){if(mounted.current)setError(e instanceof Error?e.message:'录音没有保存，请重录。');}
        finally{if(mounted.current)setPhase('idle');recorder.current=null;stream.current=null;}
      };
      rec.start();setSeconds(0);setPhase('recording');let elapsed=0;
      timer.current=setInterval(()=>{elapsed++;setSeconds(elapsed);if(elapsed>=60)stop();},1000);
    }catch(e){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(mounted.current){setPhase('idle');setError(e instanceof Error&&e.name==='NotAllowedError'?'没有麦克风权限。你可以在浏览器设置中允许，或先用照片、文字、电话。':e instanceof Error?e.message:'录音没有启动，请重试。');}}
  }
  async function addPhotos(files:FileList|null){
    if(!files?.length)return;setError('');const count=value.filter(x=>x.kind==='image').length;
    if(count+files.length>3){setError('最多添加 3 张照片，请先移除多余的照片。');return;}
    setPhase('saving');const added:MediaRef[]=[];
    try{for(const file of Array.from(files))added.push(await saveMedia(file,'image','求助照片'));if(mounted.current)latest.current.onChange([...latest.current.value,...added]);}
    catch(e){for(const ref of added)await deleteMedia(ref.id).catch(()=>{});if(mounted.current)setError(e instanceof Error?e.message:'照片没有保存，请重试。');}
    finally{if(mounted.current)setPhase('idle');}
  }
  async function remove(item:MediaRef){try{await deleteMedia(item.id);onChange(value.filter(x=>x.id!==item.id));setError('');}catch(e){setError(e instanceof Error?e.message:'没有移除，请重试。');}}
  const audio=value.some(x=>x.kind==='audio');
  return <div className="media-composer">
    <div className="media-controls">
      {phase==='recording'?<button type="button" className="btn recording-button" onClick={stop}><Square size={22}/>说完了 · {seconds} 秒</button>:<button type="button" className="btn btn-primary" onClick={()=>void start()} disabled={busy||disabled||audio}><Mic size={22}/>{phase==='permission'?'请允许麦克风':phase==='saving'?'正在保存…':audio?'语音已录好':'开始说话'}</button>}
      {photos&&<><label className="btn btn-secondary file-button"><Camera size={22}/>拍照片<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy||disabled} onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label><label className="btn btn-secondary file-button">选照片<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||disabled} onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label></>}
    </div>
    <p className="media-note" role="status">{phase==='recording'?'正在录音，最长 60 秒；说完请点上面的按钮。':'不用一直按住。说完后可以试听，不满意就移除重录。'}</p>
    {value.map(item=><div className="attachment-edit" key={item.id}><LocalAttachment item={item}/><button type="button" className="btn btn-secondary" disabled={busy||disabled} onClick={()=>void remove(item)}><Trash2 size={18}/>移除{item.kind==='audio'?'语音，重新录':'照片'}</button></div>)}
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <p className="media-note">附件仅保存在这个浏览器，未上传或发送给真实家人。请用示例内容体验。</p>
  </div>;
}
