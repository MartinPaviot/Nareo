'use client';

export default function StatsModuleSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Row 1: Streak + Daily Goal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gray-100 h-36" />
        <div className="rounded-2xl bg-gray-100 h-36" />
      </div>

      {/* Row 2: CTA */}
      <div className="rounded-xl bg-gray-200 h-14" />

      {/* Row 3: Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gray-100 h-20" />
        <div className="rounded-xl bg-gray-100 h-20" />
        <div className="rounded-xl bg-gray-100 h-20" />
        <div className="rounded-xl bg-gray-100 h-20" />
      </div>

      {/* Row 4: Mastery Preview */}
      <div className="rounded-2xl bg-gray-100 h-48" />
    </div>
  );
}
