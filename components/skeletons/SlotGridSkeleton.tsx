export default function SlotGridSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-11 rounded-lg bg-neutral-100 dark:bg-neutral-900" />
      ))}
    </div>
  );
}
