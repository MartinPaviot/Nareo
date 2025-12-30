'use client';

import { Calendar, Clock, User, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import TopBarActions from '@/components/layout/TopBarActions';

interface ArticleHeaderProps {
  title: string;
  category: string;
  readTime: number;
  author: string;
  createdAt: string;
}

export default function ArticleHeader({
  title,
  category,
  readTime,
  author,
  createdAt,
}: ArticleHeaderProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate, currentLanguage } = useLanguage();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locales: Record<string, string> = {
      fr: 'fr-FR',
      en: 'en-US',
      de: 'de-DE',
    };
    return date.toLocaleDateString(locales[currentLanguage] || 'fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <>
      {/* Navigation Header */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-sm border-b flex items-center justify-between px-4 py-2 sm:px-6 ${
          isDark
            ? 'bg-neutral-900/95 border-neutral-800'
            : 'bg-gradient-to-b from-orange-50 to-white/95 border-orange-100/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/blog')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-neutral-800 text-neutral-300'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">
              {translate('blog_title') || 'Blog'}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <TopBarActions />
        </div>
      </header>

      {/* Article Header */}
      <div className="px-4 sm:px-6 pt-8 pb-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Category Badge */}
          <div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                isDark
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {category}
            </span>
          </div>

          {/* Title */}
          <h1
            className={`text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight ${
              isDark ? 'text-neutral-50' : 'text-gray-900'
            }`}
          >
            {title}
          </h1>

          {/* Meta Information */}
          <div
            className={`flex flex-wrap items-center gap-4 text-sm ${
              isDark ? 'text-neutral-400' : 'text-gray-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(createdAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {readTime} min
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
