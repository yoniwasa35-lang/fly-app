"use client";

import { Fragment, useActionState, useEffect, useState, useTransition } from "react";
import { markCheckinDoneAction, setComponentStatusAction } from "@/app/actions";
import { COMPONENT_STATUSES, COMPONENT_STATUS_HE, COMPONENT_TYPES, COMPONENT_TYPE_HE, type ComponentStatus, type ComponentType } from "@/lib/domain/types";
import {
  addComponentAction,
  addFlightComponentAction,
  deleteComponentAction,
  editComponentAction,
  type AddComponentState,
  type EditComponentState,
} from "./actions";
import { FlightForm, type FlightDefaults } from "./FlightForm";

export type ComponentRow = {
  id: string;
  type: string;
  rawType: string;
  supplier: string | null;
  description: string | null;
  reference: string | null;
  status: ComponentStatus;
  statusHe: string;
  freeCancelUntil: string | null;
  supplierPaymentDue: string | null;
  /** בפורמט YYYY-MM-DD, לטופס העריכה. */
  freeCancelInput: string | null;
  supplierPaymentInput: string | null;
  isFlight: boolean;
  flightDefaults: FlightDefaults | null;
  checkinDone: boolean;
  checkinOpensAt: string | null;
  checkinClosesAt: string | null;
};

export function ComponentsPanel({
  tripId, components, airports, airlines, tripDates,
}: {
  tripId: string;
  components: ComponentRow[];
  airports: Array<{ iata: string; label: string }>;
  airlines: Array<{ code: string; label: string }>;
  tripDates: { departureDate: string; departureTime: string; returnDate: string; returnTime: string; departureAirport: string; returnAirport: string };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addState, addAction, addPending] = useActionState<AddComponentState, FormData>(
    addComponentAction,
    {},
  );

  return (
    <div className="card">
      <h2>רכיבים</h2>
      {error && <div className="error" style={{ margin: "0 0 0.6rem" }}>{error}</div>}

      {components.length === 0 ? (
        <p className="hint">אין רכיבים. שליחת מסמכים תישאר חסומה עד שיהיה לפחות רכיב אחד מאושר.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>רכיב</th><th>סטטוס</th><th>ביטול חינם</th><th>תשלום לספק</th><th />
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <Fragment key={c.id}>
                <tr>
                  <td>
                    <div style={{ fontWeight: 550 }}>{c.description || c.type}</div>
                    <div className="hint">
                      {c.type}
                      {c.supplier && <> · {c.supplier}</>}
                      {c.reference && <> · <span className="num">{c.reference}</span></>}
                      {c.isFlight && c.checkinOpensAt && (
                        <div>
                          צ&apos;ק-אין: <span className="num">{c.checkinOpensAt}</span> — <span className="num">{c.checkinClosesAt}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <select
                      value={c.status}
                      disabled={pending}
                      aria-label={`סטטוס ${c.description || c.type}`}
                      onChange={(e) => {
                        const status = e.target.value;
                        setError(null);
                        startTransition(async () => {
                          const res = await setComponentStatusAction(c.id, status);
                          if (!res.ok) setError(res.error);
                        });
                      }}
                    >
                      {COMPONENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{COMPONENT_STATUS_HE[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td>{c.freeCancelUntil ? <span className="num">{c.freeCancelUntil}</span> : "—"}</td>
                  <td>{c.supplierPaymentDue ? <span className="num">{c.supplierPaymentDue}</span> : "—"}</td>
                  <td>
                    <button className="btn-quiet" onClick={() => setEditingId(editingId === c.id ? null : c.id)}>
                      עריכה
                    </button>
                    {c.isFlight && (
                      <button
                        className="btn-quiet"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const res = await markCheckinDoneAction(c.id, !c.checkinDone);
                            if (!res.ok) setError(res.error);
                          });
                        }}
                      >
                        {c.checkinDone ? "✓ צ׳ק-אין בוצע" : "סימון צ׳ק-אין"}
                      </button>
                    )}
                    <button
                      className="btn-quiet"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          const res = await deleteComponentAction(c.id);
                          if (res.error) setError(res.error);
                        });
                      }}
                    >
                      מחיקה
                    </button>
                  </td>
                </tr>
                {editingId === c.id && (
                  <tr>
                    <td colSpan={5} style={{ background: "#fbfcfd" }}>
                      {c.rawType === "flight" && c.flightDefaults ? (
                        <FlightForm
                          defaults={c.flightDefaults}
                          airports={airports}
                          airlines={airlines}
                          onDone={() => setEditingId(null)}
                        />
                      ) : (
                        <EditComponentForm component={c} onDone={() => setEditingId(null)} />
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!adding ? (
        <div className="actions" style={{ marginTop: "0.7rem" }}>
          <button onClick={() => setAdding(true)}>הוספת רכיב</button>
          {(["outbound", "inbound"] as const).map((direction) => {
            const exists = components.some((c) => c.flightDefaults?.direction === direction);
            if (exists) return null;
            return (
              <button
                key={direction}
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const res = await addFlightComponentAction(tripId, direction);
                    if (res.error) setError(res.error);
                    else if (res.componentId) setEditingId(res.componentId);
                  });
                }}
              >
                הוספת טיסת {direction === "outbound" ? "הלוך" : "חזור"}
              </button>
            );
          })}
        </div>
      ) : (
        <form action={addAction} style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
          <input type="hidden" name="tripId" value={tripId} />
          {addState.error && <div className="error" style={{ margin: "0 0 0.6rem" }}>{addState.error}</div>}
          <div className="grid2">
            <div className="field">
              <label htmlFor="type">סוג</label>
              <select id="type" name="type" defaultValue="hotel">
                {COMPONENT_TYPES.map((t) => (
                  <option key={t} value={t}>{COMPONENT_TYPE_HE[t as ComponentType]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="supplier">ספק</label>
              <input id="supplier" name="supplier" autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">תיאור</label>
            <input id="description" name="description" placeholder="מלון באתונה, 7 לילות" autoComplete="off" />
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="freeCancelUntil">ביטול חינם עד</label>
              <input id="freeCancelUntil" name="freeCancelUntil" type="date" />
            </div>
            <div className="field">
              <label htmlFor="supplierPaymentDue">תשלום לספק עד</label>
              <input id="supplierPaymentDue" name="supplierPaymentDue" type="date" />
            </div>
          </div>
          <p className="hint" style={{ marginTop: "-0.3rem", marginBottom: "0.6rem" }}>
            כל אחד מהמועדים האלה מייצר אבן דרך משלו, עם התראה שלושה ימים מראש.
          </p>
          <div className="actions">
            <button className="btn-primary" type="submit" disabled={addPending}>
              {addPending ? "מוסיף…" : "הוספה"}
            </button>
            <button type="button" className="btn-quiet" onClick={() => setAdding(false)}>סגירה</button>
          </div>
        </form>
      )}
    </div>
  );
}


/**
 * עריכת רכיב קיים. מספר ההזמנה הוא השדה החשוב כאן: הוא מה שהלקוח מחפש
 * בעמוד שלו כשהוא עומד בדלפק, ועד עכשיו לא הייתה שום דרך להזין אותו.
 */
function EditComponentForm({ component, onDone }: { component: ComponentRow; onDone: () => void }) {
  const [state, action, pending] = useActionState<EditComponentState, FormData>(editComponentAction, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} style={{ padding: "0.6rem 0" }}>
      <input type="hidden" name="componentId" value={component.id} />
      {state.error && <div className="error" style={{ margin: "0 0 0.6rem" }}>{state.error}</div>}

      <div className="grid2">
        <div className="field">
          <label>מספר הזמנה / PNR</label>
          <input name="reference" defaultValue={component.reference ?? ""} dir="ltr" autoComplete="off" />
        </div>
        <div className="field">
          <label>ספק</label>
          <input name="supplier" defaultValue={component.supplier ?? ""} autoComplete="off" />
        </div>
      </div>

      <div className="field">
        <label>תיאור</label>
        <input name="description" defaultValue={component.description ?? ""} autoComplete="off" />
      </div>

      <div className="grid2">
        <div className="field">
          <label>ביטול חינם עד</label>
          <input name="freeCancelUntil" type="date" defaultValue={component.freeCancelInput ?? ""} />
        </div>
        <div className="field">
          <label>תשלום לספק עד</label>
          <input name="supplierPaymentDue" type="date" defaultValue={component.supplierPaymentInput ?? ""} />
        </div>
      </div>

      <div className="actions">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "שומר…" : "שמירה"}
        </button>
        <button type="button" className="btn-quiet" onClick={onDone}>ביטול</button>
      </div>
    </form>
  );
}
