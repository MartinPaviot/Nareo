'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';
import AuthGuard from '@/components/auth/AuthGuard';
import { useLanguage } from '@/contexts/LanguageContext';

function UploadScreen() {
  const router = useRouter();
  const { translate } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const isValidFileType = (file: File) => {
    const validTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ];
    return validTypes.includes(file.type);
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return '📄'; // PDF icon
    } else if (file.type.includes('word') || file.type.includes('document')) {
      return '📝'; // Word document icon
    } else if (file.type.startsWith('image/')) {
      return '🖼️'; // Image icon
    }
    return '📎'; // Generic file icon
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFileType(droppedFile)) {
      setFile(droppedFile);
      if (droppedFile.type.startsWith('image/')) {
        createPreview(droppedFile);
      } else {
        setPreview(null); // Clear preview for non-image files
      }
      handleUpload(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFileType(selectedFile)) {
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        createPreview(selectedFile);
      } else {
        setPreview(null); // Clear preview for non-image files
      }
      handleUpload(selectedFile);
    }
  };

  const createPreview = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (fileToUpload: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Upload failed';
        const errorDetails = data.details ? `\n\nDetails: ${data.details}` : '';
        throw new Error(errorMessage + errorDetails);
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Upload error:', error);

      let errorMessage = translate('upload_error_failed');

      if (error instanceof Error) {
        if (error.message.includes('Please upload an image')) {
          errorMessage = translate('upload_error_invalid');
        } else if (error.message.includes('Failed to process')) {
          errorMessage = translate('upload_error_processing');
        } else if (error.message.includes('API')) {
          errorMessage = translate('upload_error_api');
          // Don't stop here, the fallback should work
        } else if (error.message) {
          errorMessage = error.message;
        }
      }

      alert(errorMessage);
      setIsUploading(false);
      setFile(null);
      setPreview(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 bg-orange-200 rounded-full animate-pulse-slow opacity-50"></div>
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="text-7xl animate-float">🎓🐱</div>
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            {translate('upload_title')}
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            {translate('upload_greeting')}
          </p>
          <p className="text-sm text-gray-500">
            {translate('upload_subtitle')}
          </p>
        </div>

        {/* Upload Area */}
        <label
          htmlFor="file-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            block relative border-2 border-dashed rounded-3xl p-12 text-center transition-all
            ${isDragging 
              ? 'border-orange-500 bg-orange-50 scale-105' 
              : 'border-gray-300 bg-white hover:border-orange-400 hover:bg-orange-50/50'
            }
            ${isUploading ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
          `}
        >
          <input
            id="file-upload"
            type="file"
            accept="image/*,.pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          {isUploading ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative w-24 h-24">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Uploading"
                      className="w-24 h-24 object-cover rounded-xl opacity-50"
                    />
                  ) : file ? (
                    <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center opacity-50">
                      <span className="text-5xl">{getFileIcon(file)}</span>
                    </div>
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  {translate('upload_analyzing')}
                </p>
                <p className="text-sm text-gray-600">
                  {translate('upload_extracting')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-xl border-2 border-orange-200"
                  />
                ) : file ? (
                  <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center border-2 border-orange-200">
                    <span className="text-6xl">{getFileIcon(file)}</span>
                  </div>
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-orange-500" />
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  {file ? file.name : translate('upload_drop_here')}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  {translate('upload_or_click')}
                </p>
                <p className="text-xs text-gray-500">
                  {translate('upload_supported')}: JPG, PNG, GIF, WebP, PDF, DOCX
                </p>
              </div>

              <div className="pt-4">
                <span className="inline-block px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors">
                  {translate('upload_choose_button')}
                </span>
              </div>
            </div>
          )}
        </label>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-2xl p-4 border border-gray-200">
            <div className="text-2xl mb-2">📸</div>
            <h3 className="font-semibold text-gray-900 mb-1">{translate('upload_card1_title')}</h3>
            <p className="text-sm text-gray-600">
              {translate('upload_card1_desc')}
            </p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 border border-gray-200">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-semibold text-gray-900 mb-1">{translate('upload_card2_title')}</h3>
            <p className="text-sm text-gray-600">
              {translate('upload_card2_desc')}
            </p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 border border-gray-200">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-semibold text-gray-900 mb-1">{translate('upload_card3_title')}</h3>
            <p className="text-sm text-gray-600">
              {translate('upload_card3_desc')}
            </p>
          </div>
        </div>

        {/* Example Images Hint */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            {translate('upload_tip')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedUploadScreen() {
  return (
    <AuthGuard>
      <UploadScreen />
    </AuthGuard>
  );
}
