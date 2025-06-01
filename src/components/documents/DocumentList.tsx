import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Share2,
  FileText,
  Image,
  File,
  Filter,
  Search,
} from 'lucide-react';
import { apiClient } from '../../utils/api-client';
import { Button } from '../ui/Button';
import { formatFileSize, formatDate } from '../../utils/formatters';
import { toast } from 'react-toastify';

interface Document {
  id: string;
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  tags: string[];
  description?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface DocumentListProps {
  entityType: 'loan' | 'user' | 'application';
  entityId: string;
  showActions?: boolean;
  onDocumentSelect?: (document: Document) => void;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/gif': Image,
  default: File,
};

const CATEGORY_COLORS: Record<string, string> = {
  identity: 'bg-blue-100 text-blue-800',
  income: 'bg-green-100 text-green-800',
  employment: 'bg-purple-100 text-purple-800',
  bank_statement: 'bg-yellow-100 text-yellow-800',
  tax_return: 'bg-red-100 text-red-800',
  collateral: 'bg-indigo-100 text-indigo-800',
  contract: 'bg-pink-100 text-pink-800',
  agreement: 'bg-gray-100 text-gray-800',
  correspondence: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800',
};

export const DocumentList: React.FC<DocumentListProps> = ({
  entityType,
  entityId,
  showActions = true,
  onDocumentSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', entityType, entityId, selectedCategory, showVerifiedOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (showVerifiedOnly) params.append('verified', 'true');

      const response = await apiClient.get(
        `/documents/entity/${entityType}/${entityId}?${params}`
      );
      return response.data.data;
    },
  });

  // Download document
  const downloadMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiClient.get(`/documents/${documentId}/download`);
      return response.data.data;
    },
    onSuccess: (data) => {
      // Open the signed URL in a new tab to trigger download
      window.open(data.url, '_blank');
      toast.success('Document download started');
    },
    onError: () => {
      toast.error('Failed to download document');
    },
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiClient.delete(`/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['documents', entityType, entityId],
      });
      toast.success('Document deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });

  // Filter documents based on search term
  const filteredDocuments = documents?.filter((doc: Document) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      doc.fileName.toLowerCase().includes(searchLower) ||
      doc.category.toLowerCase().includes(searchLower) ||
      doc.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
      (doc.description && doc.description.toLowerCase().includes(searchLower))
    );
  });

  const getFileIcon = (mimeType: string) => {
    const Icon = FILE_ICONS[mimeType] || FILE_ICONS.default;
    return <Icon className="w-5 h-5" />;
  };

  const handleDownload = (document: Document) => {
    downloadMutation.mutate(document.documentId);
  };

  const handleDelete = (document: Document) => {
    if (window.confirm(`Are you sure you want to delete ${document.fileName}?`)) {
      deleteMutation.mutate(document.documentId);
    }
  };

  const handleView = (document: Document) => {
    if (onDocumentSelect) {
      onDocumentSelect(document);
    } else {
      downloadMutation.mutate(document.documentId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="identity">Identity</option>
              <option value="income">Income</option>
              <option value="employment">Employment</option>
              <option value="bank_statement">Bank Statement</option>
              <option value="tax_return">Tax Return</option>
              <option value="collateral">Collateral</option>
              <option value="contract">Contract</option>
              <option value="agreement">Agreement</option>
              <option value="correspondence">Correspondence</option>
              <option value="other">Other</option>
            </select>

            <label className="flex items-center space-x-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={showVerifiedOnly}
                onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Verified Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Document List */}
      {filteredDocuments && filteredDocuments.length > 0 ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {showActions && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((document: Document) => (
                  <tr key={document.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {getFileIcon(document.mimeType)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {document.fileName}
                          </div>
                          {document.description && (
                            <div className="text-sm text-gray-500">
                              {document.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          CATEGORY_COLORS[document.category] ||
                          CATEGORY_COLORS.other
                        }`}
                      >
                        {document.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(document.fileSize)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(document.uploadedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {document.isVerified ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span className="text-sm">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-400">
                          <XCircle className="w-4 h-4 mr-1" />
                          <span className="text-sm">Unverified</span>
                        </div>
                      )}
                    </td>
                    {showActions && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleView(document)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(document)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(document)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center">
          <File className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500">No documents found</p>
          {searchTerm && (
            <p className="text-sm text-gray-400 mt-1">
              Try adjusting your search criteria
            </p>
          )}
        </div>
      )}
    </div>
  );
};