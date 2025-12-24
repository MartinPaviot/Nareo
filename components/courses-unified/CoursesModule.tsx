'use client';

import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { useCourseSearch } from '@/hooks/useCourseSearch';
import { usePriorityItems } from '@/hooks/usePriorityItems';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Course } from '@/lib/courses/types';
import PrioritySection from './PrioritySection';
import FolderSection from './FolderSection';
import UncategorizedSection from './UncategorizedSection';
import SearchResults from './SearchResults';
import CreateFolderModal from './CreateFolderModal';
import CoursesModuleSkeleton from './CoursesModuleSkeleton';
import DragOverlayCard from './DragOverlayCard';

export default function CoursesModule() {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { folders, uncategorized, isLoading, moveCourse } = useCoursesOrganized();
  const { priorityItems } = usePriorityItems();
  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useCourseSearch();
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const courseData = active.data.current?.course as Course;
    if (courseData) {
      setActiveCourse(courseData);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCourse(null);

    if (!over) return;

    const courseId = active.id as string;
    const overData = over.data.current;

    if (overData?.type === 'folder') {
      await moveCourse(courseId, overData.folderId);
    } else if (overData?.type === 'uncategorized' || over.id === 'uncategorized') {
      await moveCourse(courseId, null);
    }
  };

  if (isLoading) {
    return <CoursesModuleSkeleton />;
  }

  const hasContent = folders.length > 0 || uncategorized.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with search and new folder button */}
      <div className="flex items-center gap-3">
        {/* Search bar */}
        <div className={`flex-1 relative ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={translate('courses_search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-10 py-2.5 rounded-xl border transition-colors ${
              isDark
                ? 'bg-neutral-800 border-neutral-700 focus:border-orange-500 placeholder-neutral-500'
                : 'bg-white border-gray-200 focus:border-orange-500 placeholder-gray-400'
            } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Create folder button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsCreateFolderOpen(true)}
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
            isDark
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{translate('courses_create_folder')}</span>
        </motion.button>
      </div>

      {/* Conditional display: search or normal view */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SearchResults
                results={searchResults || []}
                query={searchQuery}
                onClear={clearSearch}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Priority Section - always at top if items */}
              {priorityItems.length > 0 && (
                <PrioritySection items={priorityItems} />
              )}

              {/* Collapsible folders */}
              {folders.map((folder) => (
                <FolderSection key={folder.id} folder={folder} />
              ))}

              {/* Uncategorized courses */}
              <UncategorizedSection courses={uncategorized} />

              {/* Global empty state */}
              {!hasContent && (
                <EmptyCoursesState onCreateFolder={() => setIsCreateFolderOpen(true)} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag overlay */}
        <DragOverlay>
          {activeCourse ? <DragOverlayCard course={activeCourse} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Create folder modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
      />
    </div>
  );
}

function EmptyCoursesState({ onCreateFolder }: { onCreateFolder: () => void }) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  return (
    <div className={`text-center py-12 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-gray-50'}`}>
      <div className="text-5xl mb-4">📚</div>
      <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
        {translate('courses_empty_title')}
      </h3>
      <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
        {translate('courses_empty_subtitle')}
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onCreateFolder}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium border ${
            isDark
              ? 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          {translate('courses_create_folder_button')}
        </button>
      </div>
    </div>
  );
}
