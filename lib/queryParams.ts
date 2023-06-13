import { Generic } from '../models/cloudResources';
import { throwBadRequestError } from './errors';

// Keep in mind that this function will change all of your keys to lowercase;
// try to avoid camelCase keys (i.e. type would be contenttype, etc)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getQueryParams = (queryStringParams: Generic, _requiredParams: string[], _optionalParams: string[] = []): Generic => {
  const decodedParams: Generic = {};
  const requiredParams = _requiredParams.map(param => param.toLowerCase());

  for (const [key, value] of Object.entries(queryStringParams ?? {})) {
    decodedParams[key.toLowerCase()] = decodeURIComponent(value.trim());
  }

  const inputParams = Object.keys(decodedParams);
  const missingRequiredParams = requiredParams.filter(requiredParam => !inputParams.includes(requiredParam));

  if (missingRequiredParams.length > 0) {
    throwBadRequestError();
  }

  return decodedParams;
};
