'use client';
import type {MediaRef} from './care-data';

let database:Promise<IDBDatabase>|undefined;
function openDatabase(){
  if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('这个浏览器不能保存本机附件，请换手机浏览器或改用文字、电话。'));return;}
    const request=indexedDB.open('care-local-media-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('media',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{database=undefined;reject(new Error('本机存储不可用，请检查浏览器设置。'));};
    request.onblocked=()=>{database=undefined;reject(new Error('请关闭其他演示页面后重试。'));};
  });
  return database;
}
export async function saveMedia(blob:Blob,kind:MediaRef['kind'],name:string):Promise<MediaRef>{
  if(!blob.size||blob.size>8*1024*1024)throw new Error('附件为空或超过 8 MB，请换小一些的照片或重录。');
  const mime=blob.type;
  if(!(kind==='image'?/^image\/(jpeg|png|webp)$/:/^audio\/(webm|mp4|ogg)(;.*)?$/).test(mime))throw new Error('暂不支持这个格式，请使用 JPG、PNG、WebP 照片或浏览器录音。');
  const ref:MediaRef={id:`local-${crypto.randomUUID()}`,kind,mime,name:name.slice(0,80),size:blob.size};
  const db=await openDatabase();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');
    tx.objectStore('media').add({id:ref.id,blob,createdAt:Date.now()});
    tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new Error('附件没有保存，可能是本机空间不足。请重试或改用文字。'));
  });
  return ref;
}
export async function readMedia(id:string):Promise<Blob|null>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const req=db.transaction('media','readonly').objectStore('media').get(id);
    req.onsuccess=()=>resolve(req.result?.blob||null);req.onerror=()=>reject(new Error('本机附件暂时打不开。'));
  });
}
export async function deleteMedia(id:string){
  const db=await openDatabase();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').delete(id);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('附件未能删除，请重试。'));
  });
}
export async function clearLocalMedia(){
  const db=await openDatabase();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').clear();
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('本机附件未能清除，请重试。'));
  });
}
