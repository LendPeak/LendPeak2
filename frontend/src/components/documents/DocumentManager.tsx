import React, { useState } from 'react';
import { DocumentUpload } from './DocumentUpload';
import { DocumentList } from './DocumentList';
import { DocumentViewer } from './DocumentViewer';
import { Plus, FolderOpen } from 'lucide-react';
import { Button } from '../ui/Button';

interface DocumentManagerProps {
  entityType: 'loan' | 'user' | 'application';
  entityId: string;
  title?: string;
  requiredCategories?: string[];
  canUpload?: boolean;
  canDelete?: boolean;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  entityType,
  entityId,
  title = 'Documents',
  requiredCategories = [],
  canUpload = true,
  canDelete = true,
}) => {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const handleUploadComplete = () => {
    setShowUpload(false);
    setSelectedCategory('');
  };

  const handleDocumentSelect = (document: any) => {
    setSelectedDocument(document);
  };

  const handleCloseViewer = () => {
    setSelectedDocument(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-gray-600 mt-1">
              Manage and view all documents related to this {entityType}
            </p>
          </div>
          
          {canUpload && (
            <Button
              onClick={() => setShowUpload(!showUpload)}
              variant={showUpload ? 'secondary' : 'primary'}
              icon={showUpload ? FolderOpen : Plus}
            >
              {showUpload ? 'View Documents' : 'Upload Document'}
            </Button>
          )}
        </div>

        {/* Required Documents Checklist */}
        {requiredCategories.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Required Documents
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {requiredCategories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-200" />
                  <span className="text-sm text-blue-800">
                    {category.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Section */}
        {showUpload && canUpload && (
          <div className="mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a category...</option>
                <option value="identity">Identity Verification</option>
                <option value="income">Income Proof</option>
                <option value="employment">Employment Verification</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="tax_return">Tax Return</option>
                <option value="collateral">Collateral Documentation</option>
                <option value="contract">Contract</option>
                <option value="agreement">Agreement</option>
                <option value="correspondence">Correspondence</option>
                <option value="other">Other</option>
              </select>
            </div>

            {selectedCategory && (
              <DocumentUpload
                entityType={entityType}
                entityId={entityId}
                category={selectedCategory}
                onUploadComplete={handleUploadComplete}
              />
            )}
          </div>
        )}
      </div>

      {/* Document List */}
      {!showUpload && (
        <DocumentList
          entityType={entityType}
          entityId={entityId}
          showActions={canDelete}
          onDocumentSelect={handleDocumentSelect}
        />
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
};