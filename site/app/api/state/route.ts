import {sessionId,readState,reply,failure} from '@/lib/care-store';
export async function GET(request:Request){try{const id=sessionId(request);return reply(request,id,await readState(id));}catch(error){return failure(error);}}
