import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../services/api';
import cognitoAuth, { CognitoUser, AuthResult, SignUpData } from '../services/cognitoAuth';

type AuthProvider = 'api' | 'cognito';

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  status: string;
  // Cognito-specific fields
  emailVerified?: boolean;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  customAttributes?: Record<string, any>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authProvider: AuthProvider;
  
  // Authentication methods
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  
  // Cognito-specific methods
  confirmSignUp?: (username: string, code: string) => Promise<void>;
  resendConfirmationCode?: (username: string) => Promise<void>;
  resetPassword?: (username: string) => Promise<void>;
  confirmResetPassword?: (username: string, code: string, newPassword: string) => Promise<void>;
  updatePassword?: (oldPassword: string, newPassword: string) => Promise<void>;
  
  // Utility methods
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  switchAuthProvider: (provider: AuthProvider) => Promise<void>;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an EnhancedAuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
  defaultProvider?: AuthProvider;
}

export const EnhancedAuthProvider: React.FC<AuthProviderProps> = ({ 
  children, 
  defaultProvider = 'api' 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authProvider, setAuthProvider] = useState<AuthProvider>(defaultProvider);

  // Determine auth provider based on environment
  useEffect(() => {
    const cognitoConfigured = import.meta.env.VITE_COGNITO_USER_POOL_ID && 
                             import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
    
    if (cognitoConfigured && cognitoAuth.isInitialized()) {
      setAuthProvider('cognito');
    } else {
      setAuthProvider('api');
    }
  }, []);

  // Initialize authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authProvider === 'cognito' && cognitoAuth.isInitialized()) {
          await initCognitoAuth();
        } else {
          await initApiAuth();
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [authProvider]);

  const initCognitoAuth = async () => {
    try {
      const isAuthenticated = await cognitoAuth.isAuthenticated();
      if (isAuthenticated) {
        const cognitoUser = await cognitoAuth.getCurrentUser();
        setUser(mapCognitoUserToUser(cognitoUser));
      }
    } catch (error) {
      console.error('Cognito auth initialization failed:', error);
    }
  };

  const initApiAuth = async () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const userData = await apiClient.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to get current user:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
  };

  const mapCognitoUserToUser = (cognitoUser: CognitoUser): User => ({
    id: cognitoUser.userId,
    email: cognitoUser.email,
    username: cognitoUser.username,
    firstName: cognitoUser.firstName,
    lastName: cognitoUser.lastName,
    roles: cognitoUser.roles || [],
    permissions: cognitoUser.permissions || [],
    status: 'active', // Cognito users are active by default
    emailVerified: cognitoUser.emailVerified,
    phoneNumber: cognitoUser.phoneNumber,
    phoneNumberVerified: cognitoUser.phoneNumberVerified,
    customAttributes: cognitoUser.customAttributes,
  });

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (authProvider === 'cognito' && cognitoAuth.isInitialized()) {
        const result = await cognitoAuth.signIn(email, password);
        setUser(mapCognitoUserToUser(result.user));
        
        // Store tokens for API integration
        localStorage.setItem('accessToken', result.tokens.accessToken);
        localStorage.setItem('idToken', result.tokens.idToken);
        localStorage.setItem('refreshToken', result.tokens.refreshToken);
      } else {
        const { user } = await apiClient.login(email, password);
        setUser(user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (authProvider === 'cognito' && cognitoAuth.isInitialized()) {
        await cognitoAuth.signOut();
        localStorage.removeItem('accessToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('refreshToken');
      } else {
        await apiClient.logout();
      }
    } finally {
      setUser(null);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      if (authProvider === 'cognito' && cognitoAuth.isInitialized()) {
        const signUpData: SignUpData = {
          username: data.username,
          password: data.password,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
        };
        
        const result = await cognitoAuth.signUp(signUpData);
        
        // If auto-confirmed, sign in the user
        if (result.isConfirmed) {
          await login(data.email, data.password);
        }
        
        // Return the result for handling confirmation flow
        return result;
      } else {
        const { user } = await apiClient.register(data);
        setUser(user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSignUp = async (username: string, code: string) => {
    if (authProvider !== 'cognito' || !cognitoAuth.isInitialized()) {
      throw new Error('Sign-up confirmation is only available with Cognito');
    }

    setIsLoading(true);
    try {
      const result = await cognitoAuth.confirmSignUp(username, code);
      if (result) {
        setUser(mapCognitoUserToUser(result.user));
        
        // Store tokens
        localStorage.setItem('accessToken', result.tokens.accessToken);
        localStorage.setItem('idToken', result.tokens.idToken);
        localStorage.setItem('refreshToken', result.tokens.refreshToken);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmationCode = async (username: string) => {
    if (authProvider !== 'cognito' || !cognitoAuth.isInitialized()) {
      throw new Error('Confirmation code resend is only available with Cognito');
    }

    await cognitoAuth.resendConfirmationCode(username);
  };

  const resetPassword = async (username: string) => {
    if (authProvider !== 'cognito' || !cognitoAuth.isInitialized()) {
      throw new Error('Password reset is only available with Cognito');
    }

    await cognitoAuth.resetPassword(username);
  };

  const confirmResetPassword = async (username: string, code: string, newPassword: string) => {
    if (authProvider !== 'cognito' || !cognitoAuth.isInitialized()) {
      throw new Error('Password reset confirmation is only available with Cognito');
    }

    await cognitoAuth.confirmResetPassword(username, code, newPassword);
  };

  const updatePassword = async (oldPassword: string, newPassword: string) => {
    if (authProvider !== 'cognito' || !cognitoAuth.isInitialized()) {
      throw new Error('Password update is only available with Cognito');
    }

    await cognitoAuth.updatePassword(oldPassword, newPassword);
  };

  const switchAuthProvider = async (provider: AuthProvider) => {
    // Log out from current provider
    await logout();
    
    // Switch provider
    setAuthProvider(provider);
    
    // Re-initialize with new provider
    setIsLoading(true);
  };

  const hasRole = (role: string) => {
    return user?.roles.includes(role) || false;
  };

  const hasPermission = (permission: string) => {
    return user?.permissions.includes(permission) || false;
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    authProvider,
    login,
    logout,
    register,
    hasRole,
    hasPermission,
    switchAuthProvider,
    // Cognito-specific methods (only available when using Cognito)
    ...(authProvider === 'cognito' && cognitoAuth.isInitialized() && {
      confirmSignUp,
      resendConfirmationCode,
      resetPassword,
      confirmResetPassword,
      updatePassword,
    }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to check if Cognito features are available
export const useCognitoFeatures = () => {
  const { authProvider } = useAuth();
  return authProvider === 'cognito' && cognitoAuth.isInitialized();
};