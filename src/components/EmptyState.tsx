import Link from "next/link";
import { Icon, type IconName } from "./Icon";

/**
 * מסך ריק.
 *
 * "אין נתונים" הוא דיווח על מצב המסד, לא עזרה למשתמש. מסך ריק הוא הרגע
 * שבו מישהו רואה את התכונה בפעם הראשונה — ולכן הוא צריך לומר למה המסך
 * הזה קיים, ולהציע את הצעד שפותח אותו.
 *
 * כשאין צעד — למשל אחרי חיפוש שלא מצא — אין כפתור. כפתור שלא עוזר גרוע
 * מהיעדרו.
 */
export function EmptyState({
  icon, title, body, action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: { href: string; label: string; icon?: IconName };
}) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <strong>{title}</strong>
      {body}
      {action && (
        <div className="empty-action">
          <Link className="btn btn-primary btn-lg" href={action.href}>
            <Icon name={action.icon ?? "plus"} />
            <span>{action.label}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
