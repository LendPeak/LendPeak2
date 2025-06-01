import React, { useState } from 'react';
import { LoanOriginationPipeline } from '../../components/loans/LoanOriginationPipeline';

export const LoanOriginationPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Handle success logic
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Loan Origination Pipeline</h1>
        <p className="mt-2 text-sm text-gray-700">
          Complete loan origination workflow from application to funding with automated underwriting.
        </p>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Origination Workflow</h3>
          <p className="text-sm text-gray-600 mb-6">
            Launch the comprehensive loan origination pipeline to process new applications.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Open Origination Pipeline
          </button>
        </div>
      </div>
      
      <LoanOriginationPipeline 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
};