import { Amplify } from 'aws-amplify';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  updatePassword,
  fetchAuthSession,
  autoSignIn,
} from 'aws-amplify/auth';

// Cognito configuration interface
interface CognitoConfig {
  userPoolId: string;
  userPoolClientId: string;
  region: string;
  identityPoolId?: string;
  federatedIdentityProviders?: {
    google?: {
      clientId: string;
    };
    facebook?: {
      appId: string;
    };
    amazon?: {
      appId: string;
    };
    apple?: {
      serviceId: string;
    };
  };
}

// User attributes interface
export interface CognitoUser {
  userId: string;
  username: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  roles?: string[];
  permissions?: string[];
  customAttributes?: Record<string, any>;
}

// Authentication result interface
export interface AuthResult {
  user: CognitoUser;
  tokens: {
    accessToken: string;
    idToken: string;
    refreshToken: string;
  };
  isNewUser?: boolean;
}

// Sign-up data interface
export interface SignUpData {
  username: string;
  password: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  customAttributes?: Record<string, string>;
}

class CognitoAuthService {
  private initialized = false;

  constructor() {
    this.initializeFromEnv();
  }

  /**
   * Initialize Amplify with environment variables
   */
  private initializeFromEnv() {
    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
    const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
    const region = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
    const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

    if (!userPoolId || !userPoolClientId) {
      console.warn('Cognito configuration missing. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_USER_POOL_CLIENT_ID');
      return;
    }

    this.initialize({
      userPoolId,
      userPoolClientId,
      region,
      identityPoolId,
    });
  }

  /**
   * Initialize Amplify with Cognito configuration
   */
  initialize(config: CognitoConfig) {
    try {
      const amplifyConfig = {
        Auth: {
          Cognito: {
            userPoolId: config.userPoolId,
            userPoolClientId: config.userPoolClientId,
            signUpVerificationMethod: 'code' as const,
            loginWith: {
              email: true,
              username: true,
            },
            userAttributes: {
              email: {
                required: true,
              },
              given_name: {
                required: false,
              },
              family_name: {
                required: false,
              },
              phone_number: {
                required: false,
              },
            },
            passwordFormat: {
              minLength: 8,
              requireLowercase: true,
              requireUppercase: true,
              requireNumbers: true,
              requireSpecialCharacters: true,
            },
          },
        },
        ...(config.identityPoolId && {
          identityPoolId: config.identityPoolId,
        }),
      };

      // Add federated providers if configured
      if (config.federatedIdentityProviders) {
        amplifyConfig.Auth.Cognito.loginWith = {
          ...amplifyConfig.Auth.Cognito.loginWith,
          oauth: {
            domain: `${config.userPoolId}.auth.${config.region}.amazoncognito.com`,
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: window.location.origin + '/auth/callback',
            redirectSignOut: window.location.origin + '/auth/signout',
            responseType: 'code',
          },
        };
      }

      Amplify.configure(amplifyConfig);
      this.initialized = true;
      
      console.log('AWS Cognito initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AWS Cognito:', error);
      throw error;
    }
  }

  /**
   * Check if Cognito is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Sign in with username/email and password
   */
  async signIn(username: string, password: string): Promise<AuthResult> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      const { isSignedIn, nextStep } = await signIn({
        username,
        password,
      });

      if (!isSignedIn) {
        // Handle MFA or other next steps
        throw new Error(`Sign-in requires additional step: ${nextStep.signInStep}`);
      }

      const user = await this.getCurrentUser();
      const tokens = await this.getTokens();

      return {
        user,
        tokens,
      };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(data: SignUpData): Promise<{ userId: string; isConfirmed: boolean }> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      const { userId, isSignUpComplete, nextStep } = await signUp({
        username: data.username,
        password: data.password,
        options: {
          userAttributes: {
            email: data.email,
            given_name: data.firstName || '',
            family_name: data.lastName || '',
            ...(data.phoneNumber && { phone_number: data.phoneNumber }),
            ...data.customAttributes,
          },
          autoSignIn: true,
        },
      });

      return {
        userId: userId || data.username,
        isConfirmed: isSignUpComplete,
      };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Confirm user sign-up with verification code
   */
  async confirmSignUp(username: string, confirmationCode: string): Promise<AuthResult | null> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      const { isSignUpComplete, nextStep } = await confirmSignUp({
        username,
        confirmationCode,
      });

      if (!isSignUpComplete) {
        throw new Error(`Confirmation requires additional step: ${nextStep.signUpStep}`);
      }

      // Auto sign-in after confirmation
      try {
        const signInResult = await autoSignIn();
        if (signInResult.isSignedIn) {
          const user = await this.getCurrentUser();
          const tokens = await this.getTokens();
          return { user, tokens, isNewUser: true };
        }
      } catch (autoSignInError) {
        console.warn('Auto sign-in failed after confirmation:', autoSignInError);
      }

      return null;
    } catch (error: any) {
      console.error('Confirm sign up error:', error);
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Resend confirmation code
   */
  async resendConfirmationCode(username: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      await resendSignUpCode({ username });
    } catch (error: any) {
      console.error('Resend confirmation code error:', error);
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      await signOut();
    } catch (error: any) {
      console.error('Sign out error:', error);
      // Don't throw error for sign out failures
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<CognitoUser> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      const { userId, username } = await getCurrentUser();
      const session = await fetchAuthSession();
      
      // Extract user attributes from ID token
      const idToken = session.tokens?.idToken;
      const userAttributes = idToken?.payload || {};

      return {
        userId,
        username,
        email: userAttributes.email as string,
        emailVerified: userAttributes.email_verified as boolean,
        firstName: userAttributes.given_name as string,
        lastName: userAttributes.family_name as string,
        phoneNumber: userAttributes.phone_number as string,
        phoneNumberVerified: userAttributes.phone_number_verified as boolean,
        roles: this.extractRoles(userAttributes),
        permissions: this.extractPermissions(userAttributes),
        customAttributes: this.extractCustomAttributes(userAttributes),
      };
    } catch (error: any) {
      console.error('Get current user error:', error);
      throw new Error('No authenticated user found');
    }
  }

  /**
   * Get current authentication tokens
   */
  async getTokens(): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      const session = await fetchAuthSession();
      
      if (!session.tokens) {
        throw new Error('No tokens found');
      }

      return {
        accessToken: session.tokens.accessToken.toString(),
        idToken: session.tokens.idToken?.toString() || '',
        refreshToken: session.tokens.refreshToken?.toString() || '',
      };
    } catch (error: any) {
      console.error('Get tokens error:', error);
      throw new Error('Failed to get authentication tokens');
    }
  }

  /**
   * Reset password
   */
  async resetPassword(username: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      await resetPassword({ username });
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Confirm password reset with code
   */
  async confirmResetPassword(username: string, confirmationCode: string, newPassword: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      await confirmResetPassword({
        username,
        confirmationCode,
        newPassword,
      });
    } catch (error: any) {
      console.error('Confirm reset password error:', error);
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Update password for authenticated user
   */
  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cognito not initialized');
    }

    try {
      await updatePassword({
        oldPassword,
        newPassword,
      });
    } catch (error: any) {
      console.error('Update password error:', error);
      throw new Error(this.formatAuthError(error));
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      await getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract roles from user attributes
   */
  private extractRoles(userAttributes: Record<string, any>): string[] {
    const rolesAttr = userAttributes['custom:roles'] || userAttributes.roles;
    if (typeof rolesAttr === 'string') {
      return rolesAttr.split(',').map(role => role.trim());
    }
    if (Array.isArray(rolesAttr)) {
      return rolesAttr;
    }
    return [];
  }

  /**
   * Extract permissions from user attributes
   */
  private extractPermissions(userAttributes: Record<string, any>): string[] {
    const permissionsAttr = userAttributes['custom:permissions'] || userAttributes.permissions;
    if (typeof permissionsAttr === 'string') {
      return permissionsAttr.split(',').map(permission => permission.trim());
    }
    if (Array.isArray(permissionsAttr)) {
      return permissionsAttr;
    }
    return [];
  }

  /**
   * Extract custom attributes
   */
  private extractCustomAttributes(userAttributes: Record<string, any>): Record<string, any> {
    const customAttrs: Record<string, any> = {};
    
    Object.keys(userAttributes).forEach(key => {
      if (key.startsWith('custom:')) {
        const attrName = key.replace('custom:', '');
        customAttrs[attrName] = userAttributes[key];
      }
    });

    return customAttrs;
  }

  /**
   * Format authentication errors for user display
   */
  private formatAuthError(error: any): string {
    const errorCode = error.name || error.code;
    
    switch (errorCode) {
      case 'UserNotFoundException':
        return 'User not found. Please check your username or email.';
      case 'NotAuthorizedException':
        return 'Incorrect username or password.';
      case 'UserNotConfirmedException':
        return 'Please confirm your account before signing in.';
      case 'PasswordResetRequiredException':
        return 'Password reset required. Please reset your password.';
      case 'UserLambdaValidationException':
        return 'User validation failed. Please contact support.';
      case 'InvalidPasswordException':
        return 'Password does not meet requirements.';
      case 'InvalidParameterException':
        return 'Invalid parameters provided.';
      case 'CodeMismatchException':
        return 'Invalid verification code.';
      case 'ExpiredCodeException':
        return 'Verification code has expired.';
      case 'LimitExceededException':
        return 'Too many attempts. Please try again later.';
      case 'TooManyRequestsException':
        return 'Too many requests. Please try again later.';
      case 'UsernameExistsException':
        return 'Username already exists. Please choose a different username.';
      default:
        return error.message || 'An authentication error occurred.';
    }
  }
}

// Export singleton instance
export const cognitoAuth = new CognitoAuthService();
export default cognitoAuth;