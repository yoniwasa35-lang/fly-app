"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/Sheet";
import { Icon, type IconName } from "@/components/Icon";
import { prepareTripMessageAction } from "@/app/actions";
import type { PrepareMessageResult } from "@/app/actions";

type TileKey = "flights" | "hotel" | "travelers" | "money" | "documents" | "tasks";
type SheetKey = TileKey | "message" | "menu" | "edit" | "booking" | "link";

export type Tile = {
  key: TileKey;
  icon: IconName;
  label: string;
  value: string;
  /** מסמן שהאריח דורש תשומת לב — מסמך חסר, תשלום פתוח. */
  attention?: boolean;
};

type Prepared = Extract<PrepareMessageResult, { ok: true }>["message"];

/**
 * שש האריחים והחלונות שמאחוריהם.
 *
 * כל המידע כבר טעון בשרת ומועבר לכאן כ-children; הלחיצה לא מביאה נתונים
 * ולא מעבירה מסך, היא רק מגלה מה שכבר קיים. זה מה שמאפשר לכרטיס להישאר
 * בגודל מסך אחד בלי לוותר על שום פרט.
 */
export function TripSheets({
  tiles, tripId, clientId, clientPhone, messageOptions, hero, body,
  flights, hotel, travelers, money, documents, tasks, edit, booking, link,
}: {
  tiles: Tile[];
  /** שם, יעד, תאריכים ותגית המצב. מגיע מהשרת ונשתל בתוך הכותרת. */
  hero: React.ReactNode;
  /** מה שמופיע בין הכותרת לאריחים: הודעת יצירה, הפעולה הבאה, התראות. */
  body: React.ReactNode;
  tripId: string;
  clientId: string;
  clientPhone: string | null;
  messageOptions: { key: string; label: string }[];
  flights: React.ReactNode;
  hotel: React.ReactNode;
  travelers: React.ReactNode;
  money: React.ReactNode;
  documents: React.ReactNode;
  tasks: React.ReactNode;
  /** אזורי העריכה. הם חיים מאחורי תפריט ה-⋯ ולא במסך הראשי. */
  edit: React.ReactNode;
  booking: React.ReactNode;
  link: React.ReactNode;
}) {
  const [open, setOpen] = useState<SheetKey | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const content: Record<Exclude<SheetKey, "message" | "menu">, React.ReactNode> = {
    flights, hotel, travelers, money, documents, tasks, edit, booking, link,
  };

  const titles: Record<SheetKey, string> = {
    flights: "טיסות",
    hotel: "מלון",
    travelers: "נוסעים",
    money: "תשלומים",
    documents: "מסמכים",
    tasks: "משימות",
    message: "מה תרצו לשלוח?",
    menu: "פעולות",
    edit: "עריכת נסיעה",
    booking: "פרטי ההזמנה",
    link: "קישור ללקוח",
  };

  function choose(templateKey: string) {
    setError(null);
    startTransition(async () => {
      const res = await prepareTripMessageAction(tripId, templateKey);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPrepared(res.message);
      setText(res.message.text);
    });
  }

  function closeMessage() {
    setOpen(null);
    setPrepared(null);
    setText("");
    setError(null);
  }

  // הקישור נבנה מחדש מהטקסט הערוך, אחרת עריכה ידנית לא הייתה נשלחת.
  const waUrl =
    prepared?.phoneE164 && text.trim()
      ? `https://wa.me/${prepared.phoneE164}?text=${encodeURIComponent(text)}`
      : null;

  return (
    <>
      {/*
        הכותרת מרונדרת כאן ולא בעמוד, כי כפתור ה-⋯ שיושב בתוכה פותח
        חלונות שהמצב שלהם חי ברכיב הזה.
      */}
      <header className="trip-hero">
        <div className="trip-hero-bar">
          <a href="/trips" className="btn-quiet trip-back" aria-label="חזרה לנסיעות">
            <Icon name="back" />
          </a>
          <button
            type="button"
            className="btn-quiet trip-menu-btn"
            onClick={() => setOpen("menu")}
            aria-label="פעולות על הנסיעה"
          >
            <Icon name="more" />
          </button>
        </div>
        {hero}
      </header>

      {body}

      <div className="tiles">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tile${t.attention ? " tile-attention" : ""}`}
            onClick={() => setOpen(t.key)}
          >
            <Icon name={t.icon} className="tile-icon" />
            <span className="tile-label">{t.label}</span>
            <span className="tile-value">{t.value}</span>
            <Icon name="chevron" className="tile-go" />
          </button>
        ))}
      </div>

      <div className="trip-cta">
        <button type="button" className="btn-primary btn-lg" onClick={() => setOpen("message")}>
          <Icon name="messages" />
          <span>שליחת הודעה ללקוח</span>
        </button>
        {clientPhone && (
          <a className="btn btn-lg trip-call" href={`tel:${clientPhone.replace(/\s/g, "")}`} aria-label="חיוג ללקוח">
            <Icon name="phone" />
          </a>
        )}
      </div>

      {/* תפריט הפעולות. עריכה לא יושבת במסך הראשי — הוא לצפייה ולעבודה. */}
      <Sheet open={open === "menu"} onClose={() => setOpen(null)} title={titles.menu}>
        <ul className="pick-list">
          <li>
            <a href={`/clients/${clientId}`}>
              <span>עריכת לקוח</span>
              <Icon name="chevron" />
            </a>
          </li>
          <li>
            <button type="button" onClick={() => setOpen("edit")}>
              <span>עריכת נסיעה</span>
              <Icon name="chevron" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => setOpen("booking")}>
              <span>פרטי ההזמנה — טיסות, מלון, רכיבים</span>
              <Icon name="chevron" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => setOpen("link")}>
              <span>קישור ללקוח</span>
              <Icon name="chevron" />
            </button>
          </li>
          <li>
            <a href={`/trips/${tripId}/duplicate`}>
              <span>שכפול נסיעה</span>
              <Icon name="chevron" />
            </a>
          </li>
          <li>
            <a href={`/trips/new?clientId=${clientId}`}>
              <span>הוספת נסיעה נוספת</span>
              <Icon name="chevron" />
            </a>
          </li>
        </ul>
        <p className="hint" style={{ marginTop: "var(--sp-4)" }}>
          סגירת התיק וארכוב נמצאים בתוך "עריכת נסיעה" — הם מוחקים את מספרי הדרכון,
          ולכן הם לא לחיצה אחת מתפריט.
        </p>
      </Sheet>

      {(Object.keys(content) as Exclude<SheetKey, "message" | "menu">[]).map((key) => (
        <Sheet key={key} open={open === key} onClose={() => setOpen(null)} title={titles[key]}>
          {content[key]}
        </Sheet>
      ))}

      <Sheet open={open === "message"} onClose={closeMessage} title={titles.message}>
        {error && (
          <div className="error" style={{ margin: "0 0 var(--sp-4)" }}>
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}

        {!prepared ? (
          <ul className="pick-list">
            {messageOptions.map((o) => (
              <li key={o.key}>
                <button type="button" onClick={() => choose(o.key)} disabled={pending}>
                  <span>{o.label}</span>
                  <Icon name="chevron" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {prepared.missing.length > 0 && (
              <div className="wa-warn">
                חסרים פרטים: {prepared.missing.map((m) => m.name).join(", ")}. אפשר להשלים אותם
                בנוסח למטה לפני השליחה.
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              dir="rtl"
              rows={9}
              aria-label="נוסח ההודעה"
            />

            <div className="wa-actions">
              {waUrl ? (
                <a className="btn btn-wa btn-lg" href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="messages" />
                  <span>פתיחת וואטסאפ</span>
                </a>
              ) : (
                <span className="hint">{prepared.waError ?? "אין מספר טלפון תקין לשליחה."}</span>
              )}
              <button type="button" className="btn-quiet" onClick={() => setPrepared(null)}>
                בחירת נוסח אחר
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
