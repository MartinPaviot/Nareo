'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function ConfidentialitePage() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Check if there's meaningful history (more than just this page)
    setCanGoBack(typeof window !== 'undefined' && window.history.length > 1);
  }, []);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        {/* Header */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Politique de Confidentialité
        </h1>
        <p className="text-gray-500 mb-8">Dernière mise à jour : Décembre 2025</p>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 1 - Introduction</h2>
          <p className="text-gray-700 mb-4">
            La présente Politique de Confidentialité décrit comment Nareo (ci-après « nous », « notre » ou « Nareo ») collecte, utilise, stocke et protège les données personnelles des utilisateurs de notre service (ci-après « vous » ou « l&apos;Utilisateur »).
          </p>
          <p className="text-gray-700 mb-4">
            Nous nous engageons à respecter le Règlement Général sur la Protection des Données (RGPD) et la loi Informatique et Libertés.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 2 - Responsable du traitement</h2>
          <p className="text-gray-700 mb-2">Le responsable du traitement des données est :</p>
          <ul className="list-none text-gray-700 mb-4 space-y-1">
            <li><strong>Nareo</strong></li>
            <li>Adresse : 8 square de Tanouarn, 35700 Rennes, France</li>
            <li>
              Email :{' '}
              <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
                contact@usenareo.com
              </a>
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 3 - Données collectées</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.1 Données fournies directement par l&apos;Utilisateur</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Données d&apos;identification :</strong> nom, prénom, adresse email</li>
            <li><strong>Données de connexion :</strong> identifiants, mot de passe (chiffré)</li>
            <li><strong>Données de paiement :</strong> traitées exclusivement par Stripe (nous ne stockons pas vos données bancaires complètes)</li>
            <li><strong>Contenus téléchargés :</strong> documents de cours (PDF) soumis pour génération de quiz</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.2 Données collectées automatiquement</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Données techniques :</strong> adresse IP, type de navigateur, système d&apos;exploitation, appareil utilisé</li>
            <li><strong>Données de navigation :</strong> pages visitées, durée des sessions, actions effectuées</li>
            <li><strong>Données d&apos;utilisation :</strong> quiz générés, résultats obtenus, historique d&apos;apprentissage</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 4 - Finalités du traitement</h2>
          <p className="text-gray-700 mb-2">Vos données sont collectées et traitées pour les finalités suivantes :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Fourniture du Service :</strong> création et gestion de votre compte, génération de quiz personnalisés, fourniture de feedback</li>
            <li><strong>Gestion des abonnements :</strong> facturation, paiements, gestion des renouvellements</li>
            <li><strong>Communication :</strong> envoi d&apos;emails de confirmation, notifications de service, support client</li>
            <li><strong>Amélioration du Service :</strong> analyse de l&apos;utilisation, développement de nouvelles fonctionnalités</li>
            <li><strong>Sécurité :</strong> prévention de la fraude, protection contre les accès non autorisés</li>
            <li><strong>Conformité légale :</strong> respect des obligations légales et réglementaires</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 5 - Bases légales du traitement</h2>
          <p className="text-gray-700 mb-2">Nos traitements de données reposent sur les bases légales suivantes :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Exécution du contrat :</strong> pour la fourniture du Service et la gestion de votre compte</li>
            <li><strong>Consentement :</strong> pour les cookies non essentiels et les communications marketing</li>
            <li><strong>Intérêt légitime :</strong> pour l&apos;amélioration du Service et la sécurité</li>
            <li><strong>Obligation légale :</strong> pour la conservation des données de facturation</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 6 - Destinataires des données</h2>
          <p className="text-gray-700 mb-2">Vos données peuvent être partagées avec :</p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">6.1 Prestataires techniques</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Vercel Inc.</strong> (États-Unis) : hébergement de l&apos;application</li>
            <li><strong>Stripe Inc.</strong> (États-Unis) : traitement des paiements</li>
            <li><strong>OpenAI</strong> (États-Unis) : traitement IA pour l&apos;extraction de texte et la génération de quiz</li>
            <li><strong>Google LLC</strong> (États-Unis) : Google Analytics pour l&apos;analyse d&apos;audience</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">6.2 Transferts hors UE</h3>
          <p className="text-gray-700 mb-4">
            Certains de nos prestataires sont situés aux États-Unis. Ces transferts sont encadrés par des garanties appropriées, notamment les clauses contractuelles types de la Commission européenne ou la certification au EU-US Data Privacy Framework.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 7 - Durée de conservation</h2>
          <p className="text-gray-700 mb-2">Vos données sont conservées selon les durées suivantes :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Données de compte :</strong> pendant toute la durée de votre inscription, puis 3 ans après la clôture du compte</li>
            <li><strong>Documents téléchargés (PDF) :</strong> 90 jours après le dernier accès, puis supprimés automatiquement</li>
            <li><strong>Données de paiement :</strong> 10 ans conformément aux obligations comptables</li>
            <li><strong>Données d&apos;utilisation et analytics :</strong> 26 mois</li>
            <li><strong>Logs de connexion :</strong> 12 mois</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 8 - Vos droits</h2>
          <p className="text-gray-700 mb-2">Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Droit d&apos;accès :</strong> obtenir confirmation du traitement de vos données et en recevoir une copie</li>
            <li><strong>Droit de rectification :</strong> faire corriger vos données inexactes ou incomplètes</li>
            <li><strong>Droit à l&apos;effacement :</strong> demander la suppression de vos données dans les cas prévus par le RGPD</li>
            <li><strong>Droit à la limitation :</strong> demander la limitation du traitement dans certaines circonstances</li>
            <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré et transférable</li>
            <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement fondé sur l&apos;intérêt légitime</li>
            <li><strong>Droit de retirer votre consentement :</strong> à tout moment pour les traitements fondés sur le consentement</li>
          </ul>
          <p className="text-gray-700 mb-4">
            Pour exercer ces droits, contactez-nous à :{' '}
            <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
              contact@usenareo.com
            </a>
          </p>
          <p className="text-gray-700 mb-4">
            Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL :{' '}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
              www.cnil.fr
            </a>
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 9 - Sécurité des données</h2>
          <p className="text-gray-700 mb-2">
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction. Ces mesures incluent :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Chiffrement des données en transit (HTTPS/TLS)</li>
            <li>Chiffrement des mots de passe</li>
            <li>Accès restreint aux données personnelles</li>
            <li>Surveillance et détection des intrusions</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 10 - Cookies</h2>
          <p className="text-gray-700 mb-4">
            Pour plus d&apos;informations sur notre utilisation des cookies, veuillez consulter notre{' '}
            <Link href="/cookies" className="text-orange-600 hover:text-orange-700 underline">
              Politique de Cookies
            </Link>.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 11 - Modifications</h2>
          <p className="text-gray-700 mb-4">
            Nous nous réservons le droit de modifier la présente Politique de Confidentialité. En cas de modification substantielle, nous vous en informerons par email ou notification sur le Site.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 12 - Contact</h2>
          <p className="text-gray-700 mb-2">Pour toute question concernant cette Politique de Confidentialité ou vos données personnelles :</p>
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
