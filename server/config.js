export const config = {
  port: Number(process.env.PORT) || 3000,
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET,
  formbarApiUrl: process.env.FORMBAR_API_URL,
  formbarClientUrl: process.env.FORMBAR_CLIENT_URL,

  // the http api docs say new endpoints live under /api (/api/v1 is the old one)
  apiPrefix: '/api',

  roundCost: 30,
  poolId: 80,
  ownerId: 91,
  adminIds: [1, 91],
};
