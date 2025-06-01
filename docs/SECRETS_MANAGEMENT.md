# Secrets Management Guide

This guide covers how to securely manage secrets and sensitive configuration in the LendPeak2 system.

## Overview

All secrets are stored in AWS Secrets Manager and accessed by applications at runtime. Never commit secrets to version control.

## Secret Categories

### 1. Database Credentials
- MongoDB connection strings
- Database admin passwords
- Replica set keys

### 2. Authentication Secrets
- JWT signing keys
- Refresh token secrets
- OAuth client secrets

### 3. External Service Keys
- API keys for third-party services
- Webhook signing secrets
- Payment gateway credentials

### 4. Infrastructure Secrets
- Redis passwords
- Certificate private keys
- Encryption keys

## AWS Secrets Manager

### Naming Convention
```
lendpeak2-{environment}-{service}-{type}

Examples:
lendpeak2-staging-db-credentials
lendpeak2-production-jwt-keys
lendpeak2-staging-external-apis
```

### Creating Secrets

```bash
# Create database credentials
aws secretsmanager create-secret \
  --name lendpeak2-staging-db-credentials \
  --description "Database credentials for staging environment" \
  --secret-string '{
    "username": "lendpeak2admin",
    "password": "generated-password-here",
    "uri": "mongodb://...",
    "jwtSecret": "jwt-secret-here",
    "jwtRefreshSecret": "refresh-secret-here"
  }'

# Create external API keys
aws secretsmanager create-secret \
  --name lendpeak2-staging-external-apis \
  --description "External API keys for staging" \
  --secret-string '{
    "sendgridApiKey": "SG.xxxx",
    "twilioAccountSid": "ACxxxx",
    "twilioAuthToken": "xxxx",
    "stripeSecretKey": "sk_test_xxxx"
  }'
```

### Retrieving Secrets

```bash
# Get secret value
aws secretsmanager get-secret-value \
  --secret-id lendpeak2-staging-db-credentials \
  --query SecretString \
  --output text | jq '.'

# Get specific field
aws secretsmanager get-secret-value \
  --secret-id lendpeak2-staging-db-credentials \
  --query SecretString \
  --output text | jq -r '.jwtSecret'
```

### Updating Secrets

```bash
# Update entire secret
aws secretsmanager put-secret-value \
  --secret-id lendpeak2-staging-db-credentials \
  --secret-string '{"username":"admin","password":"new-password"}'

# Rotate password
aws secretsmanager rotate-secret \
  --secret-id lendpeak2-production-db-credentials \
  --rotation-lambda-arn arn:aws:lambda:...
```

## Application Integration

### ECS Task Definition
```json
{
  "containerDefinitions": [{
    "secrets": [
      {
        "name": "MONGODB_URI",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:lendpeak2-staging-db-credentials:uri::"
      },
      {
        "name": "JWT_SECRET",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:lendpeak2-staging-db-credentials:jwtSecret::"
      }
    ]
  }]
}
```

### Node.js Application
```javascript
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
  try {
    const data = await secretsManager.getSecretValue({ 
      SecretId: secretName 
    }).promise();
    
    return JSON.parse(data.SecretString);
  } catch (error) {
    console.error('Failed to retrieve secret:', error);
    throw error;
  }
}

// Usage
const dbSecrets = await getSecret('lendpeak2-staging-db-credentials');
const mongoUri = dbSecrets.uri;
```

### CDK Integration
```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// Reference existing secret
const dbSecret = secretsmanager.Secret.fromSecretNameV2(
  this, 'DbSecret',
  'lendpeak2-staging-db-credentials'
);

// Use in task definition
taskDefinition.addContainer('app', {
  secrets: {
    MONGODB_URI: ecs.Secret.fromSecretsManager(dbSecret, 'uri'),
    JWT_SECRET: ecs.Secret.fromSecretsManager(dbSecret, 'jwtSecret'),
  }
});
```

## Local Development

### Using .env Files
For local development only, use `.env` files:

```bash
# .env.development (git-ignored)
MONGODB_URI=mongodb://localhost:27017/lendpeak2
JWT_SECRET=dev-secret-not-for-production
REDIS_URL=redis://localhost:6379
```

### Docker Compose Secrets
```yaml
version: '3.8'
services:
  app:
    environment:
      - MONGODB_URI_FILE=/run/secrets/mongodb_uri
    secrets:
      - mongodb_uri

secrets:
  mongodb_uri:
    file: ./secrets/mongodb_uri.txt
```

## Secret Rotation

### Manual Rotation
```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update in Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id lendpeak2-production-jwt-keys \
  --secret-string "{\"secret\":\"$NEW_SECRET\"}"

# 3. Deploy new version
aws ecs update-service \
  --cluster lendpeak2-production \
  --service backend \
  --force-new-deployment
```

### Automated Rotation
```python
# Lambda function for automatic rotation
import boto3
import json
import secrets

def lambda_handler(event, context):
    service_client = boto3.client('secretsmanager')
    
    # Generate new password
    new_password = secrets.token_urlsafe(32)
    
    # Get current secret
    current_secret = json.loads(
        service_client.get_secret_value(
            SecretId=event['SecretId']
        )['SecretString']
    )
    
    # Update password
    current_secret['password'] = new_password
    
    # Store new version
    service_client.put_secret_value(
        SecretId=event['SecretId'],
        SecretString=json.dumps(current_secret)
    )
    
    # Update database password
    # ... database-specific code ...
    
    return {'statusCode': 200}
```

### Rotation Schedule
```bash
# Enable automatic rotation
aws secretsmanager rotate-secret \
  --secret-id lendpeak2-production-db-credentials \
  --rotation-lambda-arn arn:aws:lambda:region:account:function:SecretsRotation \
  --rotation-rules AutomaticallyAfterDays=30
```

## Security Best Practices

### 1. Access Control
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::account:role/ECSTaskRole"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:region:account:secret:lendpeak2-*",
      "Condition": {
        "StringEquals": {
          "secretsmanager:VersionStage": "AWSCURRENT"
        }
      }
    }
  ]
}
```

### 2. Encryption
- All secrets encrypted at rest using KMS
- Use customer-managed KMS keys for production
- Enable key rotation

### 3. Auditing
```bash
# Enable CloudTrail logging
aws cloudtrail create-trail \
  --name lendpeak2-secrets-audit \
  --s3-bucket-name lendpeak2-audit-logs

# Query secret access
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=lendpeak2-production-db-credentials
```

### 4. Network Security
- Access secrets only from within VPC
- Use VPC endpoints for Secrets Manager
- No internet gateway for database subnets

## Emergency Procedures

### Lost Secret Recovery
1. Check CloudTrail for last known access
2. Restore from Secrets Manager version history
3. If unavailable, generate new secrets
4. Update all dependent services

### Compromised Secrets
```bash
# 1. Immediately rotate the secret
./scripts/emergency-rotate.sh production jwt-secret

# 2. Invalidate existing sessions
redis-cli --scan --pattern "session:*" | xargs redis-cli DEL

# 3. Force re-authentication
aws ecs update-service \
  --cluster lendpeak2-production \
  --service backend \
  --force-new-deployment

# 4. Audit access logs
./scripts/audit-secret-access.sh production 24h
```

## Secret Types Reference

### JWT Configuration
```json
{
  "jwtSecret": "base64-encoded-256-bit-key",
  "jwtRefreshSecret": "different-base64-encoded-256-bit-key",
  "jwtExpiresIn": "15m",
  "refreshExpiresIn": "7d",
  "issuer": "lendpeak2",
  "audience": "lendpeak2-api"
}
```

### Database Configuration
```json
{
  "uri": "mongodb://username:password@cluster.docdb.amazonaws.com:27017/lendpeak2?tls=true&replicaSet=rs0",
  "username": "lendpeak2admin",
  "password": "strong-password-here",
  "database": "lendpeak2",
  "options": {
    "tls": true,
    "replicaSet": "rs0",
    "readPreference": "secondaryPreferred"
  }
}
```

### Redis Configuration
```json
{
  "url": "rediss://default:password@cluster.cache.amazonaws.com:6379",
  "password": "redis-auth-token",
  "tls": {
    "rejectUnauthorized": true
  }
}
```

## Compliance

### SOC 2 Requirements
- [ ] All secrets encrypted at rest
- [ ] Access logging enabled
- [ ] Regular rotation schedule
- [ ] Principle of least privilege
- [ ] No hardcoded secrets

### GDPR Compliance
- [ ] Encryption keys managed separately
- [ ] Data residency requirements met
- [ ] Right to erasure supported
- [ ] Audit trail maintained

## Tools and Scripts

### Secret Scanner
```bash
# Scan for hardcoded secrets
npm run security:scan-secrets

# Pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
if git diff --cached --name-only | xargs grep -E "(password|secret|key).*=.*['\"]"; then
  echo "Potential secret detected. Please review."
  exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

### Secret Health Check
```bash
# Check secret age
aws secretsmanager describe-secret \
  --secret-id lendpeak2-production-db-credentials \
  --query '{LastRotated: LastRotatedDate, Age: CreatedDate}'

# List secrets needing rotation
aws secretsmanager list-secrets \
  --filters '[{"Key":"tag-key","Values":["RotationEnabled"]}]' \
  --query 'SecretList[?LastRotatedDate < `2024-01-01`].Name'
```