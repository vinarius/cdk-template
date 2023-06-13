import { existsSync, mkdirSync, writeFileSync } from 'fs';

import { getAppConfig } from '../lib/getAppConfig';
import { spawn } from '../lib/spawn';

export async function synth(): Promise<void> {
  const { STACK = '' } = process.env;

  console.time('>>> Synthesis complete');

  const { IS_GITHUB, IS_CODEBUILD = false } = process.env;

  try {
    const { alias, branch, profile } = await getAppConfig();
    const includeProfile = IS_GITHUB || IS_CODEBUILD ? '' : `--profile ${profile}`;

    if (!existsSync('./dist')) {
      mkdirSync('./dist', { recursive: true });
    }

    if (!existsSync('./dist/edgeCleanupQueue.json')) {
      writeFileSync('./dist/edgeCleanupQueue.json', JSON.stringify({ edgeLambdaNames: [] }));
    }

    console.log(`\n>>> Synthesizing '${branch}' branch for deployment to ${alias} account`);

    await spawn(`npm run cdk -- synth ${STACK} ${includeProfile} --quiet`);
    console.timeEnd('>>> Synthesis complete');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  synth();
}
