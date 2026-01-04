'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Calendar, Clock, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import TopBarActions from '@/components/layout/TopBarActions';
import NewsletterModal from '@/components/blog/NewsletterModal';
import type { BlogArticle } from '@/types/blog';
import { getLocalizedTitle, getLocalizedExcerpt } from '@/types/blog';

export default function BlogPage() {
  const router = useRouter();
  const { translate, currentLanguage } = useLanguage();
  const { isDark } = useTheme();

  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('/api/blog');
        const data = await response.json();

        if (data.success && data.articles) {
          setArticles(data.articles);
        }
      } catch (error) {
        console.error('Error fetching blog articles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const language = currentLanguage as 'fr' | 'en' | 'de';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locales: Record<string, string> = {
      fr: 'fr-FR',
      en: 'en-US',
      de: 'de-DE',
    };
    return date.toLocaleDateString(locales[currentLanguage] || 'fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-neutral-950' : 'bg-gradient-to-b from-orange-50 via-white to-orange-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-sm border-b flex items-center justify-between px-4 py-2 sm:px-6 ${
        isDark
          ? 'bg-neutral-900/95 border-neutral-800'
          : 'bg-gradient-to-b from-orange-50 to-white/95 border-orange-100/50'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">{translate('back') || 'Retour'}</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <TopBarActions />
        </div>
      </header>

      <main className="px-4 sm:px-6 pb-12 pt-8">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Hero */}
          <section className="text-center space-y-4">
            <h1 className={`text-3xl sm:text-4xl font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('blog_title') || 'Blog'}
            </h1>
            <p className={`text-lg ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('blog_subtitle') || 'Conseils et méthodes pour réviser efficacement'}
            </p>
          </section>

          {/* Loading State */}
          {loading ? (
            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-2xl border overflow-hidden animate-pulse ${
                    isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`aspect-video ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
                  <div className="p-4 space-y-3">
                    <div className={`h-6 rounded ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
                    <div className={`h-4 rounded w-3/4 ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
                    <div className={`h-4 rounded w-1/2 ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
                  </div>
                </div>
              ))}
            </section>
          ) : articles.length > 0 ? (
            /* Articles Grid */
            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <article
                  key={article.id}
                  onClick={() => router.push(`/blog/${article.slug}`)}
                  className={`group rounded-2xl border overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                      : 'bg-white border-gray-200 hover:border-orange-200'
                  }`}
                >
                  {/* Image placeholder */}
                  <div className={`aspect-video relative overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`}>
                    {article.image_url ? (
                      <Image
                        src={article.image_url}
                        alt={getLocalizedTitle(article, language)}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Image
                          src="/chat/mascotte.png"
                          alt=""
                          width={80}
                          height={80}
                          className="opacity-30"
                        />
                      </div>
                    )}
                    {/* Category badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {article.category}
                      </span>
                    </div>
                    {/* Featured badge */}
                    {article.featured && (
                      <div className="absolute top-3 right-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {translate('blog_featured') || 'En vedette'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <h2 className={`text-lg font-bold line-clamp-2 group-hover:text-orange-500 transition-colors ${
                      isDark ? 'text-neutral-100' : 'text-gray-900'
                    }`}>
                      {getLocalizedTitle(article, language)}
                    </h2>
                    <p className={`text-sm line-clamp-2 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                      {getLocalizedExcerpt(article, language)}
                    </p>

                    {/* Meta */}
                    <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(article.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {article.read_time} min
                      </span>
                    </div>

                    {/* Read more */}
                    <div className={`flex items-center gap-1 text-sm font-medium text-orange-500 group-hover:gap-2 transition-all`}>
                      <span>{translate('blog_read_more') || 'Lire la suite'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            /* Empty State */
            <section className={`rounded-2xl border p-12 text-center ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
            }`}>
              <Image
                src="/chat/mascotte.png"
                alt="Nareo"
                width={120}
                height={120}
                className="mx-auto mb-4 opacity-50"
              />
              <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-neutral-200' : 'text-gray-900'}`}>
                {translate('blog_coming_soon_title') || 'Articles à venir'}
              </h2>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('blog_coming_soon_description') || 'Nous préparons des articles sur les meilleures méthodes de révision. Revenez bientôt !'}
              </p>
            </section>
          )}

          {/* Newsletter CTA */}
          <section className={`rounded-2xl p-8 text-center ${
            isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-100'
          }`}>
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
              {translate('blog_newsletter_title') || 'Restez informé'}
            </h2>
            <p className={`text-sm mb-4 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
              {translate('blog_newsletter_description') || 'Recevez nos derniers conseils de révision directement dans votre boîte mail.'}
            </p>
            <button
              onClick={() => setShowNewsletterModal(true)}
              className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
            >
              {translate('blog_newsletter_cta') || "S'inscrire gratuitement"}
            </button>
          </section>
        </div>
      </main>

      {/* Newsletter Modal */}
      <NewsletterModal
        isOpen={showNewsletterModal}
        onClose={() => setShowNewsletterModal(false)}
      />
    </div>
  );
}
