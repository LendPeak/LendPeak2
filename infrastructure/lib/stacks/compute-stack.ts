import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  databaseSecrets: secretsmanager.Secret;
}

export class ComputeStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly services: ecs.FargateService[];
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.services = [];

    // Create ECR repository
    const ecrRepository = new ecr.Repository(this, 'BackendRepository', {
      repositoryName: `lendpeak2-backend-${props.environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          rulePriority: 1,
          description: 'Keep only 10 images',
        },
      ],
    });

    // Create ECS cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `lendpeak2-${props.environment}`,
      vpc: props.vpc,
      containerInsights: true,
    });

    // Create task execution role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Add permissions to read secrets
    taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.databaseSecrets.secretArn],
    }));

    // Create task role
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add permissions for the application
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: ['arn:aws:s3:::lendpeak2-*/*'],
    }));

    // Create log group
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/lendpeak2-${props.environment}`,
      retention: logs.RetentionDays.THIRTY_DAYS,
    });

    // Create task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: `lendpeak2-backend-${props.environment}`,
      memoryLimitMiB: props.environment === 'production' ? 2048 : 1024,
      cpu: props.environment === 'production' ? 1024 : 512,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    // Add container
    const container = taskDefinition.addContainer('backend', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logGroup,
      }),
      environment: {
        NODE_ENV: props.environment,
        PORT: '3000',
        AWS_REGION: this.region,
      },
      secrets: {
        MONGODB_URI: ecs.Secret.fromSecretsManager(props.databaseSecrets, 'uri'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(props.databaseSecrets, 'jwtSecret'),
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

    // Create security group for ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for ALB',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS from anywhere'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP from anywhere'
    );

    // Create ALB
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      loadBalancerName: `lendpeak2-${props.environment}`,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // Get hosted zone (assuming it exists)
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'lendpeak.com', // Replace with your domain
    });

    // Create certificate
    const certificate = new certificatemanager.Certificate(this, 'Certificate', {
      domainName: props.environment === 'production' 
        ? 'api.lendpeak.com'
        : `api-${props.environment}.lendpeak.com`,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
    });

    // Create HTTPS listener
    const httpsListener = this.alb.addListener('HttpsListener', {
      port: 443,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not Found',
      }),
    });

    // HTTP to HTTPS redirect
    this.alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // Create target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Add listener rule
    httpsListener.addTargetGroups('BackendTarget', {
      targetGroups: [targetGroup],
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*', '/health']),
      ],
    });

    // Create security group for ECS tasks
    const taskSecurityGroup = new ec2.SecurityGroup(this, 'TaskSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });

    taskSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow from ALB'
    );

    // Create Fargate service
    const service = new ecs.FargateService(this, 'BackendService', {
      cluster,
      taskDefinition,
      serviceName: `lendpeak2-backend-${props.environment}`,
      desiredCount: props.environment === 'production' ? 3 : 1,
      assignPublicIp: false,
      securityGroups: [taskSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      enableLogging: true,
    });

    this.services.push(service);

    // Configure auto-scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: props.environment === 'production' ? 3 : 1,
      maxCapacity: props.environment === 'production' ? 10 : 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Register with target group
    service.attachToApplicationTargetGroup(targetGroup);

    // Create DNS record
    new route53.ARecord(this, 'ApiRecord', {
      zone: hostedZone,
      recordName: props.environment === 'production'
        ? 'api'
        : `api-${props.environment}`,
      target: route53.RecordTarget.fromAlias(
        new route53targets.LoadBalancerTarget(this.alb)
      ),
    });

    // Set API URL for output
    this.apiUrl = props.environment === 'production'
      ? 'https://api.lendpeak.com'
      : `https://api-${props.environment}.lendpeak.com`;

    // Outputs
    new cdk.CfnOutput(this, 'ALBEndpoint', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
      exportName: `${props.environment}-alb-dns`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API URL',
      exportName: `${props.environment}-api-url`,
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${props.environment}-ecr-uri`,
    });
  }
}