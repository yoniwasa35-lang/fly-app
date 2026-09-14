"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <div className="card">
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
        <button className="btn-primary btn-lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "בודק…" : "כניסה"}
        </button>
      </div>
    </form>
  );
}
