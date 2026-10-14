'use client';
import type {MediaRef} from './care-data';

let database:Promise<IDBDatabase>|undefined;
function openDatabase(){
  if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('�����������ܱ��汾���������뻻�ֻ��������������֡��绰��'));return;}
    const request=indexedDB.open('care-local-media-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('media',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{database=undefined;reject(new Error('�����洢�����ã�������������á�'));};
    request.onblocked=()=>{database=undefined;reject(new Error('��ر�������ʾҳ������ԡ�'));};
  });
  return database;
}
export async function saveMedia(blob:Blob,kind:MediaRef['kind'],name:string):Promise<MediaRef>{
  if(!blob.size||blob.size>8*1024*1024)throw new Error('����Ϊ�ջ򳬹� 8 MB���뻻СһЩ����Ƭ����¼��');
  const mime=blob.type;
  if(!(kind==='image'?/^image\/(jpeg|png|webp)$/:/^audio\/(webm|mp4|ogg)(;.*)?$/).test(mime))throw new Error('�ݲ�֧�������ʽ����ʹ�� JPG��PNG��WebP ��Ƭ�������¼����');
  const ref:MediaRef={id:`local-${crypto.randomUUID()}`,kind,mime,name:name.slice(0,80),size:blob.size};
  const db=await openDatabase();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');
    tx.objectStore('media').add({id:ref.id,blob,createdAt:Date.now()});
    tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new Error('����û�б��棬�����Ǳ����ռ䲻�㡣�����Ի�������֡�'));
  });
  return ref;
}
export async function readMedia(id:string,maxAgeMs?:number):Promise<Blob|null>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const req=db.transaction('media','readonly').objectStore('media').get(id);
    req.onsuccess=()=>{const row=req.result;if(row&&maxAgeMs&&Date.now()-row.createdAt>maxAgeMs){void deleteMedia(id).catch(()=>{});resolve(null);}else resolve(row?.blob||null);};req.onerror=()=>reject(new Error('����������ʱ�򲻿���'));
  });
}
export async function deleteMedia(id:string){
  const db=await openDatabase();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').delete(id);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('����δ��ɾ���������ԡ�'));
  });
}
export async function clearLocalMedia(){
  const db=await openDatabase();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').clear();
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('��������δ������������ԡ�'));
  });
}
