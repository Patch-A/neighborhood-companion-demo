// One conditional INSERT is atomic across Worker isolates; reserve before the model call.
export const RESERVE_SQL = `INSERT INTO ai_reservations(id,day,minute,client)
SELECT ?,?,?,? WHERE
(SELECT COUNT(*) FROM ai_reservations WHERE day=?) < 50 AND
(SELECT COUNT(*) FROM ai_reservations WHERE minute=?) < 10 AND
(SELECT COUNT(*) FROM ai_reservations WHERE client=? AND day=?) < 5 AND
(SELECT COUNT(*) FROM ai_reservations WHERE client=? AND minute=?) < 2
RETURNING id`;
export function dayAt(now) { return new Date(now+8*3600000).toISOString().slice(0,10); }
export async function reserve(db,client,now) {
  const day=dayAt(now),minute=Math.floor(now/60000);
  const row=await db.prepare(RESERVE_SQL).bind(crypto.randomUUID(),day,minute,client,day,minute,client,day,client,minute).first();
  return !!row;
}
export async function usedToday(db,now) {
  // Bounded synthetic metadata only; cleanup runs on status visits, not an unattended timer.
  await db.prepare('DELETE FROM ai_reservations WHERE day < ?').bind(dayAt(now-2*86400000)).run();
  const row=await db.prepare('SELECT COUNT(*) AS count FROM ai_reservations WHERE day=?').bind(dayAt(now)).first();
  return row.count;
}
