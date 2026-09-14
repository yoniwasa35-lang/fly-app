"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/messages/phone";

const schema = z.object({
  name: z.string().trim().min(2, "צריך שם"),
  phone: z.string().trim().min(6, "צריך טלפון — זה ערוץ התקשורת"),
  email: z.string().trim().email("כתובת המייל לא תקינה").optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export type NewClientState = { error?: string };

export async function createClientAction(
  _prev: NewClientState,
  formData: FormData,
): Promise<NewClientState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "חסרים פרטים" };
  }

  const { name, phone, email, notes } = parsed.data;

  // מספר שלא ניתן לנרמל לא יוכל לקבל וואטסאפ, וזה הערוץ היחיד שיש.
  if (!normalizePhone(phone).ok) {
    return { error: "המספר לא נראה כמו טלפון ישראלי תקין" };
  }

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

  if (existing) redirect(`/clients/${existing.id}?known=1`);

  const created = await prisma.client.create({
    data: { name, phone, email: email || null, notes: notes || null },
    select: { id: true },
  });

  redirect(`/clients/${created.id}`);
}
