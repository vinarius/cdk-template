/* eslint-disable @typescript-eslint/no-unused-vars */
import { App } from 'aws-cdk-lib';

import 'source-map-support/register';
import { getAppConfig } from './lib/getAppConfig';
import { validateAwsProfile } from './lib/validateAwsProfile';
import { verboseLog } from './lib/verboseLog';
import { FooStack } from './stacks/foo';
import { StatefulStack } from './stacks/stateful';

export const stackNames = {
  foo: 'foo',
  stateful: 'stateful',
};

export function getStackName(project: string, stack: string, stage: string): string {
  return `${project}-${stack}-stack-${stage}`;
}

async function buildInfrastructure(): Promise<void> {
  const { IS_CODEBUILD, IS_GITHUB = 'false' } = process.env;

  const app = new App();

  try {
    const appConfig = await getAppConfig();

    const { project, stage, profile, isStagingEnv } = appConfig;

    if (!IS_CODEBUILD && IS_GITHUB.toLowerCase() !== 'true') await validateAwsProfile(profile);

    const stackProps = {
      terminationProtection: stage === 'prod',
      ...appConfig,
    };

    // Required stack
    // deployApi.ts script is dependent on reading this physical id.
    const statefulStackName = getStackName(project, stackNames.stateful, stage);
    new StatefulStack(app, statefulStackName, {
      ...stackProps,
      stackName: statefulStackName,
      stack: stackNames.stateful,
    });

    const fooStackName = getStackName(project, stackNames.foo, stage);
    const fooStack = new FooStack(app, fooStackName, {
      ...stackProps,
      stackName: fooStackName,
      stack: stackNames.foo,
    });

    verboseLog('Cdk stack(s) built successfully.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  buildInfrastructure();
}
