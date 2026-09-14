import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { templateVariables } from "@/lib/messages/render";
import { VARIABLE_NAMES } from "@/lib/messages/variables";
import { getTemplate } from "@/lib/milestones/template";

const DIR = path.join(process.cwd(), "config", "messages");
const files = readdirSync(DIR).filter((f) => f.endsWith(".txt"));
const bodyOf = (f: string) => readFileSync(path.join(DIR, f), "utf8");

describe("התבניות שנשלחות עם המערכת", () => {
  it("יש תבניות", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s משתמשת רק במשתנים שקיימים בקטלוג", (file) => {
    const unknown = templateVariables(bodyOf(file)).filter((v) => !VARIABLE_NAMES.has(v));
    expect(unknown, `משתנים לא מוכרים ב-${file}`).toEqual([]);
  });

  it.each(files)("%s אינה ריקה ואינה ארוכה מדי לוואטסאפ", (file) => {
    const body = bodyOf(file).trim();
    expect(body.length).toBeGreaterThan(20);
    expect(body.length).toBeLessThan(1500);
  });

  it("לכל אבן דרך שפונה ללקוח יש תבנית קיימת", () => {
    const keys = new Set(files.map((f) => f.replace(/\.txt$/, "")));
    const missing = getTemplate("leisure_package")
      .milestones.filter((m) => m.message_template_key)
      .map((m) => m.message_template_key!)
      .filter((k) => !keys.has(k));
    expect(missing, "אבני דרך שמפנות לתבנית שלא קיימת").toEqual([]);
  });

  it("כל תבנית שנשלחת עם המערכת אכן בשימוש באיזו אבן דרך", () => {
    const used = new Set(
      getTemplate("leisure_package").milestones.map((m) => m.message_template_key).filter(Boolean),
    );
    const orphans = files.map((f) => f.replace(/\.txt$/, "")).filter((k) => !used.has(k));
    expect(orphans, "תבניות יתומות").toEqual([]);
  });
});
