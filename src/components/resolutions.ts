/** ההכרעות האפשריות לאבן דרך שדורשת בחירה מפורשת — סעיף 5, ביטוח. */
export const RESOLUTION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "purchased", label: "ביטוח נרכש דרכנו" },
  { value: "declined", label: "הלקוח סירב לביטוח" },
  { value: "external", label: "נרכש מחוץ לסוכנות" },
];
