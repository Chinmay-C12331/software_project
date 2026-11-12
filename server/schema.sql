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
