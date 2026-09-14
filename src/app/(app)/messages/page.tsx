import Link from "next/link";
import { listTemplates } from "@/lib/messages/store";
import { VARIABLES } from "@/lib/messages/variables";
import { getTemplate } from "@/lib/milestones/template";
import { TemplateEditor } from "./TemplateEditor";

export const dynamic = "force-dynamic";

/** לאיזו אבן דרך כל תבנית שייכת — כדי שהשמות באנגלית לא יהיו חידה. */
function milestoneTitles(): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of getTemplate("leisure_package").milestones) {
    if (m.message_template_key) map.set(m.message_template_key, m.title);
  }
  return map;
}

export default async function MessagesPage() {
  const templates = await listTemplates();
  const titles = milestoneTitles();
  const envMissing = (["AGENT_NAME", "AGENCY_NAME", "AGENT_EMERGENCY_PHONE"] as const).filter(
    (k) => !process.env[k]?.trim(),
  );

  return (
    <>
      <header className="topbar">
        <h1>
          תבניות הודעות
          <span className="sub">{templates.length} נוסחים · נשלחים בוואטסאפ מהכפתור במסך היום</span>
        </h1>
        <Link className="btn" href="/">היום</Link>
      </header>

      {envMissing.length > 0 && (
        <div className="error">
          לא הוגדרו משתני הסביבה {envMissing.join(", ")}. הודעות שמשתמשות ב
          {envMissing.includes("AGENT_NAME") ? "שם הסוכן" : "פרטי העסק"} לא יישלחו עד שיוגדרו.
        </div>
      )}

      <div className="card">
        <h2>משתנים זמינים</h2>
        <p className="hint">
          כותבים אותם בתוך שתי סוגריים מסולסלות. לחיצה על משתנה מעתיקה אותו.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>משתנה</th><th>מה זה</th><th>דוגמה</th></tr></thead>
            <tbody>
              {VARIABLES.map((v) => (
                <tr key={v.name}>
                  <td><code>{`{{${v.name}}}`}</code></td>
                  <td>{v.description}</td>
                  <td className="hint">{v.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {templates.map((t) => (
        <TemplateEditor
          key={t.key}
          templateKey={t.key}
          title={titles.get(t.key) ?? t.key}
          body={t.body}
          edited={t.edited}
        />
      ))}
    </>
  );
}
