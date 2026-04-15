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

# HTTP Request Utility (Axios Wrapper)

A simple and flexible HTTP utility class built on top of `axios`, designed to work seamlessly with Express.js.

---

## ✨ Features

- Easy access to:
  - POST, GET, QUERY, PARAMS, HEADERS
- Built-in JSON response helper
- Axios-based HTTP client
- Supports:
  - GET requests
  - POST (form-urlencoded)
  - POST (JSON body)
- Base URL support
- Cookie management (set, delete, clear)
- Structured error handling

---

## 📦 Installation

npm install axios

---

## 🚀 Usage & Examples

### Initialize
const HttpRequest = require('./HttpRequest');

const http = new HttpRequest(req, res);

---

### Get Request Data
http.getPost();
http.getPost('name');

http.getQuery();
http.getQuery('id');

http.getParam('id');
http.getHeader('authorization');

http.all();

---

### JSON Response
http.setJson('status', true)
    .setJson('message', 'Success')
    .json(200);

---

### External API - GET
const data = await http.getData('https://api.example.com/users', {
  page: 1
});

---

### External API - POST (Form)
const data = await http.postData('https://api.example.com/login', {
  username: 'admin',
  password: '1234'
});

---

### External API - POST (JSON)
const data = await http.postBody('https://api.example.com/users', {
  name: 'John',
  email: 'john@example.com'
});

---

### Using Base URL
http.setBaseURL('https://api.example.com');

const users = await http.getData('/users');

---

### Cookies
http.setCookie('token', '123456');

const token = http.getCookie('token');

http.deleteCookie('token');

http.clearCookies();

---

## 🧠 Design Philosophy

- Minimal and practical
- Works seamlessly with Express.js
- Keeps controllers clean
- No unnecessary abstraction

---

## ⚠️ Notes

- Designed for backend (Node.js + Express)
- Works as both request helper and API client
- Returns structured errors from axios

---

## 📄 License

MIT