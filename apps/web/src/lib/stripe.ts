import "server-only";
import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | undefined;

/** Lazily constructed so importing this module never requires a Stripe key. */
export function stripe(): Stripe {
  client ??= new Stripe(env.stripeSecretKey, {
    // Retries protect against a transient network blip creating a duplicate
    // session; Stripe deduplicates by idempotency key on our side.
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "Short Fuse Store", version: "0.1.0" },
  });
  return client;
}
