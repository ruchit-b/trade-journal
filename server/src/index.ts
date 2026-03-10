import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import app from './app';

const isProd = process.env.NODE_ENV === 'production';

function validateEnv(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (isProd && !process.env.CLIENT_URL) missing.push('CLIENT_URL');
  if (missing.length > 0) {
    console.error('Missing required environment variable(s):', missing.join(', '));
    process.exit(1);
  }
}

validateEnv();

const prisma = new PrismaClient();
const PORT = process.env.PORT ?? 4000;

async function main() {
  await prisma.$connect();
  console.log('Prisma connected to database');

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
