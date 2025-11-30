'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import TopBarActions from '@/components/layout/TopBarActions';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';
import { HomeTestimonials } from '@/components/home/Testimonials';

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

export default function HomePage() {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    trackEvent('page_home_viewed', { userId: user?.id });
  }, [user]);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const selected = Array.from(incoming).filter((file) =>
      ACCEPTED_TYPES.includes(file.type)
    );

    const imageCount = selected.filter((f) => f.type.startsWith('image/')).length;
    if (imageCount > MAX_IMAGES) {
      setError(translate('upload_limit_images'));
      return;
    }

    if (selected.length === 0) {
      setError(translate('upload_error_state'));
      return;
    }

    setFiles(selected.slice(0, MAX_IMAGES));
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
      const formData = new FormData();
      formData.append('file', files[0]);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Upload failed');
      }

      trackEvent('upload_success', { userId: user?.id, courseId: data.courseId });
      // Toujours utiliser le courseId réel (public si invité)
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
    }
  };

  const handleRemove = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
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
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-full text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {translate('upload_after_state_title')}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-orange-50">
      <header className="sticky top-0 z-50 bg-gradient-to-b from-orange-50 to-white/95 backdrop-blur-sm border-b border-orange-100/50 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo Mascotte"
            width={100}
            height={100}
            className="rounded-2xl"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Nareo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!user && (
            <>
              <button
                onClick={() => router.push('/auth/signin')}
                className="hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {translate('auth_signin_button')}
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
              >
                {translate('auth_signup_button')}
              </button>
            </>
          )}
          <TopBarActions />
        </div>
      </header>

      <main className="px-4 sm:px-6 pb-12 pt-8">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Hero section: left content + larger right card for visual balance */}
          <section className="flex flex-col lg:flex-row items-center gap-10 mb-12">
            <div className="flex-1 space-y-5 text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-snug">
                {translate('home_hero_title')}
              </h1>
              <p className="text-xl text-gray-700">
                {translate('home_hero_subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                <button
                  onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 shadow-md"
                >
                  {translate('home_hero_cta_primary')}
                </button>
                <button
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl border border-orange-200 text-orange-700 font-semibold bg-white hover:bg-orange-50"
                >
                  {translate('home_hero_cta_secondary')}
                </button>
              </div>
            </div>
            <div className="flex-1 w-full">
              {/* Hero right card: mascot center-left, benefits right in single row */}
              <div className="w-full rounded-3xl border border-orange-100 shadow-xl bg-white px-4 py-6 md:px-6 md:py-8">
                <div className="flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-6">
                  <div className="flex justify-center md:justify-start flex-shrink-0">
                    <Image
                      src="/chat/mascotte.png"
                      alt="Nareo mascot"
                      width={160}
                      height={160}
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="flex flex-col md:flex-col gap-2 md:gap-3 w-full">
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 md:px-4 md:py-2.5 rounded-full bg-white border border-orange-100 text-sm md:text-base font-semibold text-orange-700 shadow-sm whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      {translate('home_hero_tag1')}
                    </span>
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 md:px-4 md:py-2.5 rounded-full bg-white border border-orange-100 text-sm md:text-base font-semibold text-orange-700 shadow-sm whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      {translate('home_hero_tag2')}
                    </span>
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 md:px-4 md:py-2.5 rounded-full bg-white border border-orange-100 text-sm md:text-base font-semibold text-orange-700 shadow-sm whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      {translate('home_hero_tag3')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="mt-12 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">
                {translate('home_hiw_label')}
              </p>
              <h2 className="text-2xl font-bold text-gray-900">
                {translate('home_hiw_title')}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-left space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold">1</div>
                <p className="text-lg font-semibold text-gray-900">{translate('home_hiw_step1_title')}</p>
                <p className="text-sm text-gray-600">{translate('home_hiw_step1_desc')}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-left space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold">2</div>
                <p className="text-lg font-semibold text-gray-900">{translate('home_hiw_step2_title')}</p>
                <p className="text-sm text-gray-600">{translate('home_hiw_step2_desc')}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-left space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold">3</div>
                <p className="text-lg font-semibold text-gray-900">{translate('home_hiw_step3_title')}</p>
                <p className="text-sm text-gray-600">{translate('home_hiw_step3_desc')}</p>
              </div>
            </div>
          </section>

          {/* Upload area */}
          <section id="upload" className="grid lg:grid-cols-1 gap-6 items-start">
            <div className="bg-white/80 backdrop-blur rounded-3xl border border-orange-100 shadow-lg p-4 sm:p-6">
              {/* Header - Title and subtitle with formats */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900">{translate('home_upload_title')}</h2>
                  {renderStateBadge()}
                </div>
                <p className="text-sm text-gray-600">
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
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
                    <Upload className="w-8 h-8" />
                  </div>

                  {/* Dropzone hint */}
                  <p className="text-base font-semibold text-gray-900">
                    {translate('home_upload_drop_text')}
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-sm">
                    {/* Main button - always visible */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }}
                      className="px-6 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
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
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>

                  {/* Helper text for camera - mobile only */}
                  <p className="md:hidden text-xs text-gray-500 mt-2">
                    {translate('home_upload_camera_helper')}
                  </p>
                </div>
              </label>

              {/* Small footer text */}
              <p className="text-xs text-gray-400 mt-3 text-center">
                {translate('home_upload_limit')}
              </p>

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

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleStart}
                  disabled={isProcessing || !files.length}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
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
                <div className="sm:w-48 h-12 inline-flex items-center justify-center rounded-xl border border-gray-200 text-sm text-gray-700 bg-white">
                  {files.length ? translate('upload_after_state_title') : translate('upload_action_waiting')}
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-semibold mb-1">{translate('upload_error_state')}</p>
                  <p>{error || translate('upload_error_state_help')}</p>
                </div>
              )}

              {isProcessing && (
                <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-3 text-sm text-orange-800">
                  <p className="font-semibold">{translate('upload_processing_title')}</p>
                  <p className="text-xs text-orange-700 mt-1">
                    {translate('upload_processing_subtitle')}
                  </p>
                </div>
              )}

            </div>
          </section>

          {/* Why quizzes */}
          <section className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_why_title')}</h2>
              <p className="text-sm text-gray-600">{translate('home_why_intro')}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 space-y-2">
                  <p className="text-lg font-semibold text-gray-900">{translate(`home_why_point${i}_title` as const)}</p>
                  <p className="text-sm text-gray-600">{translate(`home_why_point${i}_desc` as const)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Preview before/after */}
          <section className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_preview_title')}</h2>
              <p className="text-sm text-gray-600">{translate('home_preview_subtitle')}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-5 space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-orange-600 font-semibold">
                  <FileText className="w-5 h-5" />
                  <span>{translate('home_preview_left_title')}</span>
                </div>
                <p className="text-sm text-gray-600">{translate('home_preview_left_desc')}</p>
                <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="w-12 h-14 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-700 font-bold">
                    PDF
                  </div>
                  <div className="text-xs text-gray-600">
                    <p>Course_Pack.pdf</p>
                    <p>78 pages</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-orange-100 bg-white shadow-sm p-5 space-y-3 flex flex-col">
                <div className="flex items-center gap-2 text-orange-600 font-semibold">
                  <Sparkles className="w-5 h-5" />
                  <span>{translate('home_preview_right_title')}</span>
                </div>
                <p className="text-sm text-gray-600">{translate('home_preview_right_desc')}</p>
                <div className="space-y-2">
                  {[1, 2, 3].map((q) => (
                    <div key={q} className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs text-gray-800">
                      <p className="font-semibold">Quiz Q{q}</p>
                      <ul className="list-disc list-inside text-[11px] text-gray-700 space-y-1">
                        <li>Option A</li>
                        <li>Option B</li>
                        <li>Option C</li>
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Subjects coverage */}
          <section className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_subjects_title')}</h2>
              <p className="text-sm text-gray-600">{translate('home_subjects_subtitle')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="inline-flex items-center gap-3 rounded-2xl border border-orange-100 bg-white shadow-sm px-4 py-3 text-sm text-gray-800">
                  <CheckCircle2 className="w-4 h-4 text-orange-600" />
                  <span>{translate(`home_subjects_item${i}` as const)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Testimonials */}
          <HomeTestimonials />

          {/* Final CTA */}
          <section className="rounded-3xl bg-orange-500 text-white shadow-xl p-8 text-center space-y-3">
            <h2 className="text-2xl font-bold">{translate('home_final_title')}</h2>
            <p className="text-sm opacity-90">{translate('home_final_subtitle')}</p>
            <div className="flex justify-center">
              <button
                onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-white text-orange-600 font-semibold hover:bg-orange-50 shadow-md"
              >
                {translate('home_final_cta')}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
