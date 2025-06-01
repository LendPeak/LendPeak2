import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { ComputeStack } from './compute-stack';
import { DatabaseStack } from './database-stack';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  computeStack: ComputeStack;
  databaseStack: DatabaseStack;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Create SNS topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `lendpeak2-${props.environment}-alarms`,
      displayName: `LendPeak2 ${props.environment} Alarms`,
    });

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `lendpeak2-${props.environment}`,
    });

    // API Service Metrics
    const apiCpuMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        ServiceName: props.computeStack.apiService.serviceName,
        ClusterName: props.computeStack.ecsCluster.clusterName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const apiMemoryMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'MemoryUtilization',
      dimensionsMap: {
        ServiceName: props.computeStack.apiService.serviceName,
        ClusterName: props.computeStack.ecsCluster.clusterName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Create alarms
    new cloudwatch.Alarm(this, 'ApiHighCpuAlarm', {
      alarmName: `${props.environment}-api-high-cpu`,
      metric: apiCpuMetric,
      threshold: 80,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API service CPU utilization is too high',
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    new cloudwatch.Alarm(this, 'ApiHighMemoryAlarm', {
      alarmName: `${props.environment}-api-high-memory`,
      metric: apiMemoryMetric,
      threshold: 85,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API service memory utilization is too high',
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // Add widgets to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Service CPU',
        left: [apiCpuMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Service Memory',
        left: [apiMemoryMetric],
        width: 12,
      })
    );

    // Business metrics placeholder
    const loanCalculationMetric = new cloudwatch.Metric({
      namespace: 'LendPeak2',
      metricName: 'LoanCalculations',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const paymentProcessingMetric = new cloudwatch.Metric({
      namespace: 'LendPeak2',
      metricName: 'PaymentsProcessed',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Loan Calculations',
        left: [loanCalculationMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Payments Processed',
        left: [paymentProcessingMetric],
        width: 12,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS topic for CloudWatch alarms',
      exportName: `${props.environment}-alarm-topic-arn`,
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}