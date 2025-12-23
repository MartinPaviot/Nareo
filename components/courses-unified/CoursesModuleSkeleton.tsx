'use client';

import { useTheme } from '@/contexts/ThemeContext';

export default function CoursesModuleSkeleton() {
  const { isDark } = useTheme();

  return (
    <div className="space-y-6 animate-pulse">
      {/* Search bar skeleton */}
      <div className="flex items-center gap-3">
        <div className={`flex-1 h-11 rounded-xl ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
        <div className={`w-24 h-11 rounded-xl ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
      </div>

      {/* Priority section skeleton */}
      <div className={`rounded-2xl p-5 ${isDark ? 'bg-neutral-900' : 'bg-orange-50'}`}>
        <div className={`h-5 w-40 rounded mb-4 ${isDark ? 'bg-neutral-800' : 'bg-orange-100'}`} />
        <div className={`h-20 rounded-xl ${isDark ? 'bg-neutral-800' : 'bg-white'}`} />
      </div>

      {/* Folder skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className={`rounded-2xl border overflow-hidden ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
          <div className={`p-4 flex items-center justify-between ${isDark ? 'bg-neutral-900' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
              <div className={`h-5 w-32 rounded ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
            </div>
            <div className={`h-5 w-16 rounded ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
          </div>
          <div className={`p-4 grid grid-cols-1 md:grid-cols-2 gap-4 ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
            {[1, 2].map((j) => (
              <div key={j} className={`h-32 rounded-xl ${isDark ? 'bg-neutral-900' : 'bg-gray-100'}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
