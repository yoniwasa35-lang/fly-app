"use client";

import { useState, useTransition } from "react";
import type { QueueItem } from "@/lib/queue/today";
import {
  completeMilestoneAction,
  prepareMessageAction,
  skipMilestoneAction,
  snoozeMilestoneAction,
  type ActionResult,
  type PrepareMessageResult,
} from "@/app/actions";
import { RESOLUTION_OPTIONS } from "./resolutions";
import { WhatsAppPanel } from "./WhatsAppPanel";

/**
 * כפתור אחד שמבצע את הפעולה — סעיף 8.1. לא ניווט למסך שממנו אפשר לבצע.
 * הפעולות המשניות (דחייה, ויתור) מאחורי "⋯", כדי שהשורה תישאר צפופה
 * ושהעין תיפול על הפעולה הנכונה.
 *
 * אבן דרך שפונה ללקוח פותחת את נוסח ההודעה מוכן לשליחה (סעיף 9);
 * אבן דרך פנימית מסומנת כבוצעה במקום.
 */
export function MilestoneActions({ item }: { item: QueueItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "more" | "skip" | "snooze" | "resolve" | "whatsapp">("idle");
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState(RESOLUTION_OPTIONS[0]?.value ?? "");
  const [prepared, setPrepared] = useState<Extract<PrepareMessageResult, { ok: true }>["message"] | null>(null);

  const hasMessage = !!item.messageTemplateKey;

  const openWhatsApp = () => {
    setError(null);
    startTransition(async () => {
      const res = await prepareMessageAction(item.id);
      if (!res.ok) { setError(res.error); return; }
      setPrepared(res.message);
      setMode("whatsapp");
    });
  };

  const run = (fn: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else setMode("idle");
    });
  };

  if (mode === "whatsapp" && prepared) {
    return (
      <WhatsAppPanel
        prepared={prepared}
        onSent={() => run(() => completeMilestoneAction(item.id))}
        onCancel={() => { setPrepared(null); setMode("idle"); }}
      />
    );
  }

  if (mode === "resolve") {
    return (
      <div className="actions wide">
        <select value={resolution} onChange={(e) => setResolution(e.target.value)}
          aria-label="הכרעה" style={{ maxWidth: "13rem" }}>
          {RESOLUTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button className="btn-primary" disabled={pending}
          onClick={() => run(() => completeMilestoneAction(item.id, resolution))}>
          שמירה
        </button>
        <button className="btn-quiet" onClick={() => setMode("idle")}>ביטול</button>
        {error && <span className="tag tag-overdue">{error}</span>}
      </div>
    );
  }

  if (mode === "skip" || mode === "snooze") {
    const isSkip = mode === "skip";
    return (
      <div className="actions wide">
        <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder={isSkip ? "למה מוותרים על זה?" : "למה דוחים בשבוע?"}
          aria-label="סיבה" style={{ flex: 1, minWidth: "10rem" }} />
        <button className="btn-primary" disabled={pending || !reason.trim()}
          onClick={() =>
            run(() => (isSkip
              ? skipMilestoneAction(item.id, reason)
              : snoozeMilestoneAction(item.id, 7, reason)))
          }>
          {isSkip ? "ויתור" : "דחייה בשבוע"}
        </button>
        <button className="btn-quiet" onClick={() => { setMode("idle"); setReason(""); }}>ביטול</button>
        {error && <span className="tag tag-overdue">{error}</span>}
      </div>
    );
  }

  if (mode === "more") {
    return (
      <div className="actions">
        <button className="btn-quiet" disabled={pending} onClick={() => setMode("snooze")}>דחייה</button>
        <button className="btn-quiet" disabled={pending} onClick={() => setMode("skip")}>ויתור</button>
        <button className="btn-quiet more" onClick={() => setMode("idle")} aria-label="סגירה">×</button>
      </div>
    );
  }

  const primaryLabel = hasMessage
    ? "וואטסאפ"
    : item.requiresResolution
      ? "הכרעה"
      : item.audience === "agent"
        ? "בוצע"
        : "נשלח";

  return (
    <div className="actions">
      {error && <span className="tag tag-overdue">{error}</span>}
      <button
        className={hasMessage ? "btn-wa" : "btn-primary"}
        disabled={pending}
        onClick={() => {
          if (hasMessage) return openWhatsApp();
          if (item.requiresResolution) return setMode("resolve");
          return run(() => completeMilestoneAction(item.id));
        }}
      >
        {pending && hasMessage ? "מכין…" : primaryLabel}
      </button>
      <button className="btn-quiet more" onClick={() => setMode("more")} aria-label="עוד פעולות">⋯</button>
    </div>
  );
}
