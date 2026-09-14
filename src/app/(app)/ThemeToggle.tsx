"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Mode = "light" | "dark";

/**
 * מתג בהיר/כהה.
 *
 * ברירת המחדל היא מה שמערכת ההפעלה אומרת; המתג שומר בחירה מפורשת
 * ב-localStorage, והיא גוברת. הקריאה הראשונה קורית ב-useEffect ולא
 * ברינדור, כי בשרת אין localStorage ואין window — קריאה משם הייתה
 * מייצרת אי-התאמה בין השרת ללקוח.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const saved = document.documentElement.dataset.theme as Mode | undefined;
    if (saved === "dark" || saved === "light") {
      setMode(saved);
      return;
    }
    setMode(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // גלישה פרטית. המצב יחזיק עד סוף הביקור, וזה מספיק.
    }
  }

  // עד שידוע מה המצב אין מה לצייר — אייקון שקופץ משמש לחמה לירח מסיח.
  if (mode === null) return <span className="theme-toggle" aria-hidden="true" />;

  return (
    <button
      type="button"
      className="btn-quiet theme-toggle"
      onClick={toggle}
      aria-label={mode === "dark" ? "מעבר לתצוגה בהירה" : "מעבר לתצוגה כהה"}
      title={mode === "dark" ? "תצוגה בהירה" : "תצוגה כהה"}
    >
      <Icon name={mode === "dark" ? "sun" : "moon"} />
    </button>
  );
}
