import React, { useEffect, useState } from 'react';
import { X, Download, Share2, Maximize2, RotateCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { apiClient } from '../../utils/api-client';
import { toast } from 'react-toastify';

interface DocumentViewerProps {
  document: {
    documentId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    category: string;
    uploadedAt: string;
    isVerified: boolean;
  };
  onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  onClose,
}) => {
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    fetchDocumentUrl();
  }, [document.documentId]);

  const fetchDocumentUrl = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/documents/${document.documentId}/download`);
      setDocumentUrl(response.data.data.url);
    } catch (error) {
      toast.error('Failed to load document');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.open(documentUrl, '_blank');
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    // PDF viewer
    if (document.mimeType === 'application/pdf') {
      return (
        <iframe
          src={`${documentUrl}#toolbar=0`}
          className="w-full h-full"
          style={{
            transform: `rotate(${rotation}deg) scale(${scale})`,
            transformOrigin: 'center',
          }}
        />
      );
    }

    // Image viewer
    if (document.mimeType.startsWith('image/')) {
      return (
        <div className="flex justify-center items-center h-full p-4">
          <img
            src={documentUrl}
            alt={document.fileName}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `rotate(${rotation}deg) scale(${scale})`,
              transformOrigin: 'center',
            }}
          />
        </div>
      );
    }

    // Other file types - show download prompt
    return (
      <div className="flex flex-col justify-center items-center h-full p-8">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {document.fileName}
          </h3>
          <p className="text-gray-500 mb-4">
            This file type cannot be previewed in the browser
          </p>
          <Button onClick={handleDownload} variant="primary">
            Download File
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-75" onClick={onClose} />
      
      <div className="absolute inset-4 md:inset-8 bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {document.fileName}
            </h3>
            {document.isVerified && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Verified
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Zoom controls for images and PDFs */}
            {(document.mimeType.startsWith('image/') || document.mimeType === 'application/pdf') && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Zoom Out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Zoom In"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Rotate"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </>
            )}
            
            <button
              onClick={handleShare}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              Category: <span className="font-medium">{document.category.replace('_', ' ')}</span>
            </div>
            <div>
              Uploaded: <span className="font-medium">{new Date(document.uploadedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};