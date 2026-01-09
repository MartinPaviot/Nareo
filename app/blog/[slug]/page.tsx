'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ArticleHeader from '@/components/blog/ArticleHeader';
import ArticleContent from '@/components/blog/ArticleContent';
import ArticleCTA from '@/components/blog/ArticleCTA';
import ShareButtons from '@/components/blog/ShareButtons';
import type { BlogArticle } from '@/types/blog';
import { getLocalizedTitle, getLocalizedContent } from '@/types/blog';

export default function BlogArticlePage() {
  const params = useParams();
  const router = useRouter();
  const { isDark } = useTheme();
  const { currentLanguage } = useLanguage();

  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = params?.slug as string;

  useEffect(() => {
    if (!slug) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/blog/${slug}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || 'Article not found');
          return;
        }

        setArticle(data.article);
      } catch (err) {
        console.error('Error fetching article:', err);
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

  // Loading state
  if (loading) {
    return (
      <div
        className={`min-h-screen ${
          isDark
            ? 'bg-neutral-950'
            : 'bg-gradient-to-b from-orange-50 via-white to-orange-50'
        }`}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div
              className={`w-12 h-12 border-4 border-t-orange-500 rounded-full animate-spin mx-auto ${
                isDark ? 'border-neutral-700' : 'border-gray-200'
              }`}
            />
            <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
              Chargement...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !article) {
    return (
      <div
        className={`min-h-screen ${
          isDark
            ? 'bg-neutral-950'
            : 'bg-gradient-to-b from-orange-50 via-white to-orange-50'
        }`}
      >
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="text-center space-y-6">
            <Image
              src="/chat/mascotte.png"
              alt="Nareo"
              width={120}
              height={120}
              className="mx-auto opacity-50"
            />
            <h1
              className={`text-2xl font-bold ${
                isDark ? 'text-neutral-200' : 'text-gray-900'
              }`}
            >
              Article non trouvé
            </h1>
            <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
              {error || "Cet article n'existe pas ou a été supprimé."}
            </p>
            <button
              onClick={() => router.push('/blog')}
              className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
            >
              Retour au blog
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get localized content
  const language = currentLanguage as 'fr' | 'en' | 'de';
  const title = getLocalizedTitle(article, language);
  const content = getLocalizedContent(article, language);

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? 'bg-neutral-950'
          : 'bg-gradient-to-b from-orange-50 via-white to-orange-50'
      }`}
    >
      {/* Header */}
      <ArticleHeader
        title={title}
        category={article.category}
        readTime={article.read_time}
        author={article.author}
        createdAt={article.created_at}
      />

      {/* Content */}
      <main className="px-4 sm:px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          {/* Featured Image Placeholder */}
          {article.image_url && (
            <div
              className={`aspect-video relative rounded-2xl overflow-hidden mb-8 ${
                isDark ? 'bg-neutral-800' : 'bg-gray-100'
              }`}
            >
              <Image
                src={article.image_url}
                alt={title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Article Content */}
          <ArticleContent content={content} />

          {/* CTA */}
          <ArticleCTA />

          {/* Share Section */}
          <ShareButtons title={title} slug={slug} />
        </div>
      </main>
    </div>
  );
}
