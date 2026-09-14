import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  DOCUMENT_KINDS,
  getDocuments,
  isDocumentKind,
  isDocumentState,
  setDocumentState,
} from "@/lib/trips/documents";

/**
 * צ׳ק-ליסט המסמכים. הרשומות נוצרות עצלנית, ולכן הבדיקה החשובה ביותר היא
 * שנסיעה בלי שורות במסד מוצגת נכון ולא ריקה.
 */

const someTrip = () => prisma.trip.findFirst({ select: { id: true } });

describe("מסמכי הנסיעה", () => {
  it("נסיעה בלי רשומות מציגה את כל הסוגים כחסרים", async () => {
    const trip = await someTrip();
    if (!trip) return;

    await prisma.tripDocument.deleteMany({ where: { tripId: trip.id } });
    const list = await getDocuments(trip.id);

    expect(list.rows.length).toBe(DOCUMENT_KINDS.length);
    expect(list.rows.every((r) => r.state === "missing")).toBe(true);
    expect(list.ready).toBe(0);
    expect(list.total).toBe(DOCUMENT_KINDS.length);
    // הכותרות בעברית, לא מפתחות באנגלית.
    expect(list.rows.every((r) => /[֐-׿]/.test(r.label))).toBe(true);
  });

  it("רק ״נשלח ללקוח״ נספר כמוכן", async () => {
    const trip = await someTrip();
    if (!trip) return;

    try {
      await setDocumentState(trip.id, "hotel_voucher", "received");
      expect((await getDocuments(trip.id)).ready).toBe(0);

      await setDocumentState(trip.id, "hotel_voucher", "sent");
      const after = await getDocuments(trip.id);
      expect(after.ready).toBe(1);
      expect(after.rows.find((r) => r.kind === "hotel_voucher")?.state).toBe("sent");
    } finally {
      await prisma.tripDocument.deleteMany({ where: { tripId: trip.id } });
    }
  });

  it("חזרה אחורה לא מוחקת את חותמת השליחה", async () => {
    const trip = await someTrip();
    if (!trip) return;

    try {
      await setDocumentState(trip.id, "insurance", "sent");
      await setDocumentState(trip.id, "insurance", "missing");

      const row = await prisma.tripDocument.findUniqueOrThrow({
        where: { tripId_kind: { tripId: trip.id, kind: "insurance" } },
      });

      expect(row.state).toBe("missing");
      // "מתי בעצם שלחנו" היא שאלה שנשאלת חודשים אחר כך.
      expect(row.sentAt).not.toBeNull();
    } finally {
      await prisma.tripDocument.deleteMany({ where: { tripId: trip.id } });
    }
  });

  it("סוג או מצב לא מוכר נדחים", () => {
    expect(isDocumentKind("hotel_voucher")).toBe(true);
    expect(isDocumentKind("passport_scan")).toBe(false);
    expect(isDocumentState("sent")).toBe(true);
    expect(isDocumentState("done")).toBe(false);
  });

  it("שמירה פעמיים לאותו סוג לא מייצרת כפילות", async () => {
    const trip = await someTrip();
    if (!trip) return;

    try {
      await setDocumentState(trip.id, "transfers", "received");
      await setDocumentState(trip.id, "transfers", "sent");
      const count = await prisma.tripDocument.count({
        where: { tripId: trip.id, kind: "transfers" },
      });
      expect(count).toBe(1);
    } finally {
      await prisma.tripDocument.deleteMany({ where: { tripId: trip.id } });
    }
  });
});
