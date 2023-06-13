import { existsSync, mkdirSync, writeFileSync } from 'fs';

import { getAppConfig } from '../lib/getAppConfig';
import { spawn } from '../lib/spawn';

export async function deploy(): Promise<void> {
  try {
    console.time('Total deploy time');

    const { IS_CODEBUILD, STACK = '--all' } = process.env;
    const { profile, stage } = await getAppConfig();
    const includeProfile = IS_CODEBUILD ? '' : `--profile ${profile}`;

    if (!existsSync('./dist')) {
      mkdirSync('./dist', { recursive: true });
    }

    if (!existsSync('./dist/edgeCleanupQueue.json')) {
      writeFileSync('./dist/edgeCleanupQueue.json', JSON.stringify({ edgeLambdaNames: [] }));
    }

    await spawn(
      `npm run cdk -- deploy ${STACK} --app cdk.out --concurrency 10 --require-approval never ${includeProfile} --outputs-file ./dist/${stage}-outputs.json`,
    );

    console.timeEnd('Total deploy time');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  deploy();
}
