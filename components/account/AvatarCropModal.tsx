'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Loader2 } from 'lucide-react';

interface AvatarCropModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (croppedBlob: Blob) => Promise<void>;
  isDark: boolean;
  translations: {
    title: string;
    cancel: string;
    save: string;
    zoom: string;
    reset: string;
  };
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export default function AvatarCropModal({
  imageUrl,
  onClose,
  onSave,
  isDark,
  translations,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height, naturalWidth, naturalHeight } = e.currentTarget;
    const newCrop = centerAspectCrop(width, height, 1);
    setCrop(newCrop);

    // Also set the initial completedCrop in pixels
    const pixelCrop: PixelCrop = {
      unit: 'px',
      x: (newCrop.x / 100) * width,
      y: (newCrop.y / 100) * height,
      width: (newCrop.width / 100) * width,
      height: (newCrop.height / 100) * height,
    };
    setCompletedCrop(pixelCrop);
  }, []);

  // Update preview canvas when crop changes
  useEffect(() => {
    if (!completedCrop || !imgRef.current || !previewCanvasRef.current) return;

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelRatio = window.devicePixelRatio || 1;
    const previewSize = 120;

    canvas.width = previewSize * pixelRatio;
    canvas.height = previewSize * pixelRatio;
    canvas.style.width = `${previewSize}px`;
    canvas.style.height = `${previewSize}px`;

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    // Draw circular preview
    ctx.beginPath();
    ctx.arc(previewSize / 2, previewSize / 2, previewSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      previewSize,
      previewSize,
    );
  }, [completedCrop]);

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Output size for avatar
    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;

    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputSize,
      outputSize,
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.92
      );
    });
  }, [completedCrop]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const croppedBlob = await getCroppedImg();
      if (croppedBlob) {
        await onSave(croppedBlob);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, 1));
    }
  };

  // Make crop smaller
  const handleZoomOut = () => {
    if (!crop) return;
    const newWidth = Math.min(100, (crop.width as number) + 10);
    const newCrop = {
      ...crop,
      width: newWidth,
      height: newWidth,
      x: Math.max(0, 50 - newWidth / 2),
      y: Math.max(0, 50 - newWidth / 2),
    };
    setCrop(newCrop);
  };

  // Make crop larger (zoom in on face)
  const handleZoomIn = () => {
    if (!crop) return;
    const newWidth = Math.max(20, (crop.width as number) - 10);
    const newCrop = {
      ...crop,
      width: newWidth,
      height: newWidth,
      x: Math.min(100 - newWidth, 50 - newWidth / 2),
      y: Math.min(100 - newWidth, 50 - newWidth / 2),
    };
    setCrop(newCrop);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
        isDark ? 'bg-neutral-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? 'border-neutral-800' : 'border-gray-100'
        }`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {translations.title}
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop Area */}
        <div className={`p-5 ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            {/* Crop Tool */}
            <div className="flex-1 flex items-center justify-center">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                className="max-h-[40vh] rounded-lg overflow-hidden"
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: '40vh', width: 'auto' }}
                  crossOrigin="anonymous"
                />
              </ReactCrop>
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center gap-3">
              <p className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                Aperçu
              </p>
              <div className={`w-[120px] h-[120px] rounded-full overflow-hidden border-4 shadow-lg ${
                isDark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-200 bg-gray-100'
              }`}>
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={`px-5 py-4 border-t ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
          {/* Zoom Controls */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={handleZoomOut}
              className={`p-2.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 bg-neutral-800/50' : 'hover:bg-gray-200 text-gray-500 bg-gray-100'
              }`}
              title="Dézoomer"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            <span className={`text-sm px-3 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {translations.zoom}
            </span>

            <button
              onClick={handleZoomIn}
              className={`p-2.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 bg-neutral-800/50' : 'hover:bg-gray-200 text-gray-500 bg-gray-100'
              }`}
              title="Zoomer"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            <div className={`w-px h-6 mx-2 ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`} />

            <button
              onClick={handleReset}
              className={`p-2.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 bg-neutral-800/50' : 'hover:bg-gray-200 text-gray-500 bg-gray-100'
              }`}
              title={translations.reset}
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {translations.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !completedCrop}
              className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {translations.save}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
