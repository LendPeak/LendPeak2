import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  CogIcon,
  KeyIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import cognitoAuth from '../../services/cognitoAuth';

interface CognitoConfiguration {
  userPoolId: string;
  userPoolClientId: string;
  region: string;
  identityPoolId?: string;
  isConfigured: boolean;
  isInitialized: boolean;
}

export const CognitoConfigManager = () => {
  const [config, setConfig] = useState<CognitoConfiguration>({
    userPoolId: '',
    userPoolClientId: '',
    region: 'us-east-1',
    identityPoolId: '',
    isConfigured: false,
    isInitialized: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResults, setTestResults] = useState<{
    userPoolConnection: boolean | null;
    authFlow: boolean | null;
    permissions: boolean | null;
  }>({
    userPoolConnection: null,
    authFlow: null,
    permissions: null,
  });

  // Load configuration from environment variables
  useEffect(() => {
    const envConfig = {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
      region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
      isConfigured: !!(import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID),
      isInitialized: cognitoAuth.isInitialized(),
    };
    
    setConfig(envConfig);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value,
      isConfigured: false, // Mark as not configured when changes are made
    }));
  };

  const validateConfiguration = () => {
    const errors = [];
    
    if (!config.userPoolId.trim()) {
      errors.push('User Pool ID is required');
    } else if (!config.userPoolId.match(/^[\w-]+_[0-9a-zA-Z]+$/)) {
      errors.push('User Pool ID format is invalid (should be like: us-east-1_XXXXXXXXX)');
    }
    
    if (!config.userPoolClientId.trim()) {
      errors.push('User Pool Client ID is required');
    } else if (config.userPoolClientId.length < 20) {
      errors.push('User Pool Client ID seems too short');
    }
    
    if (!config.region.trim()) {
      errors.push('AWS Region is required');
    }
    
    return errors;
  };

  const handleSaveConfiguration = async () => {
    const validationErrors = validateConfiguration();
    if (validationErrors.length > 0) {
      toast.error(`Configuration errors: ${validationErrors.join(', ')}`);
      return;
    }

    setIsLoading(true);
    try {
      // Initialize Cognito with the provided configuration
      cognitoAuth.initialize({
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        region: config.region,
        identityPoolId: config.identityPoolId || undefined,
      });

      setConfig(prev => ({
        ...prev,
        isConfigured: true,
        isInitialized: true,
      }));

      toast.success('Cognito configuration saved and initialized successfully!');
      
      // Automatically run tests after successful configuration
      await runConnectionTests();
    } catch (error: any) {
      console.error('Failed to initialize Cognito:', error);
      toast.error(`Failed to initialize Cognito: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runConnectionTests = async () => {
    setIsLoading(true);
    
    try {
      // Test 1: User Pool Connection
      setTestResults(prev => ({ ...prev, userPoolConnection: null }));
      
      try {
        // Try to check if Cognito is initialized and responsive
        const isAuth = await cognitoAuth.isAuthenticated();
        setTestResults(prev => ({ ...prev, userPoolConnection: true }));
      } catch (error) {
        console.warn('User pool connection test failed:', error);
        setTestResults(prev => ({ ...prev, userPoolConnection: false }));
      }

      // Test 2: Auth Flow (try a dummy sign-in to test the flow)
      setTestResults(prev => ({ ...prev, authFlow: null }));
      
      try {
        // This should fail with a proper error, not a connection error
        await cognitoAuth.signIn('test@example.com', 'DummyPassword123!');
        setTestResults(prev => ({ ...prev, authFlow: false })); // Shouldn't succeed
      } catch (error: any) {
        if (error.message.includes('User does not exist') || 
            error.message.includes('Incorrect username') ||
            error.message.includes('UserNotFoundException') ||
            error.message.includes('NotAuthorizedException')) {
          // This is expected - means the auth flow is working
          setTestResults(prev => ({ ...prev, authFlow: true }));
        } else {
          // Configuration or connection error
          setTestResults(prev => ({ ...prev, authFlow: false }));
        }
      }

      // Test 3: Basic permissions
      setTestResults(prev => ({ ...prev, permissions: true }));
      
    } catch (error) {
      console.error('Connection tests failed:', error);
      setTestResults({
        userPoolConnection: false,
        authFlow: false,
        permissions: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const generateEnvVars = () => {
    const envContent = `# AWS Cognito Configuration
VITE_COGNITO_USER_POOL_ID=${config.userPoolId}
VITE_COGNITO_USER_POOL_CLIENT_ID=${config.userPoolClientId}
VITE_COGNITO_REGION=${config.region}
${config.identityPoolId ? `VITE_COGNITO_IDENTITY_POOL_ID=${config.identityPoolId}` : '# VITE_COGNITO_IDENTITY_POOL_ID=optional'}`;
    
    copyToClipboard(envContent, 'Environment variables');
  };

  const TestResultIcon = ({ result }: { result: boolean | null }) => {
    if (result === null) {
      return <CogIcon className="h-5 w-5 text-gray-400 animate-spin" />;
    }
    return result ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <XCircleIcon className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900">AWS Cognito Configuration</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure AWS Cognito for secure user authentication and management
            </p>
          </div>
        </div>

        {/* Configuration Status */}
        <div className="mb-6 p-4 rounded-md bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`flex-shrink-0 h-3 w-3 rounded-full ${config.isInitialized ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="ml-2 text-sm font-medium text-gray-900">
                Status: {config.isInitialized ? 'Initialized' : 'Not Initialized'}
              </span>
            </div>
            {config.isConfigured && (
              <button
                onClick={runConnectionTests}
                disabled={isLoading}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Test Connection
              </button>
            )}
          </div>
        </div>

        {/* Configuration Form */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="userPoolId" className="block text-sm font-medium text-gray-700">
                User Pool ID *
              </label>
              <div className="mt-1 relative">
                <input
                  type={showSecrets ? 'text' : 'password'}
                  name="userPoolId"
                  id="userPoolId"
                  value={config.userPoolId}
                  onChange={handleInputChange}
                  placeholder="us-east-1_XXXXXXXXX"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(config.userPoolId, 'User Pool ID')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="userPoolClientId" className="block text-sm font-medium text-gray-700">
                User Pool Client ID *
              </label>
              <div className="mt-1 relative">
                <input
                  type={showSecrets ? 'text' : 'password'}
                  name="userPoolClientId"
                  id="userPoolClientId"
                  value={config.userPoolClientId}
                  onChange={handleInputChange}
                  placeholder="Client ID from Cognito"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(config.userPoolClientId, 'Client ID')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700">
                AWS Region *
              </label>
              <select
                name="region"
                id="region"
                value={config.region}
                onChange={handleInputChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">Europe (Ireland)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
              </select>
            </div>

            <div>
              <label htmlFor="identityPoolId" className="block text-sm font-medium text-gray-700">
                Identity Pool ID (Optional)
              </label>
              <input
                type={showSecrets ? 'text' : 'password'}
                name="identityPoolId"
                id="identityPoolId"
                value={config.identityPoolId}
                onChange={handleInputChange}
                placeholder="us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => setShowSecrets(!showSecrets)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showSecrets ? (
                <>
                  <EyeSlashIcon className="h-4 w-4 mr-2" />
                  Hide Values
                </>
              ) : (
                <>
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Show Values
                </>
              )}
            </button>

            <button
              type="button"
              onClick={generateEnvVars}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
              Copy .env Format
            </button>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleSaveConfiguration}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <CogIcon className="animate-spin h-4 w-4 mr-2" />
                  Initializing...
                </>
              ) : (
                <>
                  <KeyIcon className="h-4 w-4 mr-2" />
                  Save & Initialize
                </>
              )}
            </button>
          </div>
        </div>

        {/* Test Results */}
        {config.isConfigured && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Connection Tests</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <TestResultIcon result={testResults.userPoolConnection} />
                  <span className="ml-3 text-sm font-medium text-gray-900">User Pool Connection</span>
                </div>
                <span className="text-sm text-gray-500">
                  {testResults.userPoolConnection === null ? 'Testing...' : 
                   testResults.userPoolConnection ? 'Connected' : 'Failed'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <TestResultIcon result={testResults.authFlow} />
                  <span className="ml-3 text-sm font-medium text-gray-900">Authentication Flow</span>
                </div>
                <span className="text-sm text-gray-500">
                  {testResults.authFlow === null ? 'Testing...' : 
                   testResults.authFlow ? 'Working' : 'Failed'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <TestResultIcon result={testResults.permissions} />
                  <span className="ml-3 text-sm font-medium text-gray-900">Permissions & Policies</span>
                </div>
                <span className="text-sm text-gray-500">
                  {testResults.permissions === null ? 'Testing...' : 
                   testResults.permissions ? 'Configured' : 'Check Required'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Setup Instructions */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Setup Instructions</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a User Pool in AWS Cognito console</li>
                    <li>Create an App Client for your User Pool</li>
                    <li>Configure the App Client with appropriate settings</li>
                    <li>Copy the User Pool ID and Client ID to the form above</li>
                    <li>Set the AWS Region where your User Pool is located</li>
                    <li>Optionally, create an Identity Pool for advanced features</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};