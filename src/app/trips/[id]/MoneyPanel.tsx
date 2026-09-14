"use client";

import { useState, useTransition } from "react";
import { recordPaymentAction } from "@/app/actions";

export function MoneyPanel({
  tripId, priceToClient, amountPaid, balance,
}: {
  tripId: string;
  priceToClient: number;
  amountPaid: number;
  balance: number;
}) {
  const [value, setValue] = useState(String(amountPaid));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fmt = (n: number) => n.toLocaleString("he-IL");

  return (
    <div className="card">
      <h2>כסף</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            <tr><th>מחיר ללקוח</th><td><span className="num">{fmt(priceToClient)} ₪</span></td></tr>
            <tr><th>שולם</th><td><span className="num">{fmt(amountPaid)} ₪</span></td></tr>
            <tr>
              <th>יתרה</th>
              <td>
                <span className="num" style={{ color: balance > 0 ? "var(--due)" : "var(--done)", fontWeight: 650 }}>
                  {fmt(balance)} ₪
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {error && <div className="error" style={{ margin: "0.6rem 0 0" }}>{error}</div>}

      <div className="actions" style={{ marginTop: "0.7rem" }}>
        <input
          type="number" min="0" step="1" value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="סכום ששולם" style={{ maxWidth: "10rem" }}
        />
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await recordPaymentAction(tripId, Number(value));
              if (!res.ok) setError(res.error);
            });
          }}
        >
          עדכון תשלום
        </button>
      </div>
      <p className="hint">כשהיתרה מתאפסת, אבן הדרך של גביית היתרה נסגרת לבד.</p>
    </div>
  );
}
