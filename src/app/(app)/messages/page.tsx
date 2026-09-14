import Link from "next/link";
import { listTemplates } from "@/lib/messages/store";
import { templateSchedules } from "@/lib/messages/schedule";
import { Icon } from "@/components/Icon";
import { TemplateEditor } from "./TemplateEditor";

export const dynamic = "force-dynamic";

/**
 * תבניות ההודעות.
 *
 * המסך הזה נכתב מחדש סביב השאלה שהסוכן באמת שואל: "מה נשלח ללקוח, ומתי".
 * קודם הוא פתח בטבלה של {{שם_פרטי}} ו-{{תאריך_יציאה}} — שפה של מי שבונה
 * את המערכת, לא של מי שמשתמשת בה. המשתנים לא נעלמו, הם ירדו לתוך העורך
 * ולבשו שמות בעברית; מי שרק רוצה לתקן ניסוח לא פוגש אותם בכלל.
 */
export default async function MessagesPage() {
  const [templates, schedules] = await Promise.all([listTemplates(), templateSchedules()]);

  const envMissing = (["AGENT_NAME", "AGENCY_NAME", "AGENT_EMERGENCY_PHONE"] as const).filter(
    (k) => !process.env[k]?.trim(),
  );

  return (
    <>
      <header className="topbar">
        <h1>
          הודעות ללקוחות
          <span className="sub">{templates.length} נוסחים · נשלחים בוואטסאפ בלחיצה</span>
        </h1>
        <Link className="btn" href="/more">
          עוד
        </Link>
      </header>

      {envMissing.length > 0 && (
        <div className="error">
          <Icon name="alert" />
          <span>
            חסרים פרטי עסק ({envMissing.join(", ")}). הודעות שמשתמשות בהם לא יישלחו עד שיוגדרו
            — אפשר לראות מה חסר במסך "עוד".
          </span>
        </div>
      )}

      <p className="hint" style={{ padding: "var(--sp-4) var(--sp-5) 0" }}>
        שום הודעה לא נשלחת לבד. המערכת מכינה אותה ואומרת מתי — הלחיצה על "שליחה" שלכם.
      </p>

      <div className="stack" style={{ marginTop: "var(--sp-3)" }}>
        {templates.map((t) => {
          const s = schedules.get(t.key);
          return (
            <details key={t.key} className="collapse template-item">
              <summary>
                <span className="template-name">
                  {s?.title ?? t.key}
                  {t.edited && <span className="tag tag-done">נערך</span>}
                  {s && !s.toClient && <span className="tag tag-agent">פנימי</span>}
                </span>
                <span className="hint template-when">
                  {s ? s.when : "לפי מועד אבן הדרך"}
                  {s?.basis && <> · {s.basis}</>}
                </span>
              </summary>

              <TemplateEditor
                templateKey={t.key}
                title={s?.title ?? t.key}
                body={t.body}
                edited={t.edited}
              />
            </details>
          );
        })}
      </div>
    </>
  );
}
