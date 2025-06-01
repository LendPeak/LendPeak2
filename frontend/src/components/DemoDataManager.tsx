import { useState } from 'react';
import { TrashIcon, ArrowPathIcon, BeakerIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { demoLoanStorage } from '../services/demoLoanStorage';
import { toast } from 'react-toastify';

export const DemoDataManager = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      demoLoanStorage.clearAllData();
      toast.success('Demo data reset successfully');
      // Reload the page to refresh all components
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.error('Failed to reset demo data');
    } finally {
      setIsClearing(false);
      setShowConfirm(false);
    }
  };

  const exportData = () => {
    const data = demoLoanStorage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lendpeak-demo-data-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Demo data exported');
  };

  return (
    <div className="fixed bottom-4 right-20 z-[65]">
      {isCollapsed ? (
        // Collapsed state - just show icon
        <button
          onClick={() => setIsCollapsed(false)}
          className="bg-white rounded-full shadow-lg p-3 hover:shadow-xl transition-shadow duration-200 group"
          title="Demo Data Manager"
        >
          <BeakerIcon className="h-6 w-6 text-primary-600 group-hover:text-primary-700" />
        </button>
      ) : (
        // Expanded state - show full panel
        <div className="bg-white rounded-lg shadow-lg p-4 space-y-2 min-w-[240px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900">Demo Data Manager</h3>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={exportData}
              className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-3 w-3 mr-1" />
              Export
            </button>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50"
              >
                <TrashIcon className="h-3 w-3 mr-1" />
                Reset
              </button>
            ) : (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-red-600">Are you sure?</span>
                <button
                  onClick={handleClearData}
                  disabled={isClearing}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {isClearing ? 'Resetting...' : 'Yes'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-gray-700 bg-gray-200 hover:bg-gray-300"
                >
                  No
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">
            All changes are saved in your browser's local storage
          </p>
        </div>
      )}
    </div>
  );
};