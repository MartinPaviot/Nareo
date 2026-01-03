'use client';

import { useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import ContactModal from '@/components/layout/ContactModal';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900 pr-4">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const { translate } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const faqItems = [
    {
      question: translate('faq_q1_question'),
      answer: translate('faq_q1_answer'),
    },
    {
      question: translate('faq_q2_question'),
      answer: translate('faq_q2_answer'),
    },
    {
      question: translate('faq_q3_question'),
      answer: translate('faq_q3_answer'),
    },
    {
      question: translate('faq_q4_question'),
      answer: translate('faq_q4_answer'),
    },
    {
      question: translate('faq_q5_question'),
      answer: translate('faq_q5_answer'),
    },
    {
      question: translate('faq_q6_question'),
      answer: translate('faq_q6_answer'),
    },
  ];

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
      <section id="faq" className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {translate('faq_title')}
          </h2>
          <p className="text-sm text-gray-600">
            {translate('faq_subtitle')}{' '}
            <button
              onClick={() => setShowContactModal(true)}
              className="text-orange-500 hover:text-orange-600 font-medium underline-offset-2 hover:underline transition-colors"
            >
              {translate('faq_contact_link')}
            </button>
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          {faqItems.map((item, index) => (
            <FAQItem
              key={index}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </div>

        {/* Contact CTA */}
        <div className="text-center pt-4">
          <button
            onClick={() => setShowContactModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {translate('faq_contact_cta')}
          </button>
        </div>
      </section>

      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}
    </>
  );
}
