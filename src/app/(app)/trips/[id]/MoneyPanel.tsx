"use client";

import { useState, useTransition } from "react";
import { recordPaymentAction, settleSupplierCostAction, updateFinanceAction } from "@/app/actions";
import { shekels, tripFinance } from "@/lib/trips/finance";

/**
 * פאנל הכספים — סעיף 8.3.
 *
 * מודל ההכנסה: מתמחרים מעל עלות הספק ומרוויחים את ההפרש. לכן אין כאן שדה
 * "עמלה" — הרווח נגזר. מה שמזינים זה מחיר ועלות, ואחרי הנסיעה את העלות
 * האמיתית, שכמעט תמיד שונה מהמשוערת.
 *
 * זו לא הנהלת חשבונות (סעיף 3), רק מעקב סכומים.
 */
export function MoneyPanel({
  tripId, priceToClient, supplierCost, actualSupplierCost, amountPaid, settleMilestoneId,
}: {
  tripId: string;
  priceToClient: number;
  supplierCost: number;
  actualSupplierCost: number | null;
  amountPaid: number;
  /** אבן הדרך של סגירת הרווח, אם היא עדיין פתוחה. */
  settleMilestoneId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [paid, setPaid] = useState(String(amountPaid));

  const f = tripFinance({ priceToClient, supplierCost, actualSupplierCost, amountPaid });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "שגיאה");
      else { setEditing(false); setSettling(false); }
    });
  };

  return (
    <div className="card">
      <h2>כסף</h2>

      <div className="money-grid">
        <div className="money-cell">
          <span className="k">מחיר ללקוח</span>
          <span className="v num">{shekels(f.priceToClient)}</span>
        </div>
        <div className="money-cell">
          <span className="k">שולם</span>
          <span className="v num">{shekels(f.amountPaid)}</span>
        </div>
        <div className={`money-cell ${f.balance > 0 ? "warn" : "good"}`}>
          <span className="k">יתרה לגבייה</span>
          <span className="v num">{shekels(f.balance)}</span>
        </div>

        <div className="money-cell">
          <span className="k">עלות ספקים {f.settled && "(משוערת)"}</span>
          <span className="v num">{shekels(f.supplierCost)}</span>
        </div>
        <div className={`money-cell ${f.settled ? "" : f.expectedMargin > 0 ? "good" : "warn"}`}>
          <span className="k">רווח צפוי</span>
          <span className="v num">{shekels(f.expectedMargin)}</span>
          <span className="sub num">{f.expectedMarginPct.toFixed(0)}%</span>
        </div>

        {f.settled ? (
          <>
            <div className="money-cell">
              <span className="k">עלות בפועל</span>
              <span className="v num">{shekels(f.actualSupplierCost as number)}</span>
            </div>
            <div className={`money-cell ${(f.marginGap ?? 0) < 0 ? "warn" : "good"}`}>
              <span className="k">רווח בפועל</span>
              <span className="v num">{shekels(f.actualMargin as number)}</span>
              <span className="sub num">
                {(f.actualMarginPct as number).toFixed(0)}%
                {f.marginGap !== 0 && ` · ${f.marginGap! > 0 ? "+" : ""}${shekels(f.marginGap as number)} מהצפוי`}
              </span>
            </div>
          </>
        ) : (
          <div className="money-cell">
            <span className="k">רווח בפועל</span>
            <span className="v num">—</span>
            <span className="sub">נסגר אחרי החזרה</span>
          </div>
        )}
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
        <button className="btn-quiet" onClick={() => { setEditing((v) => !v); setSettling(false); }}>
          {editing ? "סגירה" : "מחיר ועלות"}
        </button>
        {!f.settled && (
          <button className="btn-quiet" onClick={() => { setSettling((v) => !v); setEditing(false); }}>
            סגירת רווח
          </button>
        )}
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
              }),
            );
          }}
        >
          <div className="field">
            <label htmlFor="priceToClient">מחיר ללקוח</label>
            <input id="priceToClient" name="priceToClient" type="number" min="0" defaultValue={priceToClient} />
          </div>
          <div className="field">
            <label htmlFor="supplierCost">עלות ספקים משוערת</label>
            <input id="supplierCost" name="supplierCost" type="number" min="0" defaultValue={supplierCost} />
          </div>
          <p className="hint" style={{ gridColumn: "1 / -1", marginTop: "-0.3rem" }}>
            הרווח נגזר מההפרש ואינו שדה נפרד, כדי שלא ייווצרו שני מספרים שמתפצלים.
          </p>
          <div className="actions" style={{ gridColumn: "1 / -1" }}>
            <button className="btn-primary" type="submit" disabled={pending}>שמירה</button>
          </div>
        </form>
      )}

      {settling && (
        <form
          style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(new FormData(e.currentTarget).get("actualSupplierCost"));
            run(() => settleSupplierCostAction(tripId, value, settleMilestoneId));
          }}
        >
          <div className="field">
            <label htmlFor="actualSupplierCost">כמה שילמנו לספקים בפועל</label>
            <input
              id="actualSupplierCost" name="actualSupplierCost" type="number" min="0"
              defaultValue={supplierCost} autoFocus
            />
            <p className="hint">
              הסכום שיצא מהכיס אחרי כל החיובים, הביטולים והזיכויים. הרווח בפועל ייגזר ממנו.
            </p>
          </div>
          <div className="actions">
            <button className="btn-primary" type="submit" disabled={pending}>סגירת הרווח</button>
            <button type="button" className="btn-quiet" onClick={() => setSettling(false)}>ביטול</button>
          </div>
        </form>
      )}
    </div>
  );
}
