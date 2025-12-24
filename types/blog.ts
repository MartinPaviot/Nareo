export interface BlogArticle {
  id: string;
  slug: string;
  title_fr: string;
  title_en: string;
  title_de: string;
  excerpt_fr: string;
  excerpt_en: string;
  excerpt_de: string;
  content_fr: string;
  content_en: string;
  content_de: string;
  category: string;
  read_time: number;
  image_url: string | null;
  published: boolean;
  featured: boolean;
  author: string;
  created_at: string;
  updated_at: string;
}

export type Language = 'fr' | 'en' | 'de';

// Helper function to get localized content
export function getLocalizedTitle(article: BlogArticle, language: Language): string {
  const key = `title_${language}` as keyof BlogArticle;
  return article[key] as string;
}

export function getLocalizedExcerpt(article: BlogArticle, language: Language): string {
  const key = `excerpt_${language}` as keyof BlogArticle;
  return article[key] as string;
}

export function getLocalizedContent(article: BlogArticle, language: Language): string {
  const key = `content_${language}` as keyof BlogArticle;
  return article[key] as string;
}
