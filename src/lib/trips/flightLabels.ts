/**
 * התיאור של רכיב טיסה, במקום אחד.
 *
 * רכיב טיסה נוצר לפני שיש לו שורת Flight, ולכן בשלב הביניים הכיוון ידוע
 * רק מהתיאור. מחרוזת שמופיעה בשני קבצים היא באג שמחכה לתיקון ניסוח —
 * לכן היא יושבת כאן, ומי שצריך לקרוא אותה עושה זאת דרך הפונקציה.
 */

export type FlightDirection = "outbound" | "inbound";

export const FLIGHT_LABEL: Record<FlightDirection, string> = {
  outbound: "טיסה הלוך",
  inbound: "טיסה חזור",
};

export function directionFromLabel(description: string | null | undefined): FlightDirection {
  return description === FLIGHT_LABEL.inbound ? "inbound" : "outbound";
}
