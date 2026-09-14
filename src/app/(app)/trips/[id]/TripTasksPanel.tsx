"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { MilestoneActions } from "@/components/MilestoneActions";
import { completeMilestoneAction, reopenMilestoneAction } from "@/app/actions";
import { MILESTONE_STATE_HE } from "@/lib/domain/types";
import type { QueueItem } from "@/lib/queue/today";
import { tap } from "@/lib/ui/feedback";

export type TaskRow = QueueItem & {
  dateLabel: string;
  relative: string;
  /** סיבת ביטול או דחייה, כפי שהוזנה. */
  note: string | null;
};

const CLOSED = new Set(["done", "skipped"]);

/**
 * המשימות של התיק, כצ׳ק-ליסט.
 *
 * קודם זה היה ציר לקריאה בלבד: אפשר היה לראות שמשהו אדום, ולא לעשות
 * איתו כלום מבלי לצאת למסך אחר. עכשיו לחיצה על העיגול סוגרת את המשימה
 * במקום, ולחיצה נוספת מחזירה אותה — סימון בלתי הפיך הוא מלכודת, כי כל
 * אחד לוחץ פעם אחת על השורה הלא נכונה.
 *
 * הפתוחות למעלה, הסגורות מתחתן בירוק ומעומעמות. כך רואים גם מה נשאר
 * וגם מה כבר נעשה, בלי לעבור מסך.
 *
 * משימה שדורשת קלט — הכרעת ביטוח, סכום רווח, או הודעה ללקוח — לא
 * נסגרת בלחיצה על העיגול. היא פותחת את הפקד הנכון, כי סגירה עיוורת
 * שלה הייתה רושמת נתון שגוי.
 */
export function TripTasksPanel({ items }: { items: TaskRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, "done" | "open">>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stateOf = (t: TaskRow) => {
    const o = optimistic[t.id];
    if (o === "done") return "done" as const;
    if (o === "open") return "pending" as const;
    return t.state;
  };

  const open = items.filter((t) => !CLOSED.has(stateOf(t)));
  const closed = items.filter((t) => CLOSED.has(stateOf(t)));

  function toggle(t: TaskRow) {
    const state = stateOf(t);
    const isClosed = CLOSED.has(state);

    if (!isClosed && (t.requiresResolution || t.requiresAmount || t.messageTemplateKey)) {
      setExpanded(expanded === t.id ? null : t.id);
      return;
    }

    if (state === "blocked") return;

    setError(null);
    setOptimistic((m) => ({ ...m, [t.id]: isClosed ? "open" : "done" }));
    tap();

    startTransition(async () => {
      const res = isClosed
        ? await reopenMilestoneAction(t.id)
        : await completeMilestoneAction(t.id);

      if (!res.ok) {
        // החזרה למצב הקודם. סימון שנראה כאילו נשמר ולא נשמר הוא הגרוע מכל.
        setOptimistic((m) => {
          const next = { ...m };
          delete next[t.id];
          return next;
        });
        setError(res.error);
      }
    });
  }

  function Row({ t }: { t: TaskRow }) {
    const state = stateOf(t);
    const isClosed = CLOSED.has(state);
    const isDone = state === "done";
    const blocked = state === "blocked";
    const needsInput = !isClosed && (t.requiresResolution || t.requiresAmount || !!t.messageTemplateKey);

    return (
      <li className={`task${isClosed ? " is-closed" : ""}${blocked ? " is-blocked" : ""}`}>
        <div className="task-main">
          <button
            type="button"
            className={`task-check is-${state}`}
            onClick={() => toggle(t)}
            disabled={pending || blocked}
            aria-pressed={isDone}
            aria-label={
              blocked ? `${t.title} — חסום, אי אפשר לסמן`
              : isClosed ? `${t.title} — ${MILESTONE_STATE_HE[state]}. לחיצה מחזירה לפתוח.`
              : needsInput ? `${t.title} — פתיחת הפעולה`
              : `${t.title} — סימון כבוצע`
            }
          >
            {isDone && <Icon name="check" />}
            {state === "skipped" && <Icon name="close" />}
          </button>

          <span className="task-body">
            <span className="task-title">{t.title}</span>
            <span className="task-meta">
              <span className="num">{t.dateLabel}</span>
              {!isClosed && <> · {t.relative}</>}
              {" · "}
              <span className={`tag ${isDone ? "tag-done" : state === "overdue" ? "tag-overdue" : ""}`}>
                {MILESTONE_STATE_HE[state]}
              </span>
              {t.note && <> · {t.note}</>}
            </span>
          </span>

          <button
            type="button"
            className="btn-quiet task-more"
            onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            aria-expanded={expanded === t.id}
            aria-label={`פעולות נוספות: ${t.title}`}
          >
            <Icon name="more" />
          </button>
        </div>

        {expanded === t.id && (
          <div className="task-actions">
            <MilestoneActions item={{ ...t, state }} />
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      {error && (
        <div className="error" role="alert" style={{ margin: "0 0 var(--sp-4)" }}>
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}

      {open.length === 0 ? (
        <p className="hint">כל המשימות של הנסיעה הזו סגורות.</p>
      ) : (
        <ul className="task-list">
          {open.map((t) => (
            <Row key={t.id} t={t} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="collapse section" style={{ margin: "var(--sp-5) 0 0" }}>
          <summary>
            נסגרו
            <span className="hint">
              {closed.length === 1 ? "משימה אחת" : `${closed.length} משימות`}
            </span>
          </summary>
          <ul className="task-list">
            {closed.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
