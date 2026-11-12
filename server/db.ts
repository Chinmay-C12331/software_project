import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
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

const INLINE_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  department TEXT NOT NULL,
  semester INTEGER NOT NULL,
  credit_limit INTEGER NOT NULL DEFAULT 24
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  faculty TEXT NOT NULL,
  department TEXT NOT NULL,
  schedule TEXT NOT NULL,
  total_seats INTEGER NOT NULL CHECK (total_seats >= 0),
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0 AND available_seats <= total_seats),
  semester INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prerequisites (
  course_id INTEGER NOT NULL,
  prerequisite_course_id INTEGER NOT NULL,
  PRIMARY KEY (course_id, prerequisite_course_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (prerequisite_course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academic_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'REGISTERED')),
  grade TEXT,
  semester INTEGER NOT NULL,
  UNIQUE (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_code TEXT NOT NULL UNIQUE,
  student_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  total_credits INTEGER NOT NULL CHECK (total_credits >= 0),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registration_items (
  registration_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  PRIMARY KEY (registration_id, course_id),
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL CHECK (status IN ('WAITING', 'PROMOTED', 'CANCELLED')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester);
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department);
CREATE INDEX IF NOT EXISTS idx_academic_records_student ON academic_records(student_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_student ON registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_course_status ON waitlist(course_id, status, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_student ON waitlist(student_id, status);
`;

let dbInstance: Database.Database | null = null;

export function getDbPath(): string {
  if (process.env.DB_PATH) {
    return path.resolve(process.cwd(), process.env.DB_PATH);
  }
  // On Vercel or read-only serverless environments, use os.tmpdir() (/tmp)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'registration.db');
  }
  return path.resolve(__dirname, 'data', 'registration.db');
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = getDbPath();
    try {
      if (dbPath !== ':memory:') {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      dbInstance = new Database(dbPath);
      dbInstance.pragma('journal_mode = WAL');
    } catch {
      // Fallback to in-memory SQLite if filesystem is read-only
      dbInstance = new Database(':memory:');
    }
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
  db.exec(INLINE_SCHEMA_SQL);
}
