"use server";

import { revalidatePath } from "next/cache";
import {
  completeMilestone,
  skipMilestone,
  snoozeMilestone,
  reopenMilestone,
} from "@/lib/milestones/actions";
import { markCheckinDone, recordPayment, setComponentStatus } from "@/lib/trips/service";

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
