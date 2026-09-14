-- האטה משותפת על ניסיונות כניסה. בזיכרון התהליך היא חסרת ערך בפריסה
-- ללא שרת, כי לכל instance יש מפה משלו.
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "LoginAttempt_updatedAt_idx" ON "LoginAttempt"("updatedAt");
