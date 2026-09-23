import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const requestSchema = z.strictObject({ userId: z.string().min(1).max(128), expectedEmail: z.email(),
  expectedGranted: z.boolean(), grant: z.boolean(), reason: z.string().trim().min(1).max(1000),
  operatorReference: z.string().trim().min(1).max(200) });
export class OrganizerAccessError extends Error {
  constructor(message) { super(message); this.name = 'OrganizerAccessError'; }
}

export async function manageOrganizerAccess(db, raw, apply) {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) throw new OrganizerAccessError('Invalid organizer access request.');
  const input = parsed.data;
  const user = (await db.query('SELECT email,"emailVerified" FROM "user" WHERE id=$1 FOR UPDATE', [input.userId])).rows[0];
  if (!user || user.email !== input.expectedEmail || (input.grant && user.emailVerified !== true))
    throw new OrganizerAccessError('Account verification failed.');
  const granted = (await db.query('SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR UPDATE', [input.userId])).rows.length > 0;
  if (granted !== input.expectedGranted) throw new OrganizerAccessError('Permission changed. Inspect current access before retrying.');
  if (!apply) return { applied: false, currentlyGranted: granted, requestedGranted: input.grant };
  if (input.grant) await db.query('INSERT INTO gyca_competition_editors(user_id) VALUES($1) ON CONFLICT DO NOTHING', [input.userId]);
  else await db.query('DELETE FROM gyca_competition_editors WHERE user_id=$1', [input.userId]);
  await db.query(`INSERT INTO gyca_organizer_access_audit(id,user_id,previously_granted,granted,reason,operator_reference)
    VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), input.userId, granted, input.grant, input.reason, input.operatorReference]);
  return { applied: true, previouslyGranted: granted, granted: input.grant };
}
