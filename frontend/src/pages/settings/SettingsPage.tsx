import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  UserIcon,
  BellIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  KeyIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useDemoAuth } from '../../contexts/DemoAuthContext';
import { toast } from 'react-toastify';

interface SettingsSection {
  id: string;
  name: string;
  icon: any;
}

const settingsSections: SettingsSection[] = [
  { id: 'profile', name: 'Profile', icon: UserIcon },
  { id: 'notifications', name: 'Notifications', icon: BellIcon },
  { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  { id: 'payment', name: 'Payment Methods', icon: CreditCardIcon },
  { id: 'preferences', name: 'Preferences', icon: DocumentTextIcon },
  { id: 'api', name: 'API Settings', icon: GlobeAltIcon },
];

const profileSchema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  phone: yup.string(),
  company: yup.string(),
});

type ProfileFormData = yup.InferType<typeof profileSchema>;

export const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const { user } = useDemoAuth();
  const [isSaving, setIsSaving] = useState(false);

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: '(555) 123-4567',
      company: 'Demo Company Inc.',
    },
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    paymentReminders: true,
    loanStatusUpdates: true,
    weeklyReports: false,
    marketingEmails: false,
  });

  // Security settings
  const [security, setSecurity] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 30,
    ipRestriction: false,
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    dateFormat: 'MM/DD/YYYY',
    timeZone: 'America/New_York',
    currency: 'USD',
    language: 'en',
    theme: 'light',
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const saveNotifications = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSecurity = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Security settings updated');
    } catch (error) {
      toast.error('Failed to update security settings');
    } finally {
      setIsSaving(false);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeSection === section.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="flex-shrink-0 -ml-1 mr-3 h-6 w-6" />
                  {section.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <div className="bg-white shadow rounded-lg">
            {/* Profile Settings */}
            {activeSection === 'profile' && (
              <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Update your personal information and contact details
                  </p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        First Name
                      </label>
                      <input
                        type="text"
                        {...registerProfile('firstName')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                      {profileErrors.firstName && (
                        <p className="mt-1 text-sm text-red-600">{profileErrors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Last Name
                      </label>
                      <input
                        type="text"
                        {...registerProfile('lastName')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                      {profileErrors.lastName && (
                        <p className="mt-1 text-sm text-red-600">{profileErrors.lastName.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        {...registerProfile('email')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                      {profileErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{profileErrors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        {...registerProfile('phone')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Company
                      </label>
                      <input
                        type="text"
                        {...registerProfile('company')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 text-right">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Notification Settings */}
            {activeSection === 'notifications' && (
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose how you want to receive notifications
                  </p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={notifications.emailAlerts}
                        onChange={(e) => setNotifications({ ...notifications, emailAlerts: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">
                          Email Alerts
                        </label>
                        <p className="text-sm text-gray-500">
                          Receive important notifications via email
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={notifications.smsAlerts}
                        onChange={(e) => setNotifications({ ...notifications, smsAlerts: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">
                          SMS Alerts
                        </label>
                        <p className="text-sm text-gray-500">
                          Get text messages for urgent updates
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={notifications.paymentReminders}
                        onChange={(e) => setNotifications({ ...notifications, paymentReminders: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">
                          Payment Reminders
                        </label>
                        <p className="text-sm text-gray-500">
                          Remind borrowers of upcoming payments
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={notifications.loanStatusUpdates}
                        onChange={(e) => setNotifications({ ...notifications, loanStatusUpdates: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">
                          Loan Status Updates
                        </label>
                        <p className="text-sm text-gray-500">
                          Get notified when loan statuses change
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={notifications.weeklyReports}
                        onChange={(e) => setNotifications({ ...notifications, weeklyReports: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">
                          Weekly Reports
                        </label>
                        <p className="text-sm text-gray-500">
                          Receive weekly portfolio summary reports
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={notifications.marketingEmails}
                        onChange={(e) => setNotifications({ ...notifications, marketingEmails: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="ml-3">
                        <label className="text-sm font-medium text-gray-700">
                          Marketing Emails
                        </label>
                        <p className="text-sm text-gray-500">
                          Updates about new features and promotions
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 text-right">
                  <button
                    onClick={saveNotifications}
                    disabled={isSaving}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeSection === 'security' && (
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage your account security preferences
                  </p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Password</label>
                    <div className="mt-1">
                      <button className="text-sm text-primary-600 hover:text-primary-500">
                        Change Password
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Two-Factor Authentication
                        </label>
                        <p className="text-sm text-gray-500">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <button
                        onClick={() => setSecurity({ ...security, twoFactorEnabled: !security.twoFactorEnabled })}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          security.twoFactorEnabled ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            security.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Session Timeout (minutes)
                    </label>
                    <select
                      value={security.sessionTimeout}
                      onChange={(e) => setSecurity({ ...security, sessionTimeout: parseInt(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          IP Address Restriction
                        </label>
                        <p className="text-sm text-gray-500">
                          Restrict access to specific IP addresses
                        </p>
                      </div>
                      <button
                        onClick={() => setSecurity({ ...security, ipRestriction: !security.ipRestriction })}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          security.ipRestriction ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            security.ipRestriction ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 text-right">
                  <button
                    onClick={saveSecurity}
                    disabled={isSaving}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Security Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Methods */}
            {activeSection === 'payment' && (
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Payment Methods</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage payment processing methods and settings
                  </p>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CreditCardIcon className="h-8 w-8 text-gray-400" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">ACH Transfers</p>
                            <p className="text-sm text-gray-500">Primary payment method</p>
                          </div>
                        </div>
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CreditCardIcon className="h-8 w-8 text-gray-400" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">Wire Transfers</p>
                            <p className="text-sm text-gray-500">For large transactions</p>
                          </div>
                        </div>
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      </div>
                    </div>
                    <button className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                      + Add Payment Method
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences */}
            {activeSection === 'preferences' && (
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Preferences</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Customize your application experience
                  </p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Date Format
                    </label>
                    <select
                      value={preferences.dateFormat}
                      onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Time Zone
                    </label>
                    <select
                      value={preferences.timeZone}
                      onChange={(e) => setPreferences({ ...preferences, timeZone: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Currency
                    </label>
                    <select
                      value={preferences.currency}
                      onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Language
                    </label>
                    <select
                      value={preferences.language}
                      onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 text-right">
                  <button
                    onClick={savePreferences}
                    disabled={isSaving}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            )}

            {/* API Settings */}
            {activeSection === 'api' && (
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">API Settings</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage API keys and webhook configurations
                  </p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Keys
                    </label>
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Production API Key</p>
                            <p className="text-sm text-gray-500 font-mono">sk_prod_**********************</p>
                          </div>
                          <button className="text-sm text-primary-600 hover:text-primary-500">
                            Regenerate
                          </button>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Test API Key</p>
                            <p className="text-sm text-gray-500 font-mono">sk_test_**********************</p>
                          </div>
                          <button className="text-sm text-primary-600 hover:text-primary-500">
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook Endpoints
                    </label>
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-900">Payment Events</p>
                        <p className="text-sm text-gray-500 font-mono">https://api.example.com/webhooks/payments</p>
                      </div>
                      <button className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        + Add Webhook Endpoint
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Demo Notice */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Demo Mode</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Settings changes are simulated in demo mode. In production, these settings
                would be persisted to your account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};