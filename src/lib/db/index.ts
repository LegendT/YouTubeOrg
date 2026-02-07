import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Global connection pool — max 3 to handle concurrent server actions
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Export Drizzle database instance
export const db = drizzle(pool, { schema });
