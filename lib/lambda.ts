/* eslint-disable @typescript-eslint/no-explicit-any */
import { trimIndexedAttributes } from '@internal-tech-solutions/sig-dynamo-factory';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import isObject from 'isobject';

import { LoggerFactory } from '../lib/loggerFactory';
import { Generic } from '../models/cloudResources';

export const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
};

const { isDeprecated = 'false', deprecationDate = '', updatedApiVersion = '' } = process.env;

const logger = LoggerFactory.getLogger();

function recursivelyFormatObject(obj: Generic | Generic[]): Generic | Generic[] {
  if (Array.isArray(obj)) {
    return obj.map(item => recursivelyFormatObject(item));
  }

  if (isObject(obj) && !(obj instanceof Date) && !(obj instanceof Set)) {
    const formattedObj = trimIndexedAttributes(obj);

    return Object.keys(formattedObj).reduce((acc: Generic, key) => {
      acc[key] = recursivelyFormatObject(obj[key]);
      return acc;
    }, {});
  }

  if (obj instanceof Set) {
    return Array.from(obj);
  }

  return obj;
}

export async function handlerWrapper(event: any, handler: any): Promise<APIGatewayProxyResult> {
  try {
    logger.debug('Event:', JSON.stringify(event, null, 2));

    const response = (await handler(event)) ?? {};
    const customSuccess = response.success;
    const customBody = response.customBody;
    const customHeaders = response.customHeaders ?? {};
    const multiValueHeaders = response.multiValueHeaders ?? {};

    delete response.success;
    delete response.customBody;
    delete response.customHeaders;
    delete response.multiValueHeaders;

    const body = {
      success: customSuccess ?? true,
      ...(isDeprecated === 'true' && {
        isDeprecated: true,
        deprecationOn: deprecationDate,
        deprecationMessage: `This API is deprecated. Use v${updatedApiVersion} instead.`,
      }),
      ...((Object.keys(response).length > 0 || Array.isArray(response)) && { payload: recursivelyFormatObject(response) }),
    };

    logger.debug('body:', JSON.stringify(body, null, 2));

    const finalResponse = {
      statusCode: 200,
      headers: {
        ...headers,
        ...customHeaders,
      },
      multiValueHeaders,
      body: customBody ?? JSON.stringify(body),
    };

    logger.debug('finalResponse:', JSON.stringify(finalResponse, null, 2));

    return finalResponse;
  } catch (caughtError: any) {
    logger.warn(caughtError);

    const reason = caughtError.name ?? caughtError.reason ?? 'Unknown';

    const finalResponse = {
      statusCode: caughtError.statusCode ?? caughtError.$metadata?.httpStatusCode ?? 500,
      headers,
      body: JSON.stringify({
        reason,
        error: caughtError.Error?.Message ?? caughtError.message ?? caughtError.error ?? caughtError.validationErrors ?? 'Unknown error',
        success: false,
        ...(isDeprecated === 'true' && {
          isDeprecated: true,
          deprecationOn: deprecationDate,
          deprecationMessage: `This API is deprecated. Please use v${updatedApiVersion} instead.`,
        }),
      }),
    };

    logger.debug('finalResponse:', JSON.stringify(finalResponse, null, 2));

    return finalResponse;
  }
}

export function parseEventBody<T>(event: APIGatewayProxyEvent): T {
  const parsedBody: Generic = JSON.parse(event.body ?? '{}');

  const getFormattedObject = (obj: Generic) => {
    const trimmedChildObj: Generic = {};

    for (const [key, val] of Object.entries(obj)) {
      let formattedVal;

      // Modifications to each type can go here as needed.
      switch (typeof val) {
        case 'string':
          formattedVal = val.trim();
          break;
        case 'object': // careful for null and classes
        case 'bigint':
        case 'boolean':
        case 'function':
        case 'number':
        case 'symbol':
        case 'undefined':
        default:
          formattedVal = val;
      }

      if (isObject(val)) formattedVal = getFormattedObject(val);

      trimmedChildObj[key as keyof typeof obj] = formattedVal;
    }

    return trimmedChildObj;
  };

  return isObject(parsedBody) ? (getFormattedObject(parsedBody) as T) : (parsedBody as T);
}
