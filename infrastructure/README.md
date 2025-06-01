# LendPeak2 Infrastructure

This directory contains the AWS CDK infrastructure code for deploying the LendPeak2 loan management system.

## Architecture Overview

The infrastructure consists of five main stacks:

1. **Network Stack** - VPC, subnets, NAT gateways, and VPC endpoints
2. **Database Stack** - DocumentDB cluster and ElastiCache Redis
3. **Compute Stack** - ECS Fargate, ALB, and auto-scaling
4. **Frontend Stack** - S3, CloudFront, and Route53
5. **Monitoring Stack** - CloudWatch dashboards, alarms, and SNS notifications

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18+ and npm installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Domain name registered in Route53
- AWS account with appropriate permissions

## Environment Variables

Create a `.env` file in the infrastructure directory:

```bash
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
DOMAIN_NAME=lendpeak.com
ALERT_EMAIL=alerts@lendpeak.com
```

## Deployment Steps

### 1. Install Dependencies

```bash
cd infrastructure
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### 3. Deploy Stacks

Deploy stacks in order for staging environment:

```bash
# Deploy network infrastructure
cdk deploy LendPeak2-staging-network

# Deploy database infrastructure
cdk deploy LendPeak2-staging-database

# Deploy compute infrastructure
cdk deploy LendPeak2-staging-compute

# Deploy frontend infrastructure
cdk deploy LendPeak2-staging-frontend

# Deploy monitoring infrastructure
cdk deploy LendPeak2-staging-monitoring
```

For production:

```bash
# Use production configuration
cdk deploy LendPeak2-production-* --context environment=production
```

### 4. Post-Deployment Configuration

1. **Update Secrets Manager**:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id lendpeak2-staging-db-credentials \
     --secret-string '{"jwtSecret":"your-jwt-secret-here"}'
   ```

2. **Configure DNS**:
   - Verify certificate validation in ACM
   - Update nameservers if using external registrar

3. **Deploy Application**:
   - Push Docker image to ECR
   - GitHub Actions will handle automatic deployments

## Stack Details

### Network Stack
- VPC with public, private, and isolated subnets
- NAT gateways for outbound connectivity
- VPC endpoints for AWS services
- Flow logs for security monitoring

### Database Stack
- DocumentDB 5.0 cluster (MongoDB compatible)
- ElastiCache Redis 7.0 for caching
- Automated backups and encryption
- Private subnet isolation

### Compute Stack
- ECS Fargate for containerized backend
- Application Load Balancer with HTTPS
- Auto-scaling based on CPU and memory
- Blue/green deployments

### Frontend Stack
- S3 bucket for static assets
- CloudFront CDN with caching
- Custom domain with SSL certificate
- Single-page application support

### Monitoring Stack
- CloudWatch dashboards for all services
- SNS alerts for critical issues
- Custom metrics and alarms
- Composite alarms for system health

## Security Considerations

- All data encrypted at rest and in transit
- Private subnets for databases and compute
- Security groups with least privilege
- VPC flow logs and CloudTrail enabled
- Secrets stored in AWS Secrets Manager
- IAM roles with minimal permissions

## Cost Optimization

- VPC endpoints reduce NAT gateway costs
- Auto-scaling prevents over-provisioning
- CloudFront caching reduces origin requests
- Lifecycle policies for logs and backups
- Reserved instances for production workloads

## Troubleshooting

### Common Issues

1. **Certificate Validation Failed**
   - Ensure Route53 hosted zone matches domain
   - Check DNS propagation
   - Verify email for validation

2. **Stack Creation Failed**
   - Check CloudFormation events
   - Verify IAM permissions
   - Review resource limits

3. **Application Not Accessible**
   - Check ALB target health
   - Verify security group rules
   - Review ECS task logs

### Useful Commands

```bash
# Check stack status
cdk diff LendPeak2-staging-compute

# View CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name LendPeak2-staging-compute \
  --query 'Stacks[0].Outputs'

# View ECS service logs
aws logs tail /ecs/lendpeak2-staging --follow

# Check DocumentDB connection
aws docdb describe-db-clusters \
  --db-cluster-identifier lendpeak2-staging
```

## Maintenance

### Daily Tasks
- Monitor CloudWatch dashboards
- Review alarm notifications
- Check backup completion

### Weekly Tasks
- Review cost reports
- Update security patches
- Analyze performance metrics

### Monthly Tasks
- Rotate secrets and credentials
- Review and optimize alarms
- Update documentation

## Disaster Recovery

1. **Backup Strategy**:
   - DocumentDB: Daily snapshots, 35-day retention
   - Redis: Daily snapshots, 7-day retention
   - S3: Versioning enabled for frontend

2. **Recovery Procedures**:
   - Database: Restore from snapshot
   - Application: Redeploy from Git/ECR
   - DNS: Update Route53 if needed

3. **RTO/RPO Targets**:
   - RTO: 4 hours
   - RPO: 24 hours

## Support

For infrastructure issues:
1. Check CloudWatch logs and metrics
2. Review AWS service health
3. Contact DevOps team
4. Escalate to AWS support if needed