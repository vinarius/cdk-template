import { project, StageDefinition, stages } from '../config';
import { getLocalGitBranch } from './getLocalGitBranch';

interface ApplicationDefinition extends StageDefinition {
  project: string;
  stage: string;
  isStagingEnv: boolean;
  fullDeploy: boolean;
  profile: string;
}

export async function getAppConfig(): Promise<ApplicationDefinition> {
  /**
   * This pattern allows for a few things. If the synth function is incorporated
   * into another process the desired stage can be programmatically set.  If not
   * a pipeline, or a developer, can take precedence and set the environment
   * manually, BRANCH=xyz, to override the "default code branch"
   *   >
   *   > BRANCH=xyz npm run synth
   *   >
   * When BRANCH is not set the default branch will be the current repo
   * branch by running `git status` to try and determine it.
   */
  const branch = process.env.BRANCH ?? (await getLocalGitBranch());

  if (!branch) throw new Error('>>> Could not determine what environment to deploy. No process.env.BRANCH nor git branch available.');

  const config = stages.find(stage => stage.branch === branch) ?? stages[0];
  if (!config.env.account) throw new Error('>>> No account prop found in stage definition.');

  const { deployMfa, alias } = config;

  const stage =
    branch === 'master'
      ? 'prod'
      : branch === 'qa'
      ? 'qa'
      : branch === 'develop'
      ? 'dev'
      : branch.includes('/')
      ? branch.split('/').reverse()[0]
      : branch; // This paradigm allows for ephemeral resource creation for team development.

  return {
    ...config,
    profile: deployMfa ? `${alias}-token` : alias,
    isStagingEnv: stage === 'prod' || stage === 'qa' || stage === 'dev',
    fullDeploy: process.env?.FULL_DEPLOY === 'true',
    stage,
    branch,
    project,
  };
}
