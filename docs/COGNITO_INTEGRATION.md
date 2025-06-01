# AWS Cognito Integration Guide

This document provides comprehensive guidance for integrating AWS Cognito authentication into the LendPeak2 application.

## Overview

The LendPeak2 system supports two authentication methods:
1. **Traditional API Authentication** - Custom JWT-based authentication
2. **AWS Cognito Authentication** - Enterprise-grade authentication with advanced features

## Features

### Cognito Authentication Features
- ✅ Secure user registration and sign-in
- ✅ Email verification and confirmation codes
- ✅ Password reset and recovery
- ✅ Password policies and complexity requirements
- ✅ Multi-factor authentication (MFA) support
- ✅ Account lockout and brute force protection
- ✅ Custom user attributes and roles
- ✅ Token-based authentication with automatic refresh
- ✅ Seamless integration with existing API endpoints

### Security Benefits
- Industry-standard OAuth 2.0 and OpenID Connect
- AWS-managed infrastructure with 99.99% availability SLA
- GDPR and HIPAA compliance ready
- Advanced threat protection and anomaly detection
- Automated security updates and patches

## Quick Setup

### 1. Environment Configuration

Add these environment variables to your `.env` file:

```bash
# AWS Cognito Configuration
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_USER_POOL_CLIENT_ID=your-client-id-here
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 2. AWS Cognito Setup

#### Step 1: Create User Pool
1. Open AWS Cognito console
2. Click "Create user pool"
3. Choose "Email" as the sign-in option
4. Configure password policies (recommended: 8+ chars, mixed case, numbers, symbols)
5. Enable email verification
6. Create the user pool

#### Step 2: Create App Client
1. In your User Pool, go to "App integration"
2. Click "Create app client"
3. Choose "Public client" (for web applications)
4. Configure these settings:
   - **Allowed OAuth flows**: Authorization code grant
   - **Allowed OAuth scopes**: email, openid, profile
   - **Callback URLs**: `http://localhost:5173/auth/callback`
   - **Sign out URLs**: `http://localhost:5173/auth/signout`

#### Step 3: Optional - Create Identity Pool
1. Go to Cognito Identity Pools
2. Click "Create identity pool"
3. Enable access to unauthenticated identities (optional)
4. Add your User Pool as an authentication provider

## Implementation Guide

### Component Usage

#### 1. Enhanced Auth Context

The `EnhancedAuthProvider` automatically detects and switches between authentication methods:

```tsx
import { EnhancedAuthProvider } from './contexts/EnhancedAuthContext';

function App() {
  return (
    <EnhancedAuthProvider defaultProvider="cognito">
      <YourApp />
    </EnhancedAuthProvider>
  );
}
```

#### 2. Using Authentication Hooks

```tsx
import { useAuth, useCognitoFeatures } from './contexts/EnhancedAuthContext';

function LoginComponent() {
  const { login, logout, user, isAuthenticated } = useAuth();
  const hasCognitoFeatures = useCognitoFeatures();

  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <div>Welcome, {user?.email}</div>
      ) : (
        <button onClick={handleLogin}>Sign In</button>
      )}
      
      {hasCognitoFeatures && (
        <div>Cognito features available</div>
      )}
    </div>
  );
}
```

#### 3. Cognito-Specific Features

```tsx
import { useAuth } from './contexts/EnhancedAuthContext';

function SignUpComponent() {
  const { 
    register, 
    confirmSignUp, 
    resendConfirmationCode,
    resetPassword 
  } = useAuth();

  // User registration with email verification
  const handleSignUp = async (userData) => {
    try {
      const result = await register(userData);
      
      if (!result.isConfirmed) {
        // Show confirmation code input
        setShowConfirmation(true);
      }
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  // Confirm registration with email code
  const handleConfirmation = async (code) => {
    try {
      await confirmSignUp(username, code);
      // User is now confirmed and logged in
    } catch (error) {
      console.error('Confirmation failed:', error);
    }
  };

  // Password reset flow
  const handlePasswordReset = async (email) => {
    try {
      await resetPassword(email);
      // Reset code sent to email
    } catch (error) {
      console.error('Password reset failed:', error);
    }
  };
}
```

## Configuration Management

### Admin Interface

The system includes a built-in configuration manager accessible to administrators:

```tsx
import { CognitoConfigManager } from './components/admin/CognitoConfigManager';

function AdminPanel() {
  return (
    <div>
      <h2>AWS Cognito Configuration</h2>
      <CognitoConfigManager />
    </div>
  );
}
```

### Configuration Features
- ✅ Visual configuration interface
- ✅ Real-time connection testing
- ✅ Environment variable generation
- ✅ Security-focused input handling (hidden by default)
- ✅ Copy-to-clipboard functionality
- ✅ Validation and error handling

## Authentication Flow

### 1. User Registration Flow
```
User Registration → Email Verification → Account Confirmation → Auto Sign-In
```

### 2. Sign-In Flow
```
Sign-In Attempt → Credential Validation → Token Generation → Session Management
```

### 3. Password Reset Flow
```
Reset Request → Email Code → Code Verification → New Password → Confirmation
```

### 4. Token Management
```
Initial Login → Access Token + Refresh Token → Automatic Refresh → API Integration
```

## API Integration

### Token Usage

The system automatically integrates Cognito tokens with existing API endpoints:

```typescript
// API client automatically uses Cognito tokens
const apiResponse = await apiClient.getLoans();

// Tokens are automatically refreshed when expired
const userProfile = await apiClient.getCurrentUser();
```

### Custom Headers

Cognito tokens are automatically added to API requests:

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
X-Cognito-Identity-Pool-Id: us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## User Attributes and Roles

### Standard Attributes
- `email` - User's email address (required)
- `given_name` - First name
- `family_name` - Last name
- `phone_number` - Phone number (optional)
- `email_verified` - Email verification status
- `phone_number_verified` - Phone verification status

### Custom Attributes
- `custom:roles` - User roles (comma-separated)
- `custom:permissions` - User permissions (comma-separated)
- `custom:department` - User department
- `custom:employee_id` - Employee ID

### Role Management

```typescript
// Check user roles
const hasAdminRole = user?.roles?.includes('admin');
const canManageLoans = user?.permissions?.includes('loans:manage');

// Custom attribute access
const department = user?.customAttributes?.department;
const employeeId = user?.customAttributes?.employee_id;
```

## Security Considerations

### Password Policies
Configure in Cognito User Pool settings:
- Minimum length: 8 characters
- Require uppercase letters
- Require lowercase letters
- Require numbers
- Require special characters
- Temporary password expiry: 7 days

### Account Security
- Account lockout after 5 failed attempts
- CAPTCHA after 3 failed attempts
- Email verification required
- Password history: Last 3 passwords remembered

### Token Security
- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- Tokens are automatically rotated
- Secure storage in localStorage (consider httpOnly cookies for production)

## Error Handling

### Common Error Scenarios

1. **User Not Confirmed**
   ```typescript
   try {
     await login(email, password);
   } catch (error) {
     if (error.message.includes('UserNotConfirmedException')) {
       // Show confirmation flow
       setShowConfirmation(true);
     }
   }
   ```

2. **Password Reset Required**
   ```typescript
   try {
     await login(email, password);
   } catch (error) {
     if (error.message.includes('PasswordResetRequiredException')) {
       // Redirect to password reset
       navigate('/auth/reset-password');
     }
   }
   ```

3. **Too Many Attempts**
   ```typescript
   try {
     await login(email, password);
   } catch (error) {
     if (error.message.includes('TooManyRequestsException')) {
       // Show cooldown message
       setShowCooldown(true);
     }
   }
   ```

## Testing

### Unit Tests

```typescript
import { cognitoAuth } from './services/cognitoAuth';

describe('Cognito Authentication', () => {
  beforeEach(() => {
    cognitoAuth.initialize({
      userPoolId: 'test-pool-id',
      userPoolClientId: 'test-client-id',
      region: 'us-east-1',
    });
  });

  it('should initialize correctly', () => {
    expect(cognitoAuth.isInitialized()).toBe(true);
  });

  it('should handle sign-in errors', async () => {
    await expect(
      cognitoAuth.signIn('invalid@example.com', 'wrongpassword')
    ).rejects.toThrow();
  });
});
```

### Integration Tests

```typescript
describe('Auth Integration', () => {
  it('should integrate with API client', async () => {
    // Mock successful Cognito sign-in
    jest.spyOn(cognitoAuth, 'signIn').mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
    });

    await login('test@example.com', 'password');
    
    // Verify tokens are stored
    expect(localStorage.getItem('accessToken')).toBe(mockTokens.accessToken);
    
    // Verify API calls include tokens
    const response = await apiClient.getLoans();
    expect(response).toBeDefined();
  });
});
```

## Monitoring and Analytics

### Cognito Metrics

Monitor these key metrics in AWS CloudWatch:
- User registration rate
- Sign-in success/failure rate
- Token refresh rate
- Password reset requests
- Account lockouts

### Custom Analytics

```typescript
// Track authentication events
analytics.track('user_signed_in', {
  provider: 'cognito',
  email: user.email,
  timestamp: new Date().toISOString(),
});

analytics.track('password_reset_requested', {
  email: email,
  timestamp: new Date().toISOString(),
});
```

## Production Deployment

### Environment Setup

1. **Development**
   ```bash
   VITE_COGNITO_USER_POOL_ID=us-east-1_DEV123456
   VITE_COGNITO_USER_POOL_CLIENT_ID=dev-client-id
   VITE_COGNITO_REGION=us-east-1
   ```

2. **Staging**
   ```bash
   VITE_COGNITO_USER_POOL_ID=us-east-1_STG123456
   VITE_COGNITO_USER_POOL_CLIENT_ID=staging-client-id
   VITE_COGNITO_REGION=us-east-1
   ```

3. **Production**
   ```bash
   VITE_COGNITO_USER_POOL_ID=us-east-1_PROD123456
   VITE_COGNITO_USER_POOL_CLIENT_ID=prod-client-id
   VITE_COGNITO_REGION=us-east-1
   ```

### Security Checklist

- [ ] User Pool configured with proper password policies
- [ ] App Client configured with minimal required scopes
- [ ] Callback URLs restricted to known domains
- [ ] Custom attributes properly configured
- [ ] MFA enabled for admin users
- [ ] Audit logging enabled
- [ ] Backup and recovery procedures documented

## Troubleshooting

### Common Issues

1. **"Cognito not initialized" Error**
   - Verify environment variables are set correctly
   - Check User Pool ID and Client ID format
   - Ensure AWS region is correct

2. **CORS Errors**
   - Verify callback URLs are configured in Cognito
   - Check that domain matches exactly (including port for development)

3. **Token Refresh Failures**
   - Check refresh token expiry settings
   - Verify App Client allows refresh token auth flow

4. **Sign-Up Not Working**
   - Verify email configuration in User Pool
   - Check if email verification is required
   - Ensure proper SES configuration for custom domains

### Debug Mode

Enable debug logging for development:

```typescript
// Enable Cognito debug logging
process.env.NODE_ENV === 'development' && 
  console.log('Cognito debug mode enabled');
```

## Migration from Traditional Auth

### Gradual Migration Strategy

1. **Phase 1**: Deploy dual authentication support
2. **Phase 2**: Migrate admin users to Cognito
3. **Phase 3**: Migrate regular users with email notifications
4. **Phase 4**: Deprecate traditional authentication
5. **Phase 5**: Remove traditional auth code

### Data Migration

```typescript
// Example migration script
async function migrateUserToCognito(user) {
  try {
    const result = await cognitoAuth.signUp({
      username: user.username,
      email: user.email,
      password: generateTemporaryPassword(),
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Send welcome email with password reset instructions
    await sendMigrationEmail(user.email);
    
    return result;
  } catch (error) {
    console.error('Migration failed for user:', user.id, error);
  }
}
```

## Support and Resources

### AWS Documentation
- [Amazon Cognito Developer Guide](https://docs.aws.amazon.com/cognito/)
- [Cognito User Pools API Reference](https://docs.aws.amazon.com/cognito-user-identity-pools/)
- [AWS Amplify Authentication](https://docs.amplify.aws/lib/auth/)

### Internal Resources
- System Architecture: `docs/ARCHITECTURE.md`
- API Documentation: `docs/API.md`
- Security Guidelines: `docs/SECURITY.md`

### Getting Help
- Technical Issues: Create issue in project repository
- AWS Support: Use AWS Support Center for infrastructure issues
- Security Concerns: Contact security team immediately

---

**Version**: 1.0  
**Last Updated**: 2023-05-31  
**Author**: LendPeak Development Team