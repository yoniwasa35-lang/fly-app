import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTrip, type PublicFlight, type PublicStay } from "@/lib/trips/publicView";
import { normalizePhone } from "@/lib/messages/phone";
import { formatRelativeHe } from "@/lib/time/zones";
import { BrandMark, Wordmark } from "@/components/Brand";
import { Icon } from "@/components/Icon";

/**
 * עמוד הלקוח — סעיף 8.4. עמוד web בקישור ייחודי, בלי התחברות, שנשלח
 * בוואטסאפ. לא אפליקציה.
 *
 * שלושה דברים שהעמוד עושה: אומר מתי יוצאים, אומר מה כבר סגור ומה נשאר,
 * ומחזיק את פרטי הטיסה במקום שנפתח בשנייה בשדה התעופה. וכשהתיק בנסיעה,
 * ראש העמוד מתחלף למספר החירום ולטיסת החזור.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // עמוד פתוח עם פרטי לקוח. אין סיבה שיגיע למנועי חיפוש.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * הלוגו בראש עמוד הלקוח. זה המסך היחיד שלקוחות רואים, ולכן הוא היחיד
 * שבו המותג מופיע בגודל מלא — בכל שלושת מצבי הנסיעה.
 */
function HeroBrand() {
  return (
    <>
      <BrandMark />
      <Wordmark sub />
      <div className="brand-rule" />
    </>
  );
}

/**
 * המלון.
 *
 * הלקוח לא צריך לדעת ש"הוזמן Hilton X" — הוא צריך לראות לאן הוא מגיע.
 * לכן השם גדול, ומתחתיו רק מה שמשרת מישהו שעומד בקבלה: חדר, אירוח,
 * תאריכים ושעות, וכתובת. הכפתורים מופיעים אחד-אחד, רק כשיש להם יעד
 * אמיתי — אין כאן כפתור שמוביל לניחוש.
 */
function StayCard({ stay }: { stay: PublicStay }) {
  return (
    <section className="c-section c-stay">
      <h2>המלון שלכם</h2>

      <h3 className="c-stay-name">{stay.name}</h3>

      {(stay.stars || stay.rating) && (
        <p className="c-stay-rating">
          {stay.stars}
          {stay.stars && stay.rating && " · "}
          {stay.rating}
        </p>
      )}

      {stay.photos.length > 0 && (
        <div className="c-gallery">
          {stay.photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" loading="lazy" decoding="async" />
          ))}
        </div>
      )}

      <dl className="c-details c-stay-details">
        <dt>צ׳ק-אין</dt>
        <dd>
          {stay.checkInLabel}
          {stay.checkInTime && <> · מ-<span className="num">{stay.checkInTime}</span></>}
        </dd>

        <dt>צ׳ק-אאוט</dt>
        <dd>
          {stay.checkOutLabel}
          {stay.checkOutTime && <> · עד <span className="num">{stay.checkOutTime}</span></>}
        </dd>

        <dt>לילות</dt>
        <dd>{stay.nights}</dd>

        {stay.roomType && (
          <>
            <dt>חדר</dt>
            <dd>{stay.roomType}</dd>
          </>
        )}

        {stay.board && (
          <>
            <dt>אירוח</dt>
            <dd>{stay.board}</dd>
          </>
        )}

        {stay.address && (
          <>
            <dt>כתובת</dt>
            <dd>{stay.address}</dd>
          </>
        )}
      </dl>

      <div className="c-stay-actions">
        <a className="c-btn" href={stay.mapUrl} target="_blank" rel="noopener noreferrer">
          פתיחה במפה
        </a>
        {stay.officialUrl && (
          <a className="c-btn" href={stay.officialUrl} target="_blank" rel="noopener noreferrer">
            האתר של המלון
          </a>
        )}
        {stay.voucherUrl && (
          <a className="c-btn" href={stay.voucherUrl} target="_blank" rel="noopener noreferrer">
            צפייה בוואוצ׳ר
          </a>
        )}
      </div>
    </section>
  );
}

function waLink(phone: string, text: string): string | null {
  const n = normalizePhone(phone);
  return n.ok ? `https://wa.me/${n.e164}?text=${encodeURIComponent(text)}` : null;
}

function FlightCard({ flight, now }: { flight: PublicFlight; now: Date }) {
  const isOut = flight.direction === "outbound";
  const checkinOpen = !!flight.checkinOpensAt && flight.checkinOpensAt <= now;

  return (
    <div className="c-flight">
      <div className="c-flight-head">
        <strong>טיסת {isOut ? "הלוך" : "חזור"}</strong>
        <span className="num">{flight.flightNumber}</span>
        <span className="c-muted">{flight.airline}</span>
      </div>

      <div className="c-flight-route">
        <div>
          <span className="c-time num">{flight.departsTime}</span>
          <span className="c-place">{flight.fromAirport}</span>
        </div>
        <span className="c-arrow">
          <Icon name="arrow" />
        </span>
        <div>
          {flight.arrivesTime ? (
            <span className="c-time num">{flight.arrivesTime}</span>
          ) : (
            <span className="c-time c-time-unknown" aria-label="שעת נחיתה לא ידועה">··</span>
          )}
          <span className="c-place">{flight.toAirport}</span>
        </div>
      </div>

      <div className="c-muted">{flight.departsLabel} · השעות בשעון המקומי של שדה היציאה</div>

      <dl className="c-details">
        {flight.reference && (
          <>
            <dt>מספר הזמנה</dt>
            <dd className="num">{flight.reference}</dd>
          </>
        )}
        {flight.baggage && (
          <>
            <dt>כבודה</dt>
            <dd>{flight.baggage}</dd>
          </>
        )}
        {flight.checkinDone ? (
          <>
            <dt>צ׳ק-אין</dt>
            <dd className="c-done">
              <Icon name="check" />
              <span>בוצע</span>
            </dd>
          </>
        ) : flight.checkinClosesLabel ? (
          <>
            <dt>צ׳ק-אין</dt>
            <dd>
              {checkinOpen ? "פתוח עכשיו" : `נפתח ${flight.checkinOpensLabel}`}
              <br />
              <span className="c-muted">
                נסגר {flight.checkinClosesLabel}
                {flight.lateCheckinCosts && " · אחרי זה צ׳ק-אין בשדה עולה כסף"}
              </span>
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

export default async function ClientTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await getPublicTrip(token);
  if (!trip) notFound();

  const now = new Date();
  const outbound = trip.flights.find((f) => f.direction === "outbound");
  const askAgent = (text: string) => (trip.agent.phone ? waLink(trip.agent.phone, text) : null);

  const coverStyle = trip.cover
    ? ({ "--cover": `url(${JSON.stringify(trip.cover.url)})` } as React.CSSProperties)
    : undefined;
  const heroClass = trip.cover ? " has-cover" : "";

  return (
    <main className="client">
      {/* ראש העמוד מתחלף בזמן הנסיעה — סעיף 8.4 */}
      {trip.phase === "returned" ? (
        <header className={`c-hero c-hero-returned${heroClass}`} style={coverStyle}>
          <HeroBrand />
          <span className="c-kicker">{trip.clientName}</span>
          <h1>ברוכים השבים</h1>
          <p className="c-muted">
            חזרתם מ{trip.destination} ב{trip.returnLabel}.
            <br />
            אם משהו לא הסתדר בנסיעה — טיסה שהתעכבה, שירות שלא סופק, כבודה שאיחרה —
            תעדכנו אותנו. לפעמים מגיע פיצוי, ויש חלונות זמן להגיש בקשה.
          </p>
        </header>
      ) : trip.phase === "traveling" ? (
        <header className={`c-hero c-hero-traveling${heroClass}`} style={coverStyle}>
          <HeroBrand />
          <span className="c-kicker">אתם ב{trip.destination}</span>
          <h1>שמרו את המספר הזה</h1>
          {trip.agent.phone ? (
            <a className="c-emergency num" href={`tel:${trip.agent.phone.replace(/\s/g, "")}`}>
              {trip.agent.phone}
            </a>
          ) : (
            <p className="c-muted">מספר החירום יתעדכן כאן.</p>
          )}
          <p className="c-muted">
            {trip.agent.name ? `${trip.agent.name} · ` : ""}לכל דבר דחוף בזמן הנסיעה
          </p>

          {trip.inbound && (
            <div className="c-inbound">
              <span className="c-kicker">טיסת החזור</span>
              <strong className="num">{trip.inbound.flightNumber}</strong>
              <span>
                {trip.inbound.departsLabel} · <span className="num">{trip.inbound.departsTime}</span> מ
                {trip.inbound.fromAirport}
              </span>
            </div>
          )}
        </header>
      ) : (
        <header className={`c-hero${heroClass}`} style={coverStyle}>
          <HeroBrand />
          <span className="c-kicker">{trip.clientName}</span>
          <h1>{trip.destination}</h1>
          <p className="c-countdown">{trip.countdown}</p>
          <p className="c-muted">
            יציאה ב{trip.departureLabel}
            {outbound && (
              <> בשעה <span className="num">{outbound.departsTime}</span></>
            )}
            <br />
            חזרה ב{trip.returnLabel}
          </p>
        </header>
      )}

      {trip.stay && <StayCard stay={trip.stay} />}

      {/* מה נשאר מהלקוח */}
      {trip.todos.length > 0 && (
        <section className="c-section c-todo">
          <h2>מה נשאר מכם</h2>
          {trip.todos.map((todo) => (
            <div key={todo.kind} className="c-todo-row">
              <strong>{todo.label}</strong>
              <span>{todo.detail}</span>
            </div>
          ))}
          {askAgent(`היי, לגבי התיק שלנו ל${trip.destination} —`) && (
            <a
              className="c-btn c-btn-wa"
              href={askAgent(`היי, לגבי התיק שלנו ל${trip.destination} —`)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              לשלוח לנו הודעה
            </a>
          )}
        </section>
      )}

      {/* פרטי הטיסות — זה מה שפותחים בשדה התעופה */}
      {trip.flights.length > 0 && (
        <section className="c-section">
          <h2>הטיסות שלכם</h2>
          {trip.flights.map((f) => (
            <FlightCard key={f.direction + f.flightNumber} flight={f} now={now} />
          ))}
        </section>
      )}

      {/* מה כבר סגור */}
      {trip.booked.length > 0 && (
        <section className="c-section">
          <h2>מה כבר סגור</h2>
          <ul className="c-booked">
            {trip.booked.map((b, i) => (
              <li key={i}>
                <span className="c-check">
                  <Icon name="check" />
                </span>
                <span>
                  {b.description}
                  {b.reference && (
                    <>
                      {" "}
                      <span className="c-muted num">{b.reference}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* כלי מכירה — סעיף 8.4: כל upsell שהוצע ולא נסגר מופיע כשורה פתוחה */}
      {trip.upsells.length > 0 && (
        <section className="c-section c-upsell">
          <h2>אפשר להוסיף</h2>
          {trip.upsells.map((u) => {
            const link = askAgent(`היי, מעניין אותנו ${u.detail || u.label} לנסיעה ל${trip.destination}`);
            return (
              <div key={u.id} className="c-upsell-row">
                <div>
                  <strong>{u.label}</strong>
                  {u.detail && <span className="c-muted"> · {u.detail}</span>}
                </div>
                {link && (
                  <a className="c-btn" href={link} target="_blank" rel="noopener noreferrer">
                    ספרו לי עוד
                  </a>
                )}
              </div>
            );
          })}
        </section>
      )}

      <footer className="c-footer">
        {trip.cover?.credit && <p className="c-credit">{trip.cover.credit}</p>}
        <Wordmark />
        <br />
        תיק <span className="num">{trip.code}</span>
        {trip.agent.agency && <> · {trip.agent.agency}</>}
        <br />
        <span className="c-muted">
          הקישור הזה אישי. אל תשתפו אותו — הוא מציג את פרטי הנסיעה שלכם.
        </span>
      </footer>
    </main>
  );
}
