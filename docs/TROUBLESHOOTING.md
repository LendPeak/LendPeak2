# Troubleshooting Guide

This guide helps diagnose and resolve common issues in the LendPeak2 system.

## Quick Diagnostics

### System Health Check
```bash
# Check all services
./scripts/health-check.sh production

# Individual components
curl https://api.lendpeak.com/health
curl https://api.lendpeak.com/health/db
curl https://api.lendpeak.com/health/redis
```

### Common Status Codes
| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | None |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Verify authentication |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify endpoint/resource |
| 429 | Rate Limited | Retry with backoff |
| 500 | Server Error | Check logs |
| 502 | Bad Gateway | Check ECS tasks |
| 503 | Service Unavailable | Check ALB targets |

## Backend Issues

### Application Won't Start

**Symptoms:**
- ECS tasks failing to start
- Health checks timing out
- Container exits immediately

**Diagnosis:**
```bash
# Check ECS task logs
aws logs tail /ecs/lendpeak2-production --follow

# Describe failed task
aws ecs describe-tasks \
  --cluster lendpeak2-production \
  --tasks <task-arn> \
  --query 'tasks[0].stoppedReason'

# Check task definition
aws ecs describe-task-definition \
  --task-definition lendpeak2-backend-production
```

**Common Causes:**
1. **Missing environment variables**
   ```bash
   # Verify secrets exist
   aws secretsmanager get-secret-value \
     --secret-id lendpeak2-production-db-credentials
   ```

2. **Database connection failed**
   ```bash
   # Test connection from bastion
   mongo "mongodb://host:27017/lendpeak2" --tls
   ```

3. **Insufficient memory/CPU**
   ```bash
   # Update task definition
   aws ecs update-service \
     --cluster lendpeak2-production \
     --service backend \
     --task-definition backend:NEW_VERSION
   ```

### High Memory Usage

**Symptoms:**
- Container restarts
- OOM (Out of Memory) errors
- Degraded performance

**Diagnosis:**
```bash
# Check memory metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=lendpeak2-backend-production \
  --start-time 2024-01-20T00:00:00Z \
  --end-time 2024-01-20T23:59:59Z \
  --period 300 \
  --statistics Average
```

**Resolution:**
1. **Analyze heap dump**
   ```bash
   # Generate heap dump
   kubectl exec -it backend-pod -- kill -USR1 1
   
   # Download and analyze
   aws s3 cp s3://lendpeak2-dumps/heapdump.hprof .
   npm run analyze:heap heapdump.hprof
   ```

2. **Check for memory leaks**
   ```javascript
   // Add to application
   if (process.env.NODE_ENV === 'production') {
     require('heapdump');
     setInterval(() => {
       global.gc();
       console.log('Memory:', process.memoryUsage());
     }, 60000);
   }
   ```

### API Timeouts

**Symptoms:**
- 504 Gateway Timeout
- Slow response times
- Request timeouts

**Diagnosis:**
```bash
# Check ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/lendpeak2-production/* \
  --start-time 2024-01-20T00:00:00Z \
  --end-time 2024-01-20T23:59:59Z \
  --period 300 \
  --statistics Average,Maximum
```

**Common Causes:**
1. **Database queries slow**
   ```javascript
   // Enable query profiling
   db.setProfilingLevel(1, { slowms: 100 });
   
   // Check slow queries
   db.system.profile.find({ millis: { $gt: 100 } })
     .sort({ ts: -1 })
     .limit(10);
   ```

2. **Insufficient connections**
   ```javascript
   // Increase pool size
   mongoose.connect(uri, {
     maxPoolSize: 20,
     minPoolSize: 5,
     socketTimeoutMS: 45000,
   });
   ```

## Database Issues

### Connection Pool Exhausted

**Symptoms:**
- "No available connections" errors
- Intermittent connection failures
- Increased latency

**Diagnosis:**
```bash
# Check connection count
mongo mongodb://cluster.docdb.amazonaws.com:27017/admin --tls --eval "db.serverStatus().connections"

# Monitor connections
watch -n 5 'mongo --eval "db.serverStatus().connections"'
```

**Resolution:**
```javascript
// Adjust connection pool
const options = {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 5000,
};

// Monitor pool
mongoose.connection.on('connected', () => {
  const { readyState, totalConnectionCount } = mongoose.connection;
  console.log('Pool status:', { readyState, totalConnectionCount });
});
```

### Replication Lag

**Symptoms:**
- Stale data on reads
- Inconsistent query results
- Write conflicts

**Diagnosis:**
```bash
# Check replication status
mongo mongodb://cluster.docdb.amazonaws.com:27017/admin --tls --eval "rs.status()"

# Check lag
mongo --eval "rs.printReplicationInfo()"
```

**Resolution:**
```javascript
// Use appropriate read preference
const options = {
  readPreference: 'primary',        // For critical reads
  readPreference: 'primaryPreferred', // Balance load
  readPreference: 'secondary',      // For analytics
  readConcern: { level: 'majority' }, // Ensure consistency
};
```

### Storage Full

**Symptoms:**
- Write operations failing
- Database becoming read-only
- Disk space alerts

**Diagnosis:**
```bash
# Check storage metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DocDB \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBClusterIdentifier,Value=lendpeak2-production
```

**Resolution:**
1. **Clean up old data**
   ```javascript
   // Archive old loans
   db.loans.aggregate([
     { $match: { createdAt: { $lt: new Date('2023-01-01') } } },
     { $out: 'loans_archive' }
   ]);
   
   // Remove archived data
   db.loans.deleteMany({ 
     createdAt: { $lt: new Date('2023-01-01') } 
   });
   ```

2. **Increase storage**
   ```bash
   aws docdb modify-db-cluster \
     --db-cluster-identifier lendpeak2-production \
     --allocated-storage 500
   ```

## Frontend Issues

### Build Failures

**Symptoms:**
- CI/CD pipeline fails
- TypeScript errors
- Module not found

**Diagnosis:**
```bash
# Check build logs
npm run build

# Verify dependencies
npm ls
npm audit

# Check TypeScript
npx tsc --noEmit
```

**Common Fixes:**
1. **Clear cache**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

2. **Update dependencies**
   ```bash
   npm update
   npm audit fix
   ```

### CloudFront Cache Issues

**Symptoms:**
- Old content served
- 404 errors after deployment
- Inconsistent content

**Diagnosis:**
```bash
# Check cache headers
curl -I https://app.lendpeak.com/assets/main.js

# View CloudFront metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate
```

**Resolution:**
```bash
# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"

# Check invalidation status
aws cloudfront get-invalidation \
  --distribution-id E1234567890ABC \
  --id I1234567890ABC
```

### CORS Errors

**Symptoms:**
- "CORS policy" errors in console
- API calls blocked
- Preflight failures

**Diagnosis:**
```bash
# Test CORS headers
curl -H "Origin: https://app.lendpeak.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.lendpeak.com/api/auth/login -v
```

**Resolution:**
```javascript
// Backend CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
}));
```

## Infrastructure Issues

### ALB Target Unhealthy

**Symptoms:**
- 503 Service Unavailable
- Targets draining
- No healthy targets

**Diagnosis:**
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/name

# Check health check configuration
aws elbv2 describe-target-groups \
  --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/name
```

**Common Causes:**
1. **Health check path incorrect**
   ```bash
   # Update health check
   aws elbv2 modify-target-group \
     --target-group-arn arn:aws:... \
     --health-check-path /health \
     --health-check-interval-seconds 30
   ```

2. **Security group blocking**
   ```bash
   # Check security group rules
   aws ec2 describe-security-groups \
     --group-ids sg-1234567890abcdef
   ```

### Auto-scaling Not Working

**Symptoms:**
- High CPU but no scale-out
- Tasks not launching
- Scaling alarms not triggering

**Diagnosis:**
```bash
# Check scaling policies
aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id service/lendpeak2-production/backend

# Check scaling activities
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/lendpeak2-production/backend
```

**Resolution:**
```bash
# Update scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/lendpeak2-production/backend \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    }
  }'
```

## Performance Issues

### Slow Queries

**Diagnosis:**
```javascript
// Enable profiling
db.setProfilingLevel(2);

// Find slow queries
db.system.profile.find({
  millis: { $gt: 100 }
}).sort({ ts: -1 }).limit(10);

// Explain query
db.loans.find({ userId: "..." }).explain("executionStats");
```

**Optimization:**
```javascript
// Add indexes
db.loans.createIndex({ userId: 1, createdAt: -1 });
db.loans.createIndex({ status: 1, dueDate: 1 });

// Use projection
db.loans.find(
  { userId: "..." },
  { amount: 1, status: 1, dueDate: 1 }
);

// Paginate results
db.loans.find({})
  .sort({ createdAt: -1 })
  .skip(20)
  .limit(20);
```

### High Latency

**Diagnosis:**
```bash
# Trace request path
curl -w "@curl-format.txt" -o /dev/null -s https://api.lendpeak.com/health

# curl-format.txt:
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer:  %{time_pretransfer}s\n
time_redirect:  %{time_redirect}s\n
time_starttransfer:  %{time_starttransfer}s\n
time_total:  %{time_total}s\n
```

**Resolution:**
1. **Enable caching**
   ```javascript
   // Redis caching
   const cached = await redis.get(key);
   if (cached) return JSON.parse(cached);
   
   const result = await expensive_operation();
   await redis.setex(key, 3600, JSON.stringify(result));
   ```

2. **Optimize middleware**
   ```javascript
   // Conditional middleware
   app.use((req, res, next) => {
     if (req.path.startsWith('/health')) {
       return next();
     }
     // Heavy middleware here
   });
   ```

## Monitoring and Alerts

### Missing Metrics

**Diagnosis:**
```bash
# List available metrics
aws cloudwatch list-metrics \
  --namespace AWS/ECS \
  --dimensions Name=ServiceName,Value=lendpeak2-backend-production

# Check custom metrics
aws cloudwatch list-metrics \
  --namespace LendPeak2
```

**Resolution:**
```javascript
// Send custom metrics
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

cloudwatch.putMetricData({
  Namespace: 'LendPeak2',
  MetricData: [{
    MetricName: 'LoanProcessingTime',
    Value: processingTime,
    Unit: 'Milliseconds',
    Dimensions: [
      { Name: 'Environment', Value: process.env.NODE_ENV },
      { Name: 'LoanType', Value: loanType }
    ]
  }]
}).promise();
```

### Alert Fatigue

**Symptoms:**
- Too many alerts
- False positives
- Important alerts missed

**Resolution:**
```bash
# Adjust alarm thresholds
aws cloudwatch put-metric-alarm \
  --alarm-name high-error-rate \
  --alarm-description "Error rate above 5%" \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Create composite alarms
aws cloudwatch put-composite-alarm \
  --alarm-name critical-system-failure \
  --alarm-rule "ALARM('high-cpu') AND ALARM('high-memory')" \
  --actions-enabled
```

## Emergency Procedures

### Service Down

1. **Immediate Actions**
   ```bash
   # Check service status
   ./scripts/emergency-check.sh production
   
   # Scale up immediately
   aws ecs update-service \
     --cluster lendpeak2-production \
     --service backend \
     --desired-count 10
   ```

2. **Diagnosis**
   ```bash
   # Recent deployments
   aws ecs list-tasks \
     --cluster lendpeak2-production \
     --started-by deployment
   
   # Check for failures
   aws logs filter-log-events \
     --log-group-name /ecs/lendpeak2-production \
     --filter-pattern ERROR \
     --start-time $(date -u -d '1 hour ago' +%s)000
   ```

3. **Rollback**
   ```bash
   # Rollback to previous version
   ./scripts/rollback.sh production previous
   
   # Or specific version
   aws ecs update-service \
     --cluster lendpeak2-production \
     --service backend \
     --task-definition backend:123
   ```

### Data Corruption

1. **Stop writes**
   ```bash
   # Enable read-only mode
   aws ecs update-service \
     --cluster lendpeak2-production \
     --service backend \
     --environment READONLY_MODE=true
   ```

2. **Assess damage**
   ```javascript
   // Check data integrity
   db.loans.find({ 
     $or: [
       { amount: { $lt: 0 } },
       { interestRate: { $gt: 100 } },
       { createdAt: { $gt: new Date() } }
     ]
   });
   ```

3. **Restore from backup**
   ```bash
   # List snapshots
   aws docdb describe-db-cluster-snapshots \
     --db-cluster-identifier lendpeak2-production
   
   # Restore
   aws docdb restore-db-cluster-from-snapshot \
     --db-cluster-identifier lendpeak2-production-restore \
     --snapshot-identifier rds:lendpeak2-production-2024-01-20
   ```

## Support Escalation

### Level 1: Development Team
- Check logs and metrics
- Restart services
- Clear caches
- Apply known fixes

### Level 2: DevOps Team  
- Infrastructure issues
- Scaling problems
- Network issues
- AWS service problems

### Level 3: AWS Support
- Service limits
- Platform issues
- Performance optimization
- Architecture review

### Incident Response
```bash
# Create incident
./scripts/create-incident.sh \
  --severity high \
  --title "API Response Time Degraded" \
  --assignee oncall@lendpeak.com

# Update status page
./scripts/update-status.sh \
  --component api \
  --status degraded \
  --message "Investigating high response times"
```