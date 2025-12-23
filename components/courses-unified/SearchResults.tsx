'use client';

import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { Course } from '@/lib/courses/types';
import CourseCard from './CourseCard';

interface SearchResultsProps {
  results: Course[];
  query: string;
  onClear: () => void;
}

export default function SearchResults({ results, query, onClear }: SearchResultsProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <div className="space-y-4">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          {results.length} résultat{results.length !== 1 ? 's' : ''} pour "{query}"
        </p>
        <button
          onClick={onClear}
          className={`flex items-center gap-1 text-sm ${
            isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <X className="w-4 h-4" />
          Effacer
        </button>
      </div>

      {/* Results grid or empty state */}
      {results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onClick={() => router.push(`/courses/${course.id}/learn`)}
            />
          ))}
        </div>
      ) : (
        <div className={`text-center py-12 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-gray-50'}`}>
          <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
            isDark ? 'bg-neutral-800' : 'bg-gray-100'
          }`}>
            <Search className={`w-6 h-6 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
          </div>
          <h3 className={`font-semibold mb-1 ${isDark ? 'text-neutral-200' : 'text-gray-900'}`}>
            Aucun résultat
          </h3>
          <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            Essaie avec d'autres mots-clés
          </p>
        </div>
      )}
    </div>
  );
}
