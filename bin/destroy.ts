import {
  CloudWatchLogsClient,
  DeleteLogGroupCommand,
  DescribeLogGroupsCommand,
  DescribeLogGroupsCommandOutput,
  LogGroup,
} from '@aws-sdk/client-cloudwatch-logs';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { existsSync, readFileSync } from 'fs';

import { fromRoot } from '../lib/fromRoot';
import { getAppConfig } from '../lib/getAppConfig';
import { retryOptions } from '../lib/retryOptions';
import { spawn } from '../lib/spawn';
import { validateAwsProfile } from '../lib/validateAwsProfile';

export async function destroy(): Promise<void> {
  console.time('>>> Destroy complete.');

  const cloudWatchLogsClient = new CloudWatchLogsClient({ ...retryOptions });
  const sqsClient = new SQSClient({ ...retryOptions });

  try {
    const { branch, profile, stage, env, isStagingEnv, edgeCleanupQueueName } = await getAppConfig();

    if (isStagingEnv)
      throw new Error(`Unable to destroy stacks on branch ${branch} for environment ${stage}. Please check your git branch.`);

    await validateAwsProfile(profile);

    process.env.AWS_PROFILE = profile;
    process.env.AWS_REGION = env.region;

    console.log('>>> Cleaning up log groups');

    const totalLogGroupNames: string[] = [];
    let nextToken;

    do {
      const describeLogGroupsOutput: DescribeLogGroupsCommandOutput = await cloudWatchLogsClient.send(
        new DescribeLogGroupsCommand({ nextToken }),
      );

      totalLogGroupNames.push(
        ...((describeLogGroupsOutput.logGroups as LogGroup[]) ?? [])
          .map(group => group.logGroupName as string)
          .filter(logGroupName => logGroupName.includes(stage)),
      );

      nextToken = describeLogGroupsOutput.nextToken;
    } while (nextToken);

    const settledPromises1 = await Promise.allSettled(
      totalLogGroupNames.map(logGroupName => cloudWatchLogsClient.send(new DeleteLogGroupCommand({ logGroupName }))),
    );

    for (const promise of settledPromises1) {
      if (promise.status === 'rejected') {
        console.error(promise.reason);
      }
    }

    console.log('>>> Log groups cleaned successfully.');

    console.log('>>> Destroying stacks');
    await spawn(`npm run cdk -- destroy --all --force --profile ${profile}`);

    const cleanupQueuePath = fromRoot(['dist', 'edgeCleanupQueue.json']);
    const { edgeLambdaNames } = existsSync(cleanupQueuePath)
      ? JSON.parse(readFileSync(cleanupQueuePath).toString())
      : { edgeLambdaNames: [] };

    if (edgeLambdaNames.length) {
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: `https://sqs.${env.region}.amazonaws.com/${env.account}/${edgeCleanupQueueName}`,
          MessageBody: JSON.stringify({
            edgeLambdaNames,
          }),
        }),
      );
    }

    console.timeEnd('>>> Destroy complete.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  destroy();
}
