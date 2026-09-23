import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const permissionSchema = z.enum(['viewer', 'operator']).nullable();
const requestSchema = z.strictObject({ userId: z.string().min(1).max(128), expectedEmail: z.email(),
  competitionId: z.string().min(1).max(128), expectedPermission: permissionSchema, permission: permissionSchema,
  reason: z.string().trim().min(1).max(1000), operatorReference: z.string().trim().min(1).max(200) });
export class PaymentAccessError extends Error {
  constructor(message) { super(message); this.name = 'PaymentAccessError'; }
}

export async function managePaymentAccess(db, raw, apply) {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) throw new PaymentAccessError('Invalid payment access request.');
  const input = parsed.data;
  const user = (await db.query('SELECT email,"emailVerified" FROM "user" WHERE id=$1 FOR UPDATE', [input.userId])).rows[0];
  if (!user || user.email !== input.expectedEmail || (input.permission !== null && user.emailVerified !== true))
    throw new PaymentAccessError('Account verification failed.');
  if ((await db.query('SELECT id FROM gyca_competitions WHERE id=$1 FOR SHARE', [input.competitionId])).rows.length === 0)
    throw new PaymentAccessError('Competition not found.');
  const row = (await db.query('SELECT permission FROM gyca_payment_permissions WHERE user_id=$1 AND competition_id=$2 FOR UPDATE',
    [input.userId, input.competitionId])).rows[0];
  const current = permissionSchema.parse(row?.permission ?? null);
  if (current !== input.expectedPermission) throw new PaymentAccessError('Permission changed. Inspect current access before retrying.');
  if (!apply) return { applied: false, currentPermission: current, requestedPermission: input.permission };
  if (input.permission === null) await db.query('DELETE FROM gyca_payment_permissions WHERE user_id=$1 AND competition_id=$2', [input.userId, input.competitionId]);
  else await db.query(`INSERT INTO gyca_payment_permissions(user_id,competition_id,permission) VALUES($1,$2,$3)
    ON CONFLICT(user_id,competition_id) DO UPDATE SET permission=excluded.permission`, [input.userId, input.competitionId, input.permission]);
  await db.query(`INSERT INTO gyca_payment_access_audit(id,user_id,competition_id,previous_permission,permission,reason,operator_reference)
    VALUES($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), input.userId, input.competitionId, current, input.permission, input.reason, input.operatorReference]);
  return { applied: true, previousPermission: current, permission: input.permission };
}
