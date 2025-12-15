'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function CGVPage() {
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
          Conditions Générales de Vente
        </h1>
        <p className="text-gray-500 mb-8">Dernière mise à jour : Décembre 2025</p>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 1 - Préambule</h2>
          <p className="text-gray-700 mb-4">
            Les présentes Conditions Générales de Vente (ci-après « CGV ») s&apos;appliquent à toute souscription d&apos;abonnement au service Nareo (ci-après « le Service »). Elles complètent les{' '}
            <Link href="/cgu" className="text-orange-600 hover:text-orange-700 underline">
              Conditions Générales d&apos;Utilisation
            </Link>.
          </p>
          <p className="text-gray-700 mb-4">
            Le Service est destiné aux étudiants et permet de générer des quiz personnalisés à partir de supports de cours.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 2 - Offres et tarifs</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.1 Formule Gratuite</h3>
          <p className="text-gray-700 mb-2">La formule gratuite donne accès aux fonctionnalités limitées du Service :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>3 cours par mois maximum</li>
            <li>Réinitialisation automatique du quota au 1er de chaque mois calendaire</li>
            <li>3 chapitres par cours</li>
            <li>Tentatives illimitées sur les quiz</li>
            <li>Feedback personnalisé</li>
          </ul>
          <p className="text-gray-600 text-sm italic mb-4">
            Note : Les cours non utilisés durant un mois ne sont pas reportables sur le mois suivant.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.2 Formule Premium</h3>
          <p className="text-gray-700 mb-2">La formule Premium donne accès à l&apos;ensemble des fonctionnalités du Service :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Cours illimités</li>
            <li>Réinitialisation automatique du quota au 1er de chaque mois calendaire</li>
            <li>Chapitres illimités par cours</li>
            <li>Tentatives illimitées sur les quiz</li>
            <li>Feedback personnalisé</li>
          </ul>

          <p className="text-gray-700 font-medium mb-2">Tarifs de la formule Premium :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li><strong>Abonnement mensuel :</strong> 9,99 € TTC par mois</li>
            <li><strong>Abonnement annuel :</strong> 83,66 € TTC par an (soit environ 6,97 € par mois)</li>
          </ul>
          <p className="text-gray-700 mb-4">
            Les prix sont indiqués en euros, toutes taxes comprises (TTC). Nareo se réserve le droit de modifier ses tarifs à tout moment, étant entendu que le tarif en vigueur au moment de la souscription restera applicable jusqu&apos;au terme de la période d&apos;abonnement en cours.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 3 - Souscription</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.1 Processus de souscription</h3>
          <p className="text-gray-700 mb-2">La souscription à un abonnement Premium s&apos;effectue en ligne sur le Site. L&apos;Utilisateur doit :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Disposer d&apos;un compte Nareo</li>
            <li>Sélectionner la formule souhaitée (mensuelle ou annuelle)</li>
            <li>Procéder au paiement via la plateforme sécurisée Stripe</li>
            <li>Accepter les présentes CGV avant validation</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.2 Activation du Service</h3>
          <p className="text-gray-700 mb-4">
            L&apos;accès aux fonctionnalités Premium est activé immédiatement après confirmation du paiement. Un email de confirmation est envoyé à l&apos;Utilisateur.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 4 - Paiement</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">4.1 Moyens de paiement</h3>
          <p className="text-gray-700 mb-4">
            Les paiements sont traités par notre prestataire de paiement sécurisé Stripe. Les moyens de paiement acceptés incluent les cartes bancaires (Visa, Mastercard, American Express) et les autres moyens proposés par Stripe.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">4.2 Sécurité des paiements</h3>
          <p className="text-gray-700 mb-4">
            Les transactions sont sécurisées par Stripe, certifié PCI-DSS. Nareo n&apos;a pas accès aux données bancaires complètes de l&apos;Utilisateur.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">4.3 Renouvellement automatique</h3>
          <p className="text-gray-700 mb-4">
            Les abonnements sont renouvelés automatiquement à leur date d&apos;anniversaire (mensuelle ou annuelle selon la formule choisie). L&apos;Utilisateur sera prélevé du montant correspondant à sa formule au début de chaque nouvelle période.
          </p>
          <p className="text-gray-700 mb-4">
            Un email de rappel sera envoyé à l&apos;Utilisateur 7 jours avant chaque renouvellement automatique.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 5 - Droit de rétractation</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">5.1 Renonciation au droit de rétractation</h3>
          <p className="text-gray-700 mb-4">
            Conformément à l&apos;article L.221-28 du Code de la consommation, le droit de rétractation ne peut être exercé pour les contrats de fourniture de contenu numérique non fourni sur un support matériel dont l&apos;exécution a commencé avec l&apos;accord préalable exprès du consommateur et son renoncement exprès à son droit de rétractation.
          </p>
          <p className="text-gray-700 mb-2">En souscrivant à un abonnement Premium et en acceptant les présentes CGV, l&apos;Utilisateur :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Demande expressément l&apos;exécution immédiate du Service avant la fin du délai de rétractation de 14 jours</li>
            <li>Reconnaît perdre son droit de rétractation dès le début de l&apos;exécution du Service</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">5.2 Accusé de réception</h3>
          <p className="text-gray-700 mb-4">
            L&apos;Utilisateur reçoit un email de confirmation rappelant sa renonciation au droit de rétractation.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 6 - Résiliation</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">6.1 Résiliation par l&apos;Utilisateur</h3>
          <p className="text-gray-700 mb-4">
            L&apos;Utilisateur peut résilier son abonnement à tout moment depuis son espace personnel sur le Site. La résiliation prend effet à la fin de la période d&apos;abonnement en cours (mensuelle ou annuelle).
          </p>
          <p className="text-gray-700 mb-4">
            Après résiliation, l&apos;Utilisateur conserve l&apos;accès aux fonctionnalités Premium jusqu&apos;à la fin de la période déjà payée, puis son compte bascule automatiquement sur la formule gratuite.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">6.2 Résiliation par Nareo</h3>
          <p className="text-gray-700 mb-4">
            Nareo se réserve le droit de résilier l&apos;abonnement d&apos;un Utilisateur en cas de violation des CGU ou CGV, d&apos;utilisation frauduleuse du Service, ou de défaut de paiement. En cas de résiliation pour faute de l&apos;Utilisateur, aucun remboursement ne sera effectué.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 7 - Politique de remboursement</h2>
          <p className="text-gray-700 mb-2">Compte tenu de la nature numérique du Service et de la renonciation au droit de rétractation acceptée lors de la souscription :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Aucun remboursement n&apos;est accordé en cas de résiliation anticipée par l&apos;Utilisateur</li>
            <li>Les périodes d&apos;abonnement non utilisées ne sont pas remboursables</li>
          </ul>
          <p className="text-gray-700 mb-4">
            <strong>Exception :</strong> En cas d&apos;indisponibilité majeure et prolongée du Service imputable à Nareo (plus de 30 jours consécutifs), l&apos;Utilisateur pourra demander un remboursement au prorata de la période d&apos;indisponibilité.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 8 - Garanties et limitations</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">8.1 Obligation de moyens</h3>
          <p className="text-gray-700 mb-4">
            Nareo s&apos;engage à mettre en œuvre tous les moyens raisonnables pour assurer la disponibilité et le bon fonctionnement du Service. Cette obligation constitue une obligation de moyens et non de résultat.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">8.2 Absence de garantie sur les résultats</h3>
          <p className="text-gray-700 mb-4">
            Le Service utilise l&apos;intelligence artificielle (API OpenAI) pour générer les quiz. Nareo ne garantit pas l&apos;exactitude, la pertinence ou l&apos;exhaustivité des contenus générés. Les quiz sont fournis à titre indicatif et pédagogique uniquement.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 9 - Données personnelles</h2>
          <p className="text-gray-700 mb-4">
            Les modalités de collecte et de traitement des données personnelles sont décrites dans notre{' '}
            <Link href="/confidentialite" className="text-orange-600 hover:text-orange-700 underline">
              Politique de Confidentialité
            </Link>
            . Les données de paiement sont traitées exclusivement par Stripe conformément à leur propre politique de confidentialité.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 10 - Service client</h2>
          <p className="text-gray-700 mb-2">Pour toute question relative à votre abonnement, facturation ou utilisation du Service :</p>
          <ul className="list-none text-gray-700 mb-4 space-y-1">
            <li>
              <strong>Email :</strong>{' '}
              <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
                contact@usenareo.com
              </a>
            </li>
            <li><strong>Délai de réponse :</strong> sous 48 heures ouvrées</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 11 - Droit applicable et litiges</h2>
          <p className="text-gray-700 mb-4">
            Les présentes CGV sont régies par le droit français.
          </p>
          <p className="text-gray-700 mb-4">
            Conformément aux dispositions du Code de la consommation, en cas de litige, l&apos;Utilisateur peut recourir gratuitement au service de médiation suivant : le médiateur de la consommation dont les coordonnées sont disponibles sur simple demande à{' '}
            <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
              contact@usenareo.com
            </a>.
          </p>
          <p className="text-gray-700 mb-4">
            L&apos;Utilisateur peut également utiliser la plateforme européenne de règlement en ligne des litiges :{' '}
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
              https://ec.europa.eu/consumers/odr
            </a>
          </p>
          <p className="text-gray-700 mb-4">
            À défaut de résolution amiable, le litige sera soumis aux tribunaux compétents de Rennes.
          </p>
        </div>
      </div>
    </div>
  );
}
