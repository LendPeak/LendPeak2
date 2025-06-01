import React, { useState, useEffect, useRef } from 'react';
import {
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
  ChartBarIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { format, subDays } from 'date-fns';

interface DocumentFile {
  id: string;
  name: string;
  originalName: string;
  category: string;
  type: string;
  size: number;
  uploadDate: Date;
  uploadedBy: string;
  loanId?: string;
  borrowerName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  version: number;
  tags: string[];
  description?: string;
  confidential: boolean;
  accessLog: AccessLogEntry[];
}

interface AccessLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: 'VIEW' | 'DOWNLOAD' | 'EDIT' | 'DELETE' | 'SHARE';
  timestamp: Date;
  ipAddress: string;
}

interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  color: string;
}

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'categories' | 'analytics' | 'settings'>('documents');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Demo data
  useEffect(() => {
    const demoCategories: DocumentCategory[] = [
      { id: '1', name: 'Loan Applications', description: 'Original loan application documents', required: true, color: 'blue' },
      { id: '2', name: 'Income Verification', description: 'Pay stubs, tax returns, employment letters', required: true, color: 'green' },
      { id: '3', name: 'Credit Reports', description: 'Credit reports and scores', required: true, color: 'purple' },
      { id: '4', name: 'Collateral Documents', description: 'Appraisals, titles, insurance', required: false, color: 'orange' },
      { id: '5', name: 'Legal Documents', description: 'Contracts, amendments, legal notices', required: false, color: 'red' },
      { id: '6', name: 'Correspondence', description: 'Email, letters, notes', required: false, color: 'gray' },
    ];

    const demoDocuments: DocumentFile[] = [
      {
        id: '1',
        name: 'loan_application_001.pdf',
        originalName: 'Loan Application - John Smith.pdf',
        category: '1',
        type: 'application/pdf',
        size: 245760,
        uploadDate: subDays(new Date(), 5),
        uploadedBy: 'Sarah Johnson',
        loanId: 'L001',
        borrowerName: 'John Smith',
        status: 'APPROVED',
        version: 1,
        tags: ['application', 'complete'],
        description: 'Initial loan application for mortgage',
        confidential: true,
        accessLog: [
          {
            id: '1',
            userId: 'U001',
            userName: 'Sarah Johnson',
            action: 'VIEW',
            timestamp: subDays(new Date(), 1),
            ipAddress: '192.168.1.100'
          }
        ]
      },
      {
        id: '2',
        name: 'income_verification_001.pdf',
        originalName: 'Pay Stub - March 2024.pdf',
        category: '2',
        type: 'application/pdf',
        size: 156430,
        uploadDate: subDays(new Date(), 3),
        uploadedBy: 'Mike Wilson',
        loanId: 'L001',
        borrowerName: 'John Smith',
        status: 'PENDING',
        version: 1,
        tags: ['income', 'paystub', 'verification'],
        description: 'Most recent pay stub for income verification',
        confidential: true,
        accessLog: []
      },
      {
        id: '3',
        name: 'credit_report_001.pdf',
        originalName: 'Credit Report - Experian.pdf',
        category: '3',
        type: 'application/pdf',
        size: 89234,
        uploadDate: subDays(new Date(), 7),
        uploadedBy: 'Agent Davis',
        loanId: 'L002',
        borrowerName: 'Sarah Davis',
        status: 'APPROVED',
        version: 2,
        tags: ['credit', 'experian', 'score'],
        description: 'Updated credit report with latest score',
        confidential: true,
        accessLog: [
          {
            id: '2',
            userId: 'U002',
            userName: 'Agent Davis',
            action: 'DOWNLOAD',
            timestamp: subDays(new Date(), 2),
            ipAddress: '192.168.1.101'
          }
        ]
      }
    ];

    setCategories(demoCategories);
    setDocuments(demoDocuments);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'text-green-600 bg-green-50';
      case 'PENDING': return 'text-yellow-600 bg-yellow-50';
      case 'REJECTED': return 'text-red-600 bg-red-50';
      case 'ARCHIVED': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'text-gray-600 bg-gray-50';
    
    switch (category.color) {
      case 'blue': return 'text-blue-600 bg-blue-50';
      case 'green': return 'text-green-600 bg-green-50';
      case 'purple': return 'text-purple-600 bg-purple-50';
      case 'orange': return 'text-orange-600 bg-orange-50';
      case 'red': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;
    const matchesSearch = searchQuery === '' || 
      doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.borrowerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const newDocument: DocumentFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: `doc_${Date.now()}.${file.name.split('.').pop()}`,
          originalName: file.name,
          category: '1', // Default to first category
          type: file.type,
          size: file.size,
          uploadDate: new Date(),
          uploadedBy: 'Current User',
          status: 'PENDING',
          version: 1,
          tags: [],
          confidential: false,
          accessLog: []
        };
        
        setDocuments(prev => [...prev, newDocument]);
        toast.success(`${file.name} uploaded successfully`);
      });
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedDocuments.length === 0) {
      toast.warning('Please select documents first');
      return;
    }

    switch (action) {
      case 'approve':
        setDocuments(prev => prev.map(doc => 
          selectedDocuments.includes(doc.id) ? { ...doc, status: 'APPROVED' as const } : doc
        ));
        toast.success(`${selectedDocuments.length} documents approved`);
        break;
      case 'reject':
        setDocuments(prev => prev.map(doc => 
          selectedDocuments.includes(doc.id) ? { ...doc, status: 'REJECTED' as const } : doc
        ));
        toast.success(`${selectedDocuments.length} documents rejected`);
        break;
      case 'archive':
        setDocuments(prev => prev.map(doc => 
          selectedDocuments.includes(doc.id) ? { ...doc, status: 'ARCHIVED' as const } : doc
        ));
        toast.success(`${selectedDocuments.length} documents archived`);
        break;
      case 'delete':
        setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)));
        toast.success(`${selectedDocuments.length} documents deleted`);
        break;
    }
    
    setSelectedDocuments([]);
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const selectAllDocuments = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Document Management</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage loan documents, compliance files, and automated document workflows.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { key: 'documents', name: 'Documents', icon: DocumentTextIcon },
            { key: 'categories', name: 'Categories', icon: FolderIcon },
            { key: 'analytics', name: 'Analytics', icon: ChartBarIcon },
            { key: 'settings', name: 'Settings', icon: CogIcon },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Upload & Search Bar */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                  Upload Documents
                </button>
                
                {selectedDocuments.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{selectedDocuments.length} selected</span>
                    <button
                      onClick={() => handleBulkAction('approve')}
                      className="text-sm text-green-600 hover:text-green-800"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleBulkAction('reject')}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleBulkAction('archive')}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-wrap items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Documents ({filteredDocuments.length})
              </h3>
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.length === filteredDocuments.length && filteredDocuments.length > 0}
                          onChange={selectAllDocuments}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Document
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Borrower
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedDocuments.includes(doc.id)}
                            onChange={() => toggleDocumentSelection(doc.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{doc.originalName}</div>
                              <div className="text-sm text-gray-500 flex items-center space-x-2">
                                <span>v{doc.version}</span>
                                {doc.confidential && <LockClosedIcon className="h-3 w-3" />}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(doc.category)}`}>
                            {getCategoryName(doc.category)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm text-gray-900">{doc.borrowerName || 'N/A'}</div>
                            <div className="text-sm text-gray-500">{doc.loanId || 'No loan'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatFileSize(doc.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            <div>{format(doc.uploadDate, 'MMM dd, yyyy')}</div>
                            <div>{doc.uploadedBy}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button className="text-indigo-600 hover:text-indigo-900">
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button className="text-green-600 hover:text-green-900">
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </button>
                            <button className="text-gray-600 hover:text-gray-900">
                              <ShareIcon className="h-4 w-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-900">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Document Categories</h3>
              <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                <FolderIcon className="h-4 w-4 mr-2" />
                Add Category
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <div key={category.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-medium text-gray-900">{category.name}</h4>
                    <div className="flex items-center space-x-2">
                      {category.required && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                      <span className={`w-3 h-3 rounded-full bg-${category.color}-500`}></span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {documents.filter(doc => doc.category === category.id).length} documents
                    </span>
                    <div className="flex items-center space-x-2">
                      <button className="text-indigo-600 hover:text-indigo-900">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DocumentTextIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Documents</dt>
                      <dd className="text-lg font-medium text-gray-900">{documents.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {documents.filter(doc => doc.status === 'APPROVED').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {documents.filter(doc => doc.status === 'PENDING').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CloudArrowUpIcon className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Storage Used</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatFileSize(documents.reduce((total, doc) => total + doc.size, 0))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Documents by Category</h3>
              <div className="space-y-3">
                {categories.map(category => {
                  const count = documents.filter(doc => doc.category === category.id).length;
                  const percentage = documents.length > 0 ? (count / documents.length) * 100 : 0;
                  return (
                    <div key={category.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{category.name}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full bg-${category.color}-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Document Status Distribution</h3>
              <div className="space-y-3">
                {['APPROVED', 'PENDING', 'REJECTED', 'ARCHIVED'].map(status => {
                  const count = documents.filter(doc => doc.status === status).length;
                  const percentage = documents.length > 0 ? (count / documents.length) * 100 : 0;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{status}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Document Management Settings</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4">Upload Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Maximum file size</label>
                      <p className="text-sm text-gray-500">Maximum size for uploaded documents</p>
                    </div>
                    <select className="text-sm border border-gray-300 rounded-md px-3 py-2">
                      <option>10 MB</option>
                      <option>25 MB</option>
                      <option>50 MB</option>
                      <option>100 MB</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Allowed file types</label>
                      <p className="text-sm text-gray-500">File types that can be uploaded</p>
                    </div>
                    <div className="text-sm text-gray-600">PDF, DOC, DOCX, JPG, PNG</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4">Retention Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Document retention period</label>
                      <p className="text-sm text-gray-500">How long to keep documents after loan closure</p>
                    </div>
                    <select className="text-sm border border-gray-300 rounded-md px-3 py-2">
                      <option>3 years</option>
                      <option>5 years</option>
                      <option>7 years</option>
                      <option>10 years</option>
                      <option>Permanent</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Auto-archive completed loans</label>
                      <p className="text-sm text-gray-500">Automatically archive documents when loans are paid off</p>
                    </div>
                    <input 
                      type="checkbox" 
                      defaultChecked
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4">Security Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Require approval for uploads</label>
                      <p className="text-sm text-gray-500">All uploaded documents must be approved before use</p>
                    </div>
                    <input 
                      type="checkbox" 
                      defaultChecked
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Enable audit logging</label>
                      <p className="text-sm text-gray-500">Log all document access and modifications</p>
                    </div>
                    <input 
                      type="checkbox" 
                      defaultChecked
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Encrypt documents at rest</label>
                      <p className="text-sm text-gray-500">Use AES-256 encryption for stored documents</p>
                    </div>
                    <input 
                      type="checkbox" 
                      defaultChecked
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};