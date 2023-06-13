import { APIGatewayProxyEvent } from 'aws-lambda';

import { ajv } from '../../../lib/ajv';
import { throwValidationError } from '../../../lib/errors';
import { handlerWrapper, parseEventBody } from '../../../lib/lambda';
import { LoggerFactory } from '../../../lib/loggerFactory';
import { jsonType } from '../../../models/enums';

export interface FooReqBody {
  input: string;
}

const createSessionSchema = {
  type: jsonType.OBJECT,
  additionalProperties: false,
  required: ['input'],
  properties: {
    input: {
      type: jsonType.STRING,
      minLength: 1,
    },
  },
} as const;

const validateCreateSession = ajv.compile(createSessionSchema);
const logger = LoggerFactory.getLogger();

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<void> => {
  const params: FooReqBody = parseEventBody(event);
  const isValid = validateCreateSession(params);

  logger.debug('params:', params);
  logger.debug('isValid:', validateCreateSession(params));

  if (!isValid) throwValidationError(validateCreateSession.errors);

  logger.debug('foo lambda function body succeeded');
};

export const handler = async (event: APIGatewayProxyEvent) => await handlerWrapper(event, lambdaHandler);
