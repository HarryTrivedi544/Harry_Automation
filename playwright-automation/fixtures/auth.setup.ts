/// <reference types="node" />
import { test as setup } from '@playwright/test';
import fs from 'fs';
import { getUserCredentials } from '../config/users';

const authFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ request }) => {
  const adminUser = getUserCredentials('admin');

  const response = await request.post('/api/login', {
    data: {
      username: adminUser.username,
      password: adminUser.password,
    },
  });

  const responseBody = await response.json();

  // Adjust this based on your API response
  const token = responseBody.token;

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: process.env.BASE_URL!,
        localStorage: [
          {
            name: 'authToken',
            value: token,
          },
        ],
      },
    ],
  };

  fs.mkdirSync('playwright/.auth', { recursive: true });
  fs.writeFileSync(authFile, JSON.stringify(storageState));
});
