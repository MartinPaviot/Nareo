'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Layers, Play, RefreshCw, BookOpen, FolderInput, FolderMinus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Course } from '@/lib/courses/types';
import { useSmartCTA } from '@/hooks/useSmartCTA';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { getMasteryColor, getFreshnessConfig, formatDaysSince } from '@/lib/courses/utils';
import CourseActionsMenu from './CourseActionsMenu';

interface CourseCardProps {
  course: Course;
  onClick: () => void;
  folderId?: string | null;
  showActions?: boolean;
}

export default function CourseCard({ course, onClick, folderId, showActions = true }: CourseCardProps) {
  const { isDark } = useTheme();
  const { smartCTA, isLoading: ctaLoading } = useSmartCTA(course.id);
  const { folders, moveCourse } = useCoursesOrganized();
  const [showMoveModal, setShowMoveModal] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const availableFolders = folders.filter(f => f.id !== folderId);

  const handleTouchStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowMoveModal(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!isLongPress.current) {
      onClick();
    }
    isLongPress.current = false;
  }, [onClick]);

  const handleMoveTo = async (targetFolderId: string | null) => {
    await moveCourse(course.id, targetFolderId);
    setShowMoveModal(false);
  };

  const freshnessConfig = getFreshnessConfig(course.days_since_study);
  const masteryColor = getMasteryColor(course.mastery_percentage);
  const masteryPercentage = Math.round(course.mastery_percentage);

  // Get CTA icon
  const getCTAIcon = () => {
    if (!smartCTA) return ArrowRight;
    switch (smartCTA.type) {
      case 'flashcards': return Layers;
      case 'start_chapter': return Play;
      case 'continue_chapter': return ArrowRight;
      case 'review': return RefreshCw;
      default: return ArrowRight;
    }
  };

  const CTAIcon = getCTAIcon();

  return (
    <>
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      className={`rounded-xl p-4 border cursor-pointer transition-all ${
        isDark
          ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:shadow-lg'
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}
    >
      {/* Top row: Title + Actions + Freshness */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium truncate ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
            {course.name}
          </h3>
          {course.current_chapter && (
            <p className={`text-sm mt-0.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              Ch.{course.current_chapter.chapter_number} en cours
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Actions menu */}
          {showActions && (
            <CourseActionsMenu
              courseId={course.id}
              courseName={course.name}
              currentFolderId={folderId}
            />
          )}

          {/* Freshness indicator */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: freshnessConfig.bgColor,
              color: freshnessConfig.color,
            }}
          >
            {formatDaysSince(course.days_since_study)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            Maîtrise
          </span>
          <span className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {masteryPercentage}%
          </span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${masteryPercentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: masteryColor }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <BookOpen className={`w-4 h-4 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
            <span className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {course.mastered_chapters}/{course.total_chapters} chapitres
            </span>
          </div>
          {course.cards_to_review > 0 && (
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-purple-500 font-medium">
                {course.cards_to_review} cartes
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CTA Button */}
      <button
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {ctaLoading ? (
          <span>Chargement...</span>
        ) : (
          <>
            <span>{smartCTA?.label || 'Continuer'}</span>
            <CTAIcon className="w-4 h-4" />
          </>
        )}
      </button>
    </motion.div>

    {/* Move modal (appears on long press) */}
    <AnimatePresence>
      {showMoveModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMoveModal(false)}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 bottom-4 z-50 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80"
          >
            <div className={`rounded-2xl shadow-xl overflow-hidden ${
              isDark ? 'bg-neutral-900' : 'bg-white'
            }`}>
              {/* Header */}
              <div className={`px-4 py-3 border-b ${
                isDark ? 'border-neutral-800' : 'border-gray-100'
              }`}>
                <h3 className={`font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                  Déplacer "{course.name}"
                </h3>
              </div>

              {/* Options */}
              <div className="max-h-64 overflow-y-auto">
                {/* Remove from folder option if in a folder */}
                {folderId && (
                  <button
                    onClick={() => handleMoveTo(null)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                      isDark
                        ? 'hover:bg-neutral-800 text-orange-400'
                        : 'hover:bg-orange-50 text-orange-600'
                    }`}
                  >
                    <FolderMinus className="w-5 h-5" />
                    <span className="font-medium">Retirer du dossier</span>
                  </button>
                )}

                {/* Divider */}
                {folderId && availableFolders.length > 0 && (
                  <div className={`h-px ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`} />
                )}

                {/* Folder options */}
                {availableFolders.length > 0 ? (
                  availableFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleMoveTo(folder.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                        isDark
                          ? 'hover:bg-neutral-800 text-neutral-200'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${folder.color}30` }}
                      >
                        {folder.icon || '📁'}
                      </div>
                      <span>{folder.name}</span>
                    </button>
                  ))
                ) : !folderId ? (
                  <div className={`px-4 py-3 text-sm ${
                    isDark ? 'text-neutral-500' : 'text-gray-400'
                  }`}>
                    Créez d'abord un dossier pour organiser vos cours
                  </div>
                ) : null}
              </div>

              {/* Cancel button */}
              <div className={`px-4 py-3 border-t ${
                isDark ? 'border-neutral-800' : 'border-gray-100'
              }`}>
                <button
                  onClick={() => setShowMoveModal(false)}
                  className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
                    isDark
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
