'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/**
 * Graphic data structure from API
 */
interface CourseGraphic {
  id: string;
  course_id: string;
  chapter_id: string | null;
  page_number: number;
  image_id: string;
  imageUrl: string; // Public URL from storage
  graphic_type: 'courbe_offre_demande' | 'diagramme_flux' | 'organigramme' | 'tableau' | 'autre';
  confidence: number;
  description: string;
  elements: Array<{
    id: string;
    type: string;
    label: string;
    coords: { x: number; y: number };
  }>;
  suggestions: {
    affichage: 'SVG' | 'Mermaid' | 'image_originale';
    annotations: string[];
  };
  width: number;
  height: number;
  created_at: string;
}

interface GraphicsGalleryProps {
  courseId: string;
  chapterId?: string; // Optional: filter by chapter
  className?: string;
}

const GRAPHIC_TYPE_LABELS = {
  courbe_offre_demande: '📈 Courbe Offre/Demande',
  diagramme_flux: '🔄 Diagramme de Flux',
  organigramme: '🌳 Organigramme',
  tableau: '📊 Tableau',
  autre: '🖼️ Autre',
};

export function GraphicsGallery({ courseId, chapterId, className = '' }: GraphicsGalleryProps) {
  const [graphics, setGraphics] = useState<CourseGraphic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGraphic, setSelectedGraphic] = useState<CourseGraphic | null>(null);

  useEffect(() => {
    async function fetchGraphics() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/courses/${courseId}/graphics`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch graphics');
        }

        let filteredGraphics = data.graphics || [];

        // Filter by chapter if specified
        if (chapterId) {
          filteredGraphics = filteredGraphics.filter(
            (g: CourseGraphic) => g.chapter_id === chapterId
          );
        }

        setGraphics(filteredGraphics);
      } catch (err: any) {
        console.error('[GraphicsGallery] Error fetching graphics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchGraphics();
  }, [courseId, chapterId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Chargement des graphiques...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-800">Erreur: {error}</p>
      </div>
    );
  }

  if (graphics.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
        <p className="text-gray-600">Aucun graphique trouvé pour ce cours.</p>
        <p className="text-sm text-gray-500 mt-2">
          Les graphiques seront automatiquement extraits lors de l'upload d'un PDF.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Graphiques Pédagogiques ({graphics.length})
        </h3>
        <p className="text-sm text-gray-600">
          Extraits et analysés automatiquement par Claude Vision
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {graphics.map((graphic) => (
          <GraphicCard
            key={graphic.id}
            graphic={graphic}
            onClick={() => setSelectedGraphic(graphic)}
          />
        ))}
      </div>

      {/* Modal for detailed view */}
      {selectedGraphic && (
        <GraphicModal
          graphic={selectedGraphic}
          onClose={() => setSelectedGraphic(null)}
        />
      )}
    </div>
  );
}

/**
 * Card component for a single graphic
 */
function GraphicCard({ graphic, onClick }: { graphic: CourseGraphic; onClick: () => void }) {
  const typeLabel = GRAPHIC_TYPE_LABELS[graphic.graphic_type] || '🖼️ Graphique';
  const confidencePercent = Math.round(graphic.confidence * 100);
  const confidenceColor = confidencePercent >= 90 ? 'bg-green-100 text-green-800' :
                          confidencePercent >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800';

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-video bg-gray-100">
        <Image
          src={graphic.imageUrl}
          alt={graphic.description}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">
            Page {graphic.page_number}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${confidenceColor}`}>
            {confidencePercent}%
          </span>
        </div>

        {/* Type badge */}
        <div className="mb-2">
          <span className="text-sm font-medium text-blue-600">
            {typeLabel}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-700 line-clamp-2">
          {graphic.description}
        </p>

        {/* Elements count */}
        {graphic.elements && graphic.elements.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {graphic.elements.length} élément{graphic.elements.length > 1 ? 's' : ''} identifié{graphic.elements.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Modal for detailed graphic view
 */
function GraphicModal({ graphic, onClose }: { graphic: CourseGraphic; onClose: () => void }) {
  const typeLabel = GRAPHIC_TYPE_LABELS[graphic.graphic_type] || 'Graphique';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{typeLabel}</h3>
            <p className="text-sm text-gray-600">Page {graphic.page_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Image */}
          <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6">
            <Image
              src={graphic.imageUrl}
              alt={graphic.description}
              fill
              className="object-contain"
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Description</h4>
            <p className="text-gray-700">{graphic.description}</p>
          </div>

          {/* Elements */}
          {graphic.elements && graphic.elements.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Éléments Identifiés ({graphic.elements.length})
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {graphic.elements.map((elem, idx) => (
                  <div key={idx} className="bg-gray-50 rounded p-3 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{elem.label}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Type: {elem.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      Position: ({(elem.coords.x * 100).toFixed(0)}%, {(elem.coords.y * 100).toFixed(0)}%)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {graphic.suggestions?.annotations && graphic.suggestions.annotations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">💡 Annotations Suggérées</h4>
              <ul className="space-y-2">
                {graphic.suggestions.annotations.map((annotation, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>{annotation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
              <div>
                <span className="font-medium">Confidence:</span> {Math.round(graphic.confidence * 100)}%
              </div>
              <div>
                <span className="font-medium">Dimensions:</span> {graphic.width} × {graphic.height}px
              </div>
              <div>
                <span className="font-medium">Affichage suggéré:</span> {graphic.suggestions?.affichage || 'Image'}
              </div>
              <div>
                <span className="font-medium">Image ID:</span> {graphic.image_id}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
