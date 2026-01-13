'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, Upload, Trophy, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTodayReviewCounts } from '@/hooks/useFlashcardReviews';
import { trackEvent } from '@/lib/posthog';
import ChallengeModal from './ChallengeModal';
import ReviewSelectModal from './ReviewSelectModal';
import UploadLimitModal from '@/components/upload/UploadLimitModal';
import DuplicateCourseModal from '@/components/upload/DuplicateCourseModal';
import ExtractionLoader from '@/components/course/ExtractionLoader';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export default function WelcomeActionSection() {
  const router = useRouter();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const { totalCount } = useTodayReviewCounts();
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadLimitModal, setShowUploadLimitModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    filename: string;
    existingCourseTitle: string;
    existingCourseDate: string;
  } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadedCourseId, setUploadedCourseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetch('/api/profile', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.profile?.full_name) {
            const name = data.profile.full_name.split(' ')[0];
            setFirstName(name);
          }
        })
        .catch(err => console.error('Error fetching profile:', err));
    }
  }, [user]);

  const handleDailyReview = () => setShowReviewModal(true);
  const handleChallenge = () => setShowChallengeModal(true);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return;
    }

    await processUpload(file);
  };

  const processUpload = async (file: File, skipDuplicateCheck = false) => {
    setIsUploading(true);
    setPendingFile(file);

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
          setIsUploading(false);
          return;
        }
      }

      await performUpload(file);
    } catch (error) {
      console.error('Upload error', error);
      setIsUploading(false);
    }
  };

  const performUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

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

      if (data.courseId) {
        trackEvent('upload_success', { userId: user?.id, courseId: data.courseId });
        // Show ExtractionLoader with GIFs instead of redirecting immediately
        setUploadedCourseId(data.courseId);
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Upload error', error);
      setIsUploading(false);
    }
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateInfo(null);
    if (pendingFile) {
      await processUpload(pendingFile, true);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateInfo(null);
    setPendingFile(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayName = firstName || translate('welcome_default_name', 'there');

  // Callback for extraction completion - must be stable to avoid re-renders
  const handleExtractionComplete = useCallback(() => {
    if (uploadedCourseId) {
      router.push(`/courses/${uploadedCourseId}/learn`);
    }
  }, [uploadedCourseId, router]);

  return (
    <>
      {/* ExtractionLoader with GIFs - shown after upload success */}
      {uploadedCourseId && (
        <ExtractionLoader
          courseId={uploadedCourseId}
          onComplete={handleExtractionComplete}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`relative rounded-xl border overflow-hidden ${
          isDark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-100 bg-white'
        }`}
      >
        <div className="flex p-4 gap-3">
          {/* Left: Mascot + Speech bubble - hidden on mobile */}
          <div className="relative w-40 flex-shrink-0 hidden sm:flex flex-col">
            {/* Speech bubble - simple rectangle aligned with button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 20 }}
              className="px-3 rounded-xl text-xs font-medium text-white h-[72px] flex flex-col justify-center"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              }}
            >
              <div>
                <span>Hello {displayName} !</span>
                <span className="ml-1">👋</span>
              </div>
              <div className="mt-1 text-[11px] opacity-90">
                {translate('welcome_question', "Qu'est-ce qu'on révise aujourd'hui ?")}
              </div>
            </motion.div>

            {/* Mascot with bubble tail icon */}
            <div className="flex-1 relative">
              {/* Bubble tail - small triangle */}
              <div
                className="absolute top-0 left-6 w-0 h-0"
                style={{
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '10px solid #ea580c',
                }}
              />
              {/* Mascot */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: [0, -4, 0],
                }}
                transition={{
                  opacity: { delay: 0.25, duration: 0.3 },
                  y: {
                    delay: 0.5,
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
                }}
                className="pt-3"
              >
                <Image
                  src="/chat/mascotte.png"
                  alt="Nareo"
                  width={110}
                  height={110}
                  className="object-contain w-auto h-[90px]"
                />
              </motion.div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex-1">
            {/* Main CTA - Daily Review */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 400, damping: 25 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleDailyReview}
              className="w-full mb-3 p-4 rounded-xl text-white flex items-center justify-between group"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">
                    {translate('welcome_action_review', 'Révision du jour')}
                  </div>
                  <div className="text-xs opacity-90">
                    {totalCount > 0
                      ? translate('welcome_review_subtitle', '{count} cartes t\'attendent', { count: totalCount })
                      : translate('welcome_no_cards', 'Rien à réviser !')
                    } {totalCount > 0 && `• ~${Math.max(1, Math.round(totalCount * 0.5))} min`}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white/80 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-3">
              {/* Upload - Drop zone style */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 400, damping: 25 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="welcome-upload-input"
                />
                <label
                  htmlFor="welcome-upload-input"
                  className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer h-full ${
                    isDark
                      ? 'bg-neutral-700/30 border-neutral-600 hover:border-orange-500/50 hover:bg-neutral-700/50'
                      : 'bg-orange-50/50 border-orange-200 hover:border-orange-400 hover:bg-orange-50'
                  } ${isUploading ? 'pointer-events-none opacity-70' : ''}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {isUploading
                      ? translate('welcome_uploading', 'Envoi en cours...')
                      : translate('welcome_action_upload', 'Déposer un cours')
                    }
                  </span>
                </label>
              </motion.div>

              {/* Challenge */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, type: 'spring', stiffness: 400, damping: 25 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleChallenge}
                className={`relative flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${
                  isDark
                    ? 'bg-neutral-700/50 border-neutral-600 hover:border-orange-500/50'
                    : 'bg-gray-50 border-gray-200 hover:border-orange-300 hover:shadow-sm'
                }`}
              >
                {/* Badge Nouveau */}
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-semibold text-white rounded-full bg-orange-500">
                  {translate('welcome_new_badge', 'Nouveau !')}
                </span>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: '#f97316' }}
                >
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {translate('welcome_action_challenge', 'Lancer un défi')}
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {showChallengeModal && (
        <ChallengeModal onClose={() => setShowChallengeModal(false)} />
      )}

      {showReviewModal && (
        <ReviewSelectModal onClose={() => setShowReviewModal(false)} />
      )}

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
    </>
  );
}
