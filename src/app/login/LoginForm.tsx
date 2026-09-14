"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Icon } from "@/components/Icon";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="login-card">
      {state.error && (
        <div className="error" role="alert">
          <Icon name="alert" />
          <span>{state.error}</span>
        </div>
      )}

      <input type="hidden" name="next" value={next} />

      <div className="field">
        <label htmlFor="passcode">סיסמה</label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
        />
      </div>

      <button className="btn-gold btn-lg" type="submit" disabled={pending}>
        <Icon name="lock" />
        <span>{pending ? "בודק…" : "כניסה"}</span>
      </button>
    </form>
  );
}
