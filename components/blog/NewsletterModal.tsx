'use client';

import { useState } from 'react';
import { X, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewsletterModal({ isOpen, onClose }: NewsletterModalProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setErrorMessage(translate('newsletter_invalid_email') || 'Veuillez entrer une adresse email valide');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setErrorMessage(data.error || translate('newsletter_error') || 'Une erreur est survenue');
        setStatus('error');
      }
    } catch {
      setErrorMessage(translate('newsletter_error') || 'Une erreur est survenue');
      setStatus('error');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setEmail('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-2xl p-6 shadow-xl ${
        isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
      }`}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {status === 'success' ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
              {translate('newsletter_success_title') || 'Inscription confirmee !'}
            </h2>
            <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('newsletter_success_description') || 'Vous recevrez nos prochains articles par email.'}
            </p>
            <button
              onClick={handleClose}
              className="mt-6 px-6 py-2 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
            >
              {translate('close') || 'Fermer'}
            </button>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="text-center mb-6">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <Mail className={`w-7 h-7 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                {translate('blog_newsletter_title') || 'Restez informe'}
              </h2>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('newsletter_modal_description') || 'Recevez nos meilleurs conseils de revision directement dans votre boite mail. Pas de spam, promis !'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  placeholder={translate('newsletter_email_placeholder') || 'Votre adresse email'}
                  className={`w-full px-4 py-3 rounded-xl border transition-colors ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-orange-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-500'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                />
                {status === 'error' && errorMessage && (
                  <p className="mt-2 text-sm" style={{ color: '#d91a1c' }}>{errorMessage}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {translate('newsletter_subscribing') || 'Inscription...'}
                  </>
                ) : (
                  translate('newsletter_subscribe_button') || "S'inscrire a la newsletter"
                )}
              </button>

              <p className={`text-xs text-center ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                {translate('newsletter_privacy_note') || 'Vous pouvez vous desinscrire a tout moment.'}
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
