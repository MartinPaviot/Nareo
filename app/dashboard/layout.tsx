import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mes cours',
  description: 'Accédez à tous vos cours, quiz et flashcards Nareo. Suivez votre progression et continuez vos révisions.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
