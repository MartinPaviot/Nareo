'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { trackEvent } from '@/lib/posthog';
import UploadLimitModal from './UploadLimitModal';
import DuplicateCourseModal from './DuplicateCourseModal';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const MAX_IMAGES = 6;

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone() {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadLimitModal, setShowUploadLimitModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    filename: string;
    existingCourseTitle: string;
    existingCourseDate: string;
  } | null>(null);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const selected = Array.from(incoming).filter((file) =>
      ACCEPTED_TYPES.includes(file.type)
    );

    if (selected.length === 0) {
      setError(translate('upload_error_state'));
      return;
    }

    // Separate images and documents from incoming files
    const incomingImages = selected.filter((f) => f.type.startsWith('image/'));
    const incomingDocuments = selected.filter((f) => !f.type.startsWith('image/'));

    // Check existing files
    const existingImages = files.filter((f) => f.type.startsWith('image/'));
    const existingDocuments = files.filter((f) => !f.type.startsWith('image/'));

    // Rule: Only 1 document allowed (PDF, DOCX) OR multiple images (max 6)
    // Cannot mix documents and images

    // If user already has a document and tries to add more files
    if (existingDocuments.length > 0) {
      if (incomingDocuments.length > 0 || incomingImages.length > 0) {
        setError(translate('upload_error_document_exists') || 'Vous avez déjà sélectionné un document. Supprimez-le pour en choisir un autre.');
        return;
      }
    }

    // If user already has images and tries to add a document
    if (existingImages.length > 0 && incomingDocuments.length > 0) {
      setError(translate('upload_error_mixed_types') || 'Vous avez déjà des images sélectionnées. Supprimez-les pour ajouter un document.');
      return;
    }

    // Cannot mix documents and images in the same selection
    if (incomingDocuments.length > 0 && incomingImages.length > 0) {
      setError(translate('upload_error_mixed_types') || 'Veuillez sélectionner soit un document, soit des images, mais pas les deux.');
      return;
    }

    // Only 1 document allowed
    if (incomingDocuments.length > 1) {
      setError(translate('upload_error_one_document') || 'Vous ne pouvez sélectionner qu\'un seul document (PDF ou DOCX) à la fois.');
      return;
    }

    // Calculate total images (existing + incoming)
    const totalImages = existingImages.length + incomingImages.length;
    if (totalImages > MAX_IMAGES) {
      setError(translate('upload_limit_images') || `Vous ne pouvez pas ajouter plus de ${MAX_IMAGES} images.`);
      return;
    }

    // Set files: either 1 document or up to 6 images
    if (incomingDocuments.length === 1) {
      setFiles([incomingDocuments[0]]);
    } else if (incomingImages.length > 0) {
      // Add incoming images to existing images
      const newImages = [...existingImages, ...incomingImages].slice(0, MAX_IMAGES);
      setFiles(newImages);
    }
    setError(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleStart = async () => {
    if (!files.length) {
      setError(translate('upload_action_waiting'));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Check for duplicate course (only for authenticated users and if not already confirmed)
      if (user && !skipDuplicateCheck) {
        const checkResponse = await fetch('/api/courses/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: files[0].name }),
          credentials: 'include',
        });
        const checkData = await checkResponse.json();

        if (checkData.isDuplicate && checkData.existingCourse) {
          setDuplicateInfo({
            filename: files[0].name,
            existingCourseTitle: checkData.existingCourse.title,
            existingCourseDate: checkData.existingCourse.createdAt,
          });
          setIsProcessing(false);
          return;
        }
      }

      await performUpload();
    } catch (uploadError) {
      console.error('Upload error', uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : translate('upload_error_state')
      );
      setIsProcessing(false);
    }
  };

  const performUpload = async () => {
    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        // Check if it's an upload limit error
        if (data?.code === 'UPLOAD_LIMIT_REACHED') {
          setShowUploadLimitModal(true);
          setIsProcessing(false);
          return;
        }
        throw new Error(data?.error || 'Upload failed');
      }

      trackEvent('upload_success', { userId: user?.id, courseId: data.courseId });
      router.push(`/courses/${data.courseId}/learn`);
    } catch (uploadError) {
      console.error('Upload error', uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : translate('upload_error_state')
      );
    } finally {
      setIsProcessing(false);
      setSkipDuplicateCheck(false);
    }
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateInfo(null);
    setSkipDuplicateCheck(true);
    setIsProcessing(true);
    await performUpload();
  };

  const handleDuplicateCancel = () => {
    setDuplicateInfo(null);
    setSkipDuplicateCheck(false);
  };

  const handleRemove = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const renderStateBadge = () => {
    if (isProcessing) {
      return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold ${
          isDark
            ? 'text-orange-400 bg-orange-950/50 border border-orange-800/50'
            : 'text-orange-700 bg-orange-50 border border-orange-100'
        }`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          {translate('upload_processing_title')}
        </div>
      );
    }
    if (files.length) {
      return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold ${
          isDark
            ? 'text-green-400 bg-green-950/50 border border-green-800/50'
            : 'text-green-700 bg-green-50 border border-green-100'
        }`}>
          <CheckCircle2 className="w-4 h-4" />
          {translate('upload_after_state_title')}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`rounded-3xl shadow-lg p-4 sm:p-6 ${
      isDark
        ? 'bg-neutral-900 border border-neutral-800'
        : 'bg-white border border-orange-100'
    }`}>
      {/* Header - Title and subtitle with formats */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className={`text-base font-bold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
            {translate('home_upload_title')}{' '}
            <span className="relative inline-block">
              <span className="relative z-10">{translate('home_upload_title_highlight')}</span>
              <span className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-r from-orange-300 to-amber-300 -z-0 rounded-sm"></span>
            </span>
          </h2>
          {renderStateBadge()}
        </div>
        <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          {translate('home_upload_helper')}
        </p>
      </div>

      {/* Main dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`block border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
          isDragging
            ? isDark
              ? 'border-orange-500 bg-orange-950/30'
              : 'border-orange-400 bg-orange-50'
            : isDark
              ? 'border-neutral-700 bg-neutral-800 hover:border-orange-500/50'
              : 'border-gray-200 bg-gray-50 hover:border-orange-300'
        } ${isProcessing ? 'opacity-75 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
            <Upload className="w-6 h-6" />
          </div>

          {/* Dropzone hint */}
          <p className={`text-base font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
            {translate('home_upload_drop_text')}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center w-full max-w-sm">
            {/* Main button - always visible */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
              className="px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              {translate('home_upload_choose_file')}
            </button>

            {/* Camera button - mobile only */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                cameraInputRef.current?.click();
              }}
              className={`md:hidden px-6 py-3 rounded-xl border-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                isDark
                  ? 'border-neutral-600 text-neutral-300 hover:border-orange-500/50 hover:text-orange-400'
                  : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600'
              }`}
            >
              <Camera className="w-4 h-4" />
              {translate('home_upload_use_camera')}
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Helper text for camera - mobile only */}
          <p className={`md:hidden text-xs mt-2 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            {translate('home_upload_camera_helper')}
          </p>
        </div>
      </label>

      {/* Small footer text */}
      <p className={`text-xs mt-3 text-center ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
        {translate('home_upload_limit')}
      </p>

      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-semibold ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
              {translate('upload_selected_files')}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`text-xs font-semibold ${isDark ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-700'}`}
            >
              {translate('upload_replace_files')}
            </button>
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.name}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  isDark
                    ? 'border-neutral-700 bg-neutral-800'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
                  <div>
                    <p className={`text-sm font-semibold line-clamp-1 ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                      {file.name}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                      {file.type || 'file'} - {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(file.name)}
                  className={`p-1 rounded-full ${isDark ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'}`}
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleStart}
          disabled={isProcessing || !files.length}
          className="flex-1 inline-flex items-center justify-center gap-2 h-[60px] sm:h-12 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {translate('upload_processing_title')}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {files.length ? translate('home_upload_cta_selected') : translate('home_hero_cta_primary')}
            </>
          )}
        </button>
        <div className={`flex-1 sm:flex-none sm:w-48 h-[60px] sm:h-12 inline-flex items-center justify-center rounded-xl border text-sm ${
          isDark
            ? 'border-neutral-700 text-neutral-300 bg-neutral-800'
            : 'border-gray-200 text-gray-700 bg-white'
        }`}>
          {files.length ? translate('upload_after_state_title') : translate('upload_action_waiting')}
        </div>
      </div>

      {error && (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${
          isDark
            ? 'border-red-800/50 bg-red-950/30 text-red-400'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          <p className="font-semibold mb-1">{translate('upload_error_state')}</p>
          <p>{error || translate('upload_error_state_help')}</p>
        </div>
      )}

      {isProcessing && (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${
          isDark
            ? 'border-orange-800/50 bg-orange-950/30 text-orange-400'
            : 'border-orange-100 bg-orange-50 text-orange-800'
        }`}>
          <p className="font-semibold">{translate('upload_processing_title')}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-orange-500' : 'text-orange-700'}`}>
            {translate('upload_processing_subtitle')}
          </p>
        </div>
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
    </div>
  );
}
