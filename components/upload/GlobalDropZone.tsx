'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { trackEvent } from '@/lib/posthog';
import UploadLimitModal from './UploadLimitModal';
import DuplicateCourseModal from './DuplicateCourseModal';
import ExtractionLoader from '@/components/course/ExtractionLoader';
// Guest session ID utilities (same as UploadSection)
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

function getOrCreateGuestSessionId(): string {
  let guestSessionId = getCookie('guestSessionId');
  if (!guestSessionId) {
    guestSessionId = localStorage.getItem('guestSessionId');
  }
  if (!guestSessionId) {
    guestSessionId = crypto.randomUUID();
  }
  setCookie('guestSessionId', guestSessionId, 30);
  localStorage.setItem('guestSessionId', guestSessionId);
  return guestSessionId;
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

interface GlobalDropZoneProps {
  children: React.ReactNode;
}

export default function GlobalDropZone({ children }: GlobalDropZoneProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [showUploadLimitModal, setShowUploadLimitModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    filename: string;
    existingCourseTitle: string;
    existingCourseDate: string;
  } | null>(null);
  const [uploadedCourseId, setUploadedCourseId] = useState<string | null>(null);

  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(file => ACCEPTED_TYPES.includes(file.type));

    if (!validFile) {
      return;
    }

    setDroppedFile(validFile);
    await processUpload(validFile);
  }, []);

  const processUpload = async (file: File, skipDuplicateCheck = false) => {
    setIsProcessing(true);

    try {
      // Check for duplicate course
      if (user && !skipDuplicateCheck) {
        const checkResponse = await fetch('/api/courses/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name }),
          credentials: 'include',
        });
        const checkData = await checkResponse.json();

        if (checkData.isDuplicate && checkData.existingCourse) {
          setDuplicateInfo({
            filename: file.name,
            existingCourseTitle: checkData.existingCourse.title,
            existingCourseDate: checkData.existingCourse.createdAt,
          });
          setIsProcessing(false);
          return;
        }
      }

      await performUpload(file);
    } catch (error) {
      console.error('Upload error', error);
      setIsProcessing(false);
      setDroppedFile(null);
    }
  };

  const performUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Add guestSessionId for non-authenticated users
      if (!user) {
        const guestSessionId = getOrCreateGuestSessionId();
        formData.append('guestSessionId', guestSessionId);
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
          setIsProcessing(false);
          setDroppedFile(null);
          return;
        }
        throw new Error(data?.error || 'Upload failed');
      }

      if (data.courseId) {
        trackEvent('upload_success_global_drop', { userId: user?.id, courseId: data.courseId });
        // Transition to extraction phase - keep isProcessing true to maintain ExtractionLoader mounted
        // The same ExtractionLoader instance will switch from upload to extraction mode
        setUploadedCourseId(data.courseId);
        // Note: Don't set isProcessing to false here - the ExtractionLoader stays mounted
        // and will call handleExtractionComplete when done
      }
    } catch (error) {
      console.error('Upload error', error);
      setIsProcessing(false);
      setDroppedFile(null);
    }
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateInfo(null);
    if (droppedFile) {
      await processUpload(droppedFile, true);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateInfo(null);
    setDroppedFile(null);
    setIsProcessing(false);
  };

  const handleCancel = () => {
    setDroppedFile(null);
    setIsProcessing(false);
  };

  // Callback for extraction completion - must be stable to avoid re-renders
  const handleExtractionComplete = useCallback(() => {
    if (uploadedCourseId) {
      // Reset all states before navigating
      setIsProcessing(false);
      setDroppedFile(null);
      router.push(`/courses/${uploadedCourseId}/learn`);
    }
  }, [uploadedCourseId, router]);

  return (
    <div
      className="relative min-h-screen"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Full-screen drop overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`flex flex-col items-center gap-6 p-12 rounded-3xl border-4 border-dashed ${
                isDark
                  ? 'border-orange-500/50 bg-neutral-900/80'
                  : 'border-orange-400 bg-white/80'
              }`}
              style={{ boxShadow: '0 25px 50px -12px rgba(255, 117, 31, 0.25)' }}
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg, #ff751f 0%, #e5681b 100%)' }}
              >
                <Upload className="w-10 h-10" />
              </motion.div>

              <div className="text-center">
                <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {translate('global_drop_title', 'Dépose ton fichier ici')}
                </h2>
                <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {translate('global_drop_subtitle', 'PDF, Word ou images (JPG, PNG)')}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single ExtractionLoader instance for both upload and extraction phases */}
      {(isProcessing || uploadedCourseId) && droppedFile && (
        <ExtractionLoader
          courseId={uploadedCourseId}
          onComplete={handleExtractionComplete}
          fileName={droppedFile.name}
          isUploading={isProcessing && !uploadedCourseId}
          onCancel={isProcessing && !uploadedCourseId ? handleCancel : undefined}
        />
      )}

      {/* Modals */}
      {showUploadLimitModal && (
        <UploadLimitModal onClose={() => setShowUploadLimitModal(false)} />
      )}

      {duplicateInfo && (
        <DuplicateCourseModal
          filename={duplicateInfo.filename}
          existingCourseTitle={duplicateInfo.existingCourseTitle}
          existingCourseDate={duplicateInfo.existingCourseDate}
          onConfirm={handleDuplicateConfirm}
          onCancel={handleDuplicateCancel}
        />
      )}
    </div>
  );
}
