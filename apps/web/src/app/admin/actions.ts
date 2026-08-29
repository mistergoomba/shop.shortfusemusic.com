"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminLoginInput } from "@sf/shared";
import {
  clearFailedLogins,
  getSession,
  loginBlocked,
  recordFailedLogin,
  verifyPassword,
} from "@/lib/auth";
import { env } from "@/lib/env";

export interface LoginState {
  error?: string;
}

/** Best-effort client key for throttling. Behind Vercel this is the real IP. */
async function clientKey(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const key = await clientKey();

  if (loginBlocked(key)) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const parsed = adminLoginInput.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    recordFailedLogin(key);
    return { error: "Enter your password." };
  }

  let hash: string;
  try {
    hash = env.adminPasswordHash;
  } catch {
    return {
      error:
        "Admin password is not configured. Run: pnpm admin:password 'your-password'",
    };
  }

  const ok = await verifyPassword(parsed.data.password, hash);
  if (!ok) {
    recordFailedLogin(key);
    // One generic message: never reveal whether config or the password was wrong.
    return { error: "That password is not right." };
  }

  clearFailedLogins(key);
  const session = await getSession();
  session.isAdmin = true;
  session.loggedInAt = Date.now();
  await session.save();

  redirect("/admin");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}
