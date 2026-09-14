import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients/directory";
import { formatAbsoluteHe, formatRelativeHe } from "@/lib/time/zones";
import { TRIP_STATUS_HE } from "@/lib/domain/types";
import { normalizePhone } from "@/lib/messages/phone";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const OPEN = new Set(["draft", "active", "traveling"]);

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getClient(id);
  if (!c) notFound();

  const now = new Date();
  const phone = normalizePhone(c.phone);
  const open = c.trips.filter((t) => OPEN.has(t.status));
  const past = c.trips.filter((t) => !OPEN.has(t.status));

  return (
    <>
      <header className="topbar">
        <h1>
          {c.name}
          <span className="sub">
            <span className="num">{c.phone}</span> · {c.trips.length}{" "}
            {c.trips.length === 1 ? "נסיעה" : "נסיעות"} · לקוח מאז{" "}
            {formatAbsoluteHe(c.since, { withTime: false })}
          </span>
        </h1>
        <Link className="btn" href="/clients">
          לקוחות
        </Link>
      </header>

      {/* הדבר הראשון שרוצים לעשות מול לקוח הוא ליצור איתו קשר */}
      <div className="contact-row">
        {phone.ok && (
          <>
            <a className="btn btn-wa" href={`https://wa.me/${phone.e164}`} target="_blank" rel="noopener noreferrer">
              <Icon name="messages" />
              <span>וואטסאפ</span>
            </a>
            <a className="btn" href={`tel:${c.phone.replace(/\s/g, "")}`}>
              חיוג
            </a>
          </>
        )}
        {c.email && (
          <a className="btn" href={`mailto:${c.email}`}>
            מייל
          </a>
        )}
        <Link className="btn btn-primary" href={`/trips/new?clientId=${c.id}`}>
          <Icon name="plus" />
          <span>נסיעה חדשה</span>
        </Link>
      </div>

      {c.notes && (
        <section className="card">
          <h2>הערות</h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.notes}</p>
        </section>
      )}

      <section className="card">
        <h2>נסיעות פתוחות</h2>
        {open.length === 0 ? (
          <p className="hint">אין נסיעה פתוחה כרגע.</p>
        ) : (
          <div className="trip-list">
            {open.map((t) => {
              const rel = formatRelativeHe(t.departureAt, now);
              return (
                <Link key={t.id} className="trip-line" href={`/trips/${t.id}`}>
                  <span className="trip-line-main">
                    <strong>{t.destination}</strong>
                    <small>
                      {formatAbsoluteHe(t.departureAt, { withTime: false })} –{" "}
                      {formatAbsoluteHe(t.returnAt, { withTime: false })}
                    </small>
                  </span>
                  <span className="trip-line-side">
                    <span className="tag">{TRIP_STATUS_HE[t.status]}</span>
                    {t.openMilestones > 0 && (
                      <span className="tag tag-overdue">{t.openMilestones} לפעולה</span>
                    )}
                    <small>{rel.text}</small>
                  </span>
                  <Icon name="chevron" className="menu-go" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {c.travelers.length > 0 && (
        <section className="card">
          <h2>מי נוסע בדרך כלל</h2>
          <p className="hint">מהנסיעה האחרונה. מספרי הדרכון נשמרים בתוך התיק עצמו.</p>
          <ul className="c-booked">
            {c.travelers.map((t, i) => (
              <li key={i}>
                <span className="ltr">{t.name}</span>
                {t.nameHe && <span className="c-muted">{t.nameHe}</span>}
                {t.isLead && <span className="tag tag-client">איש קשר</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="card">
          <h2>היסטוריה</h2>
          <div className="trip-list">
            {past.map((t) => (
              <Link key={t.id} className="trip-line" href={`/trips/${t.id}`}>
                <span className="trip-line-main">
                  <strong>{t.destination}</strong>
                  <small>{formatAbsoluteHe(t.departureAt, { withTime: false })}</small>
                </span>
                <span className="trip-line-side">
                  <span className="tag">{TRIP_STATUS_HE[t.status]}</span>
                </span>
                <Icon name="chevron" className="menu-go" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
