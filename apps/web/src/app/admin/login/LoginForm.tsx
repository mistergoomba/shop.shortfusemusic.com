"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="stamp min-h-12 w-full bg-blood px-6 py-3 text-bone transition-colors hover:bg-blood-bright disabled:bg-ink-card disabled:text-bone-faint"
    >
      {pending ? "Checking…" : "Sign In"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm text-bone">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          aria-describedby={state.error ? "login-error" : undefined}
          aria-invalid={state.error ? "true" : undefined}
          className="min-h-12 w-full border border-ink-line bg-ink-card px-3 py-2.5 text-bone"
        />
      </div>

      {state.error && (
        <p
          id="login-error"
          role="alert"
          className="border border-blood px-3 py-2 text-sm text-bone"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
