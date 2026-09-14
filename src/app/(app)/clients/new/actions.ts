"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/messages/phone";
import { PARTY_TYPES, serializeChildAges } from "@/lib/clients/party";

const schema = z.object({
  name: z.string().trim().min(2, "צריך שם"),
  phone: z.string().trim().min(6, "צריך טלפון — זה ערוץ התקשורת"),
  email: z.string().trim().email("כתובת המייל לא תקינה").optional().or(z.literal("")),
  notes: z.string().trim().optional(),
  partyType: z.enum(PARTY_TYPES),
  adults: z.coerce.number().int().min(0).max(30),
  children: z.coerce.number().int().min(0).max(20),
  infants: z.coerce.number().int().min(0).max(10),
  /** גילאים כמחרוזת מופרדת בפסיקים, כפי שהטופס שולח. */
  childAges: z.string().trim().optional(),
  /** "trip" פותח נסיעה מיד, כל ערך אחר נשאר בכרטיס הלקוח. */
  then: z.string().optional(),
});

export type NewClientState = { error?: string };

export async function createClientAction(
  _prev: NewClientState,
  formData: FormData,
): Promise<NewClientState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "חסרים פרטים" };

  const { name, phone, email, notes, partyType, adults, children, infants, childAges, then } =
    parsed.data;

  if (adults + children + infants === 0) {
    return { error: "צריך לפחות נוסע אחד" };
  }

  // מספר שלא ניתן לנרמל לא יוכל לקבל וואטסאפ, וזה הערוץ היחיד שיש.
  if (!normalizePhone(phone).ok) {
    return { error: "המספר לא נראה כמו טלפון ישראלי תקין" };
  }

  const ages = serializeChildAges(
    (childAges ?? "").split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)),
  );

  /*
   * לקוח חוזר שנרשם שוב מייצר שתי כרטיסיות לאותו אדם, וההיסטוריה
   * מתפצלת. לכן בודקים לפי הטלפון — השדה היחיד שבאמת מזהה אדם כאן —
   * ומחזירים את הקיים במקום ליצור כפיל.
   */
  const digits = phone.replace(/\D/g, "");
  const existing = await prisma.client.findFirst({
    where: { phone: { contains: digits.slice(-9) } },
    select: { id: true },
  });

  const id =
    existing?.id ??
    (
      await prisma.client.create({
        data: {
          name,
          phone,
          email: email || null,
          notes: notes || null,
          partyType,
          adults,
          children,
          infants,
          childAges: ages,
        },
        select: { id: true },
      })
    ).id;

  // מיד לנסיעה, כי זו הסיבה שפתחו לקוח. "known" אומר לעמוד להסביר
  // שהלקוח כבר היה קיים ולא נוצר כפיל.
  if (then === "trip") redirect(`/trips/new?clientId=${id}`);
  redirect(existing ? `/clients/${id}?known=1` : `/clients/${id}`);
}
