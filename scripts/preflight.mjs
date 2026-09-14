#!/usr/bin/env node
/**
 * בדיקת מוכנות מול פריסה חיה. מריצים אחרי שהאתר עלה, ולפני שמזינים תיק
 * ראשון — עדיף לגלות שמשתנה סביבה חסר עכשיו מאשר אחרי עשרים תיקים.
 *
 *   node scripts/preflight.mjs https://your-app.vercel.app <DAILY_JOB_TOKEN>
 */

const [, , rawBase, token] = process.argv;

if (!rawBase) {
  console.error("שימוש: node scripts/preflight.mjs <כתובת האתר> [טוקן ה-job היומי]");
  process.exit(2);
}

const base = rawBase.replace(/\/+$/, "");
const results = [];

const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ ok: true, name, detail });
  } catch (e) {
    results.push({ ok: false, name, detail: e instanceof Error ? e.message : String(e) });
  }
};

const get = async (path, init) => {
  const res = await fetch(base + path, { redirect: "manual", ...init });
  return res;
};

await check("המסד עונה", async () => {
  const res = await get("/api/health");
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok !== true) throw new Error(`/api/health החזיר ${res.status}`);
  return "תקין";
});

await check("המערכת נעולה", async () => {
  const res = await get("/");
  if (res.status !== 307 && res.status !== 302) {
    throw new Error(`דף הבית החזיר ${res.status} במקום הפניה לכניסה. המערכת פתוחה!`);
  }
  const location = res.headers.get("location") ?? "";
  if (!location.includes("/login")) throw new Error(`הפניה ל-${location} במקום ל-/login`);
  return "גישה ללא כניסה מופנית לדף ההתחברות";
});

await check("דף הכניסה עולה", async () => {
  const res = await get("/login");
  if (!res.ok) throw new Error(`/login החזיר ${res.status}`);
  const html = await res.text();
  if (!html.includes("סיסמה")) throw new Error("דף הכניסה נטען אבל נראה ריק");
  return "תקין";
});

await check("ה-job היומי מוגן", async () => {
  const res = await get("/api/jobs/daily", { method: "POST" });
  if (res.status !== 401) throw new Error(`בקשה ללא טוקן החזירה ${res.status} במקום 401`);
  return "בקשה ללא טוקן נדחית";
});

if (token) {
  await check("ה-job היומי רץ", async () => {
    const res = await get("/api/jobs/daily", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 207) throw new Error(`הרצה עם טוקן החזירה ${res.status}`);
    const body = await res.json();
    if (body.errors?.length) throw new Error(`ה-job רץ עם ${body.errors.length} שגיאות`);
    return `נסרקו ${body.tripsScanned} תיקים`;
  });
} else {
  results.push({ ok: null, name: "ה-job היומי רץ", detail: "דילוג — לא הועבר טוקן" });
}

await check("קישור לקוח לא קיים מחזיר 404", async () => {
  const res = await get("/c/" + "z".repeat(40));
  if (res.status !== 404) throw new Error(`החזיר ${res.status} במקום 404`);
  return "תקין";
});

await check("כותרות אבטחה", async () => {
  const res = await get("/login");
  const missing = [];
  if (res.headers.get("x-frame-options") !== "DENY") missing.push("X-Frame-Options");
  if (res.headers.get("x-content-type-options") !== "nosniff") missing.push("X-Content-Type-Options");
  if (!res.headers.get("referrer-policy")) missing.push("Referrer-Policy");
  if (missing.length) throw new Error("חסרות: " + missing.join(", "));
  return "מסגור חסום, sniffing חסום, referrer מוגבל";
});

await check("עמוד הלקוח לא מדליף את הטוקן", async () => {
  const res = await get("/c/" + "z".repeat(40));
  if (res.headers.get("referrer-policy") !== "no-referrer") {
    throw new Error("Referrer-Policy אינו no-referrer — הטוקן עלול לדלוף בקישור יוצא");
  }
  const cache = res.headers.get("cache-control") ?? "";
  if (!cache.includes("no-store")) throw new Error("העמוד ניתן ל-cache: " + cache);
  return "no-referrer, no-store";
});

await check("המערכת לא מאונדקסת", async () => {
  const res = await get("/login");
  const html = await res.text();
  if (!html.includes("noindex")) throw new Error("לא נמצא תג noindex");
  return "תקין";
});

console.log(`\nבדיקת מוכנות: ${base}\n`);
for (const r of results) {
  const mark = r.ok === null ? "–" : r.ok ? "✓" : "✗";
  console.log(`  ${mark} ${r.name.padEnd(26)} ${r.detail}`);
}

const failed = results.filter((r) => r.ok === false);
console.log(
  failed.length
    ? `\n${failed.length} בדיקות נכשלו. אל תזינו תיקים אמיתיים עד שזה נקי.\n`
    : "\nהכל תקין. אפשר להזין תיק ראשון.\n",
);
process.exit(failed.length ? 1 : 0);
