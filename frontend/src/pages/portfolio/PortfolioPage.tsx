import React from 'react';
import { PortfolioDashboard } from '../../components/analytics/PortfolioDashboard';

export const PortfolioPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Portfolio Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Comprehensive portfolio analytics, risk assessment, and performance monitoring.
        </p>
      </div>
      
      <PortfolioDashboard />
    </div>
  );
};