import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, File, Image, FileText, AlertCircle } from 'lucide-react';
import { apiClient } from '../../utils/api-client';
import { Button } from '../ui/Button';
import { toast } from 'react-toastify';

interface DocumentUploadProps {
  entityType: 'loan' | 'user' | 'application';
  entityId: string;
  category: string;
  onUploadComplete?: (document: any) => void;
  maxFileSize?: number;
  acceptedFileTypes?: string[];
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/gif': Image,
  default: File,
};

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  entityType,
  entityId,
  category,
  onUploadComplete,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedFileTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
}) => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('category', category);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      return apiClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;

          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: {
              fileName: file.name,
              progress,
              status: 'uploading',
            },
          }));
        },
      });
    },
    onSuccess: (response, file) => {
      setUploadProgress((prev) => ({
        ...prev,
        [file.name]: {
          fileName: file.name,
          progress: 100,
          status: 'success',
        },
      }));

      // Invalidate document queries
      queryClient.invalidateQueries({
        queryKey: ['documents', entityType, entityId],
      });

      if (onUploadComplete) {
        onUploadComplete(response.data.data);
      }

      toast.success(`${file.name} uploaded successfully`);

      // Remove from progress after 3 seconds
      setTimeout(() => {
        setUploadProgress((prev) => {
          const { [file.name]: _, ...rest } = prev;
          return rest;
        });
      }, 3000);
    },
    onError: (error: any, file) => {
      const errorMessage = error.response?.data?.error?.message || 'Upload failed';

      setUploadProgress((prev) => ({
        ...prev,
        [file.name]: {
          fileName: file.name,
          progress: 0,
          status: 'error',
          error: errorMessage,
        },
      }));

      toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        // Validate file size
        if (file.size > maxFileSize) {
          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: {
              fileName: file.name,
              progress: 0,
              status: 'error',
              error: `File size exceeds ${maxFileSize / (1024 * 1024)}MB limit`,
            },
          }));
          return;
        }

        // Validate file type
        if (!acceptedFileTypes.includes(file.type)) {
          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: {
              fileName: file.name,
              progress: 0,
              status: 'error',
              error: 'File type not supported',
            },
          }));
          return;
        }

        // Upload file
        uploadMutation.mutate(file);
      });
    },
    [uploadMutation, maxFileSize, acceptedFileTypes],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxFileSize,
  });

  const removeUpload = (fileName: string) => {
    setUploadProgress((prev) => {
      const { [fileName]: _, ...rest } = prev;
      return rest;
    });
  };

  const getFileIcon = (mimeType: string) => {
    const Icon = FILE_ICONS[mimeType] || FILE_ICONS.default;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${
    isDragActive
      ? 'border-blue-500 bg-blue-50'
      : 'border-gray-300 hover:border-gray-400'
    }
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        {isDragActive ? (
          <p className="text-blue-600">Drop the files here...</p>
        ) : (
          <>
            <p className="text-gray-600">
              Drag & drop files here, or click to select
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Maximum file size: {maxFileSize / (1024 * 1024)}MB
            </p>
          </>
        )}
      </div>

      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.values(uploadProgress).map((upload) => (
            <div
              key={upload.fileName}
              className="bg-white border rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getFileIcon(
                    acceptedFileTypes.find((type) =>
                      upload.fileName.toLowerCase().endsWith(
                        type.split('/')[1],
                      ),
                    ) || 'default',
                  )}
                  <span className="text-sm font-medium truncate max-w-xs">
                    {upload.fileName}
                  </span>
                </div>
                <button
                  onClick={() => removeUpload(upload.fileName)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {upload.status === 'uploading' && (
                <div className="relative w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}

              {upload.status === 'success' && (
                <div className="flex items-center text-green-600 text-sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Upload complete
                </div>
              )}

              {upload.status === 'error' && (
                <div className="flex items-center text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {upload.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};