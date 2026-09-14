"use client";

import { useState, useTransition } from "react";
import { saveStayAction } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { BOARD_BASES, BOARD_BASIS_HE } from "@/lib/trips/stay";

export type StayDraft = {
  componentId: string;
  name: string;
  roomType: string;
  boardBasis: string;
  checkInTime: string;
  checkOutTime: string;
  officialUrl: string;
  voucherUrl: string;
  address: string;
  stars: string;
};

/**
 * עריכת פרטי המלון.
 *
 * כתובת האתר היא שדה של הסוכן, ובכוונה: כל עוד אין חיבור למקור אמין,
 * מה שמופיע ללקוח הוא מה שמישהו בדק — ולא ניחוש. הטופס אומר את זה
 * במפורש, כדי שלא יתפתה להדביק לשם תוצאה ראשונה מחיפוש.
 */
export function StayEditor({ initial }: { initial: StayDraft }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (k: keyof StayDraft) => (v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveStayAction(draft.componentId, {
        name: draft.name,
        roomType: draft.roomType,
        boardBasis: draft.boardBasis || null,
        checkInTime: draft.checkInTime || null,
        checkOutTime: draft.checkOutTime || null,
        officialUrl: draft.officialUrl || null,
        voucherUrl: draft.voucherUrl || null,
        address: draft.address,
        stars: draft.stars ? Number(draft.stars) : null,
      });
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <div className="card">
      {error && (
        <div className="error" role="alert" style={{ margin: "0 0 var(--sp-4)" }}>
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      )}

      <div className="field">
        <label htmlFor="stay-name">שם המלון</label>
        <input id="stay-name" value={draft.name} onChange={(e) => set("name")(e.target.value)} />
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="stay-room">סוג חדר</label>
          <input
            id="stay-room"
            value={draft.roomType}
            onChange={(e) => set("roomType")(e.target.value)}
            placeholder="חדר זוגי"
          />
        </div>
        <div className="field">
          <label htmlFor="stay-board">בסיס אירוח</label>
          <select id="stay-board" value={draft.boardBasis} onChange={(e) => set("boardBasis")(e.target.value)}>
            <option value="">לא הוגדר</option>
            {BOARD_BASES.map((b) => (
              <option key={b} value={b}>{BOARD_BASIS_HE[b]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="stay-in">צ׳ק-אין</label>
          <input id="stay-in" type="time" value={draft.checkInTime} onChange={(e) => set("checkInTime")(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="stay-out">צ׳ק-אאוט</label>
          <input id="stay-out" type="time" value={draft.checkOutTime} onChange={(e) => set("checkOutTime")(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="stay-address">כתובת</label>
        <input
          id="stay-address"
          value={draft.address}
          onChange={(e) => set("address")(e.target.value)}
          placeholder="Seaside Blvd 25, Batumi"
        />
        <p className="hint">ממנה נבנה כפתור "פתיחה במפה" בעמוד הלקוח.</p>
      </div>

      <div className="field">
        <label htmlFor="stay-stars">דירוג כוכבים</label>
        <select id="stay-stars" value={draft.stars} onChange={(e) => set("stars")(e.target.value)}>
          <option value="">לא הוגדר</option>
          {[3, 4, 5].map((n) => (
            <option key={n} value={n}>{n} כוכבים</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="stay-url">האתר הרשמי</label>
        <input
          id="stay-url"
          type="url"
          inputMode="url"
          dir="ltr"
          value={draft.officialUrl}
          onChange={(e) => set("officialUrl")(e.target.value)}
          placeholder="https://"
        />
        <p className="hint">
          המערכת לא ממציאה כתובת. אם השדה ריק, הכפתור פשוט לא מופיע ללקוח — וזה
          עדיף על קישור שמוביל למקום הלא נכון.
        </p>
      </div>

      <div className="field">
        <label htmlFor="stay-voucher">קישור לוואוצ׳ר</label>
        <input
          id="stay-voucher"
          type="url"
          inputMode="url"
          dir="ltr"
          value={draft.voucherUrl}
          onChange={(e) => set("voucherUrl")(e.target.value)}
          placeholder="https://"
        />
        <p className="hint">קישור שהספק סיפק. המערכת לא מאחסנת קבצים.</p>
      </div>

      <button className="btn-primary" type="button" onClick={save} disabled={pending}>
        {pending ? "שומר…" : saved ? "נשמר" : "שמירת פרטי המלון"}
      </button>
    </div>
  );
}
