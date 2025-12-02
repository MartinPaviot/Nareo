'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { X } from 'lucide-react';

export default function FeedbackWidget() {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const pathname = usePathname();

  // Hide widget on home page and quiz pages
  const isHiddenPage = pathname === '/' || pathname.includes('/chapters/');

  useEffect(() => {
    // Reset visibility on page change (no localStorage check)
    setIsVisible(false);
    setIsClosing(false);

    // Don't show widget on hidden pages
    if (isHiddenPage) return;

    // Show widget with a slight delay for smooth appearance
    setTimeout(() => {
      setIsVisible(true);
    }, 1000);
  }, [pathname, isHiddenPage]); // Re-run when pathname changes

  const handleClose = () => {
    // Start closing animation
    setIsClosing(true);
    
    // Hide after animation completes (temporary, will reappear on page change)
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  };

  const handleFeedbackClick = () => {
    window.open(
      'https://docs.google.com/forms/d/e/1FAIpQLSeJf1Q2m4zCKkrFXTADxEGSmsSIdRppEVl5_XBpqpibJh7NFw/viewform',
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50
        transition-all duration-300 ease-out
        ${isClosing 
          ? 'opacity-0 translate-y-4 scale-95' 
          : 'opacity-100 translate-y-0 scale-100'
        }
      `}
      style={{
        animation: isClosing ? 'none' : 'feedbackSlideIn 0.5s ease-out'
      }}
    >
      {/* Widget Card */}
      <div className="relative bg-gradient-to-br from-white to-orange-50/30 rounded-2xl shadow-2xl border border-orange-100/50 p-5 max-w-sm backdrop-blur-sm">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full hover:bg-orange-100/50 transition-colors duration-200 group"
          aria-label="Fermer"
        >
          <X className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </button>

        {/* Content Container */}
        <div className="flex items-center gap-3">
          {/* Mascot */}
          <div className="flex-shrink-0">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-orange-50 ring-2 ring-orange-200/50 flex items-center justify-center">
              <Image
                src="/chat/Happy.png"
                alt="Nareo"
                width={84}
                height={84}
                className="object-contain"
              />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900 mb-2 leading-tight">
              Aide-nous à améliorer l'appli
            </h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Donne-nous ton avis en 30 secondes
            </p>

            {/* CTA Button */}
            <button
              onClick={handleFeedbackClick}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Donner mon avis
            </button>
          </div>
        </div>
      </div>

      {/* Custom animation keyframes */}
      <style jsx>{`
        @keyframes feedbackSlideIn {
          from {
            opacity: 0;
            transform: translateX(100px) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
