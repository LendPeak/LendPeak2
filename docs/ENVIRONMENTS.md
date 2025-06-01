# Environment Configuration Guide

This document details the configuration for each environment in the LendPeak2 system.

## Environment Overview

| Environment | Purpose | URL | Auto-Deploy |
|------------|---------|-----|-------------|
| Development | Local development | http://localhost:3000 | No |
| Staging | Testing and QA | https://app-staging.lendpeak.com | Yes (main branch) |
| Production | Live system | https://app.lendpeak.com | Manual approval |

## Development Environment

### Local Setup
```bash
# Backend
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/lendpeak2
JWT_SECRET=dev-secret-not-for-production
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug

# Frontend
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=LendPeak2 (Dev)
```

### Docker Compose
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mongodb_data:
```

### Running Locally
```bash
# Start dependencies
docker-compose up -d

# Start backend
npm run dev

# Start frontend (new terminal)
cd frontend
npm run dev
```

## Staging Environment

### Infrastructure
- **Region**: us-east-1
- **VPC**: 10.0.0.0/16
- **Availability Zones**: 2
- **NAT Gateways**: 1

### Services
| Service | Configuration | Scaling |
|---------|--------------|---------|
| ECS Tasks | 512 CPU, 1GB RAM | 1-3 instances |
| DocumentDB | db.t3.medium | 1 instance |
| Redis | cache.t3.micro | 1 node |
| ALB | HTTP/HTTPS | Cross-AZ |

### Environment Variables
```bash
NODE_ENV=staging
PORT=3000
MONGODB_URI=<from-secrets-manager>
JWT_SECRET=<from-secrets-manager>
REDIS_URL=<elasticache-endpoint>
LOG_LEVEL=info
CORS_ORIGIN=https://app-staging.lendpeak.com
```

### Deployment
- Triggered by push to `main` branch
- Runs full test suite
- Deploys backend to ECS
- Deploys frontend to S3/CloudFront
- Slack notification on completion

### Access Control
- VPN required for database access
- API key required for external services
- Basic auth on staging frontend (optional)

## Production Environment

### Infrastructure
- **Region**: us-east-1 (primary), us-west-2 (DR)
- **VPC**: 10.1.0.0/16
- **Availability Zones**: 3
- **NAT Gateways**: 2 (Multi-AZ)

### Services
| Service | Configuration | Scaling |
|---------|--------------|---------|
| ECS Tasks | 1024 CPU, 2GB RAM | 3-10 instances |
| DocumentDB | db.r6g.large | 3 instances (Multi-AZ) |
| Redis | cache.r7g.large | 3 nodes (cluster mode) |
| ALB | HTTPS only | Cross-AZ with WAF |

### Environment Variables
```bash
NODE_ENV=production
PORT=3000
MONGODB_URI=<from-secrets-manager>
JWT_SECRET=<from-secrets-manager>
REDIS_URL=<elasticache-cluster-endpoint>
LOG_LEVEL=warn
CORS_ORIGIN=https://app.lendpeak.com
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100
```

### High Availability
- Multi-AZ deployment
- Auto-scaling based on CPU/memory
- Read replicas for database
- CloudFront for global distribution
- Route53 health checks

### Security
- WAF rules enabled
- DDoS protection (Shield Standard)
- All data encrypted at rest
- TLS 1.2+ enforced
- Security groups with minimal access
- VPC endpoints for AWS services

### Backup Strategy
- **DocumentDB**: Continuous backups, 35-day retention
- **Redis**: Daily snapshots, 7-day retention
- **S3**: Versioning enabled, lifecycle policies
- **Disaster Recovery**: 4-hour RTO, 1-hour RPO

### Monitoring
- CloudWatch dashboards
- Custom metrics and alarms
- PagerDuty integration
- Datadog APM (optional)
- Weekly performance reports

### Deployment
- Triggered by version tags (v*.*.*)
- Requires manual approval
- Blue/green deployment
- Automated rollback on failures
- Maintenance window: Sunday 2-4 AM EST

## Configuration Management

### Secrets Manager
All sensitive configuration stored in AWS Secrets Manager:
```json
{
  "mongodb": {
    "uri": "mongodb://...",
    "username": "admin",
    "password": "..."
  },
  "jwt": {
    "secret": "...",
    "refreshSecret": "..."
  },
  "redis": {
    "url": "rediss://...",
    "password": "..."
  },
  "external": {
    "apiKey": "...",
    "webhookSecret": "..."
  }
}
```

### Parameter Store
Non-sensitive configuration in Systems Manager Parameter Store:
```
/lendpeak2/staging/feature-flags
/lendpeak2/staging/rate-limits
/lendpeak2/production/feature-flags
/lendpeak2/production/rate-limits
```

### Feature Flags
```json
{
  "features": {
    "newLoanCalculator": {
      "enabled": true,
      "rolloutPercentage": 100
    },
    "aiCreditScoring": {
      "enabled": false,
      "rolloutPercentage": 0
    }
  }
}
```

## Migration Between Environments

### Promoting Staging to Production
1. Run full regression test suite
2. Backup production database
3. Create release tag
4. Deploy infrastructure changes (if any)
5. Deploy application
6. Run smoke tests
7. Monitor for 30 minutes

### Database Migrations
```bash
# Test migration in staging
npm run migrate:up -- --env staging

# Backup production before migration
aws docdb create-db-cluster-snapshot \
  --db-cluster-identifier lendpeak2-production \
  --db-cluster-snapshot-identifier pre-migration-$(date +%Y%m%d)

# Run production migration
npm run migrate:up -- --env production
```

### Rollback Procedures
```bash
# Application rollback
./scripts/rollback.sh production v1.2.3

# Database rollback
npm run migrate:down -- --env production --to 20240115120000

# Infrastructure rollback
cd infrastructure
cdk deploy LendPeak2-production-* --rollback
```

## Performance Benchmarks

### Expected Metrics
| Metric | Development | Staging | Production |
|--------|------------|---------|------------|
| API Response Time | <500ms | <200ms | <100ms |
| Throughput | 10 RPS | 100 RPS | 1000 RPS |
| Error Rate | <5% | <1% | <0.1% |
| Availability | 95% | 99% | 99.9% |

### Load Testing
```bash
# Run load test against staging
npm run test:load -- --env staging --users 100 --duration 300

# Stress test (staging only)
npm run test:stress -- --env staging --users 1000
```

## Troubleshooting

### Environment-Specific Issues

**Development**
- Port conflicts: Check `lsof -i :3000`
- MongoDB connection: Verify Docker running
- CORS errors: Check frontend proxy config

**Staging**
- 502 errors: Check ECS task health
- Slow queries: Enable MongoDB profiler
- Cache misses: Verify Redis connection

**Production**
- High latency: Check CloudFront cache hit ratio
- Database locks: Review slow query log
- Memory leaks: Analyze heap dumps

### Health Checks
```bash
# Development
curl http://localhost:3000/health

# Staging
curl https://api-staging.lendpeak.com/health

# Production
curl https://api.lendpeak.com/health
```

### Log Locations
- **Development**: `./logs/app.log`
- **Staging**: CloudWatch Logs - `/ecs/lendpeak2-staging`
- **Production**: CloudWatch Logs - `/ecs/lendpeak2-production`

## Environment Promotion Checklist

### Staging → Production
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Stakeholders notified
- [ ] Monitoring alerts configured
- [ ] Change request approved
- [ ] Maintenance window scheduled