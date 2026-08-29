import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * Consistent error envelope for every API route. Nothing here ever includes a
 * stack trace, a database message, or a Stripe secret -- the client gets a
 * stable `error` code and a safe message, and the detail goes to the log.
 */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export function apiError(
  status: number,
  error: string,
  message: string,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json({ error, message, details }, { status });
}

export function badRequest(message: string, details?: unknown) {
  return apiError(400, "bad_request", message, details);
}

export function notFound(message = "Not found") {
  return apiError(404, "not_found", message);
}

export function unauthorized(message = "Not authorized") {
  return apiError(401, "unauthorized", message);
}

export function serverError(logContext: string, err: unknown) {
  // Log enough to debug a failed checkout without logging payment data.
  console.error(`[${logContext}]`, err instanceof Error ? err.message : err);
  return apiError(500, "server_error", "Something went wrong. Please try again.");
}

/** Parse and validate a JSON body, returning either the value or a 400. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse<ApiError> }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: badRequest("Request body must be valid JSON.") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: badRequest("Some of that request wasn't valid.", parsed.error.issues),
    };
  }
  return { ok: true, data: parsed.data };
}
