"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

/**
 * קישור ניווט שיודע אם הוא העמוד הנוכחי.
 *
 * הסימון נעשה ב-aria-current ולא במחלקה בלבד: כך גם קורא מסך מודיע
 * "העמוד הנוכחי", והעיצוב נתלה על אותה תכונה במקום לשכפל מצב.
 */
export function NavLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  const pathname = usePathname();
  // "/" הוא התאמה מדויקת בלבד, אחרת כל עמוד היה נחשב לעמוד הבית.
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
    </Link>
  );
}
