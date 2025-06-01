import React from 'react';
import { DocumentManager } from '../components/documents/DocumentManager';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const DocumentDemoPage: React.FC = () => {
  // Demo loan ID - in real app, this would come from route params or context
  const demoLoanId = 'demo-loan-123';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <DocumentManager
            entityType="loan"
            entityId={demoLoanId}
            title="Loan Documents"
            requiredCategories={['identity', 'income', 'bank_statement']}
            canUpload={true}
            canDelete={true}
          />
        </div>
      </div>
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};