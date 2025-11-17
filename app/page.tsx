'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Sparkles, Zap, Home } from 'lucide-react';
import Image from 'next/image';
import AuthGuard from '@/components/auth/AuthGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import TopBarActions from '@/components/layout/TopBarActions';

// Mascot component with state machine
function MascotView({ isUploading, hasFile }: { isUploading: boolean; hasFile: boolean }) {
  const getMascotImage = () => {
    if (isUploading) {
      return '/chat/Processing.png'; // Processing state
    } else if (hasFile && !isUploading) {
      return '/chat/Drag_and_Drop.png'; // Success state (brief moment before redirect)
    } else {
      return '/chat/mascotte.png'; // Default state
    }
  };

  return (
    <div className="flex justify-center -mb-32">
      <div className="relative w-96 h-96 animate-float group">
        <div className="absolute inset-0 bg-orange-100/0 group-hover:bg-orange-100/30 rounded-full transition-all duration-300"></div>
        <Image
          src={getMascotImage()}
          alt="Aristo mascot"
          width={384}
          height={384}
          className="object-contain transition-all duration-300 relative z-10"
          priority
        />
      </div>
    </div>
  );
}

// Feature card component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-orange-100 hover:border-orange-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-sm text-gray-900 mb-1.5">{title}</h3>
      <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function UploadScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
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
        credentials: 'include', // Include cookies for authentication
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

  const handleGoHome = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Top Header with Home Button and Action Buttons */}
      <div className="flex justify-between items-center p-4">
        <button
          onClick={handleGoHome}
          className="flex items-center gap-2 h-10 px-4 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
          title={translate('sidebar_home')}
        >
          <Home className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {translate('sidebar_home')}
          </span>
        </button>
        
        <TopBarActions />
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-2">
        <div className="max-w-3xl w-full">
          {/* Header Section */}
          <div className="text-center mb-4">
            <h1 className="text-5xl font-bold mb-2">
              <span className="text-orange-500">{translate('upload_header_title')}</span>
            </h1>
            <p className="text-xl text-gray-600">
              {translate('upload_header_tagline')}
            </p>
          </div>

          {/* Mascot Section */}
          <MascotView isUploading={isUploading} hasFile={file !== null} />

          {/* Upload Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 border-2 border-orange-100 shadow-xl mb-4">
            <div className="text-center mb-3">
              <h2 className="text-xl font-bold text-gray-900 mb-1.5">
                {translate('upload_card_title')}
              </h2>
              <p className="text-sm text-gray-600">
                {translate('upload_card_subtitle')}
              </p>
            </div>

            <label
              htmlFor="file-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                block relative border-2 border-dashed rounded-2xl p-10 text-center transition-all
                ${isDragging 
                  ? 'border-orange-500 bg-orange-50 scale-[1.02]' 
                  : 'border-gray-300 bg-gray-50/50 hover:border-orange-400 hover:bg-orange-50/50'
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
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-900 mb-1.5">
                      {translate('upload_analyzing')}
                    </p>
                    <p className="text-xs text-gray-600">
                      {translate('upload_extracting')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-base font-semibold text-gray-900 mb-1.5">
                      {translate('upload_drop_here')}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      {translate('upload_or_click')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {translate('upload_supported')}: JPG, PNG, PDF, DOCX
                    </p>
                  </div>

                  <div className="pt-1.5">
                    <span className="inline-block px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg">
                      {translate('upload_choose_button')}
                    </span>
                  </div>
                </div>
              )}
            </label>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            <FeatureCard
              icon={<FileText className="w-5 h-5 text-orange-600" />}
              title={translate('upload_card1_title')}
              description={translate('upload_card1_desc')}
            />
            
            <FeatureCard
              icon={<Sparkles className="w-5 h-5 text-orange-600" />}
              title={translate('upload_card2_title')}
              description={translate('upload_card2_desc')}
            />
            
            <FeatureCard
              icon={<Zap className="w-5 h-5 text-orange-600" />}
              title={translate('upload_card3_title')}
              description={translate('upload_card3_desc')}
            />
          </div>

          {/* Tip */}
          <div className="text-center">
            <p className="text-sm text-gray-500">
              {translate('upload_tip')}
            </p>
          </div>
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
