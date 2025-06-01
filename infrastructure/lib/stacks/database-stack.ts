import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as backup from 'aws-cdk-lib/aws-backup';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly databaseSecrets: secretsmanager.Secret;
  public readonly documentDbCluster: docdb.DatabaseCluster;
  public readonly redisCluster: elasticache.CfnReplicationGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Create security groups
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for DocumentDB',
      allowAllOutbound: false,
    });

    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Redis',
      allowAllOutbound: false,
    });

    // Create secrets for database credentials
    this.databaseSecrets = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `lendpeak2-${props.environment}-db-credentials`,
      description: 'DocumentDB master credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'lendpeak2admin',
        }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        passwordLength: 32,
      },
    });

    // Create subnet group for DocumentDB
    const dbSubnetGroup = new docdb.SubnetGroup(this, 'DbSubnetGroup', {
      description: 'Subnet group for DocumentDB',
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create DocumentDB parameter group
    const dbParameterGroup = new docdb.ClusterParameterGroup(this, 'DbParameterGroup', {
      family: 'docdb5.0',
      description: 'Parameter group for DocumentDB',
      parameters: {
        audit_logs: 'enabled',
        profiler: 'enabled',
        profiler_threshold_ms: '100',
        ttl_monitor: 'enabled',
      },
    });

    // Create DocumentDB cluster
    this.documentDbCluster = new docdb.DatabaseCluster(this, 'DocumentDBCluster', {
      masterUser: {
        username: this.databaseSecrets.secretValueFromJson('username').unsafeUnwrap(),
        password: this.databaseSecrets.secretValueFromJson('password'),
      },
      instanceType: props.environment === 'production' 
        ? ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      instances: props.environment === 'production' ? 3 : 1,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      vpc: props.vpc,
      subnetGroup: dbSubnetGroup,
      parameterGroup: dbParameterGroup,
      storageEncrypted: true,
      backup: {
        retention: cdk.Duration.days(props.environment === 'production' ? 35 : 7),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      deletionProtection: props.environment === 'production',
      securityGroup: this.databaseSecurityGroup,
      engineVersion: '5.0.0',
    });

    // Store connection string in secrets
    new secretsmanager.Secret(this, 'DatabaseConnectionString', {
      secretName: `lendpeak2-${props.environment}-db-connection`,
      description: 'DocumentDB connection string',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        `mongodb://${this.databaseSecrets.secretValueFromJson('username').unsafeUnwrap()}:${this.databaseSecrets.secretValueFromJson('password').unsafeUnwrap()}@${this.documentDbCluster.clusterEndpoint.hostname}:${this.documentDbCluster.clusterEndpoint.port}/lendpeak2?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`
      ),
    });

    // Create Redis subnet group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis',
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
    });

    // Create Redis cluster
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: 'Redis cluster for LendPeak2',
      engine: 'redis',
      engineVersion: '7.0',
      cacheNodeType: props.environment === 'production' 
        ? 'cache.r7g.large' 
        : 'cache.t3.micro',
      numCacheClusters: props.environment === 'production' ? 3 : 1,
      automaticFailoverEnabled: props.environment === 'production',
      multiAzEnabled: props.environment === 'production',
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [this.redisSecurityGroup.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      transitEncryptionMode: 'required',
      authToken: this.databaseSecrets.secretValueFromJson('password').unsafeUnwrap(),
      snapshotRetentionLimit: props.environment === 'production' ? 7 : 1,
      snapshotWindow: '03:00-05:00',
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      tags: [
        {
          key: 'Name',
          value: `lendpeak2-${props.environment}-redis`,
        },
      ],
    });

    // Create backup plan for production
    if (props.environment === 'production') {
      const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
        backupPlanName: `lendpeak2-${props.environment}-backup-plan`,
        backupPlanRules: [
          {
            ruleName: 'DailyBackups',
            scheduleExpression: cdk.Schedule.cron({
              hour: '3',
              minute: '0',
            }),
            deleteAfter: cdk.Duration.days(35),
            moveToColdStorageAfter: cdk.Duration.days(7),
          },
          {
            ruleName: 'MonthlyBackups',
            scheduleExpression: cdk.Schedule.cron({
              day: '1',
              hour: '3',
              minute: '0',
            }),
            deleteAfter: cdk.Duration.days(365),
            moveToColdStorageAfter: cdk.Duration.days(30),
          },
        ],
      });

      // Add DocumentDB to backup plan
      backupPlan.addSelection('DatabaseBackup', {
        resources: [
          backup.BackupResource.fromArn(this.documentDbCluster.clusterArn),
        ],
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'DocumentDBEndpoint', {
      value: this.documentDbCluster.clusterEndpoint.hostname,
      description: 'DocumentDB Cluster Endpoint',
      exportName: `${props.environment}-docdb-endpoint`,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrPrimaryEndPointAddress,
      description: 'Redis Primary Endpoint',
      exportName: `${props.environment}-redis-endpoint`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecrets.secretArn,
      description: 'Database Secret ARN',
      exportName: `${props.environment}-db-secret-arn`,
    });
  }
}