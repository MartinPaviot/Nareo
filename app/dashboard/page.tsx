'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FolderPlus } from 'lucide-react';
import Image from 'next/image';
import AuthGuard from '@/components/auth/AuthGuard';
import PageHeaderWithMascot from '@/components/layout/PageHeaderWithMascot';
import ProgressZone from '@/components/dashboard/ProgressZone';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import EnhancedCourseCard from '@/components/courses/EnhancedCourseCard';
import CourseActionMenu from '@/components/course-management/CourseActionMenu';
import DeleteCourseDialog from '@/components/course-management/DeleteCourseDialog';
import RenameCourseDialog from '@/components/course-management/RenameCourseDialog';
import CreateFolderDialog from '@/components/course-management/CreateFolderDialog';
import AddToFolderDialog from '@/components/course-management/AddToFolderDialog';
import DeleteFolderDialog from '@/components/course-management/DeleteFolderDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGamification } from '@/hooks/useGamification';
import { useCourseManagement } from '@/hooks/useCourseManagement';
import { trackEvent } from '@/lib/posthog';
import { Folder, FolderWithCourses } from '@/types/course-management';
import FolderCard from '@/components/course-management/FolderCard';
import UploadZone from '@/components/upload/UploadZone';

interface Course {
  id: string;
  title: string;
  editable_title?: string | null;
  status: string;
  chapter_count: number;
  completed_chapters: number;
  in_progress_chapters: number;
  user_score: number;
  created_at: string;
}

function MyCoursesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<FolderWithCourses[]>([]);
  const [loading, setLoading] = useState(true);

  // Course Management State
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [addToFolderDialogOpen, setAddToFolderDialogOpen] = useState(false);
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderWithCourses | null>(null);

  // Gamification hook
  const { stats, todayActivity, loading: gamificationLoading } = useGamification();

  // Course Management hook
  const { isLoading: courseManagementLoading } = useCourseManagement();

  useEffect(() => {
    if (user) {
      loadCourses();
      loadFolders();
      trackEvent('dashboard_viewed', { userId: user.id });
    }
  }, [user]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/courses');
      if (!response.ok) {
        throw new Error('Failed to load courses');
      }
      const data = await response.json();
      // Filter out failed courses
      const validCourses = (data.courses || []).filter((course: Course) => course.status !== 'failed');
      setCourses(validCourses);
    } catch (error) {
      console.error('Error loading courses', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/folders');
      if (!response.ok) {
        throw new Error('Failed to load folders');
      }
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Error loading folders', error);
    }
  };

  // Get all course IDs that are in folders
  const getCourseIdsInFolders = () => {
    const courseIds = new Set<string>();
    folders.forEach((folder) => {
      folder.courses.forEach((course) => {
        courseIds.add(course.id);
      });
    });
    return courseIds;
  };

  // Filter courses to exclude those already in folders
  const coursesNotInFolders = courses.filter(
    (course) => !getCourseIdsInFolders().has(course.id)
  );

  const handleDeleteCourse = (course: Course) => {
    setSelectedCourse(course);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCourseById = (courseId: string, courseTitle: string) => {
    // Find the course in the courses list or folders
    let course = courses.find((c) => c.id === courseId);
    if (!course) {
      // Course might be in a folder, create a minimal course object
      course = {
        id: courseId,
        title: '',
        editable_title: courseTitle,
        status: 'ready',
        chapter_count: 0,
        completed_chapters: 0,
        in_progress_chapters: 0,
        user_score: 0,
        created_at: new Date().toISOString(),
      };
    }
    handleDeleteCourse(course);
  };

  const handleRenameCourse = (course: Course) => {
    setSelectedCourse(course);
    setRenameDialogOpen(true);
  };

  const handleRenameCourseById = (courseId: string, currentTitle: string) => {
    // Find the course in the courses list or folders
    let course = courses.find((c) => c.id === courseId);
    if (!course) {
      // Course might be in a folder, create a minimal course object
      course = {
        id: courseId,
        title: '',
        editable_title: currentTitle,
        status: 'ready',
        chapter_count: 0,
        completed_chapters: 0,
        in_progress_chapters: 0,
        user_score: 0,
        created_at: new Date().toISOString(),
      };
    }
    handleRenameCourse(course);
  };

  const handleAddToFolder = (course: Course) => {
    setSelectedCourse(course);
    setAddToFolderDialogOpen(true);
  };

  const handleCourseDeleted = () => {
    loadCourses();
    loadFolders(); // Also reload folders in case the deleted course was in a folder
  };

  const handleCourseAddedToFolder = () => {
    loadFolders();
    loadCourses();
  };

  const handleCourseRenamed = (newTitle: string) => {
    if (selectedCourse) {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === selectedCourse.id ? { ...c, editable_title: newTitle } : c
        )
      );
      // Also reload folders in case the renamed course is in a folder
      loadFolders();
    }
  };

  const handleFolderCreated = (folder: Folder) => {
    loadFolders();
  };

  const handleDeleteFolder = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      setSelectedFolder(folder);
      setDeleteFolderDialogOpen(true);
    }
  };

  const handleFolderDeleted = () => {
    loadFolders();
    loadCourses(); // Reload courses as they may have been moved back to main list
  };

  const handleRemoveCourseFromFolder = async (folderId: string, courseId: string) => {
    try {
      const response = await fetch('/api/folders/courses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId, course_id: courseId }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove course from folder');
      }

      loadFolders();
    } catch (error) {
      console.error('Error removing course from folder:', error);
    }
  };

  const getCourseDisplayTitle = (course: Course) => {
    return course.editable_title || course.title;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={400}
            height={400}
            className="mx-auto mb-4 animate-bounce"
          />
          <p className="text-gray-600">{translate('dashboard_loading')}</p>
        </div>
      </div>
    );
  }

  // Courses Content for Tab
  const coursesContent = (
    <div className="space-y-4">
      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-1">
            {translate('my_courses_empty_title')}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            {translate('dashboard_empty_desc')}
          </p>
          <button
            onClick={() => {
              const uploadZone = document.querySelector('[data-upload-zone]');
              if (uploadZone) {
                uploadZone.scrollIntoView({ behavior: 'smooth' });
              } else {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }
            }}
            className="px-5 py-3 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600 inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {translate('my_courses_empty_cta')}
          </button>
        </div>
      ) : (
        <>
          {/* Create Folder Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setCreateFolderDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <FolderPlus className="w-4 h-4" />
              {translate('create_folder_button')}
            </button>
          </div>

          {/* Courses Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.map((course) => (
              <div key={course.id} className="relative">
                {/* Course Card */}
                <div onClick={() => router.push(`/courses/${course.id}/learn`)}>
                  <EnhancedCourseCard
                    course={{
                      ...course,
                      title: getCourseDisplayTitle(course),
                    }}
                    hideStatusBadge={true}
                  />
                </div>

                {/* Action Menu (Top Right Corner) */}
                <div className="absolute top-5 right-5 z-10">
                  <CourseActionMenu
                    onRename={() => handleRenameCourse(course)}
                    onDelete={() => handleDeleteCourse(course)}
                    onAddToFolder={() => handleAddToFolder(course)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Folders Content for Tab
  const foldersContent = (
    <div className="space-y-4">
      {folders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <FolderPlus className="w-6 h-6" />
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-1">
            {translate('add_to_folder_no_folders')}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            {translate('add_to_folder_create_hint')}
          </p>
          <button
            onClick={() => setCreateFolderDialogOpen(true)}
            className="px-5 py-3 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 inline-flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            {translate('create_folder_button')}
          </button>
        </div>
      ) : (
        <>
          {/* Create Folder Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setCreateFolderDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <FolderPlus className="w-4 h-4" />
              {translate('create_folder_button')}
            </button>
          </div>

          {/* Folders List */}
          <div className="space-y-4">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onDeleteFolder={handleDeleteFolder}
                onRemoveCourse={handleRemoveCourseFromFolder}
                onCourseClick={(courseId) => router.push(`/courses/${courseId}/learn`)}
                onRenameCourse={handleRenameCourseById}
                onDeleteCourse={handleDeleteCourseById}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <PageHeaderWithMascot
        title={translate('my_courses_title')}
        subtitle={translate('dashboard_mascot_subtitle')}
        hideMyCoursesButton={true}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Progress Zone - Unified gamified progress area */}
        {!gamificationLoading && stats && (
          <ProgressZone
            currentStreak={stats.current_streak}
            longestStreak={stats.longest_streak}
            totalQuizzes={stats.total_quizzes_completed}
            totalPoints={stats.total_points}
            todayStats={{
              quizzesCompleted: todayActivity?.quizzes_completed || 0,
              questionsAnswered: todayActivity?.questions_answered || 0,
              pointsEarned: todayActivity?.points_earned || 0,
              accuracy: todayActivity && todayActivity.questions_answered && todayActivity.questions_answered > 0
                ? Math.round((todayActivity.questions_correct || 0) / todayActivity.questions_answered * 100)
                : 0,
            }}
            hasQuizAvailable={false}
            onChooseChapter={() => {
              document.getElementById('courses-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onUploadClick={() => {
              const uploadZone = document.querySelector('[data-upload-zone]');
              if (uploadZone) {
                uploadZone.scrollIntoView({ behavior: 'smooth' });
              } else {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }
            }}
          />
        )}

        {/* Tabs Switcher: Courses / Folders */}
        <div id="courses-section">
          <DashboardTabs
            initialView="courses"
            coursesCount={courses.length}
            foldersCount={folders.length}
            coursesContent={coursesContent}
            foldersContent={foldersContent}
          >
            {null}
          </DashboardTabs>
        </div>

        {/* Upload Zone - Bottom */}
        <div data-upload-zone>
          <UploadZone />
        </div>
      </main>

      {/* Dialogs */}
      {selectedCourse && (
        <>
          <DeleteCourseDialog
            courseId={selectedCourse.id}
            courseTitle={getCourseDisplayTitle(selectedCourse)}
            isOpen={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            onDeleted={handleCourseDeleted}
          />

          <RenameCourseDialog
            courseId={selectedCourse.id}
            currentTitle={getCourseDisplayTitle(selectedCourse)}
            isOpen={renameDialogOpen}
            onClose={() => setRenameDialogOpen(false)}
            onRenamed={handleCourseRenamed}
          />

          <AddToFolderDialog
            courseId={selectedCourse.id}
            courseTitle={getCourseDisplayTitle(selectedCourse)}
            isOpen={addToFolderDialogOpen}
            onClose={() => setAddToFolderDialogOpen(false)}
            onAdded={handleCourseAddedToFolder}
          />
        </>
      )}

      <CreateFolderDialog
        isOpen={createFolderDialogOpen}
        onClose={() => setCreateFolderDialogOpen(false)}
        onCreated={handleFolderCreated}
      />

      {selectedFolder && (
        <DeleteFolderDialog
          folderId={selectedFolder.id}
          folderName={selectedFolder.name}
          courseCount={selectedFolder.courses.length}
          isOpen={deleteFolderDialogOpen}
          onClose={() => setDeleteFolderDialogOpen(false)}
          onDeleted={handleFolderDeleted}
        />
      )}
    </div>
  );
}

export default function ProtectedMyCourses() {
  return (
    <AuthGuard>
      <MyCoursesScreen />
    </AuthGuard>
  );
}
