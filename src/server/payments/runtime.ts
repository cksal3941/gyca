import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPaymentService } from "./service.ts";
import { createPaymentHandlers } from "./http.ts";
import { configuredTossProvider } from "./toss.ts";
import { createRoutedOrders } from "./routed-orders.ts";

const provider = configuredTossProvider(process.env);

// Test-only activation requires an explicit provider choice, MID, test key and currency contract terms.
export const paymentHandlers = createPaymentHandlers({
  service: createPaymentService(database, provider, () => new Date()),
  createRoutedOrder: createRoutedOrders(database, { providers: provider === null ? [] : [provider], now: () => new Date() }),
  now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
