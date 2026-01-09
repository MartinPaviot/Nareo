'use client';

import { useState, useMemo } from 'react';
import { FolderPlus, Upload, Inbox, MessageCircleQuestion, Folder as FolderIcon, ChevronDown, ChevronRight, FileText } from 'lucide-react';
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
  onFolderDeleted?: () => void;
  onCourseDeleted?: () => void;
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
  onFolderDeleted,
  onCourseDeleted,
}: FolderLevelProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(true);
  const [isUncategorizedExpanded, setIsUncategorizedExpanded] = useState(false);

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
      <div className="px-3 pb-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={translate('sidebar_search_placeholder') || 'Rechercher...'}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
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
            {/* Folders section - collapsible */}
            {filteredData.folders.length > 0 && (
              <div className={`${!filteredData.isSearching ? 'border-t pt-0.5' : ''} ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
                {/* Collapsible header */}
                <button
                  onClick={() => setIsFoldersExpanded(!isFoldersExpanded)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FolderIcon className="w-3.5 h-3.5 text-orange-500" />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      isDark ? 'text-neutral-500' : 'text-gray-500'
                    }`}>
                      {translate('sidebar_my_folders') || 'Mes dossiers'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                      {filteredData.folders.length}
                    </span>
                    {isFoldersExpanded ? (
                      <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isFoldersExpanded && (
                  <div className="space-y-0.5 mt-1">
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
                        onFolderDeleted={onFolderDeleted}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Matching courses section (shown when searching) */}
            {filteredData.isSearching && filteredData.matchingCourses.length > 0 && (
              <div className={`${filteredData.folders.length > 0 ? 'border-t pt-0.5' : ''} ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
                <div className={`flex items-center gap-1.5 px-2 py-1`}>
                  <FileText className="w-3.5 h-3.5 text-orange-500" />
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isDark ? 'text-neutral-500' : 'text-gray-500'
                  }`}>
                    {translate('sidebar_courses') || 'Cours'}
                  </p>
                </div>
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
                        onCourseDeleted={onCourseDeleted}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Uncategorized section (only when not searching) - collapsible */}
            {!filteredData.isSearching && filteredData.uncategorized.length > 0 && (
              <div className={`border-t pt-0.5 ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
                {/* Collapsible header */}
                <button
                  onClick={() => setIsUncategorizedExpanded(!isUncategorizedExpanded)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Inbox className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      isDark ? 'text-neutral-500' : 'text-gray-500'
                    }`}>
                      {translate('sidebar_no_folder') || 'Sans dossier'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                      {filteredData.uncategorized.length}
                    </span>
                    {isUncategorizedExpanded ? (
                      <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isUncategorizedExpanded && (
                  <div className="space-y-0.5 mt-1">
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
                        onCourseDeleted={onCourseDeleted}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer - Action buttons */}
      <div className={`flex-shrink-0 px-2 pt-1.5 pb-1 border-t ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
        <button
          onClick={onCreateFolder}
          className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            isDark
              ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-orange-400'
              : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-orange-600'
          }`}
        >
          <FolderPlus className="w-3.5 h-3.5" />
          {translate('sidebar_new_folder') || 'Nouveau dossier'}
        </button>
        <button
          onClick={onUploadCourse}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 mt-1 rounded-lg text-[11px] font-medium transition-colors text-white hover:opacity-90"
          style={{ backgroundColor: '#ff751f' }}
        >
          <Upload className="w-3.5 h-3.5" />
          {translate('sidebar_upload_course') || 'Déposer un cours'}
        </button>
      </div>

      {/* Support footer - aligned with main footer */}
      <div className={`flex-shrink-0 px-2 py-1.5 border-t ${isDark ? 'border-neutral-800 bg-neutral-900/50' : 'border-gray-100 bg-gray-50/50'}`}>
        <button
          onClick={onContactClick}
          className={`w-full flex items-center justify-center gap-1.5 text-[10px] transition-colors ${
            isDark
              ? 'text-neutral-500 hover:text-orange-400'
              : 'text-gray-400 hover:text-orange-500'
          }`}
        >
          <MessageCircleQuestion className="w-3 h-3" />
          {translate('sidebar_support_contact') || 'Support & Contact'}
        </button>
      </div>
    </div>
  );
}
