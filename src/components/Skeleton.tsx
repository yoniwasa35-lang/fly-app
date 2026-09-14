/**
 * שלד טעינה.
 *
 * מסך ריק עם ספינר מרגיש איטי גם כשהוא מהיר, כי אין בו שום דבר להסתכל
 * עליו. שלד באותה צורה של התוכן שעומד להגיע נותן לעין לאן להתמקם, וכשה
 * תוכן נוחת הוא מחליף שלד ולא ריק — התחושה היא של הגעה, לא של המתנה.
 *
 * הוא מכבד prefers-reduced-motion: ההבהוב נעצר, השלד נשאר.
 */
export function SkeletonLine({ w = "100%", h = "1rem" }: { w?: string; h?: string }) {
  return <span className="sk" style={{ width: w, height: h }} aria-hidden="true" />;
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-row">
          <SkeletonLine w="62%" h="1.05rem" />
          <SkeletonLine w="38%" h="0.8rem" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeader({ sub = true }: { sub?: boolean }) {
  return (
    <header className="topbar" aria-hidden="true">
      <h1 style={{ width: "100%" }}>
        <SkeletonLine w="46%" h="1.75rem" />
        {sub && (
          <span className="sub">
            <SkeletonLine w="62%" h="0.9rem" />
          </span>
        )}
      </h1>
    </header>
  );
}

/** מודיע לקורא מסך שהמסך בטעינה, בלי להקריא את השלד עצמו. */
export function LoadingScreen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
