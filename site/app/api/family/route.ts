import {snapshot,okay,failed} from '@/lib/family-store';
export const dynamic='force-dynamic';
export async function GET(){try{return okay(await snapshot());}catch(error){return failed(error);}}
