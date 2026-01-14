'use client';

import { useState, useMemo } from 'react';
import { FolderPlus, Upload, Inbox, MessageCircleQuestion, Folder as FolderIcon, ChevronDown, ChevronRight, FileText } from 'lucide-react';
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--sidebar-hover)' }}
            >
              <Inbox className="w-8 h-8" style={{ color: 'var(--sidebar-text-muted)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--sidebar-text)' }}>
              {translate('sidebar_no_folders') || 'Aucun dossier'}
            </p>
            <p className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
              {translate('sidebar_create_first_folder') || 'Créez votre premier dossier'}
            </p>
          </div>
        ) : !filteredData.hasResults ? (
          // No search results
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--sidebar-text-muted)' }}>
              {translate('sidebar_no_results') || 'Aucun résultat'}
            </p>
          </div>
        ) : (
          <>
            {/* Folders section - collapsible */}
            {filteredData.folders.length > 0 && (
              <div className={`${!filteredData.isSearching ? 'mt-2 pt-1' : ''}`}>
                {/* Collapsible header */}
                <button
                  onClick={() => setIsFoldersExpanded(!isFoldersExpanded)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors duration-150"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex items-center gap-1.5">
                    <FolderIcon className="w-3.5 h-3.5" style={{ color: 'var(--color-nareo)' }} />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--sidebar-text-muted)' }}
                    >
                      {translate('sidebar_my_folders') || 'Mes dossiers'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--sidebar-text-muted)', opacity: 0.6 }}>
                      {filteredData.folders.length}
                    </span>
                    {isFoldersExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
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
              <div className={`${filteredData.folders.length > 0 ? 'mt-2 pt-1' : ''}`}>
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <FileText className="w-3.5 h-3.5" style={{ color: 'var(--color-nareo)' }} />
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    {translate('sidebar_courses') || 'Cours'}
                  </p>
                </div>
                <div className="space-y-0.5 mt-1">
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
              <div className="mt-2 pt-1">
                {/* Collapsible header */}
                <button
                  onClick={() => setIsUncategorizedExpanded(!isUncategorizedExpanded)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors duration-150"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex items-center gap-1.5">
                    <Inbox className="w-3.5 h-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--sidebar-text-muted)' }}
                    >
                      {translate('sidebar_no_folder') || 'Sans dossier'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--sidebar-text-muted)', opacity: 0.6 }}>
                      {filteredData.uncategorized.length}
                    </span>
                    {isUncategorizedExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
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
      <div className="flex-shrink-0 px-3 pt-2 pb-1.5">
        <button
          onClick={onCreateFolder}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--sidebar-text-muted)',
            border: '1px solid var(--sidebar-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-text-muted)';
          }}
        >
          <FolderPlus className="w-3.5 h-3.5" />
          {translate('sidebar_new_folder') || 'Nouveau dossier'}
        </button>
        <button
          onClick={onUploadCourse}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-2 mt-1.5 rounded-lg text-[11px] font-medium transition-opacity duration-150 text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--color-nareo)' }}
        >
          <Upload className="w-3.5 h-3.5" />
          {translate('sidebar_upload_course') || 'Déposer un cours'}
        </button>
      </div>

      {/* Support footer - espace réservé pour le guide */}
      <div className="flex-shrink-0 px-3 py-1.5">
        <button
          onClick={onContactClick}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] transition-colors duration-150"
          style={{ color: 'var(--sidebar-text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-nareo)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
        >
          <MessageCircleQuestion className="w-3 h-3" />
          {translate('sidebar_support_contact') || 'Support & Contact'}
        </button>
      </div>
    </div>
  );
}
