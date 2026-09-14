"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

/**
 * חלון שעולה מלמטה.
 *
 * בנוי על <dialog> ולא על div עם position: fixed, וזו לא קפדנות: היסוד
 * הזה נותן בחינם מלכודת מיקוד, סגירה ב-Escape, והשבתה של כל מה שמאחוריו
 * לקוראי מסך. מימוש ידני של השלושה האלה הוא בדיוק המקום שבו נגישות
 * נשברת בשקט.
 */
export function Sheet({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // לחיצה על הרקע סוגרת. ה-target הוא ה-dialog עצמו רק כשלוחצים
        // מחוצה לתוכן, כי התוכן יושב ב-div פנימי.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-inner">
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="btn-quiet sheet-close" onClick={onClose} aria-label="סגירה">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
