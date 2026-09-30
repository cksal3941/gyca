import { auth } from "@/lib/auth";
import { database } from "@/server/database";
import { configuredTossProvider } from "@/server/payments/toss";
import { createPaymentOptions } from "@/server/payments/options";
import { createPaymentOptionsHandler } from "@/server/payments/options-http";

const provider = configuredTossProvider(process.env);
const handler = createPaymentOptionsHandler({
  service: createPaymentOptions(database, { providers: provider === null ? [] : [provider], now: () => new Date() }),
  origin: process.env.BETTER_AUTH_URL, now: () => new Date(),
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handler(request, (await context.params).id);
}
