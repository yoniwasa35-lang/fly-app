/**
 * מקור התבניות — סעיף 9 דורש שתי תכונות שנראות סותרות:
 * "תבניות ההודעות צריכות לחיות כקבצים ניתנים לעריכה", וגם
 * "הסוכן צריך לערוך אותן בעצמו בלי מפתח".
 *
 * הפתרון: הקובץ ב-config/messages הוא ברירת המחדל שמגיעה עם הקוד, ועריכה
 * מתוך המערכת נשמרת כדריסה במסד. כך אפשר גם לשפר נוסח בלי פריסה, וגם
 * לחזור לנוסח המקורי בלחיצה.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db";

const DIR = path.join(process.cwd(), "config", "messages");

let fileCache: Map<string, string> | null = null;

async function readFileTemplates(): Promise<Map<string, string>> {
  if (fileCache) return fileCache;
  const map = new Map<string, string>();
  try {
    for (const name of await readdir(DIR)) {
      if (!name.endsWith(".txt")) continue;
      map.set(name.replace(/\.txt$/, ""), (await readFile(path.join(DIR, name), "utf8")).trim());
    }
  } catch (e) {
    throw new Error(
      `לא הצלחתי לקרוא את תבניות ההודעות מ-${DIR}: ${e instanceof Error ? e.message : e}`,
    );
  }
  if (process.env.NODE_ENV === "production") fileCache = map;
  return map;
}

export type TemplateRecord = {
  key: string;
  body: string;
  defaultBody: string;
  edited: boolean;
  updatedAt: Date | null;
};

export async function listTemplates(): Promise<TemplateRecord[]> {
  const files = await readFileTemplates();
  const overrides = new Map(
    (await prisma.messageTemplate.findMany()).map((o) => [o.key, o]),
  );

  return [...files.entries()]
    .map(([key, defaultBody]) => {
      const override = overrides.get(key);
      return {
        key,
        body: override?.body ?? defaultBody,
        defaultBody,
        edited: !!override,
        updatedAt: override?.updatedAt ?? null,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function getTemplate(key: string): Promise<TemplateRecord> {
  const all = await listTemplates();
  const found = all.find((t) => t.key === key);
  if (!found) {
    throw new Error(
      `תבנית ההודעה "${key}" לא נמצאה. קיימות: ${all.map((t) => t.key).join(", ")}`,
    );
  }
  return found;
}

export async function saveTemplate(key: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("תבנית הודעה לא יכולה להיות ריקה");
  const current = await getTemplate(key);

  // חזרה מדויקת לנוסח המקורי מוחקת את הדריסה במקום לשמור עותק זהה.
  if (trimmed === current.defaultBody) {
    await prisma.messageTemplate.deleteMany({ where: { key } });
    return;
  }

  await prisma.messageTemplate.upsert({
    where: { key },
    create: { key, body: trimmed },
    update: { body: trimmed },
  });
}

export async function resetTemplate(key: string): Promise<void> {
  await prisma.messageTemplate.deleteMany({ where: { key } });
}
