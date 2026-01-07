'use client';

import { ArrowLeft, Upload, Inbox } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import CourseItem from './CourseItem';
import type { Course, Folder } from '@/lib/courses/types';

interface CourseLevelProps {
  folderName: string;
  folderId: string;
  courses: Course[];
  currentCourseId?: string;
  folders: Folder[];
  onBack: () => void;
  onCourseClick: (courseId: string) => void;
  onAddCourse?: () => void;
  onMoveCourse?: (courseId: string, folderId: string | null) => Promise<boolean>;
}

export default function CourseLevel({
  folderName,
  folderId,
  courses,
  currentCourseId,
  folders,
  onBack,
  onCourseClick,
  onAddCourse,
  onMoveCourse,
}: CourseLevelProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className={`px-4 pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
        <button
          onClick={onBack}
          className={`flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg transition-colors ${
            isDark
              ? 'text-neutral-300 hover:bg-neutral-800 hover:text-orange-400'
              : 'text-gray-700 hover:bg-gray-100 hover:text-orange-600'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium truncate max-w-[200px]">{folderName}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3">
        {courses.length === 0 ? (
          // Empty folder state
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              isDark ? 'bg-neutral-800' : 'bg-gray-100'
            }`}>
              <Inbox className={`w-8 h-8 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`} />
            </div>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
              {translate('sidebar_folder_empty') || 'Dossier vide'}
            </p>
            <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {translate('sidebar_folder_empty_desc') || 'Aucun cours dans ce dossier'}
            </p>
          </div>
        ) : (
          <>
            <p className={`text-xs font-semibold uppercase tracking-wider px-1 mb-2 ${
              isDark ? 'text-neutral-500' : 'text-gray-500'
            }`}>
              {translate('sidebar_courses') || 'Cours'}
            </p>
            <div className="space-y-0.5">
              {courses.map((course) => (
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
                  currentFolderId={folderId}
                  onMoveCourse={onMoveCourse}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer - Upload course button (optional) */}
      {onAddCourse && (
        <div className={`px-4 py-3 border-t ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
          <button
            onClick={onAddCourse}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#ff751f' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
          >
            <Upload className="w-4 h-4" />
            {translate('sidebar_upload_course') || 'Déposer un cours'}
          </button>
        </div>
      )}
    </div>
  );
}
