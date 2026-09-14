"use client";

import { useState, useTransition } from "react";
import { recordPaymentAction, updateFinanceAction } from "@/app/actions";

/**
 * פאנל הכספים — סעיף 8.3.
 *
 * זו לא הנהלת חשבונות (סעיף 3 מוציא את זה מהגדרת v1 במפורש). זה מעקב
 * סכומים: מה הלקוח חייב, מה שולם, כמה עולה לנו, וכמה באמת נשאר בכיס.
 *
 * הרווח בפועל מוצג לצד הצפוי, כי הפער ביניהם הוא הדבר שסוכן מגלה מאוחר
 * מדי — ואבן הדרך "סגירת עמלה בפועל" קיימת בדיוק בשבילו.
 */
export function MoneyPanel({
  tripId, priceToClient, supplierCost, amountPaid, expectedCommission, actualCommission,
}: {
  tripId: string;
  priceToClient: number;
  supplierCost: number;
  amountPaid: number;
  expectedCommission: number;
  actualCommission: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [paid, setPaid] = useState(String(amountPaid));

  const fmt = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;
  const balance = priceToClient - amountPaid;
  const margin = priceToClient - supplierCost;
  const marginPct = priceToClient > 0 ? (margin / priceToClient) * 100 : 0;
  const commissionGap = actualCommission > 0 ? actualCommission - expectedCommission : 0;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "שגיאה");
      else setEditing(false);
    });
  };

  return (
    <div className="card">
      <h2>כסף</h2>

      <div className="money-grid">
        <div className="money-cell">
          <span className="k">מחיר ללקוח</span>
          <span className="v num">{fmt(priceToClient)}</span>
        </div>
        <div className="money-cell">
          <span className="k">שולם</span>
          <span className="v num">{fmt(amountPaid)}</span>
        </div>
        <div className={`money-cell ${balance > 0 ? "warn" : "good"}`}>
          <span className="k">יתרה לגבייה</span>
          <span className="v num">{fmt(balance)}</span>
        </div>
        <div className="money-cell">
          <span className="k">עלות ספקים</span>
          <span className="v num">{fmt(supplierCost)}</span>
        </div>
        <div className={`money-cell ${margin > 0 ? "good" : "warn"}`}>
          <span className="k">רווח גולמי</span>
          <span className="v num">{fmt(margin)}</span>
          <span className="sub num">{marginPct.toFixed(0)}%</span>
        </div>
        <div className="money-cell">
          <span className="k">עמלה צפויה</span>
          <span className="v num">{fmt(expectedCommission)}</span>
        </div>
        <div className={`money-cell ${commissionGap < 0 ? "warn" : ""}`}>
          <span className="k">עמלה בפועל</span>
          <span className="v num">{actualCommission > 0 ? fmt(actualCommission) : "—"}</span>
          {commissionGap !== 0 && (
            <span className="sub num">
              {commissionGap > 0 ? "+" : ""}{fmt(commissionGap)} מהצפוי
            </span>
          )}
        </div>
      </div>

      {error && <div className="error" style={{ margin: "0.6rem 0 0" }}>{error}</div>}

      <div className="actions" style={{ marginTop: "0.7rem" }}>
        <input
          type="number" min="0" step="1" value={paid}
          onChange={(e) => setPaid(e.target.value)}
          aria-label="סכום ששולם" style={{ maxWidth: "9rem" }}
        />
        <button
          className="btn-primary"
          disabled={pending || Number(paid) === amountPaid}
          onClick={() => run(() => recordPaymentAction(tripId, Number(paid)))}
        >
          עדכון תשלום
        </button>
        <button className="btn-quiet" onClick={() => setEditing((v) => !v)}>
          {editing ? "סגירה" : "עלויות ועמלות"}
        </button>
      </div>
      <p className="hint">כשהיתרה מתאפסת, אבן הדרך של גביית היתרה נסגרת לבד.</p>

      {editing && (
        <form
          className="grid2"
          style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            run(() =>
              updateFinanceAction(tripId, {
                priceToClient: Number(data.get("priceToClient")),
                supplierCost: Number(data.get("supplierCost")),
                expectedCommission: Number(data.get("expectedCommission")),
                actualCommission: Number(data.get("actualCommission")),
              }),
            );
          }}
        >
          <div className="field">
            <label htmlFor="priceToClient">מחיר ללקוח</label>
            <input id="priceToClient" name="priceToClient" type="number" min="0" defaultValue={priceToClient} />
          </div>
          <div className="field">
            <label htmlFor="supplierCost">עלות ספקים</label>
            <input id="supplierCost" name="supplierCost" type="number" min="0" defaultValue={supplierCost} />
          </div>
          <div className="field">
            <label htmlFor="expectedCommission">עמלה צפויה</label>
            <input id="expectedCommission" name="expectedCommission" type="number" min="0" defaultValue={expectedCommission} />
          </div>
          <div className="field">
            <label htmlFor="actualCommission">עמלה בפועל</label>
            <input id="actualCommission" name="actualCommission" type="number" min="0" defaultValue={actualCommission} />
          </div>
          <div className="actions" style={{ gridColumn: "1 / -1" }}>
            <button className="btn-primary" type="submit" disabled={pending}>שמירה</button>
          </div>
        </form>
      )}
    </div>
  );
}
