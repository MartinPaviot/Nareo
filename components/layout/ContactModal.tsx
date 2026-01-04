'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Mail, Send, CheckCircle2, X, Clock, Sparkles, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface ContactModalProps {
  onClose: () => void;
}

export default function ContactModal({ onClose }: ContactModalProps) {
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !subject.trim() || !message.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), subject: subject.trim(), message: message.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setIsSent(true);
    } catch (err) {
      console.error('Contact form error:', err);
      setError(translate('contact_error') || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className={`relative max-w-md w-full rounded-2xl shadow-xl overflow-hidden ${
        isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-gray-200'
      }`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 z-10 p-1.5 rounded-full transition-colors ${
            isDark
              ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
          }`}
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header compact avec mascotte */}
        <div className={`px-5 pt-5 pb-4 text-center border-b ${
          isDark ? 'border-neutral-800' : 'border-gray-100'
        }`}>
          <div className="flex justify-center mb-3">
            <div className="relative">
              <Image
                src="/chat/Happy.png"
                alt="Nareo"
                width={56}
                height={56}
                className="rounded-xl"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ff751f' }}>
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
          <h1 className={`text-xl font-semibold ${
            isDark ? 'text-neutral-100' : 'text-gray-900'
          }`}>
            {translate('contact_title')}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {translate('contact_subtitle')}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Formulaire ou confirmation */}
          {isSent ? (
            <div className={`rounded-xl p-5 text-center ${
              isDark ? 'bg-green-950/30 border border-green-800/50' : 'bg-green-50 border border-green-200'
            }`}>
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <h3 className={`text-base font-semibold mb-1 ${
                isDark ? 'text-neutral-100' : 'text-gray-900'
              }`}>
                {translate('contact_sent_title')}
              </h3>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('contact_sent_message')}
              </p>
              <button
                onClick={() => {
                  setIsSent(false);
                  setSubject('');
                  setMessage('');
                }}
                className="mt-3 text-orange-500 font-semibold hover:text-orange-600 transition-colors text-sm"
              >
                {translate('contact_send_another')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email */}
              <div>
                <label htmlFor="contact-email" className={`block text-sm font-medium mb-1.5 ${
                  isDark ? 'text-neutral-200' : 'text-gray-900'
                }`}>
                  {translate('contact_email_label')}
                </label>
                <input
                  type="email"
                  id="contact-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={translate('contact_email_placeholder')}
                  required
                  className={`w-full px-3 py-2.5 rounded-lg border outline-none transition-all text-sm ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                  }`}
                />
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="contact-subject" className={`block text-sm font-medium mb-1.5 ${
                  isDark ? 'text-neutral-200' : 'text-gray-900'
                }`}>
                  {translate('contact_subject_label') || 'Objet'}
                </label>
                <input
                  type="text"
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={translate('contact_subject_placeholder') || 'Ex: Question sur mon abonnement'}
                  required
                  className={`w-full px-3 py-2.5 rounded-lg border outline-none transition-all text-sm ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                  }`}
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="contact-message" className={`block text-sm font-medium mb-1.5 ${
                  isDark ? 'text-neutral-200' : 'text-gray-900'
                }`}>
                  {translate('contact_message_label')}
                </label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  placeholder={translate('contact_message_placeholder')}
                  required
                  rows={3}
                  className={`w-full px-3 py-2.5 rounded-lg border outline-none transition-all resize-none text-sm min-h-[80px] max-h-[200px] overflow-y-auto ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                  }`}
                />
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="rounded-lg p-3 text-sm border"
                  style={{
                    backgroundColor: isDark ? 'rgba(217, 26, 28, 0.15)' : '#fff6f3',
                    borderColor: isDark ? 'rgba(217, 26, 28, 0.3)' : 'rgba(217, 26, 28, 0.3)',
                    color: isDark ? '#e94446' : '#d91a1c'
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSending || !email.trim() || !subject.trim() || !message.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                style={{ backgroundColor: '#ff751f' }}
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isSending ? (translate('contact_sending') || 'Envoi...') : translate('contact_cta')}
              </button>
            </form>
          )}

          {/* Infos complémentaires */}
          <div className={`flex items-center justify-center gap-4 pt-3 border-t text-xs ${
            isDark ? 'border-neutral-800 text-neutral-500' : 'border-gray-100 text-gray-400'
          }`}>
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              contact@usenareo.com
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              24-48h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
