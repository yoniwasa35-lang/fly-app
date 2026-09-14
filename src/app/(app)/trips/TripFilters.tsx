"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WINDOW_OPTIONS } from "@/lib/queue/timeline";

/**
 * סינון. ב-100+ תיקים פעילים (התשובה של הסוכן לסעיף 13.1) בלי סינון המסך
 * הופך לקיר, ומאבד בדיוק את התכונה שבגללה הוא קיים.
 */
export function TripFilters({
  q, windowDays, hot, status,
}: {
  q: string;
  windowDays: number;
  hot: boolean;
  status: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState(q);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "0") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/trips?${qs}` : "/trips");
  };

  // חיפוש מושהה, כדי שכל הקלדה לא תייצר שאילתה.
  useEffect(() => {
    if (text === q) return;
    const timer = setTimeout(() => push({ q: text.trim() || null }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="filters">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="חיפוש לקוח, יעד או מספר תיק"
        aria-label="חיפוש"
      />

      <div className="chips">
        <button
          className={hot ? "btn-primary" : "btn-quiet"}
          onClick={() => push({ hot: hot ? null : "1" })}
        >
          רק בוערים
        </button>

        <span className="sep" />

        {WINDOW_OPTIONS.map((w) => (
          <button
            key={w}
            className={windowDays === w ? "btn-primary" : "btn-quiet"}
            onClick={() => push({ window: String(w) })}
          >
            {w} יום
          </button>
        ))}

        <span className="sep" />

        {[
          { key: "open", label: "פתוחים" },
          { key: "traveling", label: "בנסיעה" },
          { key: "all", label: "הכל" },
        ].map((s) => (
          <button
            key={s.key}
            className={status === s.key ? "btn-primary" : "btn-quiet"}
            onClick={() => push({ status: s.key === "open" ? null : s.key })}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
