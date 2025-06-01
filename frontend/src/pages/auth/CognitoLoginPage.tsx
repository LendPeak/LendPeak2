import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth, useCognitoFeatures } from '../../contexts/EnhancedAuthContext';

interface LoginFormData {
  email: string;
  password: string;
}

export const CognitoLoginPage = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { 
    login, 
    confirmSignUp, 
    resendConfirmationCode, 
    resetPassword, 
    confirmResetPassword,
    authProvider 
  } = useAuth();
  const hasCognitoFeatures = useCognitoFeatures();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(formData.email, formData.password);
      toast.success('Logged in successfully!');
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Check if user needs confirmation (Cognito specific)
      if (error.message.includes('not confirmed') || error.message.includes('UserNotConfirmedException')) {
        setNeedsConfirmation(true);
        toast.warning('Please confirm your account before signing in.');
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmSignUp || !hasCognitoFeatures) return;

    setIsLoading(true);
    try {
      await confirmSignUp(formData.email, confirmationCode);
      toast.success('Account confirmed successfully! You are now logged in.');
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Confirmation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!resendConfirmationCode || !hasCognitoFeatures) return;

    try {
      await resendConfirmationCode(formData.email);
      toast.success('Confirmation code sent to your email');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend code');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword || !hasCognitoFeatures) return;

    setIsLoading(true);
    try {
      await resetPassword(formData.email);
      toast.success('Password reset code sent to your email');
      setResetPasswordMode(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmResetPassword || !hasCognitoFeatures) return;

    setIsLoading(true);
    try {
      await confirmResetPassword(formData.email, resetCode, newPassword);
      toast.success('Password reset successfully! Please log in with your new password.');
      setResetPasswordMode(false);
      setFormData(prev => ({ ...prev, password: newPassword }));
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Render confirmation form
  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
              <EnvelopeIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Confirm Your Account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We sent a confirmation code to{' '}
              <span className="font-medium text-blue-600">{formData.email}</span>
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleConfirmSignUp}>
            <div>
              <label htmlFor="confirmationCode" className="sr-only">
                Confirmation Code
              </label>
              <input
                id="confirmationCode"
                name="confirmationCode"
                type="text"
                required
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter confirmation code"
                maxLength={6}
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading || !confirmationCode}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Confirming...' : 'Confirm Account'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Resend Code
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setNeedsConfirmation(false)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render password reset form
  if (resetPasswordMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-orange-100">
              <LockClosedIcon className="h-6 w-6 text-orange-600" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Reset Password
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter the code sent to{' '}
              <span className="font-medium text-orange-600">{formData.email}</span>
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleConfirmResetPassword}>
            <div className="space-y-4">
              <div>
                <label htmlFor="resetCode" className="sr-only">
                  Reset Code
                </label>
                <input
                  id="resetCode"
                  name="resetCode"
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  placeholder="Enter reset code"
                  maxLength={6}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="sr-only">
                  New Password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  placeholder="Enter new password"
                  minLength={8}
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading || !resetCode || !newPassword}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setResetPasswordMode(false)}
                className="text-sm text-orange-600 hover:text-orange-500"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render main login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <LockClosedIcon className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to LendPeak
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {authProvider === 'cognito' ? (
              <>
                Secure authentication with AWS Cognito
                <InformationCircleIcon className="inline h-4 w-4 ml-1 text-blue-500" />
              </>
            ) : (
              'Traditional authentication'
            )}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <input type="hidden" name="remember" defaultValue="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/auth/register"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Don't have an account? Sign up
              </Link>
            </div>

            {hasCognitoFeatures && (
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => {
                    if (formData.email) {
                      handleResetPassword({ preventDefault: () => {} } as React.FormEvent);
                    } else {
                      toast.warning('Please enter your email first');
                    }
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <LockClosedIcon
                  className="h-5 w-5 text-blue-500 group-hover:text-blue-400"
                  aria-hidden="true"
                />
              </span>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          {authProvider === 'cognito' && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <div className="flex">
                <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Using AWS Cognito for secure authentication with features like:
                  </p>
                  <ul className="mt-1 text-xs text-blue-600 list-disc list-inside">
                    <li>Multi-factor authentication</li>
                    <li>Password policies and recovery</li>
                    <li>Account verification via email</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};