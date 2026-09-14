import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { checkThrottle, clearFailures, pruneAttempts, recordFailure } from "@/lib/auth/throttle";

const KEY = "test-203.0.113.9";

describe("האטה על ניסיונות כניסה", () => {
  beforeEach(async () => { await clearFailures(KEY); });

  it("ארבעה ניסיונות כושלים לא חוסמים", async () => {
    for (let i = 0; i < 4; i++) expect((await recordFailure(KEY)).blocked).toBe(false);
    expect((await checkThrottle(KEY)).blocked).toBe(false);
    await clearFailures(KEY);
  });

  it("החמישי חוסם, והחסימה נשמרת בין קריאות", async () => {
    for (let i = 0; i < 4; i++) await recordFailure(KEY);
    const fifth = await recordFailure(KEY);
    expect(fifth.blocked).toBe(true);

    // זו הנקודה: מצב החסימה נקרא מהמסד, ולא מזיכרון של תהליך מסוים.
    const fromDb = await checkThrottle(KEY);
    expect(fromDb.blocked).toBe(true);
    if (fromDb.blocked) expect(fromDb.secondsLeft).toBeGreaterThan(0);
    await clearFailures(KEY);
  });

  it("ההשהיה גדלה עם כל ניסיון נוסף", async () => {
    for (let i = 0; i < 5; i++) await recordFailure(KEY);
    const first = await checkThrottle(KEY);
    for (let i = 0; i < 3; i++) await recordFailure(KEY);
    const later = await checkThrottle(KEY);
    if (first.blocked && later.blocked) {
      expect(later.secondsLeft).toBeGreaterThan(first.secondsLeft);
    }
    await clearFailures(KEY);
  });

  it("כניסה מוצלחת מאפסת את המונה", async () => {
    for (let i = 0; i < 5; i++) await recordFailure(KEY);
    await clearFailures(KEY);
    expect((await checkThrottle(KEY)).blocked).toBe(false);
  });

  it("החסימה פגה מעצמה", async () => {
    for (let i = 0; i < 5; i++) await recordFailure(KEY);
    const future = new Date(Date.now() + 2 * 3_600_000);
    expect((await checkThrottle(KEY, future)).blocked).toBe(false);
    await clearFailures(KEY);
  });

  it("רשומות ישנות מנוקות", async () => {
    await recordFailure(KEY);
    await prisma.loginAttempt.update({
      where: { key: KEY },
      data: { updatedAt: new Date(Date.now() - 30 * 86_400_000) },
    });
    await pruneAttempts();
    expect(await prisma.loginAttempt.findUnique({ where: { key: KEY } })).toBeNull();
  });

  it("כתובות שונות נספרות בנפרד", async () => {
    const other = "test-198.51.100.4";
    await clearFailures(other);
    for (let i = 0; i < 5; i++) await recordFailure(KEY);
    expect((await checkThrottle(KEY)).blocked).toBe(true);
    expect((await checkThrottle(other)).blocked).toBe(false);
    await clearFailures(KEY);
    await clearFailures(other);
  });
});
