import NodeCache from 'node-cache';

const { stage = '' } = process.env;
const isStagingEnv = stage === 'prod' || stage === 'qa';
const secondsInAMinute = 60;
const devSeconds = 5;
const devMinutes = 0;
const prodSeconds = 0;
const prodMinutes = 5;
const devTtlInSeconds = devMinutes * secondsInAMinute + devSeconds;
const prodTtlInSeconds = prodMinutes * secondsInAMinute + prodSeconds;
const ttlInSecondsDefault = isStagingEnv ? prodTtlInSeconds : devTtlInSeconds;

export function getCache(ttlInSeconds: number = ttlInSecondsDefault): NodeCache {
  const nodeCache = new NodeCache({
    stdTTL: ttlInSeconds,
    useClones: false,
  });

  return nodeCache;
}
