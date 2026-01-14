'use client';

import { ArrowLeft, Upload, Inbox } from 'lucide-react';
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
  onCourseDeleted?: () => void;
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
  onCourseDeleted,
}: CourseLevelProps) {
  const { translate } = useLanguage();

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="px-3 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg transition-colors duration-150"
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--color-nareo)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium truncate max-w-[200px]">{folderName}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        {courses.length === 0 ? (
          // Empty folder state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--sidebar-hover)' }}
            >
              <Inbox className="w-8 h-8" style={{ color: 'var(--sidebar-text-muted)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--sidebar-text)' }}>
              {translate('sidebar_folder_empty') || 'Dossier vide'}
            </p>
            <p className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
              {translate('sidebar_folder_empty_desc') || 'Aucun cours dans ce dossier'}
            </p>
          </div>
        ) : (
          <>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2"
              style={{ color: 'var(--sidebar-text-muted)' }}
            >
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
                  onCourseDeleted={onCourseDeleted}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer - Upload course button (optional) */}
      {onAddCourse && (
        <div className="px-3 py-2">
          <button
            onClick={onAddCourse}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-white transition-opacity duration-150 hover:opacity-90"
            style={{ backgroundColor: 'var(--color-nareo)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            {translate('sidebar_upload_course') || 'Déposer un cours'}
          </button>
        </div>
      )}
    </div>
  );
}
