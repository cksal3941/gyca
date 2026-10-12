import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPaymentService } from "./service.ts";
import { createPaymentHandlers } from "./http.ts";
import { configuredTossProviders } from "./toss.ts";
import { createRoutedOrders } from "./routed-orders.ts";

// Every configured merchant account (card KRW, PayPal USD). Orders stay bound to the provider they were created with.
const providers = configuredTossProviders(process.env);

export const paymentHandlers = createPaymentHandlers({
  service: createPaymentService(database, providers, () => new Date()),
  createRoutedOrder: createRoutedOrders(database, { providers, now: () => new Date() }),
  now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
