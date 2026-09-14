import { BrandMark, Wordmark } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * מסך הכניסה הוא המסך היחיד שאינו מציג נתונים, ולכן הוא שייך למותג:
 * רקע דיו כהה, הלוגו בזהב, וכרטיס אחד עם שדה אחד. אין כאן שם משתמש —
 * סעיף 6: מנעול אחד, משותף לשני הסוכנים.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="login-shell">
      <div>
        <div className="login-brand">
          <BrandMark />
          <Wordmark />
          <div className="rule" />
          <span className="wordmark-sub">TRAVEL</span>
        </div>

        <LoginForm next={next ?? ""} />

        <p className="login-foot">ניהול מחזור חיי נסיעה</p>
      </div>
    </main>
  );
}
