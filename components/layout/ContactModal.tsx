'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Mail, MessageCircle, Clock, Send, CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

interface ContactModalProps {
  onClose: () => void;
}

export default function ContactModal({ onClose }: ContactModalProps) {
  const { translate } = useLanguage();
  const { user } = useAuth();

  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !message.trim()) return;

    setIsSending(true);

    // Encode pour l'URL mailto
    const subject = encodeURIComponent('Contact depuis Nareo');
    const body = encodeURIComponent(`${message}\n\n---\nEnvoyé depuis: ${email}`);

    // Ouvrir le client mail
    window.location.href = `mailto:contact@usenareo.com?subject=${subject}&body=${body}`;

    // Afficher confirmation après un court délai
    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xl overflow-hidden my-2 sm:my-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors shadow-md"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header avec mascotte */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 sm:px-8 py-4 sm:py-6 flex items-center gap-3 sm:gap-4">
          <Image
            src="/chat/Happy.png"
            alt="Nareo"
            width={80}
            height={80}
            className="rounded-full bg-white/20 p-1 flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 object-contain"
          />
          <div className="text-white pr-6 sm:pr-8 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold">
              {translate('contact_title')}
            </h1>
            <p className="text-orange-100 text-xs sm:text-base mt-0.5 sm:mt-1">
              {translate('contact_subtitle')}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Message sympathique */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center">
            <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 mx-auto mb-2 sm:mb-3" />
            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
              {translate('contact_message')}
            </p>
          </div>

          {/* Formulaire */}
          {isSent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-500 mx-auto mb-2 sm:mb-3" />
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">
                {translate('contact_sent_title')}
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                {translate('contact_sent_message')}
              </p>
              <button
                onClick={() => {
                  setIsSent(false);
                  setMessage('');
                }}
                className="mt-3 sm:mt-4 text-orange-600 font-semibold hover:text-orange-700 transition-colors text-xs sm:text-sm"
              >
                {translate('contact_send_another')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="contact-email" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                  {translate('contact_email_label')}
                </label>
                <input
                  type="email"
                  id="contact-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={translate('contact_email_placeholder')}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-gray-900 placeholder-gray-400 text-sm sm:text-base"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="contact-message" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                  {translate('contact_message_label')}
                </label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={translate('contact_message_placeholder')}
                  required
                  rows={3}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-gray-900 placeholder-gray-400 resize-none text-sm sm:text-base sm:[rows:4]"
                />
              </div>

              {/* Submit */}
              <div className="text-center pt-1 sm:pt-2">
                <button
                  type="submit"
                  disabled={isSending || !email.trim() || !message.trim()}
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm sm:text-base hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  {translate('contact_cta')}
                </button>

                <p className="text-gray-500 text-xs mt-2 sm:mt-3 flex items-center justify-center gap-1.5 sm:gap-2">
                  <Mail className="w-3 h-3" />
                  contact@usenareo.com
                </p>
              </div>
            </form>
          )}

          {/* Infos complémentaires */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1 sm:pt-2">
            <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm mb-0.5">
                  {translate('contact_response_title')}
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-600">
                  {translate('contact_response_text')}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm mb-0.5">
                  {translate('contact_help_title')}
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-600">
                  {translate('contact_help_text')}
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
