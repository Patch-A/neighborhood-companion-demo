export function mountCompanion(api: {getStatus:()=>Promise<{aiAvailable:boolean;usedToday:number}>;suggest:(text:string,consent:boolean)=>Promise<{cards:string[];usedToday:number}>}): ()=>void;
