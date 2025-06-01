import React from 'react';
import { BusinessIntelligenceDashboard } from '../../components/analytics/BusinessIntelligenceDashboard';

export const BusinessIntelligencePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Business Intelligence</h1>
        <p className="mt-2 text-sm text-gray-700">
          Advanced analytics, cohort analysis, vintage curves, stress testing, and fair lending compliance.
        </p>
      </div>
      
      <BusinessIntelligenceDashboard />
    </div>
  );
};