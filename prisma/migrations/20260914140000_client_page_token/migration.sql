-- עמוד הלקוח יושב על URL פתוח והקישור עצמו הוא הסוד, ולכן הטוקן אקראי
-- ואינו נגזר מה-id של התיק.

ALTER TABLE "Trip" ADD COLUMN "publicToken" TEXT;

-- מילוי לתיקים קיימים. gen_random_uuid זמין מובנה ונותן 122 ביט אנטרופיה.
UPDATE "Trip"
SET "publicToken" = replace(gen_random_uuid()::text, '-', '') ||
                    replace(gen_random_uuid()::text, '-', '')
WHERE "publicToken" IS NULL;

ALTER TABLE "Trip" ALTER COLUMN "publicToken" SET NOT NULL;
CREATE UNIQUE INDEX "Trip_publicToken_key" ON "Trip"("publicToken");
