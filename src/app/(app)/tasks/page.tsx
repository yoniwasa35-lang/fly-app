import Link from "next/link";
import { QueueRow } from "@/components/QueueRow";
import { listTasks, TASK_TABS, TASK_TAB_HE, type TaskTab } from "@/lib/queue/tasks";
import { formatAbsoluteHe } from "@/lib/time/zones";
import { Icon } from "@/components/Icon";
import { BrandMark } from "@/components/Brand";

export const dynamic = "force-dynamic";

/**
 * "משימות" — כל מה שהמערכת יודעת שצריך לקרות, כולל מה שכבר קרה.
 * מסך "היום" נשאר תור הפעולה; כאן יש חיפוש והיסטוריה.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tab = (TASK_TABS.includes(sp.tab as TaskTab) ? sp.tab : "today") as TaskTab;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(0, Number(sp.page) || 0);

  const list = await listTasks({ tab, query: q, page });

  const href = (patch: { tab?: string; page?: string }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (patch.tab && patch.tab !== "today") p.set("tab", patch.tab);
    else if (!patch.tab && tab !== "today") p.set("tab", tab);
    if (patch.page && patch.page !== "0") p.set("page", patch.page);
    const s = p.toString();
    return s ? `/tasks?${s}` : "/tasks";
  };

  const empty = {
    today: ["אין משימות להיום.", "כל מה שנדרש עד סוף היום טופל."],
    upcoming: ["אין משימות בהמשך.", "כשייפתחו תיקים חדשים, אבני הדרך שלהם יופיעו כאן."],
    done: ["עוד לא הושלמה משימה.", "כל משימה שתסמנו כבוצעה תישמר כאן."],
  }[tab];

  return (
    <>
      <header className="topbar">
        <BrandMark className="topbar-brand" />
        <h1>
          משימות
          <span className="sub">
            {list.counts.today} להיום · {list.counts.upcoming} בהמשך
          </span>
        </h1>
        <Link className="btn btn-primary" href="/tasks/new">
          <Icon name="plus" />
          <span>משימה</span>
        </Link>
      </header>

      <div className="tabs" role="tablist" aria-label="סינון משימות">
        {TASK_TABS.map((t) => (
          <Link
            key={t}
            className="tab"
            href={href({ tab: t, page: "0" })}
            aria-selected={t === tab}
            role="tab"
          >
            {TASK_TAB_HE[t]}
            <span className="tab-count">{list.counts[t]}</span>
          </Link>
        ))}
      </div>

      <form className="searchbar" action="/tasks" method="get" role="search">
        {tab !== "today" && <input type="hidden" name="tab" value={tab} />}
        <Icon name="search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי משימה, לקוח או יעד"
          aria-label="חיפוש משימה"
        />
        {q && (
          <Link className="btn-quiet" href={href({ page: "0" })}>
            ניקוי
          </Link>
        )}
      </form>

      {list.items.length === 0 ? (
        <div className="empty">
          <Icon name="tasks" />
          <strong>{q ? "אין תוצאות לחיפוש." : empty[0]}</strong>
          {q ? "נסו מילה אחרת, שם לקוח או יעד." : empty[1]}
        </div>
      ) : (
        <div className="stack" style={{ marginTop: "var(--sp-3)" }}>
          {list.items.map((item) => (
            <QueueRow key={item.id} item={item} now={list.now} />
          ))}
        </div>
      )}

      {list.more > 0 && (
        <div className="pager">
          <span />
          <Link className="btn" href={href({ page: String(page + 1) })}>
            עוד {list.more}
          </Link>
        </div>
      )}

      {page > 0 && (
        <p className="hint" style={{ padding: "0 var(--sp-5)" }}>
          עמוד {page + 1} · נכון ל{formatAbsoluteHe(list.now, { withTime: true })}
        </p>
      )}
    </>
  );
}
