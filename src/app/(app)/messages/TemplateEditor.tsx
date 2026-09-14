"use client";

import { useActionState, useState, useTransition } from "react";
import { VARIABLES } from "@/lib/messages/variables";
import {
  previewTemplateAction,
  resetTemplateAction,
  saveTemplateAction,
  type TemplateActionState,
} from "./actions";

export function TemplateEditor({
  templateKey, title, body, edited,
}: {
  templateKey: string;
  title: string;
  body: string;
  edited: boolean;
}) {
  const [state, formAction, saving] = useActionState<TemplateActionState, FormData>(
    saveTemplateAction,
    {},
  );
  const [draft, setDraft] = useState(body);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewTemplateAction>> | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = draft.trim() !== body.trim();

  const insertVariable = (name: string) => setDraft((d) => `${d}{{${name}}}`);

  return (
    <form action={formAction} className="card template-card">
      <input type="hidden" name="key" value={templateKey} />
      <p className="hint">
        כתבו את הנוסח כמו שהוא יישלח. כדי לשתול פרט שמשתנה מלקוח ללקוח —
        לחצו על אחד הכפתורים מתחת לתיבה.
      </p>

      {state.error && <div className="error" style={{ margin: "0.5rem 0" }}>{state.error}</div>}

      <textarea
        name="body"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setPreview(null); }}
        dir="rtl"
        aria-label={`נוסח ההודעה: ${title}`}
      />

      {/*
        הכפתורים נושאים שם בעברית ולא את הקוד עצמו. מי שרוצה לדעת מה
        נשתל רואה דוגמה אמיתית ב-title, ומי שרק מתקן ניסוח לא נתקל בקוד.
      */}
      <div className="var-list" role="group" aria-label="פרטים שמשתנים מלקוח ללקוח">
        {VARIABLES.map((v) => (
          <button
            key={v.name}
            type="button"
            onClick={() => insertVariable(v.name)}
            title={`${v.description} — לדוגמה: ${v.example}`}
          >
            {v.description}
          </button>
        ))}
      </div>

      <div className="actions" style={{ marginTop: "0.7rem" }}>
        <button className="btn-primary" type="submit" disabled={saving || !dirty}>
          {saving ? "שומר…" : "שמירה"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => setPreview(await previewTemplateAction(draft)))
          }
        >
          תצוגה מקדימה
        </button>
        {dirty && (
          <button type="button" className="btn-quiet" onClick={() => { setDraft(body); setPreview(null); }}>
            ביטול שינויים
          </button>
        )}
        {edited && !dirty && (
          <button
            type="button"
            className="btn-quiet"
            disabled={pending}
            onClick={() => startTransition(async () => { await resetTemplateAction(templateKey); })}
          >
            חזרה לנוסח המקורי
          </button>
        )}
      </div>

      {preview && (
        <>
          {preview.unknown.length > 0 && (
            <div className="error" style={{ margin: "0.6rem 0 0" }}>
              יש בנוסח פרט שהמערכת לא מכירה: {preview.unknown.join(", ")}. השתמשו בכפתורים
              מתחת לתיבה במקום לכתוב אותו ביד.
            </div>
          )}
          <div className="preview">{preview.text}</div>
          <p className="hint">תצוגה מול תיק לדוגמה. כך ההודעה תיראה ללקוח.</p>
        </>
      )}
    </form>
  );
}
