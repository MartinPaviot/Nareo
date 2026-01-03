import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quiz',
  description: 'Testez vos connaissances avec des quiz personnalisés générés par IA. Questions adaptées à votre niveau.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChapterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
