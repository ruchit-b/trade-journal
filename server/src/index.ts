import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import app from './app';

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
