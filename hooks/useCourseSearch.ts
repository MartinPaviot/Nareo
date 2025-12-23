'use client';

import { useState, useMemo } from 'react';
import { useCoursesOrganized } from './useCoursesOrganized';
import { Course } from '@/lib/courses/types';
import { filterCourses } from '@/lib/courses/utils';

interface UseCourseSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Course[] | null;
  isSearching: boolean;
  clearSearch: () => void;
}

export function useCourseSearch(): UseCourseSearchReturn {
  const { folders, uncategorized } = useCoursesOrganized();
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    // Collect all courses
    const allCourses: Course[] = [
      ...uncategorized,
      ...folders.flatMap(f => f.courses),
    ];

    return filterCourses(allCourses, searchQuery);
  }, [folders, uncategorized, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    clearSearch: () => setSearchQuery(''),
  };
}
