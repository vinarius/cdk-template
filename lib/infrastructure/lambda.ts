import { Duration } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

import { fromRoot } from '../fromRoot';

export function buildCommonLambdaProps(stage: string, stack: string, isStagingEnv: boolean): NodejsFunctionProps {
  const apiGatewayRestApiMaxTimeout = Duration.seconds(29);

  return {
    environment: {
      LOGGING_LEVEL: stage === 'prod' ? 'warn' : 'debug',
      sentryLogPercentage: stage === 'prod' ? '0.0001' : '0.1',
      isStagingEnv: isStagingEnv.toString(),
      stack,
      stage,
    },
    runtime: Runtime.NODEJS_18_X,
    timeout: apiGatewayRestApiMaxTimeout,
    bundling: {
      minify: true,
    },
    logRetention: stage === 'prod' ? RetentionDays.INFINITE : RetentionDays.THREE_DAYS,
    projectRoot: fromRoot(),
  };
}
