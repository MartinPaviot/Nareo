'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, FolderOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden">
      {/* Folder Header */}
      <div
        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
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
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-600" />
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
              <h3 className="text-xl font-bold text-gray-900">{folder.name}</h3>
              <p className="text-sm text-gray-500">
                {folder.course_count} {translate('courses_count')}
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
              className="p-2 hover:bg-red-100 rounded-full transition-colors group"
              title={translate('delete_folder_action')}
            >
              <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Folder Contents */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {folder.courses.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{translate('folder_empty')}</p>
              <p className="text-xs text-gray-400 mt-1">
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
                          status: course.status,
                          chapter_count: course.chapter_count,
                          completed_chapters: course.completed_chapters,
                          in_progress_chapters: course.in_progress_chapters,
                          user_score: course.user_score,
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
