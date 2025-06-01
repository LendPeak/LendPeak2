import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  alb: elbv2.ApplicationLoadBalancer;
  services: ecs.FargateService[];
  distribution: cloudfront.Distribution;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Create SNS topic for alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `lendpeak2-${props.environment}-alerts`,
      displayName: `LendPeak2 ${props.environment} Alerts`,
    });

    // Add email subscription (replace with your email)
    alertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('alerts@lendpeak.com')
    );

    // Create CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `lendpeak2-${props.environment}`,
      widgets: [
        [
          new cloudwatch.TextWidget({
            markdown: `# LendPeak2 ${props.environment.toUpperCase()} Dashboard`,
            width: 24,
            height: 1,
          }),
        ],
      ],
    });

    // ALB Metrics
    const albTargetResponseTime = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetResponseTime',
      dimensionsMap: {
        LoadBalancer: props.alb.loadBalancerFullName,
      },
      statistic: 'Average',
    });

    const albHealthyHostCount = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HealthyHostCount',
      dimensionsMap: {
        LoadBalancer: props.alb.loadBalancerFullName,
      },
      statistic: 'Average',
    });

    const albRequestCount = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'RequestCount',
      dimensionsMap: {
        LoadBalancer: props.alb.loadBalancerFullName,
      },
      statistic: 'Sum',
    });

    const alb4xxCount = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_4XX_Count',
      dimensionsMap: {
        LoadBalancer: props.alb.loadBalancerFullName,
      },
      statistic: 'Sum',
    });

    const alb5xxCount = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_5XX_Count',
      dimensionsMap: {
        LoadBalancer: props.alb.loadBalancerFullName,
      },
      statistic: 'Sum',
    });

    // Add ALB widgets to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB Response Time',
        left: [albTargetResponseTime],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB Request Count',
        left: [albRequestCount],
        width: 12,
        height: 6,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB Error Rates',
        left: [alb4xxCount, alb5xxCount],
        width: 12,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Healthy Hosts',
        metrics: [albHealthyHostCount],
        width: 12,
        height: 6,
      }),
    );

    // ECS Service Metrics
    props.services.forEach((service, index) => {
      const cpuUtilization = service.metricCpuUtilization();
      const memoryUtilization = service.metricMemoryUtilization();

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `ECS Service CPU - ${service.serviceName}`,
          left: [cpuUtilization],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: `ECS Service Memory - ${service.serviceName}`,
          left: [memoryUtilization],
          width: 12,
          height: 6,
        }),
      );

      // Create alarms for ECS service
      new cloudwatch.Alarm(this, `ServiceCpuAlarm${index}`, {
        metric: cpuUtilization,
        threshold: 80,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
        alarmDescription: `CPU utilization is too high for ${service.serviceName}`,
      }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

      new cloudwatch.Alarm(this, `ServiceMemoryAlarm${index}`, {
        metric: memoryUtilization,
        threshold: 80,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
        alarmDescription: `Memory utilization is too high for ${service.serviceName}`,
      }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
    });

    // CloudFront Metrics
    const cfRequests = new cloudwatch.Metric({
      namespace: 'AWS/CloudFront',
      metricName: 'Requests',
      dimensionsMap: {
        DistributionId: props.distribution.distributionId,
        Region: 'Global',
      },
      statistic: 'Sum',
    });

    const cfBytesDownloaded = new cloudwatch.Metric({
      namespace: 'AWS/CloudFront',
      metricName: 'BytesDownloaded',
      dimensionsMap: {
        DistributionId: props.distribution.distributionId,
        Region: 'Global',
      },
      statistic: 'Sum',
    });

    const cf4xxErrorRate = new cloudwatch.Metric({
      namespace: 'AWS/CloudFront',
      metricName: '4xxErrorRate',
      dimensionsMap: {
        DistributionId: props.distribution.distributionId,
        Region: 'Global',
      },
      statistic: 'Average',
    });

    const cf5xxErrorRate = new cloudwatch.Metric({
      namespace: 'AWS/CloudFront',
      metricName: '5xxErrorRate',
      dimensionsMap: {
        DistributionId: props.distribution.distributionId,
        Region: 'Global',
      },
      statistic: 'Average',
    });

    // Add CloudFront widgets
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'CloudFront Requests',
        left: [cfRequests],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'CloudFront Error Rates',
        left: [cf4xxErrorRate, cf5xxErrorRate],
        width: 12,
        height: 6,
      }),
    );

    // Create alarms
    new cloudwatch.Alarm(this, 'AlbResponseTimeAlarm', {
      metric: albTargetResponseTime,
      threshold: 1000, // 1 second
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'ALB response time is too high',
    }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    new cloudwatch.Alarm(this, 'AlbUnhealthyHostsAlarm', {
      metric: albHealthyHostCount,
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'ALB has unhealthy hosts',
    }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    new cloudwatch.Alarm(this, 'Alb5xxErrorAlarm', {
      metric: alb5xxCount,
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'ALB 5xx errors detected',
    }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    new cloudwatch.Alarm(this, 'CloudFront4xxAlarm', {
      metric: cf4xxErrorRate,
      threshold: 5, // 5%
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'CloudFront 4xx error rate is high',
    }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    new cloudwatch.Alarm(this, 'CloudFront5xxAlarm', {
      metric: cf5xxErrorRate,
      threshold: 1, // 1%
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'CloudFront 5xx error rate is high',
    }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    // Composite alarm for critical issues
    const criticalAlarms = [
      'AlbUnhealthyHostsAlarm',
      'Alb5xxErrorAlarm',
    ].map(alarmName => 
      cloudwatch.Alarm.fromAlarmName(this, `Import${alarmName}`, 
        `${this.stackName}-${alarmName}`
      )
    );

    new cloudwatch.CompositeAlarm(this, 'CriticalSystemAlarm', {
      compositeAlarmName: `lendpeak2-${props.environment}-critical`,
      alarmDescription: 'Critical system issue detected',
      alarmRule: cloudwatch.AlarmRule.anyOf(...criticalAlarms),
      actionsEnabled: true,
    }).addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS Alert Topic ARN',
      exportName: `${props.environment}-alert-topic`,
    });
  }
}