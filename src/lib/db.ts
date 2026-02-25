import { Pool } from 'pg';

const pool = new Pool({
  host: '72.60.172.54',
  port: 5432,
  database: 'leads_production',
  user: 'athena',
  password: 'AthenaPass2026!',
});

export default pool;
