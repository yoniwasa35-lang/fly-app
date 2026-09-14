-- הסוכנים מתמחרים מעל עלות הספק ומרוויחים את ההפרש, ולכן הרווח נגזר ואינו
-- נשמר. מה שמשתנה בפועל הוא העלות, ולכן נוספת עלות ספקים בפועל.

ALTER TABLE "Trip" ADD COLUMN "actualSupplierCost" DOUBLE PRECISION;

-- שמירה על נתונים קיימים: אם הוזנה עמלה בפועל, אפשר לגזור ממנה את העלות
-- האמיתית, כי היא הייתה ההפרש בין המחיר לעלות.
UPDATE "Trip"
SET "actualSupplierCost" = "priceToClient" - "actualCommission"
WHERE "actualCommission" > 0;

ALTER TABLE "Trip" DROP COLUMN "expectedCommission";
ALTER TABLE "Trip" DROP COLUMN "actualCommission";
