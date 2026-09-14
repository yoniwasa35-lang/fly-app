"use server";

import { revalidatePath } from "next/cache";
import {
  completeMilestone,
  skipMilestone,
  snoozeMilestone,
  reopenMilestone,
} from "@/lib/milestones/actions";
import {
  markCheckinDone,
  recordPayment,
  rotatePublicToken,
  setComponentStatus,
  settleSupplierCost,
  updateFinance,
} from "@/lib/trips/service";
import { prepareMessage, prepareTripMessage } from "@/lib/messages/prepare";
import {
  isDocumentKind,
  isDocumentState,
  setDocumentState,
} from "@/lib/trips/documents";
import {
  addTraveler,
  removeTraveler,
  revealPassport,
  updateTraveler,
  type TravelerInput,
} from "@/lib/trips/travelers";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function guard(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה לא צפויה" };
  }
}

export async function completeMilestoneAction(
  milestoneId: string,
  resolution?: string | null,
): Promise<ActionResult> {
  return guard(() => completeMilestone(milestoneId, { resolution: resolution ?? null }));
}

export async function skipMilestoneAction(milestoneId: string, reason: string): Promise<ActionResult> {
  return guard(() => skipMilestone(milestoneId, reason));
}

export async function snoozeMilestoneAction(
  milestoneId: string,
  days: number,
  reason: string,
): Promise<ActionResult> {
  const until = new Date(Date.now() + days * 24 * 3_600_000);
  return guard(() => snoozeMilestone(milestoneId, until, reason));
}

export async function reopenMilestoneAction(milestoneId: string): Promise<ActionResult> {
  return guard(() => reopenMilestone(milestoneId));
}

export async function setComponentStatusAction(componentId: string, status: string): Promise<ActionResult> {
  return guard(() => setComponentStatus(componentId, status));
}

export async function markCheckinDoneAction(componentId: string, done: boolean): Promise<ActionResult> {
  return guard(() => markCheckinDone(componentId, done));
}

export async function recordPaymentAction(tripId: string, amountPaid: number): Promise<ActionResult> {
  return guard(() => recordPayment(tripId, amountPaid));
}

export type PrepareMessageResult =
  | { ok: true; message: Awaited<ReturnType<typeof prepareMessage>> }
  | { ok: false; error: string };

/** מכין את נוסח ההודעה לאבן דרך שפונה ללקוח — סעיף 9. */
export async function prepareMessageAction(milestoneId: string): Promise<PrepareMessageResult> {
  try {
    return { ok: true, message: await prepareMessage(milestoneId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "הכנת ההודעה נכשלה" };
  }
}

/** מעקב סכומים בלבד — סעיף 3 מוציא הנהלת חשבונות מהגדרת v1. */
export async function updateFinanceAction(
  tripId: string,
  values: { priceToClient: number; supplierCost: number },
): Promise<ActionResult> {
  return guard(() => updateFinance(tripId, values));
}

/**
 * סגירת העלות בפועל. אם הפעולה מגיעה מאבן הדרך שנפתחת אחרי החזרה, היא
 * נסגרת באותה פעולה — הכפתור עושה את הדבר עצמו ולא מנווט אליו (סעיף 8.1).
 */
export async function settleSupplierCostAction(
  tripId: string,
  actualSupplierCost: number,
  milestoneId?: string | null,
): Promise<ActionResult> {
  return guard(async () => {
    await settleSupplierCost(tripId, actualSupplierCost);
    if (milestoneId) await completeMilestone(milestoneId);
  });
}

/** החלפת הקישור לעמוד הלקוח. הישן מפסיק לעבוד מיד. */
export async function rotatePublicTokenAction(tripId: string): Promise<ActionResult> {
  return guard(async () => {
    await rotatePublicToken(tripId);
  });
}

// ------------------------------- נוסעים -------------------------------

export async function addTravelerAction(
  tripId: string,
  values: TravelerInput,
): Promise<ActionResult> {
  return guard(async () => {
    await addTraveler(tripId, values);
  });
}

export async function updateTravelerAction(
  travelerId: string,
  values: TravelerInput,
): Promise<ActionResult> {
  return guard(() => updateTraveler(travelerId, values));
}

export async function removeTravelerAction(travelerId: string): Promise<ActionResult> {
  return guard(() => removeTraveler(travelerId));
}

export type RevealResult = { ok: true; value: string } | { ok: false; error: string };

/** פענוח מספר דרכון לבקשה מפורשת. לא מוחזר בשגרה עם שאר פרטי הנוסע. */
export async function revealPassportAction(travelerId: string): Promise<RevealResult> {
  try {
    return { ok: true, value: await revealPassport(travelerId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/* ---------------------------- מסמכי הנסיעה ---------------------------- */

export async function setDocumentStateAction(
  tripId: string,
  kind: string,
  state: string,
): Promise<ActionResult> {
  if (!isDocumentKind(kind) || !isDocumentState(state)) {
    return { ok: false, error: "סוג מסמך או מצב לא מוכר" };
  }
  return guard(() => setDocumentState(tripId, kind, state));
}

/**
 * הודעה שהסוכן יוזם מכרטיס הנסיעה, בלי אבן דרך.
 * "מה תרצי לשלוח?" → נוסח מוכן → וואטסאפ.
 */
export async function prepareTripMessageAction(
  tripId: string,
  templateKey: string,
): Promise<PrepareMessageResult> {
  try {
    return { ok: true, message: await prepareTripMessage(tripId, templateKey) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "הכנת ההודעה נכשלה" };
  }
}
