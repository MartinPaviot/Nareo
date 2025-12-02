'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { openCookieSettings } from '@/components/layout/CookieBanner';

export default function CookiesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        {/* Header */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Politique de Cookies
        </h1>
        <p className="text-gray-500 mb-8">Dernière mise à jour : Décembre 2025</p>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 1 - Qu&apos;est-ce qu&apos;un cookie ?</h2>
          <p className="text-gray-700 mb-4">
            Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette, smartphone) lors de votre visite sur un site internet. Il permet au site de mémoriser des informations sur votre visite, comme votre langue préférée et d&apos;autres paramètres, facilitant ainsi votre prochaine visite.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 2 - Types de cookies utilisés</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.1 Cookies strictement nécessaires (essentiels)</h3>
          <p className="text-gray-700 mb-2">Ces cookies sont indispensables au fonctionnement du Site. Ils ne peuvent pas être désactivés. Ils incluent :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Cookies d&apos;authentification :</strong> permettent de vous identifier et d&apos;accéder à votre espace personnel</li>
            <li><strong>Cookies de session :</strong> maintiennent votre connexion active pendant votre navigation</li>
            <li><strong>Cookies de sécurité :</strong> protègent contre les attaques de type CSRF</li>
            <li><strong>Cookies de préférences :</strong> mémorisent vos choix (consentement cookies, langue)</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.2 Cookies analytiques (statistiques)</h3>
          <p className="text-gray-700 mb-4">
            Ces cookies nous permettent de mesurer l&apos;audience du Site et d&apos;analyser la manière dont les utilisateurs interagissent avec notre Service. Ils nous aident à améliorer le fonctionnement et le contenu du Site.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="font-medium text-gray-900 mb-2">Google Analytics</p>
            <ul className="list-none text-gray-700 space-y-1 text-sm">
              <li><strong>Fournisseur :</strong> Google LLC</li>
              <li><strong>Finalité :</strong> analyse d&apos;audience, statistiques de fréquentation, comportement des utilisateurs</li>
              <li><strong>Durée de conservation :</strong> 26 mois maximum</li>
              <li>
                <strong>Plus d&apos;informations :</strong>{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                  https://policies.google.com/privacy
                </a>
              </li>
            </ul>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.3 Cookies fonctionnels</h3>
          <p className="text-gray-700 mb-4">
            Ces cookies permettent d&apos;améliorer votre expérience en mémorisant vos préférences. Ils ne sont pas strictement nécessaires mais facilitent votre utilisation du Service.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 3 - Gestion des cookies</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.1 Bandeau de consentement</h3>
          <p className="text-gray-700 mb-2">Lors de votre première visite sur le Site, un bandeau vous informe de l&apos;utilisation des cookies et vous permet de :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Accepter tous les cookies</li>
            <li>Refuser les cookies non essentiels</li>
            <li>Personnaliser vos choix par catégorie de cookies</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.2 Modification de vos préférences</h3>
          <p className="text-gray-700 mb-4">
            Vous pouvez modifier vos préférences à tout moment en cliquant sur le bouton ci-dessous ou via le lien « Gestion des cookies » disponible en bas de chaque page du Site.
          </p>
          <button
            onClick={openCookieSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors mb-4"
          >
            Gérer mes préférences cookies
          </button>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.3 Paramètres du navigateur</h3>
          <p className="text-gray-700 mb-2">Vous pouvez également configurer votre navigateur pour accepter ou refuser les cookies. Voici les liens vers les instructions des principaux navigateurs :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>
              <strong>Chrome :</strong>{' '}
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                support.google.com/chrome/answer/95647
              </a>
            </li>
            <li>
              <strong>Firefox :</strong>{' '}
              <a href="https://support.mozilla.org/fr/kb/activer-desactiver-cookies" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                support.mozilla.org/fr/kb/activer-desactiver-cookies
              </a>
            </li>
            <li>
              <strong>Safari :</strong>{' '}
              <a href="https://support.apple.com/fr-fr/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                support.apple.com/fr-fr/guide/safari/sfri11471
              </a>
            </li>
            <li>
              <strong>Edge :</strong>{' '}
              <a href="https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                support.microsoft.com/fr-fr/microsoft-edge
              </a>
            </li>
          </ul>
          <p className="text-gray-600 text-sm italic mb-4">
            Attention : Le blocage de certains cookies peut affecter votre expérience sur le Site et limiter l&apos;accès à certaines fonctionnalités.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 4 - Cookies tiers</h2>
          <p className="text-gray-700 mb-2">
            Certains cookies sont déposés par des services tiers qui apparaissent sur nos pages. Nous ne contrôlons pas le dépôt de ces cookies. Pour plus d&apos;informations, consultez les politiques de confidentialité de ces tiers :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>
              <strong>Google Analytics :</strong>{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                policies.google.com/privacy
              </a>
            </li>
            <li>
              <strong>Stripe (paiement) :</strong>{' '}
              <a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                stripe.com/fr/privacy
              </a>
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 5 - Durée de conservation</h2>
          <p className="text-gray-700 mb-2">La durée de vie des cookies varie selon leur type :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Cookies de session :</strong> supprimés à la fermeture du navigateur</li>
            <li><strong>Cookies de consentement :</strong> 12 mois</li>
            <li><strong>Cookies Google Analytics :</strong> 26 mois maximum</li>
          </ul>
          <p className="text-gray-700 mb-4">
            Conformément aux recommandations de la CNIL, le consentement aux cookies doit être renouvelé périodiquement.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 6 - Vos droits</h2>
          <p className="text-gray-700 mb-4">
            Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement et d&apos;opposition concernant les données collectées via les cookies.
          </p>
          <p className="text-gray-700 mb-4">
            Pour exercer ces droits :{' '}
            <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
              contact@usenareo.com
            </a>
          </p>
          <p className="text-gray-700 mb-4">
            Vous pouvez également introduire une réclamation auprès de la CNIL :{' '}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
              www.cnil.fr
            </a>
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 7 - Modifications</h2>
          <p className="text-gray-700 mb-4">
            Nous nous réservons le droit de modifier cette Politique de Cookies à tout moment. Les modifications seront publiées sur cette page avec une date de mise à jour.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 8 - Contact</h2>
          <p className="text-gray-700 mb-2">Pour toute question concernant cette Politique de Cookies :</p>
          <ul className="list-none text-gray-700 mb-4 space-y-1">
            <li>
              Email :{' '}
              <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
                contact@usenareo.com
              </a>
            </li>
            <li>Adresse : 8 square de Tanouarn, 35700 Rennes, France</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
