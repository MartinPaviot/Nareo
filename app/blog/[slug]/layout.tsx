import type { Metadata } from 'next';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://www.usenareo.com'}/api/blog/${slug}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return {
        title: 'Article',
        description: 'Lisez nos conseils pour réviser efficacement.',
      };
    }

    const data = await response.json();
    const article = data.article;

    if (!article) {
      return {
        title: 'Article',
        description: 'Lisez nos conseils pour réviser efficacement.',
      };
    }

    const title = article.title_fr || article.title_en || 'Article';
    const description = article.excerpt_fr || article.excerpt_en || 'Découvrez nos conseils de révision.';

    return {
      title,
      description,
      keywords: article.category ? [article.category, 'révision', 'étude', 'conseils'] : undefined,
      openGraph: {
        title: `${title} | Nareo Blog`,
        description,
        type: 'article',
        publishedTime: article.created_at,
        modifiedTime: article.updated_at,
        images: article.image_url ? [
          {
            url: article.image_url,
            width: 1200,
            height: 630,
            alt: title,
          },
        ] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: article.image_url ? [article.image_url] : undefined,
      },
      alternates: {
        canonical: `https://www.usenareo.com/blog/${slug}`,
      },
    };
  } catch {
    return {
      title: 'Article',
      description: 'Lisez nos conseils pour réviser efficacement.',
    };
  }
}

export default function BlogArticleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
