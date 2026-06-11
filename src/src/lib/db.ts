import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'

// 数据落在挂载卷上：容器内 WORKDIR=/app，compose 挂 crm-data 到 /app/data。
// 本地开发默认写到 src/data/，已在 .gitignore 中忽略。
const DATA_DIR = process.env.CRM_DATA_DIR || resolve(process.cwd(), 'data')

let _db: Database.Database | null = null

/** 种子数据归属的用户：取管理员配置里的第一个，否则 1。 */
export function seedOwnerId(): number {
  const ids = (process.env.CRM_ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
  return ids[0] ?? 1
}

export function getDb(): Database.Database {
  if (_db) return _db
  mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(dbFilePath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seed(db)
  _db = db
  return db
}

/** 数据目录（备份文件写在其下的 backups/）。 */
export function dataDir(): string {
  return DATA_DIR
}

/** 主数据库文件路径。 */
export function dbFilePath(): string {
  return resolve(DATA_DIR, 'crm.db')
}

/** 关闭当前连接并清空缓存，下次 getDb() 会重新打开（还原后需要）。 */
export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      company        TEXT,
      status         TEXT NOT NULL DEFAULT 'lead',
      source         TEXT,
      tags           TEXT,
      note           TEXT,
      owner_id       INTEGER NOT NULL,
      next_follow_at TEXT,
      created_by     INTEGER NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      title       TEXT,
      phone       TEXT,
      email       TEXT,
      is_primary  INTEGER NOT NULL DEFAULT 0,
      note        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id       INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      title             TEXT NOT NULL,
      stage             TEXT NOT NULL DEFAULT 'initial',
      status            TEXT NOT NULL DEFAULT 'open',
      owner_id          INTEGER NOT NULL,
      amount            REAL,
      expected_close_at TEXT,
      lost_reason       TEXT,
      next_follow_at    TEXT,
      created_by        INTEGER NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follow_ups (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
      content        TEXT NOT NULL,
      follow_by      INTEGER NOT NULL,
      next_follow_at TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id   INTEGER NOT NULL,
      task_id     INTEGER NOT NULL,
      title       TEXT,
      created_by  INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(entity_type, entity_id, task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_customers_owner       ON customers(owner_id);
    CREATE INDEX IF NOT EXISTS idx_customers_next_follow ON customers(next_follow_at);
    CREATE INDEX IF NOT EXISTS idx_contacts_customer     ON contacts(customer_id);
    CREATE INDEX IF NOT EXISTS idx_opps_owner            ON opportunities(owner_id);
    CREATE INDEX IF NOT EXISTS idx_opps_customer         ON opportunities(customer_id);
    CREATE INDEX IF NOT EXISTS idx_opps_status           ON opportunities(status);
    CREATE INDEX IF NOT EXISTS idx_opps_next_follow      ON opportunities(next_follow_at);
    CREATE INDEX IF NOT EXISTS idx_follow_customer       ON follow_ups(customer_id);
    CREATE INDEX IF NOT EXISTS idx_follow_opp            ON follow_ups(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_tasklinks_entity      ON task_links(entity_type, entity_id);
  `)
}

/** 仅在客户表为空时塞入演示数据，方便安装后立刻看到效果。 */
function seed(db: Database.Database) {
  const count = (
    db.prepare('SELECT COUNT(*) AS c FROM customers').get() as { c: number }
  ).c
  if (count > 0) return

  const owner = seedOwnerId()
  const now = "datetime('now')"
  // 相对今天 n 天的 YYYY-MM-DD（演示数据用，借数据库计算避免 Date API）。
  const dayOffset = (n: number): string =>
    (
      db.prepare(`SELECT date('now', ? || ' days') AS d`).get(String(n)) as {
        d: string
      }
    ).d

  const insCustomer = db.prepare(
    `INSERT INTO customers (name, company, status, source, tags, note, owner_id, next_follow_at, created_by)
     VALUES (@name, @company, @status, @source, @tags, @note, @owner, @next, @owner)`,
  )
  const c1 = insCustomer.run({
    name: '王经理',
    company: '杭州海潮科技',
    status: 'following',
    source: '展会',
    tags: 'VIP,制造业',
    note: '对协作办公方案感兴趣',
    owner,
    next: dayOffset(2),
  }).lastInsertRowid as number
  const c2 = insCustomer.run({
    name: '李总',
    company: '上海明远贸易',
    status: 'lead',
    source: '官网咨询',
    tags: null,
    note: null,
    owner,
    next: dayOffset(-1), // 已过期，用于演示过期提示
  }).lastInsertRowid as number

  db.prepare(
    `INSERT INTO contacts (customer_id, name, title, phone, email, is_primary)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(c1, '王经理', '采购经理', '13800000001', 'wang@haichao.com', 1)
  db.prepare(
    `INSERT INTO contacts (customer_id, name, title, phone, email, is_primary)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(c1, '赵助理', '采购助理', '13800000002', null, 0)

  const opp = db
    .prepare(
      `INSERT INTO opportunities (customer_id, title, stage, status, owner_id, amount, expected_close_at, next_follow_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      c1,
      '海潮科技 100 席年度采购',
      'proposal',
      'open',
      owner,
      120000,
      dayOffset(20),
      dayOffset(2),
      owner,
    ).lastInsertRowid as number

  db.prepare(
    `INSERT INTO follow_ups (customer_id, opportunity_id, content, follow_by, next_follow_at, created_at)
     VALUES (?, ?, ?, ?, ?, ${now})`,
  ).run(c1, opp, '电话沟通，客户认可方案，等待内部预算审批。', owner, dayOffset(2))
  db.prepare(
    `INSERT INTO follow_ups (customer_id, opportunity_id, content, follow_by, next_follow_at, created_at)
     VALUES (?, ?, ?, ?, ?, ${now})`,
  ).run(c2, null, '官网留资，已加微信，待初次需求沟通。', owner, dayOffset(-1))
}
