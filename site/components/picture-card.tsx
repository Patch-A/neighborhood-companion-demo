import {PICTURE_CARDS,type CardId} from '@/lib/picture-cards';

// Fixed drawings keep visual meanings stable. They still require user validation.
export function PictureCard({id,compact=false}:{id:CardId;compact?:boolean}){
  const card=PICTURE_CARDS.find(c=>c.id===id)!;
  const person=(x:number,y:number,color:string)=> <g><circle cx={x} cy={y} r="12" fill="#ad7156"/><path d={`M${x-17} ${y+38} Q${x-18} ${y+13} ${x} ${y+15} Q${x+18} ${y+13} ${x+17} ${y+38}`} fill={color}/><path d={`M${x-8} ${y+38} l-3 16 M${x+8} ${y+38} l3 16`} stroke="#354b40" strokeWidth="7" strokeLinecap="round"/></g>;
  return <span className={`picture-card-art${compact?' compact':''}`}>
    <svg viewBox="0 0 160 130" role="img" aria-label={card.hint}>
      <rect x="2" y="2" width="156" height="126" rx="24" fill="#edf2e7"/>
      {card.scene==='together'&&<><path d="M20 111 H140" stroke="#9ab898" strokeWidth="5" strokeLinecap="round"/>{person(50,43,'#527b5c')}{person(110,43,'#c27b48')}<path d="M68 75 Q80 64 92 75" fill="none" stroke="#527b5c" strokeWidth="7" strokeLinecap="round"/><path d="M80 17 C66 2 48 23 80 40 C112 23 94 2 80 17" fill="#b55047"/></>}
      {card.scene==='photo'&&<><rect x="30" y="13" width="100" height="101" rx="12" fill="#fffdfa" stroke="#527b5c" strokeWidth="5"/><circle cx="109" cy="33" r="9" fill="#dbb05a"/><path d="M37 101 L57 81 L79 102 L106 78 L123 101" fill="#a8c49c"/>{person(68,42,'#c27b48')}<path d="M65 116 H95" stroke="#527b5c" strokeWidth="5" strokeLinecap="round"/></>}
      {card.scene==='walk'&&<><path d="M36 120 Q86 86 151 93" stroke="#ccb879" strokeWidth="13" fill="none"/>{person(55,38,'#527b5c')}{person(104,49,'#c27b48')}<path d="M134 40 V76" stroke="#83664c" strokeWidth="5"/><circle cx="135" cy="28" r="20" fill="#8cae79"/></>}
      {card.scene==='hello'&&<>{person(72,42,'#527b5c')}<path d="M90 72 L113 53 L117 27" stroke="#ad7156" strokeWidth="9" fill="none" strokeLinecap="round"/><path d="M129 23 Q138 37 130 52 M138 18 Q154 37 143 58" stroke="#b77c37" strokeWidth="4" fill="none" strokeLinecap="round"/><circle cx="50" cy="31" r="17" fill="#fffdfa"/><path d="M42 32 Q50 44 58 32" stroke="#527b5c" strokeWidth="3" fill="none" strokeLinecap="round"/></>}
      {card.scene==='again'&&<><rect x="26" y="20" width="108" height="73" rx="23" fill="#fffdfa" stroke="#b07c35" strokeWidth="5"/><path d="M45 94 L40 112 L67 95" fill="#fffdfa" stroke="#b07c35" strokeWidth="5" strokeLinejoin="round"/><path d="M65 41 Q64 27 79 29 Q100 31 94 46 Q91 53 80 58 V65" stroke="#7d572a" strokeWidth="7" fill="none" strokeLinecap="round"/><circle cx="80" cy="80" r="4" fill="#7d572a"/></>}
      {card.scene==='later'&&<><circle cx="80" cy="62" r="41" fill="#fffdfa" stroke="#527b5c" strokeWidth="6"/><path d="M80 35 V63 L102 75" stroke="#527b5c" strokeWidth="7" fill="none" strokeLinecap="round"/><path d="M115 99 H143 M133 88 L144 99 L133 110" stroke="#b07c35" strokeWidth="6" fill="none" strokeLinecap="round"/></>}
    </svg><strong>{card.label}</strong>
  </span>;
}
