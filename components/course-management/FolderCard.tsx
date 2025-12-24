'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, FolderOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FolderWithCourses } from '@/types/course-management';
import EnhancedCourseCard from '@/components/courses/EnhancedCourseCard';
import CourseActionMenu from '@/components/course-management/CourseActionMenu';

interface FolderCardProps {
  folder: FolderWithCourses;
  onDeleteFolder: (folderId: string) => void;
  onRemoveCourse: (folderId: string, courseId: string) => void;
  onCourseClick: (courseId: string) => void;
  onRenameCourse?: (courseId: string, currentTitle: string) => void;
  onDeleteCourse?: (courseId: string, courseTitle: string) => void;
}

export default function FolderCard({
  folder,
  onDeleteFolder,
  onRemoveCourse,
  onCourseClick,
  onRenameCourse,
  onDeleteCourse,
}: FolderCardProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`rounded-3xl shadow-md border overflow-hidden ${
      isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
    }`}>
      {/* Folder Header */}
      <div
        className={`p-6 cursor-pointer transition-colors ${
          isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'
        }`}
        style={{
          borderLeft: `4px solid ${folder.color}`,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Expand/Collapse Icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={`p-2 rounded-full transition-colors ${
                isDark ? 'hover:bg-neutral-700' : 'hover:bg-gray-200'
              }`}
            >
              {isExpanded ? (
                <ChevronDown className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`} />
              ) : (
                <ChevronRight className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`} />
              )}
            </button>

            {/* Folder Icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: folder.color + '20' }}
            >
              {folder.icon}
            </div>

            {/* Folder Info */}
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>{folder.name}</h3>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {folder.course_count} {folder.course_count === 1 ? translate('course_count_singular') : translate('courses_count')}
              </p>
            </div>
          </div>

          {/* Folder Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(translate('delete_folder_confirm'))) {
                  onDeleteFolder(folder.id);
                }
              }}
              className={`p-2 rounded-full transition-colors group ${
                isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-100'
              }`}
              title={translate('delete_folder_action')}
            >
              <Trash2 className={`w-5 h-5 group-hover:text-red-500 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Folder Contents */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {folder.courses.length === 0 ? (
            <div className={`text-center py-12 rounded-2xl border-2 border-dashed ${
              isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'
            }`}>
              <FolderOpen className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-neutral-600' : 'text-gray-300'}`} />
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{translate('folder_empty')}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                {translate('folder_empty_hint')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {folder.courses.map((course) => {
                const displayTitle = course.editable_title || course.title;
                return (
                  <div key={course.id} className="relative">
                    {/* Course Card */}
                    <div onClick={() => onCourseClick(course.id)}>
                      <EnhancedCourseCard
                        course={{
                          id: course.id,
                          title: displayTitle,
                          status: course.status || 'not_started',
                          chapter_count: course.chapter_count || 0,
                          completed_chapters: course.completed_chapters || 0,
                          in_progress_chapters: course.in_progress_chapters || 0,
                          user_score: course.user_score || 0,
                          created_at: course.created_at,
                        }}
                        hideStatusBadge={true}
                      />
                    </div>

                    {/* Action Menu (Top Right Corner) */}
                    <div className="absolute top-5 right-5 z-10">
                      <CourseActionMenu
                        onRename={() => onRenameCourse?.(course.id, displayTitle)}
                        onDelete={() => onDeleteCourse?.(course.id, displayTitle)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
