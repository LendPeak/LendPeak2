import * as cdk from 'aws-cdk-lib';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly documentDbCluster: docdb.DatabaseCluster;
  public readonly redisCluster: elasticache.CfnReplicationGroup;
  public readonly dbSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Import security groups from Network Stack
    const dbSecurityGroup = ec2.SecurityGroup.fromLookupByName(
      this,
      'DatabaseSecurityGroup',
      `lendpeak2-${props.environment}-db-sg`,
      props.vpc
    );

    const redisSecurityGroup = ec2.SecurityGroup.fromLookupByName(
      this,
      'RedisSecurityGroup',
      `lendpeak2-${props.environment}-redis-sg`,
      props.vpc
    );

    // Create database credentials secret
    this.dbSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `lendpeak2-${props.environment}-db-credentials`,
      description: 'MongoDB/DocumentDB master credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'lendpeak2admin' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        passwordLength: 32,
      },
    });

    // Create subnet group for DocumentDB
    const dbSubnetGroup = new docdb.SubnetGroup(this, 'DatabaseSubnetGroup', {
      subnetGroupName: `lendpeak2-${props.environment}-db-subnet-group`,
      description: 'Subnet group for DocumentDB cluster',
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create DocumentDB cluster
    this.documentDbCluster = new docdb.DatabaseCluster(this, 'DocumentDBCluster', {
      masterUser: {
        username: 'lendpeak2admin',
        secretName: this.dbSecret.secretName,
      },
      instanceType: props.environment === 'production' 
        ? ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      vpc: props.vpc,
      securityGroup: dbSecurityGroup,
      subnetGroup: dbSubnetGroup,
      instances: props.environment === 'production' ? 3 : 1,
      backup: {
        retention: cdk.Duration.days(props.environment === 'production' ? 35 : 7),
        preferredWindow: '03:00-04:00',
      },
      cloudWatchLogsRetention: props.environment === 'production' ? 30 : 7,
      enableCloudWatchLogsExports: ['audit', 'profiler'],
      storageEncrypted: true,
      deletionProtection: props.environment === 'production',
      engineVersion: '5.0.0',
    });

    // Create Redis subnet group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      cacheSubnetGroupName: `lendpeak2-${props.environment}-redis-subnet-group`,
      description: 'Subnet group for Redis cluster',
      subnetIds: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    // Create Redis replication group
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupId: `lendpeak2-${props.environment}-redis`,
      replicationGroupDescription: 'Redis cluster for caching and session management',
      engine: 'redis',
      engineVersion: '7.0',
      cacheNodeType: props.environment === 'production' 
        ? 'cache.r6g.large' 
        : 'cache.t3.micro',
      numCacheClusters: props.environment === 'production' ? 3 : 1,
      automaticFailoverEnabled: props.environment === 'production',
      multiAzEnabled: props.environment === 'production',
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      securityGroupIds: [redisSecurityGroup.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      snapshotRetentionLimit: props.environment === 'production' ? 7 : 1,
      snapshotWindow: '03:00-05:00',
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      notificationTopicArn: undefined, // Will be set up in monitoring stack
      tags: [
        { key: 'Name', value: `lendpeak2-${props.environment}-redis` },
        { key: 'Environment', value: props.environment },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'DocumentDBEndpoint', {
      value: this.documentDbCluster.clusterEndpoint.socketAddress,
      description: 'DocumentDB cluster endpoint',
      exportName: `${props.environment}-docdb-endpoint`,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrPrimaryEndPointAddress,
      description: 'Redis primary endpoint',
      exportName: `${props.environment}-redis-endpoint`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `${props.environment}-db-secret-arn`,
    });
  }
}