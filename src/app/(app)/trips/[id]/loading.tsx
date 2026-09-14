import { LoadingScreen, SkeletonLine } from "@/components/Skeleton";

/**
 * שלד כרטיס הנסיעה. הוא מצייר את אותה צורה: כותרת גדולה, כרטיס הפעולה
 * הבאה, ושישה אריחים — כדי שהמעבר לתוכן האמיתי יהיה החלפה ולא קפיצה.
 */
export default function Loading() {
  return (
    <LoadingScreen label="טוען את הנסיעה">
      <header className="trip-hero" aria-hidden="true">
        <div className="trip-hero-bar" />
        <SkeletonLine w="58%" h="1.9rem" />
        <div style={{ marginTop: "var(--sp-3)" }}>
          <SkeletonLine w="72%" h="1rem" />
        </div>
      </header>

      <div className="next-action" aria-hidden="true">
        <SkeletonLine w="28%" h="0.75rem" />
        <div style={{ marginTop: "var(--sp-3)" }}>
          <SkeletonLine w="66%" h="1.2rem" />
        </div>
      </div>

      <div className="tiles" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="tile sk-tile" />
        ))}
      </div>
    </LoadingScreen>
  );
}
