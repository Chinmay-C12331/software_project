import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StudentRow {
  id: number;
  student_code: string;
  name: string;
  email: string;
  password_hash: string;
  department: string;
  semester: number;
  credit_limit: number;
}

export interface CourseRow {
  id: number;
  code: string;
  name: string;
  credits: number;
  faculty: string;
  department: string;
  schedule: string;
  total_seats: number;
  available_seats: number;
  semester: number;
}

let dbInstance: Database.Database | null = null;

export function getDbPath(): string {
  if (process.env.DB_PATH) {
    return path.resolve(process.cwd(), process.env.DB_PATH);
  }
  return path.resolve(__dirname, 'data', 'registration.db');
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = getDbPath();
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

export function setDbInstance(customDb: Database.Database): void {
  dbInstance = customDb;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initializeSchema(db: Database.Database): void {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);
}
