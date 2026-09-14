/**
 * מסמכי הנסיעה.
 *
 * חמישה סוגים קבועים, ושרשרת של שלושה מצבים: חסר → התקבל מהספק →
 * נשלח ללקוח. "מוכן" הוא רק "נשלח": וואוצ׳ר שיושב בתיבת המייל של הסוכן
 * לא עוזר למי שעומד בקבלה של המלון בשתיים בלילה.
 *
 * הרשומות נוצרות עצלנית — נסיעה בלי שורות מסמכים מוצגת כאילו כל החמישה
 * חסרים, ורק שינוי ראשון כותב למסד. כך אין צורך למלא את כל התיקים
 * הקיימים למפרע.
 */

import { prisma } from "../db";

export const DOCUMENT_KINDS = [
  "flight_tickets",
  "hotel_voucher",
  "transfers",
  "activities",
  "insurance",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_HE: Record<DocumentKind, string> = {
  flight_tickets: "כרטיסי טיסה",
  hotel_voucher: "וואוצ׳ר מלון",
  transfers: "העברות",
  activities: "אטרקציות",
  insurance: "ביטוח נסיעות",
};

export const DOCUMENT_STATES = ["missing", "received", "sent"] as const;
export type DocumentState = (typeof DOCUMENT_STATES)[number];

export const DOCUMENT_STATE_HE: Record<DocumentState, string> = {
  missing: "חסר",
  received: "התקבל",
  sent: "נשלח ללקוח",
};

export type DocumentRow = {
  kind: DocumentKind;
  label: string;
  state: DocumentState;
  note: string | null;
};

export type DocumentChecklist = {
  rows: DocumentRow[];
  /** כמה כבר נשלחו ללקוח, מתוך כמה שרלוונטיים. */
  ready: number;
  total: number;
};

export function isDocumentKind(v: unknown): v is DocumentKind {
  return typeof v === "string" && (DOCUMENT_KINDS as readonly string[]).includes(v);
}

export function isDocumentState(v: unknown): v is DocumentState {
  return typeof v === "string" && (DOCUMENT_STATES as readonly string[]).includes(v);
}

export async function getDocuments(tripId: string): Promise<DocumentChecklist> {
  const saved = await prisma.tripDocument.findMany({
    where: { tripId },
    select: { kind: true, state: true, note: true },
  });

  const byKind = new Map(saved.map((d) => [d.kind, d]));

  const rows: DocumentRow[] = DOCUMENT_KINDS.map((kind) => {
    const row = byKind.get(kind);
    const state = isDocumentState(row?.state) ? row.state : "missing";
    return { kind, label: DOCUMENT_KIND_HE[kind], state, note: row?.note ?? null };
  });

  return {
    rows,
    ready: rows.filter((r) => r.state === "sent").length,
    total: rows.length,
  };
}

export async function setDocumentState(
  tripId: string,
  kind: DocumentKind,
  state: DocumentState,
): Promise<void> {
  const now = new Date();

  /*
   * החותמות נכתבות רק כשמתקדמים קדימה, ולא נמחקות כשחוזרים אחורה:
   * "מתי בעצם שלחנו" היא שאלה שנשאלת חודשים אחר כך, ותיקון מצב בטעות
   * לא צריך למחוק את התשובה.
   */
  const data = {
    state,
    receivedAt: state === "received" || state === "sent" ? now : undefined,
    sentAt: state === "sent" ? now : undefined,
  };

  await prisma.tripDocument.upsert({
    where: { tripId_kind: { tripId, kind } },
    create: { tripId, kind, ...data },
    update: data,
  });
}
