import {neon} from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
sql`SELECT rl.id, rl.email, rl.source, rl.created_at, c.name FROM report_leads rl LEFT JOIN companies c ON c.id = rl.company_id ORDER BY rl.created_at DESC LIMIT 10`.then(r => console.log(JSON.stringify(r, null, 2)));
