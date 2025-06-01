import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  databaseCluster: docdb.DatabaseCluster;
  redisCluster: elasticache.CfnReplicationGroup;
}

export class ComputeStack extends cdk.Stack {
  public readonly ecsCluster: ecs.Cluster;
  public readonly apiService: ecs.FargateService;
  public readonly apiGateway: apigateway.RestApi;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Create ECS Cluster
    this.ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: `lendpeak2-${props.environment}`,
      vpc: props.vpc,
      containerInsights: true,
    });

    // Create ECR repository for API
    const apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: `lendpeak2-api`,
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
      lifecycleRules: [{
        maxImageCount: props.environment === 'production' ? 20 : 5,
      }],
    });

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      loadBalancerName: `lendpeak2-${props.environment}-alb`,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: ec2.SecurityGroup.fromLookupByName(
        this,
        'ApiSecurityGroup',
        `lendpeak2-${props.environment}-api-sg`,
        props.vpc
      ),
    });

    // Create task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      family: `lendpeak2-${props.environment}-api`,
      memoryLimitMiB: props.environment === 'production' ? 4096 : 2048,
      cpu: props.environment === 'production' ? 2048 : 1024,
    });

    // Add container to task definition
    const container = taskDefinition.addContainer('api', {
      image: ecs.ContainerImage.fromEcrRepository(apiRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        NODE_ENV: props.environment,
        PORT: '3000',
        AWS_REGION: props.env?.region || 'us-east-1',
      },
      secrets: {
        DB_CONNECTION: ecs.Secret.fromSecretsManager(
          cdk.aws_secretsmanager.Secret.fromSecretNameV2(
            this,
            'DbSecret',
            `lendpeak2-${props.environment}-db-credentials`
          )
        ),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Create Fargate Service
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      cluster: this.ecsCluster,
      taskDefinition,
      serviceName: `lendpeak2-${props.environment}-api`,
      desiredCount: props.environment === 'production' ? 3 : 1,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      enableLogging: true,
    });

    // Configure auto-scaling
    const scaling = this.apiService.autoScaleTaskCount({
      minCapacity: props.environment === 'production' ? 3 : 1,
      maxCapacity: props.environment === 'production' ? 20 : 5,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 75,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Create target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      targetGroupName: `lendpeak2-${props.environment}-api-tg`,
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.apiService],
      healthCheck: {
        enabled: true,
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Add listener to load balancer
    const listener = this.loadBalancer.addListener('ApiListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      // Certificate will be added later
    });

    listener.addTargetGroups('ApiTargets', {
      targetGroups: [targetGroup],
    });

    // Create API Gateway
    this.apiGateway = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `lendpeak2-${props.environment}-api`,
      description: 'LendPeak2 API Gateway',
      deployOptions: {
        stageName: props.environment,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: props.environment !== 'production',
        metricsEnabled: true,
        throttlingBurstLimit: props.environment === 'production' ? 5000 : 1000,
        throttlingRateLimit: props.environment === 'production' ? 1000 : 100,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
      },
    });

    // Grant database access to ECS tasks
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'kms:Decrypt',
      ],
      resources: ['*'], // Will be restricted in production
    }));

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load balancer DNS name',
      exportName: `${props.environment}-alb-dns`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiGateway.url,
      description: 'API Gateway URL',
      exportName: `${props.environment}-api-gateway-url`,
    });
  }
}