export interface StageDefinition {
  branch: string;
  alias: string;
  env: {
    account: string;
    region: string;
  };
  deployMfa: boolean;
}

export const project = 'mvp';
export const repo = 'TODO';
export const slackConfig = {
  useSlackNotifications: false,
  slackChannelId: '',
  slackWorkspaceId: '',
};

export const stages: StageDefinition[] = [
  {
    branch: 'individual',
    alias: '',
    env: {
      account: '',
      region: '',
    },
    deployMfa: false,
  },
  {
    branch: 'develop',
    alias: '',
    env: {
      account: '',
      region: '',
    },
    deployMfa: false,
  },
  {
    branch: 'qa',
    alias: '',
    env: {
      account: '',
      region: '',
    },
    deployMfa: false,
  },
  {
    branch: 'master',
    alias: '',
    env: {
      account: '',
      region: '',
    },
    deployMfa: false,
  },
];
