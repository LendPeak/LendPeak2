import React from 'react';
import { BulkPaymentProcessor } from '../../components/payments/BulkPaymentProcessor';

export const BulkPaymentPage: React.FC = () => {
  const handleBatchComplete = (batch: any) => {
    console.log('Batch completed:', batch);
    // You could show a notification or update some global state here
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Bulk Payment Processing</h1>
        <p className="mt-2 text-sm text-gray-700">
          Upload, validate, and process payment files in bulk with comprehensive monitoring and error handling.
        </p>
      </div>
      
      <BulkPaymentProcessor onBatchComplete={handleBatchComplete} />
    </div>
  );
};