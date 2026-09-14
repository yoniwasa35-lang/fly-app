import { LoadingScreen, SkeletonHeader, SkeletonRows } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="טוען">
      <SkeletonHeader />
      <div style={{ padding: "0 var(--sp-4)" }}>
        <SkeletonRows count={5} />
      </div>
    </LoadingScreen>
  );
}
