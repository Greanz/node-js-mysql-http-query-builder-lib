/**
 * MySQL - Database Utility Class with Query Chaining
 * A utility class for MySQL database operations with chainable query builder
 */
const fs = require('fs');

class QueryBuilder {
  constructor(mysql, defaultTable = null) {
    this.mysql = mysql;
    this.defaultTable = defaultTable;
    this.reset();
  }

  reset() {
    this._select = '*';
    this._from = this.defaultTable ?? null;
    this._conditions = [];   // { sql, values, logic: 'AND'|'OR' }
    this._orderBy = [];
    this._limit = null;
    this._offset = null;
    this._join = [];
    this._groupBy = [];
    this._having = [];
    this._havingValues = [];
    this._updateData = null;
    this._insertData = null;
    this._deleteFlag = false;
    return this;
  }

  // ─── Internal: push a condition with given logic ─────────────────
  _pushCondition(sql, values = [], logic = 'AND') {
    this._conditions.push({ sql, values, logic });
  }

  // ─── Internal: build the WHERE string from _conditions ───────────
  _buildWhere() {
    if (this._conditions.length === 0) return { clause: '', params: [] };

    let clause = ' WHERE ';
    const params = [];

    this._conditions.forEach((cond, i) => {
      if (i > 0) clause += ` ${cond.logic} `;
      clause += cond.sql;
      params.push(...cond.values);
    });

    return { clause, params };
  }

  // ─── FIX 1: wrap only plain column names in backticks.
  //     Dotted references like "table.column" or raw SQL expressions
  //     must NOT be wrapped — doing so produces `table.column` which
  //     MySQL treats as a single identifier and fails.
  _wrapField(field) {
    if (typeof field !== 'string') return field;
    // Already quoted, contains a dot (table.col), space, or parenthesis → leave alone
    if (field.includes('`') || field.includes('.') || field.includes('(') || field.includes(' ')) {
      return field;
    }
    return `\`${field}\``;
  }

  // ─── Backward-compat helpers ──────────────────────────────────────
  get _where() { return this._conditions.map(c => c.sql); }
  get _whereValues() { return this._conditions.flatMap(c => c.values); }

  select(fields = '*') {
    this._select = Array.isArray(fields) ? fields.join(', ') : fields;
    return this;
  }

  from(table) { this._from = table; return this; }
  table(table) { return this.from(table); }

  // ═══════════════════════════════════════════════════════════════
  //  WHERE  (AND)
  // ═══════════════════════════════════════════════════════════════

  where(field, value = null, operator = '=') {
    if (typeof field === 'object' && field !== null) {
      Object.keys(field).forEach(key => {
        this._pushCondition(`${this._wrapField(key)} = ?`, [field[key]], 'AND');
      });
    } else if (value === null && arguments.length === 1) {
      // Raw SQL string — pass through unchanged
      this._pushCondition(field, [], 'AND');
    } else {
      this._pushCondition(`${this._wrapField(field)} ${operator} ?`, [value], 'AND');
    }
    return this;
  }

  whereIn(field, values) {
    if (!Array.isArray(values) || values.length === 0)
      throw new Error('whereIn requires a non-empty array');
    const ph = values.map(() => '?').join(', ');
    this._pushCondition(`${this._wrapField(field)} IN (${ph})`, values, 'AND');
    return this;
  }

  whereNotIn(field, values) {
    if (!Array.isArray(values) || values.length === 0)
      throw new Error('whereNotIn requires a non-empty array');
    const ph = values.map(() => '?').join(', ');
    this._pushCondition(`${this._wrapField(field)} NOT IN (${ph})`, values, 'AND');
    return this;
  }

  whereNull(field) {
    this._pushCondition(`${this._wrapField(field)} IS NULL`, [], 'AND');
    return this;
  }

  whereNotNull(field) {
    this._pushCondition(`${this._wrapField(field)} IS NOT NULL`, [], 'AND');
    return this;
  }

  // ═══════════════════════════════════════════════════════════════
  //  OR WHERE
  // ═══════════════════════════════════════════════════════════════

  orWhere(field, value = null, operator = '=') {
    if (typeof field === 'object' && field !== null) {
      Object.keys(field).forEach((key, i) => {
        this._pushCondition(`${this._wrapField(key)} = ?`, [field[key]], i === 0 ? 'OR' : 'AND');
      });
    } else if (value === null && arguments.length === 1) {
      this._pushCondition(field, [], 'OR');
    } else {
      this._pushCondition(`${this._wrapField(field)} ${operator} ?`, [value], 'OR');
    }
    return this;
  }

  orWhereIn(field, values) {
    if (!Array.isArray(values) || values.length === 0)
      throw new Error('orWhereIn requires a non-empty array');
    const ph = values.map(() => '?').join(', ');
    this._pushCondition(`${this._wrapField(field)} IN (${ph})`, values, 'OR');
    return this;
  }

  orWhereNotIn(field, values) {
    if (!Array.isArray(values) || values.length === 0)
      throw new Error('orWhereNotIn requires a non-empty array');
    const ph = values.map(() => '?').join(', ');
    this._pushCondition(`${this._wrapField(field)} NOT IN (${ph})`, values, 'OR');
    return this;
  }

  orWhereNull(field) {
    this._pushCondition(`${this._wrapField(field)} IS NULL`, [], 'OR');
    return this;
  }

  orWhereNotNull(field) {
    this._pushCondition(`${this._wrapField(field)} IS NOT NULL`, [], 'OR');
    return this;
  }

  orWhereGroup(callback) {
    const inner = new QueryBuilder(this.mysql);
    callback(inner);
    if (inner._conditions.length === 0) return this;
    let s = ''; const p = [];
    inner._conditions.forEach((c, i) => { if (i > 0) s += ` ${c.logic} `; s += c.sql; p.push(...c.values); });
    this._pushCondition(`(${s})`, p, 'OR');
    return this;
  }

  andWhereGroup(callback) {
    const inner = new QueryBuilder(this.mysql);
    callback(inner);
    if (inner._conditions.length === 0) return this;
    let s = ''; const p = [];
    inner._conditions.forEach((c, i) => { if (i > 0) s += ` ${c.logic} `; s += c.sql; p.push(...c.values); });
    this._pushCondition(`(${s})`, p, 'AND');
    return this;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ORDER / GROUP / HAVING / LIMIT / OFFSET / JOIN
  // ═══════════════════════════════════════════════════════════════

  orderBy(field, direction = 'ASC') {
    // Use _wrapField so dotted aliases work correctly
    this._orderBy.push(`${this._wrapField(field)} ${direction.toUpperCase()}`);
    return this;
  }

  groupBy(fields) {
    if (Array.isArray(fields)) {
      this._groupBy.push(...fields.map(f => this._wrapField(f)));
    } else {
      this._groupBy.push(this._wrapField(fields));
    }
    return this;
  }

  having(condition, value = null) {
    this._having.push(condition);
    if (value !== null) this._havingValues.push(value);
    return this;
  }

  limit(limit) { this._limit = limit; return this; }
  offset(offset) { this._offset = offset; return this; }

  join(table, condition, type = 'INNER') {
    this._join.push(`${type.toUpperCase()} JOIN ${table} ON ${condition}`);
    return this;
  }
  leftJoin(table, condition) { return this.join(table, condition, 'LEFT'); }
  rightJoin(table, condition) { return this.join(table, condition, 'RIGHT'); }

  set(data) { this._updateData = data; return this; }

  // ═══════════════════════════════════════════════════════════════
  //  EXECUTION
  // ═══════════════════════════════════════════════════════════════

  async get() {
    if (!this._from) throw new Error('Table name is required. Use from(), table(), or setTable()');

    let query = `SELECT ${this._select} FROM ${this._from}`;
    if (this._join.length > 0) query += ' ' + this._join.join(' ');

    const { clause, params: whereParams } = this._buildWhere();
    query += clause;

    if (this._groupBy.length > 0) query += ' GROUP BY ' + this._groupBy.join(', ');
    if (this._having.length > 0) query += ' HAVING ' + this._having.join(' AND ');
    if (this._orderBy.length > 0) query += ' ORDER BY ' + this._orderBy.join(', ');
    if (this._limit !== null) query += ` LIMIT ${this._limit}`;
    if (this._offset !== null) query += ` OFFSET ${this._offset}`;

    const params = [...whereParams, ...this._havingValues];
    const result = await this.mysql.query(query, params);
    this.reset();
    return result;
  }

  async first() {
    this.limit(1);
    const results = await this.get();
    return results.length > 0 ? results[0] : null;
  }

  async last() {
    const results = await this.get();
    const total = results.length;
    return total > 0 ? results[total - 1] : null;
  }

  async update(data = null) {
    const updateData = data || this._updateData;
    if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0)
      throw new Error('Update data is required');
    if (!this._from)
      throw new Error('Table name is required. Use from(), table(), or setTable()');

    const setFields = Object.keys(updateData);
    const setClause = setFields.map(f => `\`${f}\` = ?`).join(', ');
    const setValues = Object.values(updateData);

    const { clause, params: whereParams } = this._buildWhere();
    const result = await this.mysql.query(
      `UPDATE ${this._from} SET ${setClause}${clause}`,
      [...setValues, ...whereParams]
    );
    this.reset();
    return result;
  }

  async delete(table = null) {
    const tableName = table || this._from;
    if (!tableName) throw new Error('Table name is required');

    const { clause, params: whereParams } = this._buildWhere();
    if (!clause) throw new Error('DELETE query requires WHERE conditions for safety');

    const result = await this.mysql.query(`DELETE FROM ${tableName}${clause}`, whereParams);
    this.reset();
    return result;
  }

  async insert(data, table = null) {
    const tableName = table || this._from;
    if (!tableName) throw new Error('Table name is required');
    return await this.mysql.insert(data, tableName);
  }

  async count(field = '*') {
    this._select = `COUNT(${field}) as count`;
    const result = await this.first();
    return result ? parseInt(result.count) : 0;
  }
}

class MySQL {
  constructor(config = null) {
    this.connection = null;
    this.pool = null;
    this.defaultTable = null;

    if (!config) {
      try {
        require('dotenv').config({ path: '.env' });

        let host = process.env.DB_HOST ?? null;
        let user = process.env.DB_USER ?? null;
        let password = process.env.DB_PASSWORD ?? null;
        let database = process.env.DB_DATABASE ?? null;
        let port = process.env.DB_PORT ?? 3306;

        if (fs.existsSync("mysql.json")) {
          const conData = require("../../mysql.json");
          host = conData.host ?? host;
          user = conData.user ?? user;
          password = conData.password ?? password;
          database = conData.database ?? database;
          port = conData.port ?? port;
        }

        config = { host, user, password, database, port };

        if (!('password' in config)) {
          console.log('password key does not exist, user reset to null');
          config.user = null;
        }

        if (!config.host || !config.user || !config.database) {
          console.warn('Some database configuration values are missing from .env');
        } else {
          this.connect(config);
        }
      } catch (error) {
        console.error('Error loading configuration from .env:', error);
      }
    } else {
      this.connect(config);
    }
  }

  setTable(table) {
    this.defaultTable = table;
    return this;
  }

  connect(config = null) {
    if (!config) {
      try {
        require('dotenv').config({ path: '.env' });
        let host = process.env.DB_HOST ?? null;
        let user = process.env.DB_USER ?? null;
        let password = process.env.DB_PASSWORD ?? null;
        let database = process.env.DB_DATABASE ?? null;
        let port = process.env.DB_PORT ?? 3306;

        if (fs.existsSync("mysql.json")) {
          const conData = require("../../mysql.json");
          host = conData.host ?? host;
          user = conData.user ?? user;
          password = conData.password ?? password;
          database = conData.database ?? database;
          port = conData.port ?? port;
        }

        config = { host, user, password, database, port };
        if (!('password' in config)) {
          console.log('password key does not exist, user reset to null');
          config.user = null;
        }

        if (!config.host || !config.user || !config.database)
          throw new Error('Required database configuration values are missing from .env');
      } catch (error) {
        console.error('Error loading configuration from .env:', error);
        return Promise.reject(error);
      }
    }

    const mysql = require('mysql2/promise');
    try {
      if (config.usePool !== false) {
        this.pool = mysql.createPool({
          host: config.host,
          user: config.user,
          password: config.password,
          database: config.database,
          waitForConnections: true,
          connectionLimit: 500,
          queueLimit: 0,
          dateStrings: true
        });
        console.log('MySQL connection pool created successfully');
        return Promise.resolve(this.pool);
      } else {
        return mysql.createConnection({
          host: config.host, user: config.user,
          password: config.password, database: config.database
        }).then(connection => {
          this.connection = connection;
          console.log('MySQL connection established successfully');
          return this.connection;
        });
      }
    } catch (error) {
      console.error('MySQL connection error:', error);
      return Promise.reject(error);
    }
  }

  async begin() {
    try {
      if (this.pool) this.connection = await this.pool.getConnection();
      if (this.connection) await this.connection.beginTransaction();
    } catch (error) { console.error('Begin transaction error:', error); throw error; }
  }

  async commit() {
    try {
      if (this.connection) {
        await this.connection.commit();
        if (this.pool) { this.connection.release(); this.connection = null; }
      }
    } catch (error) { console.error('Commit error:', error); throw error; }
  }

  async rollback() {
    try {
      if (this.connection) await this.connection.rollback();
    } catch (error) { console.error('Rollback error:', error); throw error; }
  }

  async query(query, params = []) {
    try {
      if (!this.pool && !this.connection)
        throw new Error('Database connection not established. Call connect() first.');

      if (Array.isArray(params) && params.length > 0 &&
        query.trim().toUpperCase().startsWith('UPDATE') &&
        query.includes('SET ?') &&
        typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
        const [updateData, ...otherParams] = params;
        const keys = Object.keys(updateData);
        const values = Object.values(updateData);
        query = query.replace('SET ?', keys.map(k => `\`${k}\` = ?`).join(', '));
        params = [...values, ...otherParams];
      } else if (params && typeof params === 'object' && !Array.isArray(params)) {
        const keys = Object.keys(params);
        const values = Object.values(params);
        if (query.trim().toUpperCase().startsWith('INSERT') && query.includes('SET ?')) {
          query = query.replace('SET ?', keys.map(k => `\`${k}\` = ?`).join(', ')); params = values;
        } else if (query.trim().toUpperCase().startsWith('UPDATE') && query.includes('SET ?')) {
          query = query.replace('SET ?', keys.map(k => `\`${k}\` = ?`).join(', ')); params = values;
        } else if (query.trim().toUpperCase().startsWith('DELETE') && query.includes('WHERE ?')) {
          query = query.replace('WHERE ?', keys.map(k => `\`${k}\` = ?`).join(' AND ')); params = values;
        }
      }

      const conn = this.pool || this.connection;
      const [results] = await conn.execute(query, params);
      return results;
    } catch (error) { console.error('Query error:', error); throw error; }
  }

  async update(data, where, tableName) {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) throw new Error('Data must be a non-empty object');
    if (!where || typeof where !== 'object' || Object.keys(where).length === 0) throw new Error('Where conditions must be a non-empty object');
    if (!tableName) throw new Error('Table name is required');

    const setFields = Object.keys(data);
    const whereFields = Object.keys(where);
    return await this.query(
      `UPDATE ${tableName} SET ${setFields.map(f => `${f} = ?`).join(', ')} WHERE ${whereFields.map(f => `${f} = ?`).join(' AND ')}`,
      [...setFields.map(f => data[f]), ...whereFields.map(f => where[f])]
    );
  }

  async insert(data, tableName) {
    if (!data) throw new Error('Data is required');
    if (!tableName) throw new Error('Table name is required');

    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) throw new Error('Data must not be empty');

    const fields = Object.keys(rows[0]);
    if (fields.length === 0) throw new Error('Data must contain at least one field');

    for (let i = 1; i < rows.length; i++) {
      const rf = Object.keys(rows[i]);
      if (rf.length !== fields.length || !fields.every(f => rf.includes(f)))
        throw new Error('All rows must have the same fields');
    }

    const placeholders = rows.map(() => `(${fields.map(() => '?').join(', ')})`).join(', ');
    const values = [];
    rows.forEach(row => fields.forEach(f => values.push(row[f])));

    return await this.query(`INSERT INTO ${tableName} (${fields.join(', ')}) VALUES ${placeholders}`, values);
  }

  // ── Chainable entry points — all pass defaultTable into QueryBuilder ──
  select(fields = '*') {
    return new QueryBuilder(this, this.defaultTable).select(fields);
  }
  from(table) {
    return new QueryBuilder(this, this.defaultTable).from(table);
  }
  table(table) {
    return this.from(table);
  }
  where(field, value = null, operator = '=') {
    return new QueryBuilder(this, this.defaultTable).where(field, value, operator);
  }

  // ─── FIX 2: expose andWhereGroup and orWhereGroup on MySQL itself
  //     so models can call this.mysql.andWhereGroup(...) directly.
  //     Both simply create a fresh QueryBuilder and delegate.
  andWhereGroup(callback) {
    return new QueryBuilder(this, this.defaultTable).andWhereGroup(callback);
  }
  orWhereGroup(callback) {
    return new QueryBuilder(this, this.defaultTable).orWhereGroup(callback);
  }

  async close() {
    try {
      if (this.connection) { await this.connection.end(); console.log('MySQL connection closed'); }
      if (this.pool) { await this.pool.end(); console.log('MySQL connection pool closed'); }
      return true;
    } catch (error) { console.error('Error closing MySQL connection:', error); throw error; }
  }
}

module.exports = MySQL;


/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 setTable — USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Option A — chain on construction
this.mysql = new Mysql().setTable('users');

// Option B — set after construction
this.mysql = new Mysql();
this.mysql.setTable('users');

// Once set, .from() is no longer needed:
await this.mysql.where('id', 1).get();
await this.mysql.where('status', 'active').count();
await this.mysql.insert({ name: 'Jane' });
await this.mysql.where('id', 1).update({ name: 'John' });
await this.mysql.where('id', 1).delete();
await this.mysql.select(['id', 'name']).get();

// Override for one query — does NOT change the default:
await this.mysql.from('orders').where('user_id', 1).get();

// Change default at any time:
this.mysql.setTable('admins');

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ALL PREVIOUS EXAMPLES STILL WORK UNCHANGED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const users = await db.select('*').from('users').where('user_id', 1).get();
const user  = await db.from('users').where({ user_id: 1, status: 'active' }).first();
await db.table('users').where('user_id', 1).update({ name: 'John' });
await db.from('users').where('user_id', 1).delete();
const count = await db.from('users').where('status', 'active').count();
await db.from('users').where('role','admin').orWhere('role','super_admin').get();

// andWhereGroup / orWhereGroup — now work on both mysql AND a QueryBuilder chain:
await db.from('users').andWhereGroup(q => q.where('role', 'admin').orWhere('role', 'super_admin')).get();
await db.andWhereGroup(q => q.where('status', 'active')).get();  // uses defaultTable if set
*/