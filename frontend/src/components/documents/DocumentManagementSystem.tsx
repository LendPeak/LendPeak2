import { useState, useRef, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  FolderIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  TagIcon,
  CalendarIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowUpIcon,
  LockClosedIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

interface DocumentManagementSystemProps {
  loanId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  color: string;
}

interface DocumentFile {
  id: string;
  name: string;
  originalName: string;
  category: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  version: number;
  status: 'PROCESSING' | 'ACTIVE' | 'ARCHIVED' | 'REJECTED';
  tags: string[];
  description?: string;
  expirationDate?: Date;
  isConfidential: boolean;
  downloadCount: number;
  lastAccessed?: Date;
  checksum: string;
  thumbnailUrl?: string;
  ocrText?: string;
}

interface DocumentUploadProgress {
  file: File;
  progress: number;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  error?: string;
}

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: 'application', name: 'Loan Application', description: 'Initial loan application documents', required: true, color: 'bg-blue-100 text-blue-800' },
  { id: 'income', name: 'Income Verification', description: 'Pay stubs, tax returns, employment letters', required: true, color: 'bg-green-100 text-green-800' },
  { id: 'credit', name: 'Credit Documents', description: 'Credit reports, credit monitoring', required: true, color: 'bg-purple-100 text-purple-800' },
  { id: 'collateral', name: 'Collateral Documents', description: 'Property docs, vehicle titles, appraisals', required: false, color: 'bg-yellow-100 text-yellow-800' },
  { id: 'legal', name: 'Legal Documents', description: 'Contracts, agreements, disclosures', required: true, color: 'bg-red-100 text-red-800' },
  { id: 'correspondence', name: 'Correspondence', description: 'Letters, emails, communication records', required: false, color: 'bg-gray-100 text-gray-800' },
  { id: 'payment', name: 'Payment Records', description: 'Payment confirmations, receipts', required: false, color: 'bg-emerald-100 text-emerald-800' },
  { id: 'modification', name: 'Loan Modifications', description: 'Modification agreements and related docs', required: false, color: 'bg-indigo-100 text-indigo-800' },
  { id: 'other', name: 'Other Documents', description: 'Miscellaneous supporting documents', required: false, color: 'bg-orange-100 text-orange-800' },
];

export const DocumentManagementSystem = ({ loanId, isOpen, onClose, onSuccess }: DocumentManagementSystemProps) => {
  const [documents, setDocuments] = useState<DocumentFile[]>([
    // Demo documents
    {
      id: '1',
      name: 'loan_application.pdf',
      originalName: 'Loan Application - John Doe.pdf',
      category: 'application',
      type: 'application/pdf',
      size: 2450000,
      uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      uploadedBy: 'John Doe',
      version: 1,
      status: 'ACTIVE',
      tags: ['signed', 'original'],
      description: 'Initial loan application with all required signatures',
      isConfidential: true,
      downloadCount: 3,
      lastAccessed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      checksum: 'abc123def456',
    },
    {
      id: '2',
      name: 'pay_stub_march.pdf',
      originalName: 'Paystub - March 2024.pdf',
      category: 'income',
      type: 'application/pdf',
      size: 890000,
      uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      uploadedBy: 'Jane Smith',
      version: 1,
      status: 'ACTIVE',
      tags: ['income', 'current'],
      isConfidential: true,
      downloadCount: 1,
      checksum: 'def456ghi789',
    },
    {
      id: '3',
      name: 'credit_report.pdf',
      originalName: 'Credit Report - Experian.pdf',
      category: 'credit',
      type: 'application/pdf',
      size: 1200000,
      uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      uploadedBy: 'System',
      version: 1,
      status: 'ACTIVE',
      tags: ['experian', 'official'],
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isConfidential: true,
      downloadCount: 2,
      checksum: 'ghi789jkl012',
    },
  ]);

  const [uploadProgress, setUploadProgress] = useState<DocumentUploadProgress[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState('application');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadDescription, setUploadDescription] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<DocumentFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false;
      if (searchTerm && !doc.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !doc.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (selectedTags.length > 0 && !selectedTags.some(tag => doc.tags.includes(tag))) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.uploadedAt.getTime() - b.uploadedAt.getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get all unique tags
  const allTags = Array.from(new Set(documents.flatMap(doc => doc.tags)));

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    if (files.length > 0) {
      setShowUploadModal(true);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    setSelectedFiles(files);
    if (files.length > 0) {
      setShowUploadModal(true);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const uploadFiles = async () => {
    const newUploadProgress: DocumentUploadProgress[] = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'UPLOADING' as const,
    }));
    
    setUploadProgress(newUploadProgress);
    setShowUploadModal(false);

    // Simulate file upload with progress
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, progress } : item
        ));
      }

      // Simulate processing
      setUploadProgress(prev => prev.map((item, index) => 
        index === i ? { ...item, status: 'PROCESSING' } : item
      ));
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create document record
      const newDocument: DocumentFile = {
        id: Date.now().toString() + i,
        name: file.name,
        originalName: file.name,
        category: uploadCategory,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        uploadedBy: 'Current User',
        version: 1,
        status: 'ACTIVE',
        tags: uploadTags,
        description: uploadDescription,
        isConfidential,
        downloadCount: 0,
        checksum: 'new_' + Date.now(),
      };

      setDocuments(prev => [newDocument, ...prev]);
      
      setUploadProgress(prev => prev.map((item, index) => 
        index === i ? { ...item, status: 'COMPLETED' } : item
      ));
    }

    // Clear upload progress after a delay
    setTimeout(() => {
      setUploadProgress([]);
      setSelectedFiles([]);
      setUploadTags([]);
      setUploadDescription('');
      setIsConfidential(false);
    }, 2000);

    toast.success(`${selectedFiles.length} file(s) uploaded successfully`);
    onSuccess();
  };

  const downloadDocument = (doc: DocumentFile) => {
    // Simulate download
    console.log('Downloading document:', doc.name);
    
    // Update download count
    setDocuments(prev => prev.map(d => 
      d.id === doc.id 
        ? { ...d, downloadCount: d.downloadCount + 1, lastAccessed: new Date() }
        : d
    ));
    
    toast.success(`Downloading ${doc.name}`);
  };

  const deleteDocument = (doc: DocumentFile) => {
    if (window.confirm(`Are you sure you want to delete ${doc.name}?`)) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Document deleted successfully');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return DocumentTextIcon;
    if (type.includes('image')) return DocumentTextIcon;
    if (type.includes('word')) return DocumentTextIcon;
    if (type.includes('excel')) return DocumentTextIcon;
    return DocumentTextIcon;
  };

  const getCategoryInfo = (categoryId: string) => {
    return DOCUMENT_CATEGORIES.find(cat => cat.id === categoryId) || DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1];
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 w-full max-w-7xl">
                <div className="bg-white">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200">
                          <FolderIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                            Document Management
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              {loanId}
                            </span>
                            <span>•</span>
                            <span>{documents.length} documents</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    {/* Upload Progress */}
                    {uploadProgress.length > 0 && (
                      <div className="mb-6 space-y-2">
                        {uploadProgress.map((progress, index) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-blue-900">{progress.file.name}</span>
                              <span className="text-sm text-blue-700">
                                {progress.status === 'UPLOADING' ? `${progress.progress}%` : progress.status}
                              </span>
                            </div>
                            {progress.status === 'UPLOADING' && (
                              <div className="w-full bg-blue-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${progress.progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Area */}
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer mb-6"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium text-indigo-600 hover:text-indigo-500">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG up to 10MB</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>

                    {/* Filters and Search */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        {/* Category Filter */}
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="all">All Categories</option>
                          {DOCUMENT_CATEGORIES.map(category => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>

                        {/* Search */}
                        <div className="relative">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search documents..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        {/* Tag Filter */}
                        {allTags.length > 0 && (
                          <select
                            multiple
                            value={selectedTags}
                            onChange={(e) => setSelectedTags(Array.from(e.target.selectedOptions, option => option.value))}
                            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          >
                            {allTags.map(tag => (
                              <option key={tag} value={tag}>{tag}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Sort */}
                        <select
                          value={`${sortBy}-${sortOrder}`}
                          onChange={(e) => {
                            const [field, order] = e.target.value.split('-');
                            setSortBy(field as any);
                            setSortOrder(order as any);
                          }}
                          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="date-desc">Newest First</option>
                          <option value="date-asc">Oldest First</option>
                          <option value="name-asc">Name A-Z</option>
                          <option value="name-desc">Name Z-A</option>
                          <option value="size-desc">Largest First</option>
                          <option value="size-asc">Smallest First</option>
                        </select>
                      </div>
                    </div>

                    {/* Document Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredDocuments.map((doc) => {
                        const FileIcon = getFileIcon(doc.type);
                        const categoryInfo = getCategoryInfo(doc.category);
                        
                        return (
                          <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <FileIcon className="h-5 w-5 text-gray-400" />
                                {doc.isConfidential && <LockClosedIcon className="h-4 w-4 text-red-500" />}
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                                {categoryInfo.name}
                              </span>
                            </div>

                            <h4 className="text-sm font-medium text-gray-900 truncate mb-1" title={doc.originalName}>
                              {doc.originalName}
                            </h4>
                            
                            {doc.description && (
                              <p className="text-xs text-gray-600 mb-2 line-clamp-2">{doc.description}</p>
                            )}

                            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                              <span>{formatFileSize(doc.size)}</span>
                              <span>{format(doc.uploadedAt, 'MMM d, yyyy')}</span>
                            </div>

                            {doc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {doc.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {tag}
                                  </span>
                                ))}
                                {doc.tags.length > 2 && (
                                  <span className="text-xs text-gray-500">+{doc.tags.length - 2}</span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => setViewingDocument(doc)}
                                  className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                  title="View"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => downloadDocument(doc)}
                                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                  title="Download"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteDocument(doc)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Delete"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                              
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                {doc.downloadCount > 0 && (
                                  <span title={`Downloaded ${doc.downloadCount} times`}>
                                    📥 {doc.downloadCount}
                                  </span>
                                )}
                                {doc.expirationDate && (
                                  <span className="text-orange-500" title={`Expires ${format(doc.expirationDate, 'MMM d, yyyy')}`}>
                                    ⏰
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {filteredDocuments.length === 0 && (
                      <div className="text-center py-12">
                        <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {searchTerm || selectedCategory !== 'all' || selectedTags.length > 0
                            ? 'Try adjusting your filters or search terms.'
                            : 'Upload your first document to get started.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 px-6 py-4 flex justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    >
                      <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                      Upload Documents
                    </button>
                  </div>
                </div>

                {/* Upload Modal */}
                {showUploadModal && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Documents</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Category</label>
                          <select
                            value={uploadCategory}
                            onChange={(e) => setUploadCategory(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          >
                            {DOCUMENT_CATEGORIES.map(category => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Description</label>
                          <textarea
                            value={uploadDescription}
                            onChange={(e) => setUploadDescription(e.target.value)}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Brief description of the document(s)..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
                          <input
                            type="text"
                            value={uploadTags.join(', ')}
                            onChange={(e) => setUploadTags(e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="e.g., signed, original, verified"
                          />
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isConfidential}
                            onChange={(e) => setIsConfidential(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label className="ml-2 text-sm text-gray-700">Mark as confidential</label>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Files to upload:</h4>
                          <div className="space-y-1">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="truncate">{file.name}</span>
                                <span className="text-gray-500">{formatFileSize(file.size)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end space-x-3">
                        <button
                          onClick={() => {
                            setShowUploadModal(false);
                            setSelectedFiles([]);
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={uploadFiles}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                        >
                          Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Viewer Modal */}
                {viewingDocument && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-[80]">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">{viewingDocument.originalName}</h3>
                        <button
                          onClick={() => setViewingDocument(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Category:</span>
                            <span className="ml-2">{getCategoryInfo(viewingDocument.category).name}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Size:</span>
                            <span className="ml-2">{formatFileSize(viewingDocument.size)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Uploaded:</span>
                            <span className="ml-2">{format(viewingDocument.uploadedAt, 'MMM d, yyyy h:mm a')}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Uploaded by:</span>
                            <span className="ml-2">{viewingDocument.uploadedBy}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Downloads:</span>
                            <span className="ml-2">{viewingDocument.downloadCount}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Version:</span>
                            <span className="ml-2">{viewingDocument.version}</span>
                          </div>
                        </div>

                        {viewingDocument.description && (
                          <div>
                            <span className="font-medium text-gray-700">Description:</span>
                            <p className="mt-1 text-sm text-gray-600">{viewingDocument.description}</p>
                          </div>
                        )}

                        {viewingDocument.tags.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700">Tags:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {viewingDocument.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="border-t pt-4">
                          <div className="text-center py-8 text-gray-500">
                            <DocumentTextIcon className="h-16 w-16 mx-auto mb-2" />
                            <p>Document preview would be displayed here</p>
                            <p className="text-xs">Supports PDF, images, and office documents</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end space-x-3">
                        <button
                          onClick={() => downloadDocument(viewingDocument)}
                          className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4 mr-2 inline" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};