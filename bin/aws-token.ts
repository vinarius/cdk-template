import { IAMClient, ListMFADevicesCommand, ListMFADevicesCommandOutput, MFADevice } from '@aws-sdk/client-iam';
import { Credentials, GetSessionTokenCommand, STSClient, STSClientConfig } from '@aws-sdk/client-sts';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { spawnSync } from 'child_process';
import moment = require('moment-timezone');

function spawn(command: string) {
  spawnSync(command, [], {
    shell: true,
    stdio: 'inherit',
  });
}

const options: STSClientConfig = {};

const [, , ...args] = process.argv;
const profile = args[0];
const token = args[1];
const profileToken = `${profile}-token`;

export async function setSessionToken(): Promise<void> {
  const { IS_JEST } = process.env;

  try {
    if (IS_JEST?.toLowerCase() !== 'true') options.credentials = fromIni({ profile });

    const stsClient = new STSClient(options);
    const iamClient = new IAMClient(options);

    const listMfaDevicesResponse: ListMFADevicesCommandOutput = await iamClient.send(new ListMFADevicesCommand({}));
    const serialNumber = (listMfaDevicesResponse.MFADevices as MFADevice[])[0].SerialNumber;

    const getSessionTokenResponse = await stsClient.send(
      new GetSessionTokenCommand({
        DurationSeconds: 129600,
        SerialNumber: serialNumber,
        TokenCode: token,
      }),
    );

    const { AccessKeyId, Expiration, SecretAccessKey, SessionToken } = getSessionTokenResponse.Credentials as Credentials;

    await Promise.all([
      spawn(`aws configure set aws_access_key_id ${AccessKeyId} --profile ${profileToken}`),
      spawn(`aws configure set aws_secret_access_key ${SecretAccessKey} --profile ${profileToken}`),
      spawn(`aws configure set aws_session_token ${SessionToken} --profile ${profileToken}`),
    ]);

    const timelimit = moment(Expiration).tz('America/New_York').format('MM/DD/YYYY hh:mm z');

    console.log(`Set session token in profile ${profileToken}, expires ${timelimit}`);
  } catch (error) {
    const { name, message } = error as Error;
    console.error(`${name}: ${message}`);

    if (!IS_JEST) process.exit(1);
  }
}

setSessionToken();
