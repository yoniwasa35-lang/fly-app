"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

const OPTIONS = [
  { href: "/clients/new", icon: "clients", label: "לקוח חדש" },
  { href: "/trips/new", icon: "trips", label: "נסיעה חדשה" },
  { href: "/tasks/new", icon: "tasks", label: "משימה חדשה" },
] as const;

/**
 * כפתור ה-+ הקבוע.
 *
 * שלוש אפשרויות ולא יותר, כי הן שלושת הדברים היחידים שנוצרים מאפס.
 * הוא מוסתר במסכי היצירה עצמם — כפתור "צור" בתוך טופס יצירה הוא רעש.
 */
export function QuickAdd() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

    /*
   * הכפתור מוסתר היכן שהוא מתחרה בפעולה אחרת או סתם מרחף:
   * מסכי יצירה (הוא כבר שם), מסכי הגדרות (אין מה ליצור בהם), ומסך
   * נסיעה — שם הפעולה הראשית היא "שליחת הודעה ללקוח", ושני כפתורים
   * ראשיים באותו מסך מבטלים זה את זה.
   */
  const insideTrip = /^\/trips\/[^/]+/.test(pathname) && !pathname.startsWith("/trips/new");

  const hidden =
    OPTIONS.some((o) => pathname.startsWith(o.href)) ||
    pathname.startsWith("/more") ||
    pathname.startsWith("/messages") ||
    insideTrip;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    // סגירה בלחיצה בחוץ וב-Escape. בלי זה התפריט נתקע פתוח על מסך מגע.
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hidden) return null;

  return (
    <div className="quick-add" ref={box}>
      {open && (
        <div className="quick-add-menu" role="menu">
          {OPTIONS.map((o) => (
            <Link key={o.href} href={o.href} role="menuitem">
              <Icon name={o.icon} />
              <span>{o.label}</span>
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        className="quick-add-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "סגירת תפריט היצירה" : "יצירת פריט חדש"}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
