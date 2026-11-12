import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { getDb, initializeSchema } from './db.ts';

export function seedDatabase(customDb?: Database.Database, forceReset = false): void {
  const db = customDb || getDb();
  initializeSchema(db);

  const existingStudents = db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number };
  if (existingStudents.count > 0 && !forceReset) {
    return;
  }

  const passwordHash = bcrypt.hashSync('student123', 10);

  const runSeed = db.transaction(() => {
    db.exec(`
      DELETE FROM waitlist;
      DELETE FROM registration_items;
      DELETE FROM registrations;
      DELETE FROM academic_records;
      DELETE FROM prerequisites;
      DELETE FROM courses;
      DELETE FROM students;
      DELETE FROM sqlite_sequence WHERE name IN ('students', 'courses', 'academic_records', 'registrations', 'waitlist');
    `);

    const insertStudent = db.prepare(`
      INSERT INTO students (student_code, name, email, password_hash, department, semester, credit_limit)
      VALUES (@student_code, @name, @email, @password_hash, @department, @semester, @credit_limit)
    `);

    const students = [
      {
        student_code: '20241CSE0837',
        name: 'Shalini K',
        email: 'shalini.k@presidency.edu.in',
        password_hash: passwordHash,
        department: 'CSE',
        semester: 5,
        credit_limit: 24,
      },
      {
        student_code: '20241CSE0838',
        name: 'Sahana H C',
        email: 'sahana.hc@presidency.edu.in',
        password_hash: passwordHash,
        department: 'CSE',
        semester: 5,
        credit_limit: 24,
      },
      {
        student_code: '20241CSE0839',
        name: 'Ranjan Gowda N',
        email: 'ranjan.gowda@presidency.edu.in',
        password_hash: passwordHash,
        department: 'CSE',
        semester: 5,
        credit_limit: 24,
      },
      {
        student_code: '20241CSE0840',
        name: 'Ayaj Rajak Valasang',
        email: 'ayaj.valasang@presidency.edu.in',
        password_hash: passwordHash,
        department: 'CSE',
        semester: 5,
        credit_limit: 24,
      },
      {
        student_code: '20241CSE0841',
        name: 'Chinmay J C',
        email: 'chinmay.jc@presidency.edu.in',
        password_hash: passwordHash,
        department: 'CSE',
        semester: 5,
        credit_limit: 24,
      },
    ];

    const studentMap = new Map<string, number>();
    for (const s of students) {
      const info = insertStudent.run(s);
      studentMap.set(s.student_code, Number(info.lastInsertRowid));
    }

    const insertCourse = db.prepare(`
      INSERT INTO courses (code, name, credits, faculty, department, schedule, total_seats, available_seats, semester)
      VALUES (@code, @name, @credits, @faculty, @department, @schedule, @total_seats, @available_seats, @semester)
    `);

    // Historical foundational courses (Semesters 1 - 4)
    const pastCourses = [
      {
        code: 'CS101',
        name: 'Programming in C',
        credits: 4,
        faculty: 'Prof. Maheshwar Rao',
        department: 'CSE',
        schedule: 'Completed (Sem 1)',
        total_seats: 60,
        available_seats: 60,
        semester: 1,
      },
      {
        code: 'MA101',
        name: 'Engineering Mathematics I',
        credits: 4,
        faculty: 'Dr. Shanthi Swaroop',
        department: 'MAT',
        schedule: 'Completed (Sem 1)',
        total_seats: 60,
        available_seats: 60,
        semester: 1,
      },
      {
        code: 'CS102',
        name: 'Data Structures',
        credits: 4,
        faculty: 'Dr. Rameshwar Bhat',
        department: 'CSE',
        schedule: 'Completed (Sem 2)',
        total_seats: 60,
        available_seats: 60,
        semester: 2,
      },
      {
        code: 'CS201',
        name: 'Database Management Systems',
        credits: 4,
        faculty: 'Dr. Kavitha Rao',
        department: 'CSE',
        schedule: 'Completed (Sem 3)',
        total_seats: 60,
        available_seats: 60,
        semester: 3,
      },
      {
        code: 'CS203',
        name: 'Operating Systems',
        credits: 4,
        faculty: 'Dr. Naveen Kumar',
        department: 'CSE',
        schedule: 'Completed (Sem 4)',
        total_seats: 60,
        available_seats: 60,
        semester: 4,
      },
      {
        code: 'MA201',
        name: 'Probability & Linear Algebra',
        credits: 4,
        faculty: 'Dr. Harish Chandra',
        department: 'MAT',
        schedule: 'Completed (Sem 4)',
        total_seats: 60,
        available_seats: 60,
        semester: 4,
      },
    ];

    // Upcoming Semester 5 courses (12 courses)
    const semester5Courses = [
      {
        code: 'CS301',
        name: 'Computer Networks',
        credits: 4,
        faculty: 'Dr. Ramesh Babu',
        department: 'CSE',
        schedule: 'Mon, Wed 09:00 - 10:30 AM',
        total_seats: 60,
        available_seats: 42,
        semester: 5,
      },
      {
        code: 'CS302',
        name: 'Software Engineering',
        credits: 3,
        faculty: 'Prof. Anitha Nair',
        department: 'CSE',
        schedule: 'Tue, Thu 10:00 - 11:30 AM',
        total_seats: 60,
        available_seats: 48,
        semester: 5,
      },
      {
        code: 'CS303',
        name: 'Web Technologies',
        credits: 4,
        faculty: 'Dr. Vikram Deshmukh',
        department: 'CSE',
        schedule: 'Mon, Wed 11:00 - 12:30 PM',
        total_seats: 50,
        available_seats: 35,
        semester: 5,
      },
      {
        code: 'CS304',
        name: 'Cloud Computing',
        credits: 4,
        faculty: 'Dr. Priya Sundaram',
        department: 'CSE',
        schedule: 'Tue, Thu 02:00 - 03:30 PM',
        total_seats: 45,
        available_seats: 29,
        semester: 5,
      },
      {
        code: 'CS305',
        name: 'Artificial Intelligence',
        credits: 4,
        faculty: 'Dr. Arvind Krishnan',
        department: 'CSE',
        schedule: 'Mon, Wed, Fri 02:00 - 03:00 PM',
        total_seats: 40,
        available_seats: 0, // DEMO: Full course (Waitlist offered)
        semester: 5,
      },
      {
        code: 'CS401',
        name: 'Machine Learning',
        credits: 4,
        faculty: 'Dr. Meera Raghavan',
        department: 'CSE',
        schedule: 'Tue, Thu 09:00 - 10:30 AM',
        total_seats: 50,
        available_seats: 22, // DEMO: Blocked by MA201 prerequisite for standard students
        semester: 5,
      },
      {
        code: 'CS306',
        name: 'Compiler Design',
        credits: 4,
        faculty: 'Prof. Suresh Kulkarni',
        department: 'CSE',
        schedule: 'Mon, Wed 03:30 - 05:00 PM',
        total_seats: 40,
        available_seats: 1, // DEMO: Exactly 1 seat left (race condition & seat update demo)
        semester: 5,
      },
      {
        code: 'CS307',
        name: 'Distributed Database Systems',
        credits: 4,
        faculty: 'Dr. Kavitha Rao',
        department: 'CSE',
        schedule: 'Wed, Fri 10:00 - 11:30 AM',
        total_seats: 45,
        available_seats: 19,
        semester: 5,
      },
      {
        code: 'CS308',
        name: 'Cybersecurity & Cryptography',
        credits: 4,
        faculty: 'Dr. Nikhil Verma',
        department: 'CSE',
        schedule: 'Thu, Fri 11:30 - 01:00 PM',
        total_seats: 50,
        available_seats: 31,
        semester: 5,
      },
      {
        code: 'CS309',
        name: 'Mobile Application Development',
        credits: 3,
        faculty: 'Prof. Rohini Joshi',
        department: 'CSE',
        schedule: 'Tue, Thu 03:30 - 05:00 PM',
        total_seats: 50,
        available_seats: 38,
        semester: 5,
      },
      {
        code: 'EC310',
        name: 'Embedded IoT Systems',
        credits: 4,
        faculty: 'Dr. Sanjay Hegde',
        department: 'ECE',
        schedule: 'Mon, Fri 11:00 - 12:30 PM',
        total_seats: 40,
        available_seats: 25,
        semester: 5,
      },
      {
        code: 'HS301',
        name: 'Technical Communication & Ethics',
        credits: 2,
        faculty: 'Prof. Deepa Menon',
        department: 'HSS',
        schedule: 'Fri 03:00 - 05:00 PM',
        total_seats: 80,
        available_seats: 64,
        semester: 5,
      },
    ];

    const courseMap = new Map<string, number>();
    for (const c of [...pastCourses, ...semester5Courses]) {
      const info = insertCourse.run(c);
      courseMap.set(c.code, Number(info.lastInsertRowid));
    }

    // Prerequisites
    const insertPrereq = db.prepare(`
      INSERT INTO prerequisites (course_id, prerequisite_course_id)
      VALUES (?, ?)
    `);

    const prereqPairs: Array<[string, string]> = [
      ['CS301', 'CS203'], // Computer Networks -> Operating Systems
      ['CS303', 'CS102'], // Web Technologies -> Data Structures
      ['CS304', 'CS203'], // Cloud Computing -> Operating Systems
      ['CS305', 'CS102'], // Artificial Intelligence -> Data Structures
      ['CS305', 'MA101'], // Artificial Intelligence -> Engineering Mathematics I
      ['CS401', 'CS102'], // Machine Learning -> Data Structures
      ['CS401', 'MA201'], // Machine Learning -> Probability & Linear Algebra (Blocked for most students!)
      ['CS306', 'CS101'], // Compiler Design -> Programming in C
      ['CS306', 'CS102'], // Compiler Design -> Data Structures
      ['CS307', 'CS201'], // Distributed Database Systems -> DBMS
      ['CS308', 'CS203'], // Cybersecurity & Cryptography -> Operating Systems
      ['CS309', 'CS102'], // Mobile Application Development -> Data Structures
      ['EC310', 'CS101'], // Embedded IoT Systems -> Programming in C
    ];

    for (const [courseCode, prereqCode] of prereqPairs) {
      insertPrereq.run(courseMap.get(courseCode)!, courseMap.get(prereqCode)!);
    }

    // Academic records for each student
    // Standard 5 completed courses: CS101, CS102, MA101, CS201, CS203
    // Differentiated histories:
    // - Shalini (20241CSE0837), Sahana (20241CSE0838), Ranjan (20241CSE0839): Completed CS101, CS102, MA101, CS201, CS203 (Missing MA201 -> CS401 blocked)
    // - Ayaj (20241CSE0840): Completed CS101, CS102, MA101, CS201 (Missing CS203 and MA201 -> CS301, CS304, CS308, CS401 blocked)
    // - Chinmay (20241CSE0841): Completed CS101, CS102, MA101, CS201, CS203 AND MA201 (Eligible for CS401 Machine Learning too!)
    const insertAcademicRecord = db.prepare(`
      INSERT INTO academic_records (student_id, course_id, status, grade, semester)
      VALUES (@student_id, @course_id, 'COMPLETED', @grade, @semester)
    `);

    const standardCompleted: Array<{ code: string; grade: string; semester: number }> = [
      { code: 'CS101', grade: 'A+', semester: 1 },
      { code: 'MA101', grade: 'A', semester: 1 },
      { code: 'CS102', grade: 'A+', semester: 2 },
      { code: 'CS201', grade: 'A', semester: 3 },
      { code: 'CS203', grade: 'A', semester: 4 },
    ];

    for (const student of students) {
      const studentId = studentMap.get(student.student_code)!;

      for (const rec of standardCompleted) {
        // Ayaj has not completed CS203 yet
        if (student.student_code === '20241CSE0840' && rec.code === 'CS203') {
          continue;
        }
        insertAcademicRecord.run({
          student_id: studentId,
          course_id: courseMap.get(rec.code)!,
          grade: rec.grade,
          semester: rec.semester,
        });
      }

      // Chinmay also completed MA201 (Probability & Linear Algebra), making CS401 Machine Learning unlocked for him
      if (student.student_code === '20241CSE0841') {
        insertAcademicRecord.run({
          student_id: studentId,
          course_id: courseMap.get('MA201')!,
          grade: 'A+',
          semester: 4,
        });
      }
    }

    // Seed 1 initial waitlist entry on CS305 (Artificial Intelligence) by Sahana H C so joining shows realistic queue position (#2)
    const sahanaId = studentMap.get('20241CSE0838')!;
    const cs305Id = courseMap.get('CS305')!;
    db.prepare(`
      INSERT INTO waitlist (student_id, course_id, position, status)
      VALUES (?, ?, 1, 'WAITING')
    `).run(sahanaId, cs305Id);
  });

  runSeed();
}

// Allow running directly via `npm run seed` or `npm run reset-db`
const isMain = process.argv[1] && process.argv[1].endsWith('seed.ts');
if (isMain) {
  const isReset = process.argv.includes('--reset');
  seedDatabase(undefined, true);
  console.log(
    isReset
      ? 'Database reset and re-seeded with initial demo state.'
      : 'Database seeded successfully with demo students, courses, prerequisites, and academic records.'
  );
}
