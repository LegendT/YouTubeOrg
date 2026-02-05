import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Global connection pool for serverless compatibility
// Using max: 1 to prevent connection exhaustion in serverless environments
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 1, // Serverless-compatible: 1 connection per instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Export Drizzle database instance
export const db = drizzle(pool, { schema });
