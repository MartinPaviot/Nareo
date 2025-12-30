'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

const testimonials = [
  {
    nameKey: "home_testimonials_1_name",
    roleKey: "home_testimonials_1_role",
    quoteKey: "home_testimonials_1_quote",
    src: "/images/martin_paviot.jpg",
    alt: "Martin Paviot",
  },
  {
    nameKey: "home_testimonials_2_name",
    roleKey: "home_testimonials_2_role",
    quoteKey: "home_testimonials_2_quote",
    src: "/images/joy_kinley.jpg",
    alt: "Joy Kinley",
  },
  {
    nameKey: "home_testimonials_3_name",
    roleKey: "home_testimonials_3_role",
    quoteKey: "home_testimonials_3_quote",
    src: "/images/will_linley.jpg",
    alt: "Arjun Sharma",
  },
];

export function HomeTestimonials() {
  const { translate } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-rotate every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const goToPrev = () => {
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const currentTestimonial = testimonials[activeIndex];

  return (
    <section className="py-6 bg-orange-50/50 rounded-2xl">
      <div className="max-w-2xl mx-auto text-center px-4">
        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{translate('home_testimonials_title')}</h2>

        {/* Stars */}
        <div className="flex items-center justify-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-5 h-5 text-orange-400 fill-orange-400" />
          ))}
        </div>

        {/* Quote */}
        <p className="text-lg text-gray-700 mb-6">
          "{translate(currentTestimonial.quoteKey)}"
        </p>

        {/* Author */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-orange-100">
            <Image
              src={currentTestimonial.src}
              alt={currentTestimonial.alt}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{translate(currentTestimonial.nameKey)}</p>
            <p className="text-sm text-gray-500">{translate(currentTestimonial.roleKey)}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={goToPrev}
            className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === activeIndex ? 'bg-orange-500' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={goToNext}
            className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
