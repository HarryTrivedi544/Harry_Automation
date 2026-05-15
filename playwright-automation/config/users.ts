export type UserRole = 'admin' | 'user';

export type UserCredentials = {
  username: string;
  password: string;
};

type CredentialEnvKeys = {
  username: string;
  password: string;
};

const userEnvKeys: Record<UserRole, CredentialEnvKeys> = {
  admin: {
    username: 'ADMIN_USERNAME',
    password: 'ADMIN_PASSWORD',
  },
  user: {
    username: 'USER_USERNAME',
    password: 'USER_PASSWORD',
  },
};

export function getUserCredentials(role: UserRole): UserCredentials {
  return getCredentials(userEnvKeys[role], `user role "${role}"`);
}

export function getCredentialProfileCredentials(profile: string): UserCredentials {
  const profileKey = toEnvKey(profile);

  return getCredentials(
    {
      username: `${profileKey}_USERNAME`,
      password: `${profileKey}_PASSWORD`,
    },
    `credential profile "${profile}"`,
  );
}

function getCredentials(envKeys: CredentialEnvKeys, description: string): UserCredentials {
  const username = process.env[envKeys.username]?.trim();
  const password = process.env[envKeys.password]?.trim();

  if (!username || !password) {
    throw new Error(`Missing credentials for ${description}. Check ${envKeys.username} and ${envKeys.password} in .env.`);
  }

  return { username, password };
}

function toEnvKey(profile: string): string {
  return profile
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
