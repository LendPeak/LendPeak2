import React from 'react';
import { SuspenseAccountManager } from '../../components/payments/SuspenseAccountManager';

export const SuspenseAccountPage: React.FC = () => {
  const handlePaymentApplied = (payment: any, loanNumber: string) => {
    console.log('Payment applied:', { payment, loanNumber });
    // You could show a notification or update some global state here
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Suspense Account Management</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage unapplied payments, research customer information, and match payments to appropriate loans.
        </p>
      </div>
      
      <SuspenseAccountManager onPaymentApplied={handlePaymentApplied} />
    </div>
  );
};