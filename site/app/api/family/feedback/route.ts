import {context,database,familyOnly,okay,failed} from '@/lib/family-store';
export const dynamic='force-dynamic';
export async function GET(){try{
  const ctx=await context();familyOnly(ctx);
  const rows=await database().prepare('SELECT id,category,detail,created_at FROM family_feedback WHERE household_id=? ORDER BY created_at DESC LIMIT 30').bind(ctx.householdId).all();
  return okay({items:rows.results});
}catch(error){return failed(error);}}
