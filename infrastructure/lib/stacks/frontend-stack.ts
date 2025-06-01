import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  environment: string;
  apiUrl: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // Create S3 bucket for frontend assets
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `lendpeak2-${props.environment}-frontend`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // For SPA routing
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.environment === 'production' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'production',
      versioned: props.environment === 'production',
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Create Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for LendPeak2 ${props.environment}`,
    });

    // Grant read permissions to CloudFront
    this.bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [this.bucket.arnForObjects('*')],
      principals: [originAccessIdentity.grantPrincipal],
    }));

    // Get hosted zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'lendpeak.com', // Replace with your domain
    });

    // Domain name for the frontend
    const domainName = props.environment === 'production'
      ? 'app.lendpeak.com'
      : `app-${props.environment}.lendpeak.com`;

    // Create certificate for CloudFront (must be in us-east-1)
    const certificate = new certificatemanager.DnsValidatedCertificate(this, 'Certificate', {
      domainName,
      hostedZone,
      region: 'us-east-1', // CloudFront requires certificates in us-east-1
    });

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `LendPeak2 ${props.environment} Frontend`,
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(this.bucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      domainNames: [domainName],
      certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      priceClass: props.environment === 'production'
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: true,
      logBucket: new s3.Bucket(this, 'LogBucket', {
        bucketName: `lendpeak2-${props.environment}-frontend-logs`,
        lifecycleRules: [
          {
            id: 'DeleteOldLogs',
            enabled: true,
            expiration: cdk.Duration.days(30),
          },
        ],
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: props.environment === 'production'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: props.environment !== 'production',
      }),
      logFilePrefix: 'cloudfront/',
      geoRestriction: cloudfront.GeoRestriction.allowlist('US', 'CA', 'GB'),
    });

    // Create DNS record
    new route53.ARecord(this, 'FrontendRecord', {
      zone: hostedZone,
      recordName: props.environment === 'production' ? 'app' : `app-${props.environment}`,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(this.distribution)
      ),
    });

    // Deploy frontend assets (placeholder - actual deployment happens in CI/CD)
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [
        s3deploy.Source.data('index.html', `
          <!DOCTYPE html>
          <html>
            <head>
              <title>LendPeak2 - ${props.environment}</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body>
              <h1>LendPeak2 ${props.environment} - Deployment Pending</h1>
              <p>Frontend will be deployed via CI/CD pipeline.</p>
              <p>API URL: ${props.apiUrl}</p>
            </body>
          </html>
        `),
      ],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'Frontend S3 Bucket Name',
      exportName: `${props.environment}-frontend-bucket`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${props.environment}-distribution-id`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `${props.environment}-distribution-domain`,
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${domainName}`,
      description: 'Frontend URL',
      exportName: `${props.environment}-frontend-url`,
    });
  }
}