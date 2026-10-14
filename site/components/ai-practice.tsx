'use client';
import {useState} from 'react';
import {PictureCard} from './picture-card';
import type {CardId} from '@/lib/picture-cards';
export function AiPractice({provider}:{provider:string}){
  const [input,setInput]=useState('');const [cards,setCards]=useState<CardId[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <details className="family-more"><summary>����ǰ������һ�� AI ͼ������</summary><p className="family-help">��仰�ύ��{provider}������ÿ���˺�ÿ����� 5 �Ρ���ֻ��ʾ�����ݣ����������˽������ֻ���ɺ�ѡ�����ᷢ�͸����ˡ�</p><label>�������<textarea maxLength={500} rows={2} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder="���磺���뿴�����˵���Ƭ"/></label>
    <button type="button" className="family-secondary family-wide" disabled={busy||!input.trim()} onClick={()=>void(async()=>{setBusy(true);setError('');setCards([]);try{
      const response=await fetch('/api/family/try-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:input}),signal:AbortSignal.timeout(20000)});
      const result=await response.json() as {cards:CardId[];error?:string};if(!response.ok)throw new Error(result.error||'AI ��ʱ�����ã������ֶ�ѡͼ����');setCards(result.cards);
    }catch(e){setError(e instanceof Error?e.message:'AI ��ʱ�����ã������ֶ�ѡͼ����');}finally{setBusy(false);}})()}>{busy?'����ѡ��ͼ����':`��${provider}ѡͼ��`}</button>
    {error&&<p className="family-warning" role="alert">{error}</p>}{cards.length>0&&<div role="status"><div className="family-card-preview">{cards.map(id=><PictureCard key={id} id={id}/>)}</div><p className="family-help">���� AI ��ѡ����û�з��͡���˶Ժ��壻����ÿ�仰����������ͼ�����</p></div>}
  </details>;
}
