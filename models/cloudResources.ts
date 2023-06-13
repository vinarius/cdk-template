import { StackProps } from 'aws-cdk-lib';
import { NodejsFunctionProps, NodejsFunction as NodeLambda } from 'aws-cdk-lib/aws-lambda-nodejs';
import { APIGatewayProxyEventBase } from 'aws-lambda';

import { StageDefinition } from '../config';

export interface AppStackProps extends StackProps, StageDefinition {
  project: string;
  stage: string;
  stack: string;
  isStagingEnv: boolean;
  fullDeploy: boolean;
  env: {
    account: string;
    region: string;
  };
}

export interface Generic {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface WebSocketLambdaDefinition extends Partial<NodejsFunctionProps> {
  name: string;
  entry: string;
  skip?: boolean;
  customLogicFunctions?: ((lambda: NodeLambda) => void)[];
  action: string;
  loggingLevel?: 'error' | 'warn' | 'info' | 'debug';
}

type AuthorizerContext = {
  [key: string]: string;
};

export type APIGatewayEvent = APIGatewayProxyEventBase<AuthorizerContext>;

export type APIGatewayBody<T> = {
  success: boolean;
  payload?: T;
  isDeprecated?: boolean;
  deprecationOn?: string;
  deprecationMessage?: string;
  reason?: string;
  error?: string;
};
