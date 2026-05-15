/// <reference types="node" />
import { test as setup } from '@playwright/test';
import fs from 'fs';

const authFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ request }) => {
  const response = await request.post('/api/login', {
    data: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
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
