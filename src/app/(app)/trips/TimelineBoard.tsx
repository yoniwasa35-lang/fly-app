"use client";

import Link from "next/link";
import { useState } from "react";
import type { Timeline, TimelineRow } from "@/lib/queue/timeline";
import { MILESTONE_STATE_HE } from "@/lib/domain/types";
import { DISPLAY_TZ, formatRelativeHe, utcToZoned } from "@/lib/time/zones";
import { Icon } from "@/components/Icon";

/**
 * ציר הזמן של כל התיקים — סעיף 8.2.
 *
 * כיוון הזמן הוא מימין לשמאל, כמו קריאה בעברית: העבר הקרוב בקצה הימני
 * והעתיד נמשך שמאלה. המיקום נעשה ב-inset-inline-start, ולכן אין כאן שום
 * היפוך ידני — הדפדפן עושה את זה נכון לבד.
 *
 * עמודת השמות מוקפאת. בלעדיה, ברגע שגוללים את הציר בטלפון כבר לא יודעים
 * על איזה לקוח מסתכלים, והמסך מאבד את כל הערך שלו.
 */

const ZOOM = [
  { label: "צפוף", px: 4 },
  { label: "רגיל", px: 9 },
  { label: "מפורט", px: 18 },
] as const;

const HE_MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

export function TimelineBoard({ timeline, pastDays }: { timeline: Timeline; pastDays: number }) {
  const [pxPerDay, setPxPerDay] = useState<number>(9);
  const width = timeline.windowDays * pxPerDay;
  const windowStart = new Date(timeline.windowStart);

  /*
   * קווי החודש מחושבים בשעון ישראל ולא ב-UTC. windowStart הוא חצות מקומית,
   * שהיא 21:00 או 22:00 של היום הקודם ב-UTC — ולכן חישוב ב-UTC היה מציב את
   * הקווים על היום הלא נכון. זו אותה מלכודת של סעיף 6.2, בתחפושת.
   */
  const ticks: Array<{ offset: number; label: string }> = [];
  for (let d = 0; d <= timeline.windowDays; d++) {
    const local = utcToZoned(addDays(windowStart, d), DISPLAY_TZ);
    const [, month, day] = local.slice(0, 10).split("-");
    // התווית ממורכזת על הקו, ולכן קו צמוד מדי לקצה הימני נחתך.
    if (day === "01" && d * pxPerDay > 26) {
      ticks.push({ offset: d, label: HE_MONTHS[Number(month) - 1] });
    }
  }

  return (
    <>
      <div className="zoom-bar">
        <span className="hint">צפיפות</span>
        {ZOOM.map((z) => (
          <button
            key={z.px}
            className={pxPerDay === z.px ? "btn-primary" : "btn-quiet"}
            onClick={() => setPxPerDay(z.px)}
          >
            {z.label}
          </button>
        ))}
        <span className="hint future-hint" style={{ marginInlineStart: "auto" }}>
          <Icon name="arrow" />
          <span>העתיד</span>
        </span>
      </div>

      <div className="tl-grid">
        <div className="tl-names">
          <div className="tl-head" />
          {timeline.rows.map((row) => (
            <Link key={row.id} href={`/trips/${row.id}`} className="tl-name">
              <span className="who">{row.clientName}</span>
              <span className="where">
                {row.destination}
                {row.overdue > 0 && <b className="tag tag-overdue" title="עברו מועד">{row.overdue}</b>}
                {row.blocked > 0 && <b className="tag tag-blocked" title="חסומות">{row.blocked}</b>}
                {row.late > 0 && row.overdue === 0 && row.blocked === 0 && (
                  <b className="tag" title="נולדו באיחור — תיק שנפתח קרוב ליציאה">{row.late}</b>
                )}
              </span>
            </Link>
          ))}
        </div>

        <div className="tl-scroll">
          <div className="tl-canvas" style={{ width: `${width}px` }}>
            <div className="tl-head axis">
              {ticks.map((t) => (
                <span key={t.offset} className="tick" style={{ insetInlineStart: `${t.offset * pxPerDay}px` }}>
                  {t.label}
                </span>
              ))}
              <span className="today-line" style={{ insetInlineStart: `${pastDays * pxPerDay}px` }}>
                <em>היום</em>
              </span>
            </div>

            {timeline.rows.map((row) => (
              <Track key={row.id} row={row} pxPerDay={pxPerDay} windowDays={timeline.windowDays} now={timeline.now} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Track({
  row, pxPerDay, windowDays, now,
}: {
  row: TimelineRow;
  pxPerDay: number;
  windowDays: number;
  now: Date;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(windowDays, n));
  const start = clamp(row.departureOffset);
  const end = clamp(row.returnOffset);
  const hot = row.overdue > 0 || row.blocked > 0;
  const rel = formatRelativeHe(row.departureAt, now);

  return (
    <div className={`tl-track ${hot ? "hot" : ""}`}>
      <span
        className="trip-span"
        style={{
          insetInlineStart: `${start * pxPerDay}px`,
          width: `${Math.max(4, (end - start) * pxPerDay)}px`,
        }}
        title={`בנסיעה · ${rel.text}`}
      />

      <span
        className="departure"
        style={{ insetInlineStart: `${start * pxPerDay}px` }}
        title={`יציאה ${rel.text}`}
      />

      {row.dots.map((dot) => (
        <span
          key={dot.dayOffset}
          className={`tl-dot s-${dot.state}`}
          style={{ insetInlineStart: `${dot.dayOffset * pxPerDay}px` }}
          title={`${dot.labels.join(" · ")}${
            dot.count > dot.labels.length ? ` ועוד ${dot.count - dot.labels.length}` : ""
          } — ${MILESTONE_STATE_HE[dot.state]}`}
        />
      ))}

    </div>
  );
}
