'use client';

import {
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  Calculator,
  FlaskConical,
  Globe,
  Landmark,
  Megaphone,
  Scale,
  Stethoscope,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

interface SubjectsMarqueeProps {
  translate: (key: string) => string;
}

export function SubjectsMarquee({ translate }: SubjectsMarqueeProps) {
  const subjects = [
    { icon: TrendingUp, labelKey: 'marquee_economy' },
    { icon: Megaphone, labelKey: 'marquee_marketing' },
    { icon: Scale, labelKey: 'marquee_law' },
    { icon: Brain, labelKey: 'marquee_psychology' },
    { icon: Wallet, labelKey: 'marquee_finance' },
    { icon: Landmark, labelKey: 'marquee_history' },
    { icon: Globe, labelKey: 'marquee_languages' },
    { icon: BarChart3, labelKey: 'marquee_management' },
    { icon: Building2, labelKey: 'marquee_polisci' },
    { icon: Users, labelKey: 'marquee_sociology' },
    { icon: BookOpen, labelKey: 'marquee_literature' },
    { icon: FlaskConical, labelKey: 'marquee_socialsciences' },
    { icon: Stethoscope, labelKey: 'marquee_medicine' },
    { icon: Calculator, labelKey: 'marquee_accounting' },
  ];

  const SubjectPill = ({ icon: Icon, labelKey, keyPrefix }: { icon: typeof TrendingUp; labelKey: string; keyPrefix: string }) => (
    <div
      key={`${keyPrefix}-${labelKey}`}
      className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-white border border-gray-200 rounded-full shadow-sm flex-shrink-0"
    >
      <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" style={{ color: '#ff751f' }} />
      <span className="text-sm font-medium text-gray-700">{translate(labelKey)}</span>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{translate('home_subjects_title')}</h2>
      </div>

      {/* Marquee container */}
      <div className="overflow-hidden w-full">
        <div
          className="flex gap-3 sm:gap-4 animate-marquee hover:[animation-play-state:paused]"
          style={{ width: 'max-content' }}
        >
          {/* First set of pills */}
          {subjects.map((subject) => (
            <SubjectPill key={`first-${subject.labelKey}`} icon={subject.icon} labelKey={subject.labelKey} keyPrefix="first" />
          ))}
          {/* Duplicated set for seamless loop */}
          {subjects.map((subject) => (
            <SubjectPill key={`second-${subject.labelKey}`} icon={subject.icon} labelKey={subject.labelKey} keyPrefix="second" />
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-600 text-center">{translate('home_subjects_subtitle')}</p>
    </section>
  );
}
