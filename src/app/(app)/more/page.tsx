import Link from "next/link";
import { logoutAction } from "../../login/actions";
import { Icon } from "@/components/Icon";
import { BrandMark, Wordmark } from "@/components/Brand";
import { hostAgencyName, ratePct, configuredHostFeeRate } from "@/lib/trips/finance";
import { ThemeSetting } from "./ThemeSetting";

export const dynamic = "force-dynamic";

/**
 * "עוד" — כל מה שלא נוגעים בו כל יום.
 *
 * הרשימה הזו מכילה רק מסכים שקיימים באמת. קישור לעמוד שעוד לא נבנה גרוע
 * מהיעדרו: הוא מלמד את הסוכן שחלק מהמערכת שבור.
 */
export default async function MorePage() {
  const agent = process.env.AGENT_NAME?.trim();
  const agency = process.env.AGENCY_NAME?.trim();
  const phone = process.env.AGENT_EMERGENCY_PHONE?.trim();

  return (
    <>
      <header className="topbar">
        <BrandMark className="topbar-brand" />
        <h1>
          עוד
          <span className="sub">הגדרות וכלים</span>
        </h1>
      </header>

      <nav className="menu" aria-label="הגדרות">
        <Link href="/messages" className="menu-row">
          <Icon name="messages" />
          <span className="menu-label">
            תבניות הודעות
            <small>הנוסחים שנשלחים בוואטסאפ</small>
          </span>
          <Icon name="chevron" className="menu-go" />
        </Link>
      </nav>

      <ThemeSetting />

      <section className="card">
        <h2>פרטי העסק</h2>
        <p className="hint">
          הפרטים האלה נכנסים לתוך ההודעות ללקוחות. שינוי שלהם נעשה בהגדרות
          השרת, ולא מכאן — כדי שלא ישתנו בטעות באמצע נסיעה.
        </p>
        <dl className="c-details" style={{ borderTop: "none", paddingTop: 0 }}>
          <dt>חתימה בהודעות</dt>
          <dd>{agent || <span className="expiry-bad">לא הוגדר</span>}</dd>
          <dt>שם העסק</dt>
          <dd>{agency || <span className="expiry-bad">לא הוגדר</span>}</dd>
          <dt>מספר חירום</dt>
          <dd>{phone ? <span className="num">{phone}</span> : <span className="expiry-bad">לא הוגדר</span>}</dd>
          <dt>סוכנות מארחת</dt>
          <dd>
            {hostAgencyName()} · {ratePct(configuredHostFeeRate())} מההפרש
          </dd>
        </dl>
      </section>

      <nav className="menu" aria-label="חשבון">
        <form action={logoutAction}>
          <button type="submit" className="menu-row menu-row-danger">
            <Icon name="logout" />
            <span className="menu-label">יציאה מהחשבון</span>
          </button>
        </form>
      </nav>

      <footer className="more-foot">
        <Wordmark sub />
      </footer>
    </>
  );
}
