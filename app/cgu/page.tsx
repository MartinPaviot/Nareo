'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function CGUPage() {
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
          Conditions Générales d&apos;Utilisation
        </h1>
        <p className="text-gray-500 mb-8">Dernière mise à jour : Décembre 2025</p>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 1 - Objet</h2>
          <p className="text-gray-700 mb-4">
            Les présentes Conditions Générales d&apos;Utilisation (ci-après « CGU ») ont pour objet de définir les modalités et conditions d&apos;utilisation du service Nareo (ci-après « le Service »), accessible via le site internet usenareo.com.
          </p>
          <p className="text-gray-700 mb-4">
            Nareo est une plateforme éducative qui permet aux utilisateurs de générer des quiz personnalisés à partir de leurs supports de cours, en utilisant l&apos;intelligence artificielle.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 2 - Acceptation des CGU</h2>
          <p className="text-gray-700 mb-4">
            L&apos;accès et l&apos;utilisation du Service sont subordonnés à l&apos;acceptation et au respect des présentes CGU. En créant un compte ou en utilisant le Service, l&apos;Utilisateur reconnaît avoir lu, compris et accepté les présentes CGU sans réserve.
          </p>
          <p className="text-gray-700 mb-4">
            Nareo se réserve le droit de modifier les présentes CGU à tout moment. Les Utilisateurs seront informés de toute modification par email ou notification sur le Site. La poursuite de l&apos;utilisation du Service après notification vaut acceptation des nouvelles CGU.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 3 - Description du Service</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.1 Fonctionnalités principales</h3>
          <p className="text-gray-700 mb-2">Nareo offre les fonctionnalités suivantes :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Upload de documents de cours (PDF)</li>
            <li>Extraction automatique du contenu et structuration en chapitres</li>
            <li>Génération de quiz personnalisés par chapitre via intelligence artificielle</li>
            <li>Possibilité de retenter les quiz autant de fois que souhaité</li>
            <li>Feedback personnalisé en fonction des réponses</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.2 Formules disponibles</h3>

          <p className="text-gray-700 font-medium mb-2">Formule Gratuite :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>3 cours par mois maximum</li>
            <li>Réinitialisation du quota au 1er de chaque mois</li>
            <li>3 chapitres maximum par cours</li>
            <li>Tentatives illimitées sur les quiz</li>
            <li>Feedback personnalisé</li>
          </ul>

          <p className="text-gray-700 font-medium mb-2">Formule Premium (Abonnement payant) :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>12 cours par mois</li>
            <li>Réinitialisation du quota au 1er de chaque mois</li>
            <li>Chapitres illimités par cours</li>
            <li>Tentatives illimitées sur les quiz</li>
            <li>Feedback personnalisé</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 4 - Inscription et compte utilisateur</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">4.1 Création de compte</h3>
          <p className="text-gray-700 mb-4">
            L&apos;accès au Service nécessite la création d&apos;un compte. L&apos;Utilisateur s&apos;engage à fournir des informations exactes, complètes et à jour lors de son inscription.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">4.2 Sécurité du compte</h3>
          <p className="text-gray-700 mb-4">
            L&apos;Utilisateur est seul responsable de la confidentialité de ses identifiants de connexion et de toute activité effectuée depuis son compte. En cas de suspicion d&apos;utilisation non autorisée, l&apos;Utilisateur doit en informer Nareo immédiatement à contact@usenareo.com.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 5 - Obligations de l&apos;Utilisateur</h2>
          <p className="text-gray-700 mb-2">L&apos;Utilisateur s&apos;engage à :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Utiliser le Service conformément à sa destination et aux présentes CGU</li>
            <li>Ne pas télécharger de contenu illicite, diffamatoire, obscène ou portant atteinte aux droits de tiers</li>
            <li>Ne pas tenter de perturber le fonctionnement du Service</li>
            <li>Respecter les droits de propriété intellectuelle des contenus téléchargés</li>
            <li>Ne pas utiliser le Service à des fins commerciales non autorisées</li>
            <li>Ne pas partager ses identifiants avec des tiers</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 6 - Propriété intellectuelle</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">6.1 Contenu de Nareo</h3>
          <p className="text-gray-700 mb-4">
            L&apos;ensemble du Service, incluant sans limitation le code source, les algorithmes, l&apos;interface, les textes, graphismes et logos, est protégé par le droit de la propriété intellectuelle et appartient à Nareo.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">6.2 Contenu de l&apos;Utilisateur</h3>
          <p className="text-gray-700 mb-4">
            L&apos;Utilisateur conserve l&apos;entière propriété des documents qu&apos;il télécharge sur le Service. En téléchargeant un document, l&apos;Utilisateur accorde à Nareo une licence limitée, non exclusive et révocable pour traiter ce contenu aux seules fins de fourniture du Service (extraction de texte, génération de quiz).
          </p>
          <p className="text-gray-700 mb-4">
            L&apos;Utilisateur garantit qu&apos;il dispose des droits nécessaires sur les contenus téléchargés.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 7 - Limitation de responsabilité</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">7.1 Nature du Service</h3>
          <p className="text-gray-700 mb-4">
            Le Service est fourni « en l&apos;état » et « selon disponibilité ». Nareo s&apos;engage à mettre en œuvre tous les moyens raisonnables pour assurer le bon fonctionnement du Service (obligation de moyens).
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">7.2 Utilisation de l&apos;intelligence artificielle</h3>
          <p className="text-gray-700 mb-4">
            Le Service utilise des technologies d&apos;intelligence artificielle (API OpenAI) pour l&apos;extraction de texte, la définition des chapitres et la génération des quiz. Nareo ne garantit pas l&apos;exactitude, la pertinence ou l&apos;exhaustivité des contenus générés par l&apos;IA.
          </p>
          <p className="text-gray-700 mb-4">
            Les quiz générés sont fournis à titre indicatif et pédagogique. L&apos;Utilisateur reste seul responsable de la vérification et de la validation des contenus générés pour ses besoins d&apos;apprentissage.
          </p>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">7.3 Exclusions de responsabilité</h3>
          <p className="text-gray-700 mb-2">Nareo ne saurait être tenu responsable :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-1">
            <li>Des erreurs, inexactitudes ou omissions dans les quiz générés</li>
            <li>Des résultats obtenus par l&apos;Utilisateur dans ses études ou examens</li>
            <li>Des interruptions temporaires du Service pour maintenance ou mises à jour</li>
            <li>Des dommages indirects, accessoires ou consécutifs</li>
            <li>Des actes de piratage ou d&apos;accès non autorisé malgré les mesures de sécurité</li>
            <li>De la qualité ou de la lisibilité des documents téléchargés par l&apos;Utilisateur</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">7.4 Plafond de responsabilité</h3>
          <p className="text-gray-700 mb-4">
            En tout état de cause, la responsabilité de Nareo est limitée au montant des sommes effectivement versées par l&apos;Utilisateur au cours des douze (12) derniers mois précédant le fait générateur de responsabilité.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 8 - Suspension et résiliation</h2>
          <p className="text-gray-700 mb-4">
            Nareo se réserve le droit de suspendre ou résilier l&apos;accès d&apos;un Utilisateur au Service, sans préavis ni indemnité, en cas de violation des présentes CGU, d&apos;utilisation frauduleuse ou abusive du Service, ou de comportement portant atteinte aux intérêts de Nareo ou des autres Utilisateurs.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 9 - Données personnelles</h2>
          <p className="text-gray-700 mb-4">
            Les modalités de collecte et de traitement des données personnelles sont décrites dans notre{' '}
            <Link href="/confidentialite" className="text-orange-600 hover:text-orange-700 underline">
              Politique de Confidentialité
            </Link>
            , accessible sur le Site et faisant partie intégrante des présentes CGU.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 10 - Droit applicable et litiges</h2>
          <p className="text-gray-700 mb-4">
            Les présentes CGU sont régies par le droit français. En cas de litige relatif à l&apos;interprétation ou l&apos;exécution des présentes, les parties s&apos;efforceront de trouver une solution amiable. À défaut, le litige sera soumis aux tribunaux compétents de Rennes.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Article 11 - Contact</h2>
          <p className="text-gray-700 mb-4">
            Pour toute question relative aux présentes CGU, vous pouvez nous contacter à :{' '}
            <a href="mailto:contact@usenareo.com" className="text-orange-600 hover:text-orange-700 underline">
              contact@usenareo.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
