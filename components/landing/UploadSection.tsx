'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { trackEvent } from '@/lib/posthog';
import ExtractionLoader from '@/components/course/ExtractionLoader';

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

// Cookie utilities for guest session
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number = 30): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return '';

  let guestSessionId = getCookie('guestSessionId') || localStorage.getItem('guestSessionId');

  if (!guestSessionId) {
    guestSessionId = crypto.randomUUID();
  }

  setCookie('guestSessionId', guestSessionId, 30);
  localStorage.setItem('guestSessionId', guestSessionId);

  return guestSessionId;
}

interface UploadSectionProps {
  translate: (key: string) => string;
  onCtaClick: (ctaName: string, destination?: string) => void;
  userId?: string;
}

export function UploadSection({ translate, onCtaClick, userId }: UploadSectionProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCamera, setIsFromCamera] = useState(false);
  const [uploadedCourseId, setUploadedCourseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (incoming: FileList | null, source: 'drop' | 'file_picker' | 'camera' = 'file_picker') => {
    if (!incoming) return;

    const allFiles = Array.from(incoming);
    const selected = allFiles.filter((file) => ACCEPTED_TYPES.includes(file.type));
    const rejected = allFiles.filter((file) => !ACCEPTED_TYPES.includes(file.type));

    trackEvent('home_file_selected', {
      userId,
      source,
      totalFiles: allFiles.length,
      acceptedFiles: selected.length,
      rejectedFiles: rejected.length,
      fileTypes: allFiles.map((f) => f.type),
      fileSizes: allFiles.map((f) => f.size),
      totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
    });

    if (selected.length === 0) {
      trackEvent('home_file_error', {
        userId,
        errorType: 'invalid_format',
        attemptedTypes: allFiles.map((f) => f.type),
      });
      setError(translate('upload_error_state'));
      return;
    }

    const incomingImages = selected.filter((f) => f.type.startsWith('image/'));
    const incomingDocuments = selected.filter((f) => !f.type.startsWith('image/'));
    const existingImages = files.filter((f) => f.type.startsWith('image/'));
    const existingDocuments = files.filter((f) => !f.type.startsWith('image/'));

    if (existingDocuments.length > 0) {
      if (incomingDocuments.length > 0 || incomingImages.length > 0) {
        setError(translate('upload_error_document_exists') || 'Vous avez déjà sélectionné un document. Supprimez-le pour en choisir un autre.');
        return;
      }
    }

    if (existingImages.length > 0 && incomingDocuments.length > 0) {
      setError(translate('upload_error_mixed_types') || 'Vous avez déjà des images sélectionnées. Supprimez-les pour ajouter un document.');
      return;
    }

    if (incomingDocuments.length > 0 && incomingImages.length > 0) {
      setError(translate('upload_error_mixed_types') || 'Veuillez sélectionner soit un document, soit des images, mais pas les deux.');
      return;
    }

    if (incomingDocuments.length > 1) {
      setError(translate('upload_error_one_document') || 'Vous ne pouvez sélectionner qu\'un seul document (PDF ou DOCX) à la fois.');
      return;
    }

    const totalImages = existingImages.length + incomingImages.length;
    if (totalImages > MAX_IMAGES) {
      setError(translate('upload_limit_images') || `Vous ne pouvez pas ajouter plus de ${MAX_IMAGES} images.`);
      return;
    }

    let newFiles: File[] = [];
    if (incomingDocuments.length === 1) {
      newFiles = [incomingDocuments[0]];
    } else if (incomingImages.length > 0) {
      newFiles = [...existingImages, ...incomingImages].slice(0, MAX_IMAGES);
    }

    setFiles(newFiles);
    setError(null);

    const cameraSource = source === 'camera';
    setIsFromCamera(cameraSource);

    if (!cameraSource && newFiles.length > 0) {
      setTimeout(() => {
        handleStartWithFiles(newFiles);
      }, 100);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    trackEvent('home_file_dropped', { userId });
    handleFiles(event.dataTransfer.files, 'drop');
  };

  const handleDragEnter = () => {
    if (!isDragging) {
      trackEvent('home_drag_started', { userId });
    }
    setIsDragging(true);
  };

  const handleStartWithFiles = async (filesToUpload: File[]) => {
    if (!filesToUpload.length) return;

    const uploadStartTime = Date.now();
    const file = filesToUpload[0];

    trackEvent('home_upload_started', {
      userId,
      isGuest: !userId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      autoTriggered: true,
    });

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (!userId) {
        const guestSessionId = getOrCreateGuestSessionId();
        formData.append('guestSessionId', guestSessionId);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();
      const uploadDuration = Date.now() - uploadStartTime;

      if (!response.ok) {
        trackEvent('home_upload_failed', {
          userId,
          isGuest: !userId,
          error: data?.error,
          statusCode: response.status,
          uploadDurationMs: uploadDuration,
        });
        throw new Error(data?.error || 'Upload failed');
      }

      trackEvent('home_upload_success', {
        userId,
        isGuest: !userId,
        courseId: data.courseId,
        uploadDurationMs: uploadDuration,
        fileType: file.type,
        fileSize: file.size,
      });

      // Show ExtractionLoader with GIFs instead of redirecting immediately
      setUploadedCourseId(data.courseId);
    } catch (uploadError) {
      console.error('Upload error', uploadError);
      const errorMessage = uploadError instanceof Error ? uploadError.message : translate('upload_error_state');
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStart = async () => {
    if (!files.length) {
      trackEvent('home_upload_clicked_empty', { userId });
      setError(translate('upload_action_waiting'));
      return;
    }
    await handleStartWithFiles(files);
  };

  const handleRemove = (name: string) => {
    trackEvent('home_file_removed', {
      userId,
      fileName: name,
      remainingFiles: files.length - 1,
    });
    setFiles((prev) => {
      const newFiles = prev.filter((f) => f.name !== name);
      if (newFiles.length === 0) {
        setIsFromCamera(false);
      }
      return newFiles;
    });
  };

  const renderStateBadge = () => {
    if (isProcessing) {
      return (
        <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-100 px-3 py-2 rounded-full text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" />
          {translate('upload_processing_title')}
        </div>
      );
    }
    if (files.length) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold" style={{ color: '#379f5a', backgroundColor: 'rgba(55, 159, 90, 0.1)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(55, 159, 90, 0.2)' }}>
          <CheckCircle2 className="w-4 h-4" />
          {translate('upload_after_state_title')}
        </div>
      );
    }
    return null;
  };

  // Callback for extraction completion - must be stable to avoid re-renders
  const handleExtractionComplete = useCallback(() => {
    if (uploadedCourseId) {
      router.push(`/courses/${uploadedCourseId}/learn`);
    }
  }, [uploadedCourseId, router]);

  // Show ExtractionLoader with GIFs when course is being processed
  if (uploadedCourseId) {
    return (
      <ExtractionLoader
        courseId={uploadedCourseId}
        onComplete={handleExtractionComplete}
      />
    );
  }

  return (
    <section id="upload" className="grid lg:grid-cols-1 gap-6 items-start">
      <div className="relative bg-gradient-to-br from-orange-50 via-white to-amber-50/50 rounded-3xl border-2 border-orange-200 shadow-xl p-4 sm:p-6 overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(255, 117, 31, 0.15)' }}
      >
        {/* Decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">
              {translate('home_upload_title')}{' '}
              <span className="relative inline-block">
                <span className="relative z-10">{translate('home_upload_title_highlight')}</span>
                <span className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-r from-orange-300 to-amber-300 -z-0 rounded-sm"></span>
              </span>
            </h2>
            {renderStateBadge()}
          </div>
          <p className="text-xs text-gray-600">
            {translate('home_upload_helper')}
          </p>
        </div>

        {/* Main dropzone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            handleDragEnter();
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`block border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
            isDragging
              ? 'border-orange-400 bg-orange-50'
              : 'border-gray-200 bg-gray-50/80 hover:border-orange-300'
          } ${isProcessing ? 'opacity-75 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files, 'file_picker')}
          />
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
            {/* Icon with glow ring */}
            <div className="relative">
              <div className="absolute inset-0 bg-orange-400/30 rounded-2xl blur-xl animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ring-4 ring-orange-500/20 ring-offset-2 ring-offset-orange-50" style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)' }}>
                <Upload className="w-7 h-7" />
              </div>
            </div>

            {/* Dropzone hint */}
            <p className="text-base font-semibold text-gray-900">
              {translate('home_upload_drop_text')}
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 justify-center w-full max-w-sm">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onCtaClick('upload_choose_file');
                  fileInputRef.current?.click();
                }}
                className="px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02]"
                style={{
                  backgroundColor: '#ff751f',
                  boxShadow: '0 8px 20px -4px rgba(255, 117, 31, 0.35)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5681b';
                  e.currentTarget.style.boxShadow = '0 12px 25px -4px rgba(255, 117, 31, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff751f';
                  e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(255, 117, 31, 0.35)';
                }}
              >
                {translate('home_upload_choose_file')}
              </button>

              {/* Camera button - mobile only */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onCtaClick('upload_use_camera');
                  cameraInputRef.current?.click();
                }}
                className="md:hidden px-6 py-3 rounded-xl border-2 border-gray-300 text-sm font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center justify-center gap-2"
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
                onChange={(e) => handleFiles(e.target.files, 'camera')}
              />
            </div>

            {/* Helper text for camera - mobile only */}
            <p className="md:hidden text-xs text-gray-500 mt-2">
              {translate('home_upload_camera_helper')}
            </p>
          </div>
        </label>

        {files.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">
                {translate('upload_selected_files')}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700"
              >
                {translate('upload_replace_files')}
              </button>
            </div>
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 bg-white"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {file.type || 'file'} - {formatSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(file.name)}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Only show Generate button for camera uploads */}
        {isFromCamera && files.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleStart}
              disabled={isProcessing || !files.length}
              className="flex-1 inline-flex items-center justify-center gap-2 h-[60px] md:h-12 rounded-xl text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {translate('upload_processing_title')}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {translate('home_upload_cta_selected')}
                </>
              )}
            </button>
            <div className="flex-1 h-[60px] md:h-12 inline-flex items-center justify-center rounded-xl border border-gray-200 text-sm text-gray-700 bg-white">
              {translate('upload_after_state_title')}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: 'rgba(217, 26, 28, 0.3)', backgroundColor: '#fff6f3', color: '#d91a1c' }}>
            <p>{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}
