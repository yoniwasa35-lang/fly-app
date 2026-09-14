import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/Brand";
import { NavLink } from "./NavLink";
import { QuickAdd } from "./QuickAdd";

/**
 * המעטפת של האזור המחובר.
 *
 * חמישה יעדים קבועים, ולא אחד יותר. הכלל שקובע מה נכנס לסרגל התחתון
 * הוא כמה פעמים ביום נוגעים בו: "היום", "לקוחות", "נסיעות" ו"משימות"
 * נפתחים כל הזמן; תבניות הודעות, הגדרות ויציאה — פעם בחודש, ולכן הם
 * יושבים מאחורי "עוד". יציאה בסרגל ראשי גוזלת מקום מיעד שמשתמשים בו.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <nav className="nav" aria-label="ניווט ראשי">
        {/*
          הלוגו מופיע רק במסך רחב. בטלפון הסרגל התחתון יושב בטווח האגודל,
          ושם כל פיקסל שייך ליעד ניווט — לא לזהות.
        */}
        <Link href="/" className="brand-lockup nav-brand" aria-label="LUA Travel — לדף הבית">
          <BrandMark />
          <Wordmark />
        </Link>

        <NavLink href="/" icon="today" label="היום" />
        <NavLink href="/clients" icon="clients" label="לקוחות" />
        <NavLink href="/trips" icon="trips" label="נסיעות" />
        <NavLink href="/tasks" icon="tasks" label="משימות" />
        <NavLink href="/more" icon="more" label="עוד" also={["/messages"]} />
      </nav>

      {children}

      <QuickAdd />
    </div>
  );
}
