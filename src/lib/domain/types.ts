/** טיפוסי הליבה — סעיף 5 באפיון. SQLite שומר מחרוזות; כאן הן מאולצות. */

export const TRIP_STATUSES = ["draft", "active", "traveling", "returned", "closed"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const COMPONENT_TYPES = [
  "flight", "hotel", "transfer", "car", "insurance", "activity", "event_ticket", "other",
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const COMPONENT_STATUSES = ["requested", "confirmed", "cancelled", "declined_by_client"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

export const CLIENT_RESPONSES = ["accepted", "declined", "no_answer"] as const;
export type ClientResponse = (typeof CLIENT_RESPONSES)[number];

export const AUDIENCES = ["agent", "client", "both"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const ANCHORS = [
  "booking", "departure", "return", "event",
  "component_deadline", "flight_outbound", "flight_inbound", "absolute",
] as const;
export type Anchor = (typeof ANCHORS)[number];

export const MILESTONE_STATES = ["pending", "due", "overdue", "blocked", "done", "skipped"] as const;
export type MilestoneState = (typeof MILESTONE_STATES)[number];

export const FLIGHT_DIRECTIONS = ["outbound", "inbound"] as const;
export type FlightDirection = (typeof FLIGHT_DIRECTIONS)[number];

export const TRIP_STATUS_HE: Record<TripStatus, string> = {
  draft: "טיוטה",
  active: "פעיל",
  traveling: "בנסיעה",
  returned: "חזר",
  closed: "סגור",
};

export const COMPONENT_TYPE_HE: Record<ComponentType, string> = {
  flight: "טיסה",
  hotel: "מלון",
  transfer: "העברה",
  car: "רכב",
  insurance: "ביטוח",
  activity: "אטרקציה",
  event_ticket: "כרטיס לאירוע",
  other: "אחר",
};

export const COMPONENT_STATUS_HE: Record<ComponentStatus, string> = {
  requested: "on request",
  confirmed: "מאושר",
  cancelled: "בוטל",
  declined_by_client: "הלקוח סירב",
};

export const AUDIENCE_HE: Record<Audience, string> = {
  agent: "פנימי",
  client: "ללקוח",
  both: "ללקוח + פנימי",
};

export const MILESTONE_STATE_HE: Record<MilestoneState, string> = {
  pending: "עתידי",
  due: "לפעולה",
  overdue: "עבר מועד",
  blocked: "חסום",
  done: "בוצע",
  /*
   * "בוטל" ולא "נדחה". דחייה היא פעולה אחרת לגמרי במערכת — היא מזיזה את
   * המועד קדימה (snoozedUntil) והמשימה חוזרת. skipped אומר שוויתרנו
   * עליה. שני השמות היו זהים, ושני מצבים שונים בשם אחד הם בלבול שמגיע
   * עד לשאלה "למה זה עדיין פתוח".
   */
  skipped: "בוטל",
};

export const CLIENT_RESPONSE_HE: Record<ClientResponse, string> = {
  accepted: "אישר",
  declined: "סירב",
  no_answer: "לא ענה",
};

/** רכיב נחשב "סגור" לצורך חסימות כשאין עליו יותר מה לחכות מהספק או מהלקוח.
 *  האפיון (סעיף 6.4) מדבר על confirmed או cancelled; declined_by_client נספר
 *  כאן גם הוא, אחרת הצעת upsell שהלקוח דחה תחסום מסמכים לנצח. */
export function isComponentResolved(status: string): boolean {
  return status === "confirmed" || status === "cancelled" || status === "declined_by_client";
}

export function isOpenState(state: string): boolean {
  return state === "pending" || state === "due" || state === "overdue" || state === "blocked";
}
