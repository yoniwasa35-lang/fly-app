-- שעת הנחיתה אינה ידועה בזמן פתיחת התיק. עד עכשיו הקוד העתיק לתוכה את שעת
-- ההמראה, וזה הופיע ללקוח כטיסה שנוחתת בדיוק כשהיא ממריאה.

ALTER TABLE "Flight" ALTER COLUMN "arrivesAtLocal" DROP NOT NULL;
ALTER TABLE "Flight" ALTER COLUMN "arrivesAtUtc" DROP NOT NULL;

-- ניקוי הערכים הכוזבים שכבר נשמרו.
UPDATE "Flight"
SET "arrivesAtLocal" = NULL, "arrivesAtUtc" = NULL
WHERE "arrivesAtLocal" = "departsAtLocal";
