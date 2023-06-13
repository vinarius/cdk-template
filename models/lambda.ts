import { NodejsFunctionProps, NodejsFunction as NodeLambda } from 'aws-cdk-lib/aws-lambda-nodejs';

import { HttpMethod } from './enums';

export interface LambdaDefinition extends Partial<NodejsFunctionProps> {
  name: string; // Must match the file name without the file extension.
  entry: string;
  skip?: boolean;
  customLogicFunctions?: ((lambda: NodeLambda) => void)[];
  api?: {
    httpMethod: HttpMethod;
    apiPath: string;
    deprecation?: {
      date: string;
      updatedApiVersion: number;
    };
  };
  loggingLevel?: 'error' | 'warn' | 'info' | 'debug';
}
