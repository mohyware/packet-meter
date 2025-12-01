import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const dbClient = (process.env.DB_CLIENT ?? 'sqlite').toLowerCase();
const isSQLite = dbClient !== 'postgres';

export default {
  schema: isSQLite
    ? './src/db/schema.lite.ts'
    : './src/db/schema.postgres.ts',
  out: './drizzle',
  dialect: isSQLite ? 'sqlite' : 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;

