'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function MentionsLegalesPage() {
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
          Mentions Légales
        </h1>
        <p className="text-gray-500 mb-8">Dernière mise à jour : Décembre 2025</p>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 1 - Éditeur du site</h2>
          <p className="text-gray-700 mb-2">Le site internet Nareo (ci-après « le Site ») est édité par :</p>
          <ul className="list-none text-gray-700 mb-4 space-y-1">
            <li><strong>Nareo</strong></li>
            <li>Statut : Entreprise en cours de création</li>
            <li>Adresse : 8 square de Tanouarn, 35700 Rennes, France</li>
            <li>
              Email :{' '}
              <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
                contact@usenareo.com
              </a>
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 2 - Directeur de la publication</h2>
          <p className="text-gray-700 mb-4">
            Le directeur de la publication est le représentant légal de Nareo.
          </p>
          <p className="text-gray-700 mb-4">
            Contact :{' '}
            <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
              contact@usenareo.com
            </a>
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 3 - Hébergeur</h2>
          <p className="text-gray-700 mb-2">Le Site est hébergé par :</p>
          <ul className="list-none text-gray-700 mb-4 space-y-1">
            <li><strong>Vercel Inc.</strong></li>
            <li>Adresse : 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
            <li>
              Site web :{' '}
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                https://vercel.com
              </a>
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 4 - Propriété intellectuelle</h2>
          <p className="text-gray-700 mb-4">
            L&apos;ensemble du contenu du Site (textes, images, graphismes, logo, icônes, logiciels, etc.) est la propriété exclusive de Nareo ou de ses partenaires et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
          </p>
          <p className="text-gray-700 mb-4">
            Toute reproduction, représentation, modification, publication, transmission ou dénaturation, totale ou partielle, du Site ou de son contenu, par quelque procédé que ce soit, et sur quelque support que ce soit, est interdite sans autorisation écrite préalable de Nareo.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 5 - Données personnelles</h2>
          <p className="text-gray-700 mb-4">
            Les informations relatives au traitement des données personnelles sont détaillées dans notre{' '}
            <Link href="/confidentialite" className="text-orange-600 hover:text-orange-700 underline">
              Politique de Confidentialité
            </Link>
            , accessible sur le Site.
          </p>
          <p className="text-gray-700 mb-4">
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, de portabilité et d&apos;opposition concernant vos données personnelles.
          </p>
          <p className="text-gray-700 mb-4">
            Pour exercer ces droits :{' '}
            <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
              contact@usenareo.com
            </a>
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 6 - Cookies</h2>
          <p className="text-gray-700 mb-4">
            Le Site utilise des cookies. Pour plus d&apos;informations sur l&apos;utilisation des cookies et la gestion de vos préférences, veuillez consulter notre{' '}
            <Link href="/cookies" className="text-orange-600 hover:text-orange-700 underline">
              Politique de Cookies
            </Link>
            {' '}accessible sur le Site.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 7 - Droit applicable et juridiction</h2>
          <p className="text-gray-700 mb-4">
            Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative de résolution amiable, compétence exclusive est attribuée aux tribunaux compétents de Rennes.
          </p>
        </div>
      </div>
    </div>
  );
}
