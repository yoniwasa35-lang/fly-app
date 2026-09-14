import Link from "next/link";
import { listClients } from "@/lib/clients/directory";
import { formatAbsoluteHe, formatRelativeHe } from "@/lib/time/zones";
import { TRIP_STATUS_HE } from "@/lib/domain/types";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

/**
 * כל האנשים במקום אחד.
 *
 * החיפוש הוא טופס GET רגיל ולא שדה שמדבר ל-JavaScript: הוא עובד גם
 * לפני שהעמוד סיים להיטען, אפשר לשמור את הכתובת במועדפים, וכפתור
 * "אחורה" מתנהג כמו שמצפים ממנו.
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page) || 0);
  const q = sp.q?.trim() ?? "";

  const dir = await listClients({ query: q, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const now = new Date();

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k);
    const s = p.toString();
    return s ? `/clients?${s}` : "/clients";
  };

  return (
    <>
      <header className="topbar">
        <h1>
          לקוחות
          <span className="sub">
            {dir.total} {dir.total === 1 ? "לקוח" : "לקוחות"}
            {q && <> · תוצאות לחיפוש</>}
          </span>
        </h1>
      </header>

      <form className="searchbar" action="/clients" method="get" role="search">
        <Icon name="search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="חיפוש לקוח — שם או טלפון"
          aria-label="חיפוש לקוח"
        />
        {q && (
          <Link className="btn-quiet" href="/clients">
            ניקוי
          </Link>
        )}
      </form>

      {dir.rows.length === 0 ? (
        q ? (
          <EmptyState
            icon="search"
            title="אף לקוח לא תואם את החיפוש"
            body="נסו חלק מהשם, או את ארבע הספרות האחרונות של הטלפון."
          />
        ) : (
          <EmptyState
            icon="clients"
            title="בואו נוסיף את הלקוח הראשון"
            body="כאן יישבו כל האנשים — שם, טלפון, וכל הנסיעות שלהם לאורך השנים."
            action={{ href: "/clients/new", label: "לקוח חדש" }}
          />
        )
      ) : (
        <div className="stack">
          {dir.rows.map((c) => {
            const rel = c.next ? formatRelativeHe(c.next.departureAt, now) : null;
            return (
              <Link key={c.id} className="person" href={`/clients/${c.id}`}>
                <span className="person-avatar" aria-hidden="true">
                  {c.name.trim().charAt(0)}
                </span>

                <span className="person-main">
                  <strong>{c.name}</strong>
                  <span className="num person-phone">{c.phone}</span>
                </span>

                <span className="person-side">
                  {c.next ? (
                    <>
                      <span className="person-dest">{c.next.destination}</span>
                      <small>
                        {formatAbsoluteHe(c.next.departureAt, { withTime: false })}
                        {rel && <> · {rel.text}</>}
                      </small>
                      {c.next.status === "traveling" && (
                        <span className="tag tag-done">{TRIP_STATUS_HE.traveling}</span>
                      )}
                    </>
                  ) : (
                    <small className="hint">
                      {c.lastDestination ? `אחרון: ${c.lastDestination}` : "אין נסיעות"}
                    </small>
                  )}
                </span>

                <Icon name="chevron" className="menu-go" />
              </Link>
            );
          })}
        </div>
      )}

      {(page > 0 || dir.more > 0) && (
        <div className="pager">
          {page > 0 ? (
            <Link className="btn" href={href({ page: String(page - 1) })}>
              הקודמים
            </Link>
          ) : (
            <span />
          )}
          {dir.more > 0 && (
            <Link className="btn" href={href({ page: String(page + 1) })}>
              עוד {Math.min(PAGE_SIZE, dir.more)}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
