'use client';

import { useState, useMemo } from 'react';
import { FolderPlus, Upload, Inbox, MessageCircleQuestion, Folder as FolderIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchInput from './SearchInput';
import FolderItem from './FolderItem';
import CourseItem from './CourseItem';
import ReviewsSection from './ReviewsSection';
import type { Folder, Course } from '@/lib/courses/types';

interface FolderLevelProps {
  folders: Folder[];
  uncategorized: Course[];
  activeFolderId: string | null;
  currentCourseId?: string;
  onFolderClick: (folderId: string, folderName: string) => void;
  onCourseClick: (courseId: string) => void;
  onCreateFolder: () => void;
  onUploadCourse: () => void;
  onContactClick: () => void;
  onMoveCourse?: (courseId: string, folderId: string | null) => Promise<boolean>;
}

export default function FolderLevel({
  folders,
  uncategorized,
  activeFolderId,
  currentCourseId,
  onFolderClick,
  onCourseClick,
  onCreateFolder,
  onUploadCourse,
  onContactClick,
  onMoveCourse,
}: FolderLevelProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter folders and courses based on search query
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return { folders, uncategorized, matchingCourses: [], hasResults: true, isSearching: false };
    }

    // Filter folders that match the query (by name only)
    const filteredFolders = folders.filter((folder) =>
      folder.name.toLowerCase().includes(query)
    );

    // Find all courses that match the query (from all folders + uncategorized)
    const matchingCourses: Array<Course & { folderName?: string }> = [];

    // Search in folders
    for (const folder of folders) {
      for (const course of folder.courses) {
        if (
          course.name.toLowerCase().includes(query) ||
          course.file_name.toLowerCase().includes(query)
        ) {
          matchingCourses.push({ ...course, folderName: folder.name });
        }
      }
    }

    // Search in uncategorized
    for (const course of uncategorized) {
      if (
        course.name.toLowerCase().includes(query) ||
        course.file_name.toLowerCase().includes(query)
      ) {
        matchingCourses.push(course);
      }
    }

    const hasResults = filteredFolders.length > 0 || matchingCourses.length > 0;

    return {
      folders: filteredFolders,
      uncategorized: [], // Hide uncategorized section when searching
      matchingCourses,
      hasResults,
      isSearching: true
    };
  }, [folders, uncategorized, searchQuery]);

  const hasNoContent = folders.length === 0 && uncategorized.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pb-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={translate('sidebar_search_placeholder') || 'Rechercher...'}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* Reviews section - shown only when not searching */}
        {!filteredData.isSearching && <ReviewsSection />}

        {hasNoContent ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              isDark ? 'bg-neutral-800' : 'bg-gray-100'
            }`}>
              <Inbox className={`w-8 h-8 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`} />
            </div>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
              {translate('sidebar_no_folders') || 'Aucun dossier'}
            </p>
            <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {translate('sidebar_create_first_folder') || 'Créez votre premier dossier'}
            </p>
          </div>
        ) : !filteredData.hasResults ? (
          // No search results
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {translate('sidebar_no_results') || 'Aucun résultat'}
            </p>
          </div>
        ) : (
          <>
            {/* Folders section */}
            {filteredData.folders.length > 0 && (
              <div className="mb-4">
                {/* Separator after reviews section */}
                {!filteredData.isSearching && (
                  <div className={`border-t mb-4 ${isDark ? 'border-neutral-800' : 'border-gray-200'}`} />
                )}
                <div className={`flex items-center gap-2 px-3 mb-2`}>
                  <FolderIcon className="w-4 h-4 text-orange-500" />
                  <p className={`text-xs font-semibold uppercase tracking-wider ${
                    isDark ? 'text-neutral-500' : 'text-gray-500'
                  }`}>
                    {translate('sidebar_my_folders') || 'Mes dossiers'}
                  </p>
                </div>
                <div className="space-y-1">
                  {filteredData.folders.map((folder) => (
                    <FolderItem
                      key={folder.id}
                      id={folder.id}
                      name={folder.name}
                      courseCount={folder.course_count}
                      color={folder.color}
                      icon={folder.icon}
                      isActive={folder.id === activeFolderId}
                      onClick={() => onFolderClick(folder.id, folder.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Matching courses section (shown when searching) */}
            {filteredData.isSearching && filteredData.matchingCourses.length > 0 && (
              <div className={filteredData.folders.length > 0 ? 'mt-4' : ''}>
                {filteredData.folders.length > 0 && (
                  <div className={`border-t pt-4 ${isDark ? 'border-neutral-800' : 'border-gray-200'}`} />
                )}
                <p className={`text-xs font-semibold uppercase tracking-wider px-3 mb-2 ${
                  isDark ? 'text-neutral-500' : 'text-gray-500'
                }`}>
                  {translate('sidebar_courses') || 'Cours'}
                </p>
                <div className="space-y-0.5">
                  {filteredData.matchingCourses.map((course) => {
                    // Find which folder this course is in
                    const courseFolderId = folders.find(f =>
                      f.courses.some(c => c.id === course.id)
                    )?.id || null;

                    return (
                      <CourseItem
                        key={course.id}
                        id={course.id}
                        name={course.name}
                        masteredChapters={course.mastered_chapters}
                        totalChapters={course.total_chapters}
                        masteryPercentage={course.mastery_percentage}
                        isActive={course.id === currentCourseId}
                        onClick={() => onCourseClick(course.id)}
                        subtitle={'folderName' in course ? course.folderName : undefined}
                        folders={folders}
                        currentFolderId={courseFolderId}
                        onMoveCourse={onMoveCourse}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Uncategorized section (only when not searching) */}
            {!filteredData.isSearching && filteredData.uncategorized.length > 0 && (
              <div>
                <div className={`border-t pt-4 mt-2 ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider px-3 mb-2 ${
                    isDark ? 'text-neutral-500' : 'text-gray-500'
                  }`}>
                    {translate('sidebar_no_folder') || 'Sans dossier'}
                  </p>
                  <div className="space-y-0.5">
                    {filteredData.uncategorized.map((course) => (
                      <CourseItem
                        key={course.id}
                        id={course.id}
                        name={course.name}
                        masteredChapters={course.mastered_chapters}
                        totalChapters={course.total_chapters}
                        masteryPercentage={course.mastery_percentage}
                        isActive={course.id === currentCourseId}
                        onClick={() => onCourseClick(course.id)}
                        folders={folders}
                        currentFolderId={null}
                        onMoveCourse={onMoveCourse}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer - Action buttons */}
      <div className={`px-4 py-3 border-t space-y-2 ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
        <button
          onClick={onCreateFolder}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isDark
              ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-orange-400'
              : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-orange-600'
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          {translate('sidebar_new_folder') || 'Nouveau dossier'}
        </button>
        <button
          onClick={onUploadCourse}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-white hover:opacity-90"
          style={{ backgroundColor: '#ffa51f' }}
        >
          <Upload className="w-4 h-4" />
          {translate('sidebar_upload_course') || 'Déposer un cours'}
        </button>

        {/* Separator */}
        <div className={`border-t pt-2 mt-2 ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
          <button
            onClick={onContactClick}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              isDark
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MessageCircleQuestion className="w-4 h-4" />
            {translate('sidebar_support_contact') || 'Support & Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
