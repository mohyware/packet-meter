import {
  drizzle as drizzlePostgres,
  PostgresJsDatabase,
} from 'drizzle-orm/postgres-js';
import { drizzle as drizzleLibSql } from 'drizzle-orm/libsql';
import postgres from 'postgres';
import { createClient as createLibSqlClient } from '@libsql/client';
import { schema, isSQLite } from './schema';
import { DATABASE_URL } from '../config/env';

const connectionString = DATABASE_URL;

const db = (() => {
  if (isSQLite) {
    const libsqlClient = createLibSqlClient({
      url: 'file:./packetPilotDB.db',
    });

    return drizzleLibSql(libsqlClient, {
      schema,
    }) as unknown as PostgresJsDatabase<typeof schema>;
  }

  return drizzlePostgres(postgres(connectionString, { prepare: false }), {
    schema,
  });
})();

export { db, closeDb };

async function closeDb() {
  if (!isSQLite) {
    // @ts-expect-error - TODO
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await db.$client.end();
  }
}

export * from './schema';
