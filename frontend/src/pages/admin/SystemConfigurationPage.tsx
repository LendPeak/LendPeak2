import React from 'react';
import { SystemConfigurationManager } from '../../components/admin/SystemConfigurationManager';

export const SystemConfigurationPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">System Configuration</h1>
        <p className="mt-2 text-sm text-gray-700">
          Configure system settings, monitor health, manage backups, and handle integrations.
        </p>
      </div>
      
      <SystemConfigurationManager />
    </div>
  );
};