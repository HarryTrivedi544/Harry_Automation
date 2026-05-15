import { getCredentialProfileCredentials, type UserCredentials, type UserRole } from './users';

export type EnvironmentName = 'stage' | 'qa' | 'local';

export type TestSetup = {
  environment: EnvironmentName;
  userRole: UserRole;
  credentialProfile?: string;
  testCaseId?: string;
  scenario?: string;
};

type ResolvedTestSetup = TestSetup & {
  baseUrl: string;
  user: UserCredentials;
};

const environmentEnvKeys: Record<EnvironmentName, string[]> = {
  stage: ['STAGE_BASE_URL', 'BASE_URL'],
  qa: ['QA_BASE_URL'],
  local: ['LOCAL_BASE_URL'],
};

export const defaultTestSetup: TestSetup = {
  environment: 'stage',
  userRole: 'admin',
  credentialProfile: 'admin',
};

export function resolveTestSetup(testSetup: TestSetup): ResolvedTestSetup {
  const baseUrl = getEnvironmentBaseUrl(testSetup.environment);
  const user = getCredentialProfileCredentials(testSetup.credentialProfile ?? testSetup.userRole);

  return {
    ...testSetup,
    baseUrl,
    user,
  };
}

function getEnvironmentBaseUrl(environment: EnvironmentName): string {
  const envKeys = environmentEnvKeys[environment];
  const baseUrl = envKeys.map((key) => process.env[key]?.trim()).find(Boolean);

  if (!baseUrl) {
    throw new Error(`Missing base URL for environment "${environment}". Check ${envKeys.join(' or ')} in .env.`);
  }

  return baseUrl;
}
