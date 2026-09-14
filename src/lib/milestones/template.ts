import { z } from "zod";
import leisurePackage from "../../../config/templates/leisure-package.json";
import { ANCHORS, AUDIENCES } from "../domain/types";

/**
 * תבניות אבני דרך — סעיף 7. חיות כקובצי JSON ב-config/templates,
 * נטענות ומאומתות כאן. הוספת תבנית = הוספת קובץ + שורה ב-REGISTRY.
 */

const offsetSchema = z
  .string()
  .regex(/^[+-]\d+(?:\.\d+)?[mhdw]$/, 'היסט חייב להיראות כמו "+3d", "-60d", "-6h", "+30m"');

const timeOfDaySchema = z.string().regex(/^\d{2}:\d{2}$/, 'שעה חייבת להיראות כמו "09:00"');

const blockRuleSchema = z.discriminatedUnion("rule", [
  z.object({ rule: z.literal("all_components_resolved") }),
  z.object({ rule: z.literal("milestone_done"), key: z.string() }),
  z.object({ rule: z.literal("component_type_confirmed"), type: z.string() }),
]);

const autoCompleteSchema = z.discriminatedUnion("rule", [
  z.object({ rule: z.literal("all_components_resolved") }),
  z.object({ rule: z.literal("all_components_confirmed") }),
  z.object({ rule: z.literal("balance_zero") }),
  z.object({ rule: z.literal("all_travelers_have_passport") }),
  z.object({ rule: z.literal("flight_checkin_done"), direction: z.enum(["outbound", "inbound"]) }),
  z.object({ rule: z.literal("component_type_confirmed"), type: z.string() }),
]);

const templateMilestoneSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  audience: z.enum(AUDIENCES),
  anchor: z.enum(ANCHORS),
  anchor_field: z.enum(["checkin_opens_at", "checkin_closes_at", "departs_at"]).optional(),
  offset: offsetSchema,
  /** חלון ההתראה: כמה זמן לפני המועד אבן הדרך עוברת מ-pending ל-due. */
  lead: offsetSchema.or(z.string().regex(/^\d+(?:\.\d+)?[mhdw]$/)).optional(),
  /** שעה ביום לאבני דרך ברזולוציית ימים. ברירת מחדל: default_time_of_day. */
  at: timeOfDaySchema.optional(),
  message_template_key: z.string().optional(),
  blocked_by: z.array(blockRuleSchema).optional(),
  auto_complete: autoCompleteSchema.optional(),
  /** אבן דרך שחייבת בחירה מפורשת ולא ניתן פשוט "לסמן בוצע" — למשל ביטוח. */
  requires_resolution: z.array(z.string()).optional(),
  not_skippable: z.boolean().optional(),
});

export const templateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  default_time_of_day: timeOfDaySchema.default("09:00"),
  requires: z.array(z.string()).default([]),
  milestones: z.array(templateMilestoneSchema).min(1),
});

export type MilestoneTemplateEntry = z.infer<typeof templateMilestoneSchema>;
export type MilestoneTemplate = z.infer<typeof templateSchema>;
export type BlockRule = z.infer<typeof blockRuleSchema>;
export type AutoCompleteRule = z.infer<typeof autoCompleteSchema>;

const RAW_TEMPLATES = [leisurePackage];

const REGISTRY = new Map<string, MilestoneTemplate>();

for (const raw of RAW_TEMPLATES) {
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `תבנית אבני דרך לא תקינה (${(raw as { id?: string }).id ?? "ללא מזהה"}): ${parsed.error.issues
        .map((i) => `${i.path.join(".")} — ${i.message}`)
        .join("; ")}`,
    );
  }
  const keys = new Set<string>();
  for (const m of parsed.data.milestones) {
    if (keys.has(m.key)) throw new Error(`מפתח כפול בתבנית ${parsed.data.id}: ${m.key}`);
    keys.add(m.key);
  }
  REGISTRY.set(parsed.data.id, parsed.data);
}

export function getTemplate(id: string): MilestoneTemplate {
  const t = REGISTRY.get(id);
  if (!t) {
    throw new Error(`תבנית אבני דרך לא נמצאה: "${id}". קיימות: ${[...REGISTRY.keys()].join(", ")}`);
  }
  return t;
}

export function listTemplates(): MilestoneTemplate[] {
  return [...REGISTRY.values()];
}

const UNIT_MINUTES: Record<string, number> = { m: 1, h: 60, d: 60 * 24, w: 60 * 24 * 7 };

/** '-60d' → -86400 דקות. '4h' (בלי סימן) → 240. */
export function offsetToMinutes(offset: string): number {
  const m = /^([+-]?)(\d+(?:\.\d+)?)([mhdw])$/.exec(offset.trim());
  if (!m) throw new Error(`היסט לא תקין: "${offset}"`);
  const sign = m[1] === "-" ? -1 : 1;
  return Math.round(sign * Number(m[2]) * UNIT_MINUTES[m[3]]);
}

/** האם ההיסט ברזולוציית ימים ומעלה — ואז המועד מוצמד לשעה ביום. */
export function isDayGrained(offset: string): boolean {
  const unit = offset.trim().slice(-1);
  return unit === "d" || unit === "w";
}
