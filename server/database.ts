import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Initialize DB
let db: Database | null = null;

export const initDb = async () => {
  if (db) return db;

  const dbPath = path.resolve(process.cwd(), 'database.sqlite');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      start_date TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
  `);

  console.log('Database initialized successfully at ' + dbPath);
  return db;
};

export const getDb = async () => {
  if (!db) {
    return await initDb();
  }
  return db;
};
