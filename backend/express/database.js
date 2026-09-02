import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'opencode.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initializeDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('administrateur', 'partenaire', 'citoyen')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS dynamic_elements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('eau', 'route', 'batiment')),
      height REAL,
      distance REAL,
      path TEXT NOT NULL DEFAULT '[]',
      x REAL NOT NULL,
      y REAL NOT NULL,
      in_fokotany INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedDefaultUsers(database);

  return database;
}

function seedDefaultUsers(database) {
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get();

  if (userCount.count > 0) return;

  const salt = bcrypt.genSaltSync(10);

  const defaultUsers = [
    {
      username: 'admin',
      email: 'admin@opencode.mg',
      password: 'Admin@2024!',
      role: 'administrateur',
    },
    {
      username: 'partenaire1',
      email: 'partenaire@opencode.mg',
      password: 'Partenaire@2024!',
      role: 'partenaire',
    },
    {
      username: 'citoyen1',
      email: 'citoyen@opencode.mg',
      password: 'Citoyen@2024!',
      role: 'citoyen',
    },
  ];

  const insert = database.prepare(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (@username, @email, @password_hash, @role)
  `);

  const insertMany = database.transaction((users) => {
    for (const user of users) {
      insert.run({
        username: user.username,
        email: user.email,
        password_hash: bcrypt.hashSync(user.password, salt),
        role: user.role,
      });
    }
  });

  insertMany(defaultUsers);
  console.log('[DB] Utilisateurs par defaut inseres (admin, partenaire1, citoyen1)');
}

export default initializeDatabase;
