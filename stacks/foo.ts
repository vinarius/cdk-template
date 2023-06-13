import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { buildServerlessApi } from '../lib/infrastructure/buildServerlessApi';
import { AppStackProps } from '../models/cloudResources';
import { LambdaDefinition } from '../models/lambda';

export class FooStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { project, stage, stack, isStagingEnv } = props;

    const lambdaDefinitions: LambdaDefinition[] = [];

    buildServerlessApi({
      project,
      stage,
      isStagingEnv,
      scope: this,
      stack,
      lambdaDefinitions,
    });
  }
}
