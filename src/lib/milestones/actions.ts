/**
 * פעולות על אבן דרך בודדת. כאן נאכפים הכללים שהאפיון מגדיר כחובה:
 * אי אפשר "לוותר" על אבן דרך שדורשת הכרעה מפורשת, ואי אפשר לדחות בלי סיבה.
 */

import { prisma } from "../db";
import { refreshTripStates } from "./sync";
import { getTemplate } from "./template";

async function templateEntryFor(milestoneId: string) {
  const m = await prisma.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { trip: { select: { templateId: true, id: true } } },
  });
  const entry = getTemplate(m.trip.templateId).milestones.find((e) => e.key === m.key) ?? null;
  return { milestone: m, entry };
}

export const RESOLUTION_HE: Record<string, string> = {
  purchased: "נרכש דרכנו",
  declined: "הלקוח סירב",
  external: "נרכש מחוץ לסוכנות",
};

export async function completeMilestone(
  milestoneId: string,
  opts: { resolution?: string | null } = {},
): Promise<void> {
  const { milestone, entry } = await templateEntryFor(milestoneId);

  // סעיף 5 — ביטוח. אין סימון "בוצע" בלי בחירה בין נרכש, סורב, או חיצוני.
  const required = entry?.requires_resolution;
  if (required && required.length > 0) {
    if (!opts.resolution || !required.includes(opts.resolution)) {
      throw new Error(
        `אבן הדרך "${milestone.title}" דורשת בחירה מפורשת: ${required
          .map((r) => RESOLUTION_HE[r] ?? r)
          .join(" / ")}`,
      );
    }
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      state: "done",
      completedAt: new Date(),
      resolution: opts.resolution ?? null,
      snoozedUntil: null,
      snoozeReason: null,
    },
  });

  await refreshTripStates(milestone.tripId);
}

export async function skipMilestone(milestoneId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("דחיית אבן דרך מחייבת סיבה");

  const { milestone, entry } = await templateEntryFor(milestoneId);
  if (entry?.not_skippable) {
    throw new Error(`אי אפשר לוותר על "${milestone.title}". צריך להכריע בה.`);
  }
  if (milestone.key.startsWith("passport_expiry:")) {
    throw new Error("אי אפשר לוותר על בעיית תוקף דרכון. עדכנו את תאריך התוקף או החליפו דרכון.");
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { state: "skipped", skipReason: trimmed, completedAt: new Date() },
  });

  await refreshTripStates(milestone.tripId);
}

/**
 * דחייה זמנית. אבן הדרך יוצאת מהתור עד המועד שנבחר, אבל לא נעלמת —
 * סעיף 12 מחייב שדבר לא ייעלם בלי טיפול או סיבה, ולכן גם כאן נדרשת סיבה.
 */
export async function snoozeMilestone(
  milestoneId: string,
  until: Date,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("דחייה זמנית מחייבת סיבה");
  if (until.getTime() <= Date.now()) throw new Error("מועד הדחייה חייב להיות בעתיד");

  const m = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { snoozedUntil: until, snoozeReason: trimmed },
    select: { tripId: true },
  });
  await refreshTripStates(m.tripId);
}

export async function reopenMilestone(milestoneId: string): Promise<void> {
  const m = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      state: "pending",
      completedAt: null,
      skipReason: null,
      resolution: null,
      snoozedUntil: null,
      snoozeReason: null,
    },
    select: { tripId: true },
  });
  await refreshTripStates(m.tripId);
}
