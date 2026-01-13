'use client';

interface HowItWorksSectionProps {
  translate: (key: string) => string;
}

export function HowItWorksSection({ translate }: HowItWorksSectionProps) {
  const steps = [
    { num: 1, titleKey: 'home_hiw_step1_title', descKey: 'home_hiw_step1_desc' },
    { num: 2, titleKey: 'home_hiw_step2_title', descKey: 'home_hiw_step2_desc' },
    { num: 3, titleKey: 'home_hiw_step3_title', descKey: 'home_hiw_step3_desc' },
  ];

  return (
    <section id="how-it-works" className="mt-16 space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {translate('home_hiw_title')}
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.num}
            className="group rounded-2xl border border-orange-100 bg-white shadow-sm p-6 text-center space-y-3 transition-all duration-200 hover:border-orange-200 hover:shadow-lg hover:-translate-y-1"
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-lg mx-auto transition-transform duration-200 group-hover:scale-110"
              style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)' }}
            >
              {step.num}
            </div>
            <p className="text-base font-semibold text-gray-900 line-clamp-1">{translate(step.titleKey)}</p>
            <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-line">{translate(step.descKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
