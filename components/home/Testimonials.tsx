import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, Star } from "lucide-react";

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
    alt: "Will Linley",
  },
];

export function HomeTestimonials() {
  const { translate } = useLanguage();

  return (
    <section className="space-y-4">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-orange-600 text-sm font-semibold">
          <Star className="w-4 h-4" />
          <Star className="w-4 h-4" />
          <Star className="w-4 h-4" />
          <Star className="w-4 h-4" />
          <Star className="w-4 h-4" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{translate("home_testimonials_title")}</h2>
        <p className="text-sm text-gray-600">{translate("home_testimonials_subtitle")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {testimonials.map((item) => (
          <div
            key={item.nameKey}
            className="rounded-3xl bg-white border border-orange-100 shadow-sm p-6 flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-200">
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{translate(item.nameKey)}</p>
                <p className="text-xs text-gray-600">{translate(item.roleKey)}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              “{translate(item.quoteKey)}”
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
