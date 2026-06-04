/// <reference types="node" />
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import type { UserCredentials } from './users';

export type RuntimeEnvironmentInput = {
  name?: string;
  webUrl?: string;
  kioskUrl?: string;
  boxId?: string;
  username?: string;
  password?: string;
};

export type ResolvedRuntimeEnvironment = {
  name: string;
  webUrl: string;
  kioskUrl: string;
  boxId: string;
  credentials: UserCredentials;
};

type RuntimeEnvironmentDefaults = {
  webUrl: () => string;
  kioskUrl: () => string;
  boxId: () => string;
  credentials: () => UserCredentials;
};

const requiredHeaders = ['name', 'webUrl', 'kioskUrl', 'boxId', 'username', 'password'];
const defaultRuntimeName = 'env-default';

export function loadRuntimeEnvironments(): RuntimeEnvironmentInput[] {
  const filePath = getRuntimeEnvironmentFilePath();

  if (!existsSync(filePath)) {
    return [{ name: defaultRuntimeName }];
  }

  const records = parseCsv(readFileSync(filePath, 'utf8'));

  if (records.length === 0) {
    return [{ name: defaultRuntimeName }];
  }

  const headers = records[0].map((value) => value.trim());
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing runtime environment CSV headers: ${missingHeaders.join(', ')}. Check ${filePath}.`);
  }

  const rows = records
    .slice(1)
    .filter((record) => record.some((value) => value.trim() !== ''))
    .map((record, index) => {
      const values = Object.fromEntries(headers.map((header, columnIndex) => [header, record[columnIndex]?.trim() ?? '']));

      return {
        name: values.name || `csv-row-${index + 1}`,
        webUrl: values.webUrl,
        kioskUrl: values.kioskUrl,
        boxId: values.boxId,
        username: values.username,
        password: values.password,
      };
    });

  return rows.length > 0 ? rows : [{ name: defaultRuntimeName }];
}

export function resolveRuntimeEnvironment(
  input: RuntimeEnvironmentInput,
  defaults: RuntimeEnvironmentDefaults,
): ResolvedRuntimeEnvironment {
  const defaultCredentials = input.username?.trim() && input.password?.trim()
    ? undefined
    : defaults.credentials();

  return {
    name: input.name?.trim() || defaultRuntimeName,
    webUrl: input.webUrl?.trim() || defaults.webUrl(),
    kioskUrl: input.kioskUrl?.trim() || defaults.kioskUrl(),
    boxId: input.boxId?.trim() || defaults.boxId(),
    credentials: {
      username: input.username?.trim() || defaultCredentials?.username || '',
      password: input.password?.trim() || defaultCredentials?.password || '',
    },
  };
}

function getRuntimeEnvironmentFilePath(): string {
  return process.env.RUNTIME_ENVIRONMENTS_FILE?.trim()
    || path.resolve(process.cwd(), 'test-data', 'runtime-environments.csv');
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      row.push(field);
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}
