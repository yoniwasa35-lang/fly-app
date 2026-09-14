-- הסוכנות המארחת גובה נתח מההפרש בין המחיר לעלות. השיעור נשמר על כל תיק,
-- כדי ששינוי בהסכם לא ישכתב רטרואקטיבית עונה שכבר נסגרה.
ALTER TABLE "Trip" ADD COLUMN "hostFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01;
