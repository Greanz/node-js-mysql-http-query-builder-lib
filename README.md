Alright — here is a **true single README file** (no repeated code blocks, no nesting issues, clean GitHub rendering). Just copy everything once and paste:

```md
# MySQL Query Builder (Node.js)

A lightweight and flexible MySQL query builder built on top of `mysql2/promise`.

Designed for simplicity, readability, and full control — without the overhead of heavy ORMs.

---

## ✨ Features

- Chainable query builder
- Clean and readable syntax
- Supports:
  - SELECT, INSERT, UPDATE, DELETE
  - WHERE / OR WHERE / grouped conditions
  - JOIN (INNER, LEFT, RIGHT)
  - GROUP BY & HAVING
  - ORDER BY, LIMIT, OFFSET
- Transaction support (begin, commit, rollback)
- Connection pooling (mysql2)
- Default table support (`setTable`)
- Safe parameter binding (prevents SQL injection)
- Supports raw SQL when needed

---

## 📦 Installation

npm install mysql2

---

## 🚀 Usage & Examples

### Initialize
const MySQL = require('./MySQL');
const db = new MySQL().setTable('users');

---

### SELECT
const users = await db
  .select(['id', 'name'])
  .where('status', 'active')
  .orderBy('id', 'DESC')
  .get();

---

### WHERE Conditions
await db.where('id', 1).get();

await db.where({ status: 'active', role: 'admin' }).get();

await db
  .where('role', 'admin')
  .orWhere('role', 'manager')
  .get();

---

### Grouped Conditions
await db.andWhereGroup(q => {
  q.where('role', 'admin').orWhere('role', 'super_admin');
}).get();

---

### INSERT
await db.insert({
  name: 'John',
  email: 'john@example.com'
});

---

### UPDATE
await db.where('id', 1).update({
  name: 'Updated Name'
});

---

### DELETE (Safe)
await db.where('id', 1).delete();

DELETE requires a WHERE clause to prevent accidental full-table deletion.

---

### JOIN
await db
  .select('*')
  .from('orders')
  .join('users', 'users.id = orders.user_id')
  .get();

---

### COUNT
const total = await db.where('status', 'active').count();

---

### Transactions
await db.begin();

try {
  await db.insert({ name: 'Test' });
  await db.commit();
} catch (err) {
  await db.rollback();
}

---

## 🧠 Design Philosophy

- No magic
- No heavy abstraction
- Full SQL control when needed
- Simple enough for small projects
- Powerful enough for production use

---

## ⚠️ Notes

- This is not an ORM
- You still write SQL logic, just cleaner
- Designed for developers who prefer control over abstraction

---

## 📄 License

MIT
```
