'use client';

import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { trackEvent } from '@/lib/posthog';
import SidebarHeader from './SidebarHeader';
import FolderLevel from './FolderLevel';
import CourseLevel from './CourseLevel';
import CreateFolderModal from '@/components/courses-unified/CreateFolderModal';
import UploadLimitModal from '@/components/upload/UploadLimitModal';
import ContactModal from '@/components/layout/ContactModal';
import type { SidebarLevel } from '@/types/sidebar';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

interface CourseSidebarProps {
  isOpen: boolean;
  level: SidebarLevel;
  selectedFolderId: string | null;
  selectedFolderName: string | null;
  currentCourseId?: string;
  onClose: () => void;
  onOpen: () => void;
  onGoToFolderLevel: () => void;
  onGoToCourseLevel: (folderId: string, folderName: string) => void;
  disabled?: boolean;
}

export default function CourseSidebar({
  isOpen,
  level,
  selectedFolderId,
  selectedFolderName,
  currentCourseId,
  onClose,
  onOpen,
  onGoToFolderLevel,
  onGoToCourseLevel,
  disabled = false,
}: CourseSidebarProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const { folders, uncategorized, refetch, moveCourse } = useCoursesOrganized();
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showUploadLimitModal, setShowUploadLimitModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Find which folder contains the current course (for highlighting)
  const activeFolderId = useMemo(() => {
    for (const folder of folders) {
      if (folder.courses.some((course) => course.id === currentCourseId)) {
        return folder.id;
      }
    }
    return null;
  }, [folders, currentCourseId]);

  // Get courses for the selected folder
  const selectedFolderCourses = useMemo(() => {
    if (!selectedFolderId) return [];
    const folder = folders.find((f) => f.id === selectedFolderId);
    return folder?.courses || [];
  }, [folders, selectedFolderId]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCourseClick = useCallback((courseId: string) => {
    if (courseId !== currentCourseId) {
      router.push(`/courses/${courseId}/learn`);
    }
    onClose();
  }, [currentCourseId, router, onClose]);

  const handleFolderCreated = useCallback(() => {
    setShowCreateFolderModal(false);
    refetch();
  }, [refetch]);

  const handleUploadClick = useCallback(() => {
    // Directly open file picker (no folder assignment)
    setUploadTargetFolderId(null);
    fileInputRef.current?.click();
  }, []);

  const handleUploadToFolder = useCallback((folderId: string) => {
    // Open file picker for uploading to a specific folder
    setUploadTargetFolderId(folderId);
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError(translate('upload_error_state') || 'Type de fichier non supporté');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (uploadTargetFolderId) {
        formData.append('folderId', uploadTargetFolderId);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.code === 'UPLOAD_LIMIT_REACHED') {
          setShowUploadLimitModal(true);
          setIsUploading(false);
          return;
        }
        throw new Error(data?.error || 'Upload failed');
      }

      trackEvent('upload_success', { userId: user?.id, courseId: data.courseId });
      onClose();
      router.push(`/courses/${data.courseId}/learn`);
    } catch (error) {
      console.error('Upload error', error);
      setUploadError(
        error instanceof Error
          ? error.message
          : translate('upload_error_state') || 'Erreur lors du téléchargement'
      );
    } finally {
      setIsUploading(false);
      setUploadTargetFolderId(null);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [user, translate, onClose, router, uploadTargetFolderId]);

  return (
    <>
      {/* Toggle button with mascot - only visible when sidebar is closed */}
      {!isOpen && (
        <div
          className="hidden md:flex fixed top-0 left-0 z-40 flex-col border-b"
          style={{
            pointerEvents: disabled ? 'none' : 'auto',
            opacity: disabled ? 0.5 : 1,
            backgroundColor: isDark ? '#121212' : '#ffffff',
            borderColor: isDark ? '#262626' : '#e5e7eb',
          }}
        >
          <div className="h-[51px] flex items-center gap-2 px-3">
            <button
              onClick={onOpen}
              disabled={disabled}
              className="p-1.5 rounded-lg transition-colors duration-150 text-[var(--sidebar-text-muted)] hover:text-[var(--color-nareo)] hover:bg-[var(--sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-nareo)] focus-visible:ring-offset-2"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Image
              src="/chat/mascotte2.png"
              alt="Nareo"
              width={24}
              height={24}
              className="rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Desktop: Animated sidebar that pushes content */}
      <aside
        className="hidden md:flex fixed top-0 left-0 h-full w-[260px] z-40 flex-col transition-all duration-200 ease-out"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: disabled ? 'none' : 'auto',
          opacity: disabled ? 0.5 : 1,
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: isOpen ? '1px solid var(--sidebar-border)' : 'none',
        }}
      >
          {/* Header */}
          <SidebarHeader onClose={onClose} />

          {/* Level content with fade animation */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              {level === 'folders' ? (
                <motion.div
                  key="folders"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute inset-0 pt-4"
                >
                  <FolderLevel
                    folders={folders}
                    uncategorized={uncategorized}
                    activeFolderId={activeFolderId}
                    currentCourseId={currentCourseId}
                    onFolderClick={onGoToCourseLevel}
                    onCourseClick={handleCourseClick}
                    onCreateFolder={() => setShowCreateFolderModal(true)}
                    onUploadCourse={handleUploadClick}
                    onContactClick={() => setShowContactModal(true)}
                    onMoveCourse={moveCourse}
                    onFolderDeleted={refetch}
                    onCourseDeleted={refetch}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="courses"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute inset-0 pt-4"
                >
                  <CourseLevel
                    folderName={selectedFolderName || ''}
                    folderId={selectedFolderId || ''}
                    courses={selectedFolderCourses}
                    currentCourseId={currentCourseId}
                    folders={folders}
                    onBack={onGoToFolderLevel}
                    onCourseClick={handleCourseClick}
                    onMoveCourse={moveCourse}
                    onAddCourse={selectedFolderId ? () => handleUploadToFolder(selectedFolderId) : undefined}
                    onCourseDeleted={refetch}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>

      {/* Mobile: Animated overlay sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop (mobile only) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
            />

            {/* Full Sidebar (mobile only) */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed top-0 left-0 h-full w-[260px] z-50 shadow-2xl flex flex-col"
              style={{
                pointerEvents: disabled ? 'none' : 'auto',
                opacity: disabled ? 0.5 : 1,
                backgroundColor: 'var(--sidebar-bg)',
              }}
            >
              {/* Header */}
              <SidebarHeader onClose={onClose} />

              {/* Level content with fade animation */}
              <div className="flex-1 min-h-0 relative overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  {level === 'folders' ? (
                    <motion.div
                      key="folders"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute inset-0 pt-4"
                    >
                      <FolderLevel
                        folders={folders}
                        uncategorized={uncategorized}
                        activeFolderId={activeFolderId}
                        currentCourseId={currentCourseId}
                        onFolderClick={onGoToCourseLevel}
                        onCourseClick={handleCourseClick}
                        onCreateFolder={() => setShowCreateFolderModal(true)}
                        onUploadCourse={handleUploadClick}
                        onContactClick={() => setShowContactModal(true)}
                        onMoveCourse={moveCourse}
                        onFolderDeleted={refetch}
                        onCourseDeleted={refetch}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="courses"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute inset-0 pt-4"
                    >
                      <CourseLevel
                        folderName={selectedFolderName || ''}
                        folderId={selectedFolderId || ''}
                        courses={selectedFolderCourses}
                        currentCourseId={currentCourseId}
                        folders={folders}
                        onBack={onGoToFolderLevel}
                        onCourseClick={handleCourseClick}
                        onMoveCourse={moveCourse}
                        onAddCourse={selectedFolderId ? () => handleUploadToFolder(selectedFolderId) : undefined}
                        onCourseDeleted={refetch}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Create folder modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={handleFolderCreated}
      />

      {/* Upload limit modal */}
      {showUploadLimitModal && (
        <UploadLimitModal onClose={() => setShowUploadLimitModal(false)} />
      )}

      {/* Contact modal */}
      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}

      {/* Upload loading overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-4"
            style={{ backgroundColor: 'var(--sidebar-bg)' }}
          >
            <Loader2 className="w-8 h-8 text-[var(--color-nareo)] animate-spin" />
            <p className="text-sm font-medium" style={{ color: 'var(--sidebar-text)' }}>
              {translate('upload_processing_title') || 'Traitement en cours...'}
            </p>
          </div>
        </div>
      )}

      {/* Upload error toast */}
      {uploadError && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm rounded-xl border p-4 shadow-lg"
          style={{
            backgroundColor: isDark ? 'rgba(127, 29, 29, 0.9)' : '#fff6f3',
            borderColor: isDark ? 'rgba(217, 26, 28, 0.5)' : 'rgba(217, 26, 28, 0.2)',
            color: isDark ? '#f87171' : '#b91c1c'
          }}
        >
          <p className="text-sm">{uploadError}</p>
          <button
            onClick={() => setUploadError(null)}
            className="mt-2 text-xs font-medium transition-colors"
            style={{ color: isDark ? '#fca5a5' : '#d91a1c' }}
            onMouseEnter={(e) => e.currentTarget.style.color = isDark ? '#fecaca' : '#b81618'}
            onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#fca5a5' : '#d91a1c'}
          >
            {translate('dismiss') || 'Fermer'}
          </button>
        </div>
      )}
    </>
  );
}
