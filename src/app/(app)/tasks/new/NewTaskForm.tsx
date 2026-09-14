"use client";

import { useActionState } from "react";
import { createTaskAction, type NewTaskState } from "./actions";
import { Icon } from "@/components/Icon";

export function NewTaskForm({
  trips,
  preselected,
}: {
  trips: { id: string; label: string }[];
  preselected: string;
}) {
  const [state, action, pending] = useActionState<NewTaskState, FormData>(createTaskAction, {});

  return (
    <form action={action}>
      {state.error && (
        <div className="error" role="alert">
          <Icon name="alert" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="card">
        <div className="field">
          <label htmlFor="tripId">לאיזו נסיעה</label>
          <select id="tripId" name="tripId" required defaultValue={preselected}>
            <option value="">בחרו נסיעה</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="title">מה צריך לעשות</label>
          <input id="title" name="title" required placeholder="לבדוק מול המלון חדר מחובר" />
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="date">תאריך</label>
            <input id="date" name="date" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="time">שעה (לא חובה)</label>
            <input id="time" name="time" type="time" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="audience">סוג</label>
          <select id="audience" name="audience" defaultValue="agent">
            <option value="agent">פנימי — משהו שאני צריכה לעשות</option>
            <option value="client">מול הלקוח — צריך לפנות אליו</option>
          </select>
        </div>

        <button className="btn-primary btn-lg" type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "שומר…" : "הוספת משימה"}
        </button>
      </div>
    </form>
  );
}
