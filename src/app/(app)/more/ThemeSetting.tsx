"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Mode = "light" | "dark" | "system";

const LABEL: Record<Mode, string> = {
  system: "לפי המכשיר",
  light: "בהירה",
  dark: "כהה",
};

/**
 * בחירת התצוגה. שלוש אפשרויות ולא מתג דו-מצבי, כי "לפי המכשיר" הוא
 * ברירת המחדל האמיתית — והמשתמש צריך דרך לחזור אליה אחרי שבחר ידנית.
 */
export function ThemeSetting() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    setMode(saved === "dark" || saved === "light" ? saved : "system");
  }, []);

  function choose(next: Mode) {
    setMode(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // גלישה פרטית. הבחירה תחזיק עד סוף הביקור, וזה מספיק.
    }

    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  }

  return (
    <section className="card">
      <h2>
        <Icon name="moon" />
        תצוגה
      </h2>
      <div className="chips" role="group" aria-label="מצב תצוגה">
        {(["system", "light", "dark"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? "btn-primary" : "btn-quiet"}
            aria-pressed={mode === m}
            onClick={() => choose(m)}
          >
            {LABEL[m]}
          </button>
        ))}
      </div>
    </section>
  );
}
