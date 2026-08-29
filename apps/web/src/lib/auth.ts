import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { env } from "./env";
import { hashPassword, verifyPassword } from "./password";

// Re-exported so callers keep importing auth concerns from one place.
export { hashPassword, verifyPassword };

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export interface AdminSession {
  isAdmin?: true;
  loggedInAt?: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export async function getSession(): Promise<IronSession<AdminSession>> {
  return getIronSession<AdminSession>(await cookies(), {
    password: env.adminSessionSecret,
    cookieName: "sf_admin",
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      // Secure in production only, so local http development still works.
      secure: env.isProduction,
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  });
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await getSession();
    return session.isAdmin === true;
  } catch {
    // Missing ADMIN_SESSION_SECRET: treat as logged out rather than crashing.
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Login rate limiting                                                 */
/* ------------------------------------------------------------------ */

/**
 * In-memory throttle on failed logins. Deliberately simple: one admin, one
 * password, and a serverless instance that may be recycled. It raises the cost
 * of online guessing without pretending to be a distributed rate limiter.
 */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function loginBlocked(key: string): boolean {
  const record = attempts.get(key);
  if (!record) return false;
  if (Date.now() - record.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(key: string): void {
  const record = attempts.get(key);
  if (!record || Date.now() - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  record.count += 1;
}

export function clearFailedLogins(key: string): void {
  attempts.delete(key);
}
