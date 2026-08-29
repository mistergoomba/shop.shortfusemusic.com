import "server-only";

/**
 * Reads a required secret at the moment it is used, not at import time, so a
 * missing Stripe key breaks checkout with a clear message instead of breaking
 * the whole build.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get stripeSecretKey() {
    return required("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  get adminPasswordHash() {
    return required("ADMIN_PASSWORD_HASH");
  },
  get adminSessionSecret() {
    return required("ADMIN_SESSION_SECRET");
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    );
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

/** True when Stripe is configured well enough to attempt a checkout. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
