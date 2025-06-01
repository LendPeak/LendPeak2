#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LendPeak2Stack } from '../lib/lendpeak2-stack';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ComputeStack } from '../lib/compute-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';
const awsAccountId = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const awsRegion = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

if (!awsAccountId) {
  throw new Error('AWS Account ID must be provided via CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable');
}

const env = {
  account: awsAccountId,
  region: awsRegion,
};

// Stack naming convention
const stackPrefix = `LendPeak2-${environment}`;

// Network Stack - VPC, Subnets, Security Groups
const networkStack = new NetworkStack(app, `${stackPrefix}-Network`, {
  env,
  environment,
  description: 'LendPeak2 Network Infrastructure',
});

// Database Stack - MongoDB on EC2/DocumentDB, Redis
const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  environment,
  vpc: networkStack.vpc,
  description: 'LendPeak2 Database Infrastructure',
});

// Compute Stack - ECS, Lambda, API Gateway
const computeStack = new ComputeStack(app, `${stackPrefix}-Compute`, {
  env,
  environment,
  vpc: networkStack.vpc,
  databaseCluster: databaseStack.documentDbCluster,
  redisCluster: databaseStack.redisCluster,
  description: 'LendPeak2 Compute Infrastructure',
});

// Monitoring Stack - CloudWatch, Alarms, Dashboards
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  environment,
  computeStack,
  databaseStack,
  description: 'LendPeak2 Monitoring and Alerting',
});

// Tag all resources
cdk.Tags.of(app).add('Project', 'LendPeak2');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');