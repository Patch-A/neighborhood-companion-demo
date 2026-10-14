'use client';
import {useState} from 'react';
import {PictureCard} from './picture-card';
import type {CardId} from '@/lib/picture-cards';
export function AiPractice({provider}:{provider:string}){
  const [input,setInput]=useState('');const [cards,setCards]=useState<CardId[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <details className="family-more"><summary>设置前，先试一试 AI 图卡建议</summary><p className="family-help">这句话会交给{provider}处理，每个账号每天可试 5 次。请只用示例内容，不填个人隐私。这里只生成候选，不会发送给家人。</p><label>我想表达<textarea maxLength={500} rows={2} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder="例如：我想看看家人的照片"/></label>
    <button type="button" className="family-secondary family-wide" disabled={busy||!input.trim()} onClick={()=>void(async()=>{setBusy(true);setError('');setCards([]);try{
      const response=await fetch('/api/family/try-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:input}),signal:AbortSignal.timeout(20000)});
      const result=await response.json() as {cards:CardId[];error?:string};if(!response.ok)throw new Error(result.error||'AI 暂时不可用，可以手动选图卡。');setCards(result.cards);
    }catch(e){setError(e instanceof Error?e.message:'AI 暂时不可用，可以手动选图卡。');}finally{setBusy(false);}})()}>{busy?'正在选择图卡…':`请${provider}选图卡`}</button>
    {error&&<p className="family-warning" role="alert">{error}</p>}{cards.length>0&&<div role="status"><div className="family-card-preview">{cards.map(id=><PictureCard key={id} id={id}/>)}</div><p className="family-help">这是 AI 候选，还没有发送。请核对含义；并非每句话都能用已有图卡表达。</p></div>}
  </details>;
}
