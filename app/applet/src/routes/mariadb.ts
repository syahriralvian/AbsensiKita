import pg from 'pg';
const { Pool } = pg;

let pool: any = null;

export function getMariaDBPool() {
  if (!pool) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const connectionString = process.env.DATABASE_URL || 'postgresql://absensikita:Hajimekojo12345@43.133.35.10:5432/absensikita?ssl=true&sslmode=require';
    const pgPool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });

    pool = {
      query: async (sql: string, params: any[] = []) => {
        let pgSql = sql.replace(/\`/g, '"');
        let index = 1;
        pgSql = pgSql.replace(/\?/g, () => '$' + index++);
        pgSql = pgSql.replace(/="([^"]+)"/g, "='$1'");
        pgSql = pgSql.replace(/!= "([^"]+)"/g, "!= '$1'");
        pgSql = pgSql.replace(/LIKE "([^"]+)"/g, "LIKE '$1'");

        if (pgSql.trim().toUpperCase().startsWith('INSERT INTO') && !pgSql.toUpperCase().includes('RETURNING')) {
          pgSql += ' RETURNING *';
        }

        try {
          const res = await pgPool.query(pgSql, params);
          return [res.rows, res.fields];
        } catch (err: any) {
          console.error("PostgreSQL Query Error:", err.message, "Original SQL:", sql, "Converted SQL:", pgSql, "Params:", params);
          throw err;
        }
      },
      end: async () => {
        await pgPool.end();
      }
    };
  }
  return pool;
}

import express from 'express';
export const mariadbRouter = express.Router();

export async function executeDbQuery(body: any) {
  const { table, method, payload, filters, modifiers } = body;
  if (!table) throw new Error('No table provided');
  
  const db = getMariaDBPool();
  let sql = '';
  let params: any[] = [];
  
  if (method === 'select') {
    const sels = modifiers.select || '*';
    sql = 'SELECT ' + sels + ' FROM ' + table;
    
    let whereAdded = false;
    for (const f of filters) {
      if (!whereAdded) { sql += ' WHERE '; whereAdded = true; }
      else { sql += ' AND '; }
      
      if (f.type === 'eq') { sql += f.col + ' = ?'; params.push(f.val); }
      else if (f.type === 'in') {
        if (!f.val || f.val.length === 0) { sql += '1=0'; continue; }
        const marks = f.val.map(() => '?').join(',');
        sql += f.col + ' IN (' + marks + ')';
        params.push(...f.val);
      }
      else if (f.type === 'neq') { sql += f.col + ' != ?'; params.push(f.val); }
      else if (f.type === 'gt') { sql += f.col + ' > ?'; params.push(f.val); }
      else if (f.type === 'gte') { sql += f.col + ' >= ?'; params.push(f.val); }
      else if (f.type === 'lt') { sql += f.col + ' < ?'; params.push(f.val); }
      else if (f.type === 'lte') { sql += f.col + ' <= ?'; params.push(f.val); }
      else if (f.type === 'or') {
        const parts = f.val.split(',');
        let orSql = [];
        for (const p of parts) {
          const [condCol, op, ...rest] = p.split('.');
          let val = rest.join('.');
          if (op === 'is' && val === 'null') orSql.push(condCol + ' IS NULL');
          else if (op === 'eq') {
            if (val === '""') orSql.push(condCol + " = ''");
            else { orSql.push(condCol + ' = ?'); params.push(val); }
          }
          else if (op === 'like') {
            orSql.push(condCol + ' LIKE ?'); params.push(val);
          }
          else if (op === 'not' && rest[0] === 'like') {
            val = rest.slice(1).join('.');
            orSql.push(condCol + ' NOT LIKE ?'); params.push(val);
          }
        }
        if (orSql.length > 0) sql += '(' + orSql.join(' OR ') + ')';
      }
    }
    
    if (modifiers.order && modifiers.order.length > 0) {
      sql += ' ORDER BY ';
      const orders = modifiers.order.map((o: any) => o.col + ' ' + (o.asc ? 'ASC' : 'DESC'));
      sql += orders.join(', ');
    }
    
    if (modifiers.limit) {
      sql += ' LIMIT ?';
      params.push(modifiers.limit);
    }
    
    const [rows] = await db.query(sql, params);
    
    if (modifiers.single) {
      if (rows.length === 0) {
        throw { message: 'JSON object requested, multiple (or no) rows returned', status: 406, code: 'PGRST116' };
      }
      return { data: rows[0], error: null };
    } else if (modifiers.maybeSingle) {
      return { data: rows.length > 0 ? rows[0] : null, error: null };
    }
    
    return { data: rows, error: null };
    
  } else if (method === 'insert') {
    const isArray = Array.isArray(payload);
    const items = isArray ? payload : [payload];
    if (items.length === 0) return { data: [], error: null };
    
    const cols = Object.keys(items[0]).filter(k => items[0][k] !== undefined);
    const placeholders = items.map(item => '(' + cols.map(c => item[c] === undefined ? 'DEFAULT' : '?').join(',') + ')').join(',');
    sql = 'INSERT INTO ' + table + ' (' + cols.join(',') + ') VALUES ' + placeholders;
    
    for (const item of items) {
      for (const col of cols) {
        if (item[col] !== undefined) {
           params.push(item[col] === null ? null : item[col]);
        }
      }
    }
    const [rows] = await db.query(sql, params);
    return { data: rows, error: null };
    
  } else if (method === 'update') {
    const cols = Object.keys(payload).filter(k => payload[k] !== undefined);
    if (cols.length === 0) return { data: [], error: null };
    
    sql = 'UPDATE ' + table + ' SET ' + cols.map(c => c + ' = ?').join(', ');
    for (const col of cols) params.push(payload[col] === null ? null : payload[col]);
    
    let whereAdded = false;
    for (const f of filters) {
      if (!whereAdded) { sql += ' WHERE '; whereAdded = true; }
      else { sql += ' AND '; }
      if (f.type === 'eq') { sql += f.col + ' = ?'; params.push(f.val); }
      else if (f.type === 'in') {
        if (!f.val || f.val.length === 0) { sql += '1=0'; continue; }
        const marks = f.val.map(() => '?').join(',');
        sql += f.col + ' IN (' + marks + ')';
        params.push(...f.val);
      }
      else if (f.type === 'neq') { sql += f.col + ' != ?'; params.push(f.val); }
    }
    
    const [rows] = await db.query(sql, params);
    return { data: rows, error: null };
    
  } else if (method === 'delete') {
    sql = 'DELETE FROM ' + table;
    let whereAdded = false;
    for (const f of filters) {
      if (!whereAdded) { sql += ' WHERE '; whereAdded = true; }
      else { sql += ' AND '; }
      if (f.type === 'eq') { sql += f.col + ' = ?'; params.push(f.val); }
      else if (f.type === 'in') {
        if (!f.val || f.val.length === 0) { sql += '1=0'; continue; }
        const marks = f.val.map(() => '?').join(',');
        sql += f.col + ' IN (' + marks + ')';
        params.push(...f.val);
      }
      else if (f.type === 'neq') { sql += f.col + ' != ?'; params.push(f.val); }
    }
    
    const [result] = await db.query(sql, params);
    return { data: [], error: null };
  }
  
  throw new Error('Unknown method');
}

mariadbRouter.post('/api/db-query', async (req: any, res: any) => {
  try {
    const result = await executeDbQuery(req.body);
    return res.json(result);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error("Db query helper error:", err);
    return res.status(500).json({ error: { message: err.message, code: err.code }});
  }
});
