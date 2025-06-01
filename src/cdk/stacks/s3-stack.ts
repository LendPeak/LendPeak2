import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface S3StackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class S3Stack extends cdk.Stack {
  public readonly documentBucket: s3.Bucket;
  public readonly cloudFrontDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    // Document storage bucket
    this.documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      bucketName: `lendpeak2-documents-${props.environment}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(90),
          enabled: true,
        },
        {
          id: 'TransitionToInfrequentAccess',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'DeleteExpiredDocuments',
          expiration: cdk.Duration.days(365),
          tagFilters: {
            documentType: 'temporary',
          },
        },
      ],
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'], // Restrict in production
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod',
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'DocumentOAI',
      {
        comment: 'OAI for LendPeak2 document bucket',
      }
    );

    // Grant CloudFront access to S3 bucket
    this.documentBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.documentBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // CloudFront distribution for document delivery
    this.cloudFrontDistribution = new cloudfront.Distribution(
      this,
      'DocumentDistribution',
      {
        defaultBehavior: {
          origin: new origins.S3Origin(this.documentBucket, {
            originAccessIdentity,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        additionalBehaviors: {
          '/thumbnails/*': {
            origin: new origins.S3Origin(this.documentBucket, {
              originAccessIdentity,
            }),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachePolicy: new cloudfront.CachePolicy(this, 'ThumbnailCachePolicy', {
              defaultTtl: cdk.Duration.days(7),
              maxTtl: cdk.Duration.days(30),
              minTtl: cdk.Duration.days(1),
            }),
            compress: true,
          },
        },
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        enabled: true,
        comment: `LendPeak2 Document CDN - ${props.environment}`,
        logBucket: new s3.Bucket(this, 'DocumentCDNLogs', {
          bucketName: `lendpeak2-cdn-logs-${props.environment}`,
          lifecycleRules: [
            {
              id: 'DeleteOldLogs',
              expiration: cdk.Duration.days(30),
              enabled: true,
            },
          ],
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          autoDeleteObjects: true,
        }),
      }
    );

    // Outputs
    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: this.documentBucket.bucketName,
      description: 'Name of the document storage bucket',
    });

    new cdk.CfnOutput(this, 'DocumentBucketArn', {
      value: this.documentBucket.bucketArn,
      description: 'ARN of the document storage bucket',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.cloudFrontDistribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.cloudFrontDistribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    // Tags
    cdk.Tags.of(this).add('Service', 'DocumentManagement');
    cdk.Tags.of(this).add('Environment', props.environment);
  }
}