'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CGUPage() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);
  const { translate } = useLanguage();

  useEffect(() => {
    // Check if there's meaningful history (more than just this page)
    setCanGoBack(typeof window !== 'undefined' && window.history.length > 1);
  }, []);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {translate('back')}
        </button>

        {/* Header */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {translate('cgu_title')}
        </h1>
        <p className="text-gray-500 mb-8">{translate('cgu_last_update')}</p>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article1_title')}</h2>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article1_p1')}
          </p>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article1_p2')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article2_title')}</h2>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article2_p1')}
          </p>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article2_p2')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article3_title')}</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article3_1_title')}</h3>
          <p className="text-gray-700 mb-2">{translate('cgu_article3_1_intro')}</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>{translate('cgu_article3_1_feature1')}</li>
            <li>{translate('cgu_article3_1_feature2')}</li>
            <li>{translate('cgu_article3_1_feature3')}</li>
            <li>{translate('cgu_article3_1_feature4')}</li>
            <li>{translate('cgu_article3_1_feature5')}</li>
            <li>{translate('cgu_article3_1_feature6')}</li>
            <li>{translate('cgu_article3_1_feature7')}</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article3_2_title')}</h3>

          <p className="text-gray-700 font-medium mb-2">{translate('cgu_article3_2_free_title')}</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>{translate('cgu_article3_2_free_1')}</li>
            <li>{translate('cgu_article3_2_free_2')}</li>
            <li>{translate('cgu_article3_2_free_3')}</li>
            <li>{translate('cgu_article3_2_free_4')}</li>
            <li>{translate('cgu_article3_2_free_5')}</li>
            <li>{translate('cgu_article3_2_free_6')}</li>
          </ul>

          <p className="text-gray-700 font-medium mb-2">{translate('cgu_article3_2_premium_title')}</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>{translate('cgu_article3_2_premium_1')}</li>
            <li>{translate('cgu_article3_2_premium_2')}</li>
            <li>{translate('cgu_article3_2_premium_3')}</li>
            <li>{translate('cgu_article3_2_premium_4')}</li>
            <li>{translate('cgu_article3_2_premium_5')}</li>
            <li>{translate('cgu_article3_2_premium_6')}</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article4_title')}</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article4_1_title')}</h3>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article4_1_p1')}
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article4_2_title')}</h3>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article4_2_p1')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article5_title')}</h2>
          <p className="text-gray-700 mb-2">{translate('cgu_article5_intro')}</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>{translate('cgu_article5_obligation1')}</li>
            <li>{translate('cgu_article5_obligation2')}</li>
            <li>{translate('cgu_article5_obligation3')}</li>
            <li>{translate('cgu_article5_obligation4')}</li>
            <li>{translate('cgu_article5_obligation5')}</li>
            <li>{translate('cgu_article5_obligation6')}</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article6_title')}</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article6_1_title')}</h3>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article6_1_p1')}
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article6_2_title')}</h3>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article6_2_p1')}
          </p>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article6_2_p2')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article7_title')}</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article7_1_title')}</h3>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article7_1_p1')}
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article7_2_title')}</h3>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article7_2_p1')}
          </p>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article7_2_p2')}
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article7_3_title')}</h3>
          <p className="text-gray-700 mb-2">{translate('cgu_article7_3_intro')}</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>{translate('cgu_article7_3_exclusion1')}</li>
            <li>{translate('cgu_article7_3_exclusion2')}</li>
            <li>{translate('cgu_article7_3_exclusion3')}</li>
            <li>{translate('cgu_article7_3_exclusion4')}</li>
            <li>{translate('cgu_article7_3_exclusion5')}</li>
            <li>{translate('cgu_article7_3_exclusion6')}</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">{translate('cgu_article7_4_title')}</h3>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article7_4_p1')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article8_title')}</h2>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article8_p1')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article9_title')}</h2>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article9_p1')}{' '}
            <Link href="/confidentialite" className="text-orange-600 hover:text-orange-700 underline">
              {translate('cgu_article9_privacy_link')}
            </Link>
            {translate('cgu_article9_p2')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article10_title')}</h2>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article10_p1')}
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{translate('cgu_article11_title')}</h2>
          <p className="text-gray-700 mb-4">
            {translate('cgu_article11_p1')}{' '}
            <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
              contact@usenareo.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
