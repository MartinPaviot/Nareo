'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Calendar, Clock, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import TopBarActions from '@/components/layout/TopBarActions';

// Articles statiques (à terme, pourra venir d'un CMS ou d'une base de données)
const BLOG_ARTICLES = [
  {
    id: 'active-recall',
    slug: 'active-recall-methode-revision',
    titleKey: 'blog_article_1_title',
    descriptionKey: 'blog_article_1_description',
    image: '/images/blog/active-recall.jpg',
    category: 'Méthode',
    readTime: 5,
    date: '2024-12-20',
    published: true,
  },
  {
    id: 'spaced-repetition',
    slug: 'repetition-espacee-memorisation',
    titleKey: 'blog_article_2_title',
    descriptionKey: 'blog_article_2_description',
    image: '/images/blog/spaced-repetition.jpg',
    category: 'Méthode',
    readTime: 7,
    date: '2024-12-18',
    published: true,
  },
  {
    id: 'pomodoro',
    slug: 'technique-pomodoro-concentration',
    titleKey: 'blog_article_3_title',
    descriptionKey: 'blog_article_3_description',
    image: '/images/blog/pomodoro.jpg',
    category: 'Productivité',
    readTime: 4,
    date: '2024-12-15',
    published: true,
  },
];

export default function BlogPage() {
  const router = useRouter();
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const publishedArticles = BLOG_ARTICLES.filter((a) => a.published);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-neutral-950' : 'bg-gradient-to-b from-orange-50 via-white to-orange-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-sm border-b flex items-center justify-between px-4 py-4 sm:px-6 ${
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

          {/* Articles Grid */}
          {publishedArticles.length > 0 ? (
            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {publishedArticles.map((article) => (
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
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Image
                        src="/chat/mascotte.png"
                        alt=""
                        width={80}
                        height={80}
                        className="opacity-30"
                      />
                    </div>
                    {/* Category badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {article.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <h2 className={`text-lg font-bold line-clamp-2 group-hover:text-orange-500 transition-colors ${
                      isDark ? 'text-neutral-100' : 'text-gray-900'
                    }`}>
                      {translate(article.titleKey as any) || article.titleKey}
                    </h2>
                    <p className={`text-sm line-clamp-2 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                      {translate(article.descriptionKey as any) || article.descriptionKey}
                    </p>

                    {/* Meta */}
                    <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(article.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {article.readTime} min
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
              onClick={() => router.push('/auth/signup')}
              className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
            >
              {translate('blog_newsletter_cta') || "S'inscrire gratuitement"}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
