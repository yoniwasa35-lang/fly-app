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
      <h2>
        {title}{" "}
        {edited && <span className="tag tag-done">נערך</span>}
      </h2>
      <p className="hint">
        קובץ ברירת המחדל: <code>config/messages/{templateKey}.txt</code>
      </p>

      {state.error && <div className="error" style={{ margin: "0.5rem 0" }}>{state.error}</div>}

      <textarea
        name="body"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setPreview(null); }}
        dir="rtl"
        aria-label={`נוסח ההודעה: ${title}`}
      />

      <div className="var-list">
        {VARIABLES.map((v) => (
          <code key={v.name} onClick={() => insertVariable(v.name)} title={v.description}>
            {`{{${v.name}}}`}
          </code>
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
              משתנים שלא קיימים: {preview.unknown.join(", ")}. בדקו איות מול הרשימה למעלה.
            </div>
          )}
          <div className="preview">{preview.text}</div>
          <p className="hint">תצוגה מול תיק לדוגמה. כך ההודעה תיראה ללקוח.</p>
        </>
      )}
    </form>
  );
}
