import path from 'path';
import { readFile, utils } from 'xlsx';
import type { EnvironmentName } from './testSetups';
import type { UserRole } from './users';

export type TestDataCriteria = {
  environment: EnvironmentName;
  userRole: UserRole;
  credentialProfile?: string;
  testCaseId?: string;
  scenario?: string;
};

export type TestData = {
  all: Record<string, string>;
  get: (key: string, fallback?: string) => string | undefined;
  required: (key: string) => string;
};

type TestDataRow = {
  enabled?: unknown;
  environment?: unknown;
  userRole?: unknown;
  credentialProfile?: unknown;
  testCaseId?: unknown;
  scenario?: unknown;
  key?: unknown;
  value?: unknown;
};

const defaultScenario = 'default';
const testDataSheetName = 'TestData';

export function loadTestData(criteria: TestDataCriteria): TestData {
  const values = criteria.testCaseId ? readMatchingValues(criteria) : {};

  return {
    all: values,
    get: (key, fallback) => values[key] ?? fallback,
    required: (key) => {
      const value = values[key];

      if (value === undefined || value === '') {
        throw new Error(
          `Missing test data key "${key}" for ${describeCriteria(criteria)}. Check ${getTestDataFilePath()} sheet "${testDataSheetName}".`,
        );
      }

      return value;
    },
  };
}

function readMatchingValues(criteria: TestDataCriteria): Record<string, string> {
  const filePath = getTestDataFilePath();
  const workbook = readFile(filePath);
  const sheet = workbook.Sheets[testDataSheetName];

  if (!sheet) {
    throw new Error(`Missing sheet "${testDataSheetName}" in ${filePath}.`);
  }

  const rows = utils.sheet_to_json<TestDataRow>(sheet, { defval: '' });
  const scenario = criteria.scenario ?? defaultScenario;
  const values: Record<string, string> = {};

  for (const row of rows) {
    if (!isEnabled(row.enabled)) continue;
    if (!matches(row.environment, criteria.environment)) continue;
    if (!matches(row.userRole, criteria.userRole)) continue;
    if (!matchesOptional(row.credentialProfile, criteria.credentialProfile ?? criteria.userRole)) continue;
    if (!matches(row.testCaseId, criteria.testCaseId)) continue;
    if (!matches(row.scenario, scenario)) continue;

    const key = normalize(row.key);
    if (!key) continue;

    values[key] = normalize(row.value);
  }

  return values;
}

function getTestDataFilePath(): string {
  return process.env.TEST_DATA_FILE?.trim() || path.resolve(process.cwd(), 'test-data', 'test-data.xlsx');
}

function matches(actual: unknown, expected?: string): boolean {
  const normalizedActual = normalize(actual);

  return normalizedActual === '*' || normalizedActual === normalize(expected);
}

function matchesOptional(actual: unknown, expected?: string): boolean {
  const normalizedActual = normalize(actual);

  return normalizedActual === '' || normalizedActual === '*' || normalizedActual === normalize(expected);
}

function isEnabled(value: unknown): boolean {
  const normalizedValue = normalize(value).toLowerCase();

  return normalizedValue !== 'false' && normalizedValue !== 'no' && normalizedValue !== '0';
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function describeCriteria(criteria: TestDataCriteria): string {
  return [
    `environment="${criteria.environment}"`,
    `userRole="${criteria.userRole}"`,
    `credentialProfile="${criteria.credentialProfile ?? criteria.userRole}"`,
    `testCaseId="${criteria.testCaseId ?? ''}"`,
    `scenario="${criteria.scenario ?? defaultScenario}"`,
  ].join(', ');
}
