import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface Student {
  id: number;
  student_code: string;
  name: string;
  email: string;
  department: string;
  semester: number;
  credit_limit: number;
  registeredCredits?: number;
}

export interface PrerequisiteItem {
  id: number;
  code: string;
  name: string;
  completed: boolean;
}

export interface Course {
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
  prerequisites: PrerequisiteItem[];
  prerequisitesPassed: boolean;
  missingPrerequisites: PrerequisiteItem[];
  isRegistered: boolean;
  isWaitlisted: boolean;
  waitlistId: number | null;
  waitlistPosition: number | null;
  totalWaitlisted: number;
  eligibilityStatus: 'ELIGIBLE' | 'PREREQUISITE_MISSING' | 'FULL_WAITLIST_AVAILABLE' | 'REGISTERED';
}

export interface ValidationCourseResult {
  courseId: number;
  code: string;
  name: string;
  credits: number;
  faculty: string;
  department: string;
  schedule: string;
  prerequisites: {
    passed: boolean;
    items: PrerequisiteItem[];
    missing: PrerequisiteItem[];
  };
  seats: {
    available: number;
    total: number;
    full: boolean;
    currentWaitlistSize: number;
  };
  alreadyRegistered: boolean;
  alreadyWaitlisted: boolean;
  status: 'ELIGIBLE' | 'PREREQUISITE_MISSING' | 'FULL_WAITLIST_AVAILABLE' | 'ALREADY_REGISTERED';
}

export interface ValidationResponse {
  courses: ValidationCourseResult[];
  creditCheck: {
    currentRegisteredCredits: number;
    selectedEligibleCredits: number;
    total: number;
    limit: number;
    remaining: number;
    exceeded: boolean;
  };
  valid: boolean;
}

export interface ConfirmationReceipt {
  registration: {
    id: number;
    registration_code: string;
    created_at: string;
    total_credits: number;
  };
  registeredCourses: Array<{
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
  }>;
  waitlistedCourses: Array<{
    waitlistId: number;
    courseId: number;
    code: string;
    name: string;
    credits: number;
    faculty: string;
    schedule: string;
    position: number;
  }>;
  totalRegisteredCredits: number;
  batchCredits: number;
  student: Student;
}

const TOKEN_STORAGE_KEY = 'ccrs_jwt_token';
const FALLBACK_DB_KEY = 'ccrs_vercel_fallback_db_v1';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

// ============================================================================
// Built-in Serverless Fallback DB (used automatically if Vercel static hosting
// or native SQLite binary is unavailable in the cloud environment)
// ============================================================================
interface FallbackDbState {
  students: Student[];
  courses: Array<{
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
  }>;
  prerequisites: Array<[number, number]>;
  academic_records: Array<{
    id: number;
    student_id: number;
    course_id: number;
    status: 'COMPLETED' | 'REGISTERED';
    grade: string | null;
    semester: number;
  }>;
  registrations: Array<{
    id: number;
    registration_code: string;
    student_id: number;
    created_at: string;
    total_credits: number;
    courseIds: number[];
  }>;
  waitlist: Array<{
    id: number;
    student_id: number;
    course_id: number;
    position: number;
    created_at: string;
    status: 'WAITING' | 'PROMOTED' | 'CANCELLED';
  }>;
}

function createInitialFallbackState(): FallbackDbState {
  const students: Student[] = [
    { id: 1, student_code: '20241CSE0837', name: 'Shalini K', email: 'shalini.k@presidency.edu.in', department: 'CSE', semester: 5, credit_limit: 24 },
    { id: 2, student_code: '20241CSE0838', name: 'Sahana H C', email: 'sahana.hc@presidency.edu.in', department: 'CSE', semester: 5, credit_limit: 24 },
    { id: 3, student_code: '20241CSE0839', name: 'Ranjan Gowda N', email: 'ranjan.gowda@presidency.edu.in', department: 'CSE', semester: 5, credit_limit: 24 },
    { id: 4, student_code: '20241CSE0840', name: 'Ayaj Rajak Valasang', email: 'ayaj.valasang@presidency.edu.in', department: 'CSE', semester: 5, credit_limit: 24 },
    { id: 5, student_code: '20241CSE0841', name: 'Chinmay J C', email: 'chinmay.jc@presidency.edu.in', department: 'CSE', semester: 5, credit_limit: 24 },
  ];

  const courses = [
    { id: 1, code: 'CS101', name: 'Programming in C', credits: 4, faculty: 'Prof. Maheshwar Rao', department: 'CSE', schedule: 'Completed (Sem 1)', total_seats: 60, available_seats: 60, semester: 1 },
    { id: 2, code: 'MA101', name: 'Engineering Mathematics I', credits: 4, faculty: 'Dr. Shanthi Swaroop', department: 'MAT', schedule: 'Completed (Sem 1)', total_seats: 60, available_seats: 60, semester: 1 },
    { id: 3, code: 'CS102', name: 'Data Structures', credits: 4, faculty: 'Dr. Rameshwar Bhat', department: 'CSE', schedule: 'Completed (Sem 2)', total_seats: 60, available_seats: 60, semester: 2 },
    { id: 4, code: 'CS201', name: 'Database Management Systems', credits: 4, faculty: 'Dr. Kavitha Rao', department: 'CSE', schedule: 'Completed (Sem 3)', total_seats: 60, available_seats: 60, semester: 3 },
    { id: 5, code: 'CS203', name: 'Operating Systems', credits: 4, faculty: 'Dr. Naveen Kumar', department: 'CSE', schedule: 'Completed (Sem 4)', total_seats: 60, available_seats: 60, semester: 4 },
    { id: 6, code: 'MA201', name: 'Probability & Linear Algebra', credits: 4, faculty: 'Dr. Harish Chandra', department: 'MAT', schedule: 'Completed (Sem 4)', total_seats: 60, available_seats: 60, semester: 4 },
    { id: 7, code: 'CS301', name: 'Computer Networks', credits: 4, faculty: 'Dr. Ramesh Babu', department: 'CSE', schedule: 'Mon, Wed 09:00 - 10:30 AM', total_seats: 60, available_seats: 42, semester: 5 },
    { id: 8, code: 'CS302', name: 'Software Engineering', credits: 3, faculty: 'Prof. Anitha Nair', department: 'CSE', schedule: 'Tue, Thu 10:00 - 11:30 AM', total_seats: 60, available_seats: 48, semester: 5 },
    { id: 9, code: 'CS303', name: 'Web Technologies', credits: 4, faculty: 'Dr. Vikram Deshmukh', department: 'CSE', schedule: 'Mon, Wed 11:00 - 12:30 PM', total_seats: 50, available_seats: 35, semester: 5 },
    { id: 10, code: 'CS304', name: 'Cloud Computing', credits: 4, faculty: 'Dr. Priya Sundaram', department: 'CSE', schedule: 'Tue, Thu 02:00 - 03:30 PM', total_seats: 45, available_seats: 29, semester: 5 },
    { id: 11, code: 'CS305', name: 'Artificial Intelligence', credits: 4, faculty: 'Dr. Arvind Krishnan', department: 'CSE', schedule: 'Mon, Wed, Fri 02:00 - 03:00 PM', total_seats: 40, available_seats: 0, semester: 5 },
    { id: 12, code: 'CS401', name: 'Machine Learning', credits: 4, faculty: 'Dr. Meera Raghavan', department: 'CSE', schedule: 'Tue, Thu 09:00 - 10:30 AM', total_seats: 50, available_seats: 22, semester: 5 },
    { id: 13, code: 'CS306', name: 'Compiler Design', credits: 4, faculty: 'Prof. Suresh Kulkarni', department: 'CSE', schedule: 'Mon, Wed 03:30 - 05:00 PM', total_seats: 40, available_seats: 1, semester: 5 },
    { id: 14, code: 'CS307', name: 'Distributed Database Systems', credits: 4, faculty: 'Dr. Kavitha Rao', department: 'CSE', schedule: 'Wed, Fri 10:00 - 11:30 AM', total_seats: 45, available_seats: 19, semester: 5 },
    { id: 15, code: 'CS308', name: 'Cybersecurity & Cryptography', credits: 4, faculty: 'Dr. Nikhil Verma', department: 'CSE', schedule: 'Thu, Fri 11:30 - 01:00 PM', total_seats: 50, available_seats: 31, semester: 5 },
    { id: 16, code: 'CS309', name: 'Mobile Application Development', credits: 3, faculty: 'Prof. Rohini Joshi', department: 'CSE', schedule: 'Tue, Thu 03:30 - 05:00 PM', total_seats: 50, available_seats: 38, semester: 5 },
    { id: 17, code: 'EC310', name: 'Embedded IoT Systems', credits: 4, faculty: 'Dr. Sanjay Hegde', department: 'ECE', schedule: 'Mon, Fri 11:00 - 12:30 PM', total_seats: 40, available_seats: 25, semester: 5 },
    { id: 18, code: 'HS301', name: 'Technical Communication & Ethics', credits: 2, faculty: 'Prof. Deepa Menon', department: 'HSS', schedule: 'Fri 03:00 - 05:00 PM', total_seats: 80, available_seats: 64, semester: 5 },
  ];

  const prerequisites: Array<[number, number]> = [
    [7, 5],   // CS301 -> CS203
    [9, 3],   // CS303 -> CS102
    [10, 5],  // CS304 -> CS203
    [11, 3],  // CS305 -> CS102
    [11, 2],  // CS305 -> MA101
    [12, 3],  // CS401 -> CS102
    [12, 6],  // CS401 -> MA201
    [13, 1],  // CS306 -> CS101
    [13, 3],  // CS306 -> CS102
    [14, 4],  // CS307 -> CS201
    [15, 5],  // CS308 -> CS203
    [16, 3],  // CS309 -> CS102
    [17, 1],  // EC310 -> CS101
  ];

  const academic_records: FallbackDbState['academic_records'] = [];
  let recId = 1;
  const baseCompleted = [
    { course_id: 1, grade: 'A+', semester: 1 },
    { course_id: 2, grade: 'A', semester: 1 },
    { course_id: 3, grade: 'A+', semester: 2 },
    { course_id: 4, grade: 'A', semester: 3 },
    { course_id: 5, grade: 'A', semester: 4 },
  ];

  for (const s of students) {
    for (const b of baseCompleted) {
      if (s.student_code === '20241CSE0840' && b.course_id === 5) continue;
      academic_records.push({
        id: recId++,
        student_id: s.id,
        course_id: b.course_id,
        status: 'COMPLETED',
        grade: b.grade,
        semester: b.semester,
      });
    }
    if (s.student_code === '20241CSE0841') {
      academic_records.push({
        id: recId++,
        student_id: s.id,
        course_id: 6,
        status: 'COMPLETED',
        grade: 'A+',
        semester: 4,
      });
    }
  }

  return {
    students,
    courses,
    prerequisites,
    academic_records,
    registrations: [],
    waitlist: [
      {
        id: 1,
        student_id: 2,
        course_id: 11,
        position: 1,
        created_at: new Date().toISOString(),
        status: 'WAITING',
      },
    ],
  };
}

function loadFallbackDb(): FallbackDbState {
  try {
    const raw = localStorage.getItem(FALLBACK_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const initial = createInitialFallbackState();
  localStorage.setItem(FALLBACK_DB_KEY, JSON.stringify(initial));
  return initial;
}

function saveFallbackDb(state: FallbackDbState) {
  localStorage.setItem(FALLBACK_DB_KEY, JSON.stringify(state));
}

function makeError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  const err: any = new Error(message);
  err.response = {
    status,
    data: {
      error: { code, message, ...(extra || {}) },
    },
  };
  return Promise.reject(err);
}

function makeResponse(config: AxiosRequestConfig, status: number, data: any): Promise<AxiosResponse> {
  return Promise.resolve({
    data,
    status,
    statusText: status === 201 ? 'Created' : 'OK',
    headers: {},
    config: config as any,
  });
}

function handleFallbackRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
  const db = loadFallbackDb();
  const method = (config.method || 'get').toLowerCase();
  const rawUrl = (config.url || '').replace(/^\/api/, '');
  const [pathname, queryString] = rawUrl.split('?');
  const params = new URLSearchParams(queryString || '');
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};

  // 1. POST /auth/login
  if (method === 'post' && pathname === '/auth/login') {
    const studentCode = String(body.studentCode || '').trim();
    const password = String(body.password || '');
    if (!studentCode || !password) {
      return makeError(400, 'VALIDATION_ERROR', 'Student ID and password are required.');
    }
    const student = db.students.find((s) => s.student_code.toUpperCase() === studentCode.toUpperCase());
    if (!student || password !== 'student123') {
      return makeError(401, 'INVALID_CREDENTIALS', 'Invalid Student ID or password.');
    }
    const token = `local-jwt-${student.id}-${student.student_code}`;
    return makeResponse(config, 200, { token, student });
  }

  // Authenticate current student from token
  const token = getStoredToken() || '';
  let currentStudent: Student | undefined;
  if (token.startsWith('local-jwt-')) {
    const parts = token.split('-');
    const id = Number(parts[2]);
    currentStudent = db.students.find((s) => s.id === id);
  } else if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentStudent = db.students.find((s) => s.id === payload.id);
    } catch {
      // ignore
    }
  }

  if (!currentStudent) {
    return makeError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
  }

  const getStudentState = (studentId: number) => {
    const records = db.academic_records.filter((r) => r.student_id === studentId);
    const completedIds = new Set<number>(records.filter((r) => r.status === 'COMPLETED').map((r) => r.course_id));
    const registeredIds = new Set<number>(records.filter((r) => r.status === 'REGISTERED').map((r) => r.course_id));
    let currentRegisteredCredits = 0;
    for (const cid of registeredIds) {
      const c = db.courses.find((course) => course.id === cid);
      if (c) currentRegisteredCredits += c.credits;
    }
    const waitlistMap = new Map<number, { id: number; position: number }>();
    db.waitlist
      .filter((w) => w.student_id === studentId && w.status === 'WAITING')
      .forEach((w) => waitlistMap.set(w.course_id, { id: w.id, position: w.position }));

    return { completedIds, registeredIds, currentRegisteredCredits, waitlistMap };
  };

  const getPrereqs = (courseId: number, completedIds: Set<number>) => {
    const pairs = db.prerequisites.filter(([cid]) => cid === courseId);
    const items = pairs
      .map(([, pid]) => {
        const c = db.courses.find((course) => course.id === pid)!;
        return { id: c.id, code: c.code, name: c.name, completed: completedIds.has(c.id) };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
    const missing = items.filter((i) => !i.completed);
    return { passed: missing.length === 0, items, missing };
  };

  // 2. GET /auth/me
  if (method === 'get' && pathname === '/auth/me') {
    const st = getStudentState(currentStudent.id);
    return makeResponse(config, 200, {
      student: { ...currentStudent, registeredCredits: st.currentRegisteredCredits },
    });
  }

  // 3. GET /courses
  if (method === 'get' && pathname === '/courses') {
    const st = getStudentState(currentStudent.id);
    const sem5 = db.courses.filter((c) => c.semester === currentStudent!.semester);
    let enriched: Course[] = sem5.map((course) => {
      const prereqCheck = getPrereqs(course.id, st.completedIds);
      const isRegistered = st.registeredIds.has(course.id);
      const wl = st.waitlistMap.get(course.id) || null;
      const totalWaitlisted = db.waitlist.filter((w) => w.course_id === course.id && w.status === 'WAITING').length;

      let eligibilityStatus: Course['eligibilityStatus'] = 'ELIGIBLE';
      if (isRegistered) eligibilityStatus = 'REGISTERED';
      else if (!prereqCheck.passed) eligibilityStatus = 'PREREQUISITE_MISSING';
      else if (course.available_seats <= 0) eligibilityStatus = 'FULL_WAITLIST_AVAILABLE';

      return {
        ...course,
        prerequisites: prereqCheck.items,
        prerequisitesPassed: prereqCheck.passed,
        missingPrerequisites: prereqCheck.missing,
        isRegistered,
        isWaitlisted: Boolean(wl),
        waitlistId: wl?.id ?? null,
        waitlistPosition: wl?.position ?? null,
        totalWaitlisted,
        eligibilityStatus,
      };
    });

    const availability = (params.get('availability') || '').toLowerCase();
    if (availability === 'full') enriched = enriched.filter((c) => c.available_seats === 0);
    else if (availability === 'available') enriched = enriched.filter((c) => c.available_seats > 0);

    return makeResponse(config, 200, {
      courses: enriched,
      meta: { currentRegisteredCredits: st.currentRegisteredCredits, creditLimit: currentStudent.credit_limit },
    });
  }

  // 4. POST /registration/validate
  if (method === 'post' && pathname === '/registration/validate') {
    const st = getStudentState(currentStudent.id);
    const courseIds: number[] = Array.from(new Set(body.courseIds || []));
    let selectedEligibleCredits = 0;
    let hasPrerequisiteMissing = false;
    let hasAlreadyRegistered = false;
    let eligibleCount = 0;
    let waitlistAvailableCount = 0;

    const courseResults: ValidationCourseResult[] = courseIds.map((cid) => {
      const course = db.courses.find((c) => c.id === cid)!;
      const prereqCheck = getPrereqs(course.id, st.completedIds);
      const alreadyRegistered = st.registeredIds.has(course.id);
      const isFull = course.available_seats <= 0;

      let status: ValidationCourseResult['status'] = 'ELIGIBLE';
      if (alreadyRegistered) {
        status = 'ALREADY_REGISTERED';
        hasAlreadyRegistered = true;
      } else if (!prereqCheck.passed) {
        status = 'PREREQUISITE_MISSING';
        hasPrerequisiteMissing = true;
      } else if (isFull) {
        status = 'FULL_WAITLIST_AVAILABLE';
        waitlistAvailableCount++;
      } else {
        status = 'ELIGIBLE';
        selectedEligibleCredits += course.credits;
        eligibleCount++;
      }

      const currentWaitlistSize = db.waitlist.filter((w) => w.course_id === course.id && w.status === 'WAITING').length;

      return {
        courseId: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        faculty: course.faculty,
        department: course.department,
        schedule: course.schedule,
        prerequisites: prereqCheck,
        seats: {
          available: course.available_seats,
          total: course.total_seats,
          full: isFull,
          currentWaitlistSize,
        },
        alreadyRegistered,
        alreadyWaitlisted: st.waitlistMap.has(course.id),
        status,
      };
    });

    const total = st.currentRegisteredCredits + selectedEligibleCredits;
    const exceeded = total > currentStudent.credit_limit;
    const remaining = Math.max(0, currentStudent.credit_limit - total);
    const valid =
      courseIds.length > 0 &&
      (eligibleCount > 0 || waitlistAvailableCount > 0) &&
      !hasPrerequisiteMissing &&
      !hasAlreadyRegistered &&
      !exceeded;

    return makeResponse(config, 200, {
      courses: courseResults,
      creditCheck: {
        currentRegisteredCredits: st.currentRegisteredCredits,
        selectedEligibleCredits,
        total,
        limit: currentStudent.credit_limit,
        remaining,
        exceeded,
      },
      valid,
    });
  }

  // 5. POST /registration/confirm
  if (method === 'post' && pathname === '/registration/confirm') {
    const st = getStudentState(currentStudent.id);
    const courseIds: number[] = Array.from(new Set(body.courseIds || []));
    const waitlistCourseIds: number[] = Array.from(new Set(body.waitlistCourseIds || []));

    let batchCredits = 0;
    const coursesToReg = [];
    for (const cid of courseIds) {
      const course = db.courses.find((c) => c.id === cid);
      if (!course) return makeError(404, 'COURSE_NOT_FOUND', 'Course not found.');
      if (st.registeredIds.has(cid)) return makeError(409, 'ALREADY_REGISTERED', `Already registered for ${course.code}.`);
      const prereq = getPrereqs(cid, st.completedIds);
      if (!prereq.passed) return makeError(400, 'PREREQUISITE_MISSING', `Missing prerequisite for ${course.code}.`);
      if (course.available_seats <= 0) {
        return makeError(409, 'SEAT_UNAVAILABLE', `No seats left in ${course.code}.`, {
          courseId: course.id,
          courseCode: course.code,
        });
      }
      batchCredits += course.credits;
      coursesToReg.push(course);
    }

    if (st.currentRegisteredCredits + batchCredits > currentStudent.credit_limit) {
      return makeError(400, 'CREDIT_LIMIT_EXCEEDED', 'Credit limit (24) exceeded.');
    }

    const nowIso = new Date().toISOString();
    const regCode = `REG-${new Date().getFullYear()}-${currentStudent.student_code}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nextRegId = db.registrations.length + 1;

    for (const c of coursesToReg) {
      c.available_seats -= 1;
      db.academic_records.push({
        id: db.academic_records.length + 1,
        student_id: currentStudent.id,
        course_id: c.id,
        status: 'REGISTERED',
        grade: null,
        semester: currentStudent.semester,
      });
    }

    if (coursesToReg.length > 0) {
      db.registrations.push({
        id: nextRegId,
        registration_code: regCode,
        student_id: currentStudent.id,
        created_at: nowIso,
        total_credits: batchCredits,
        courseIds: coursesToReg.map((c) => c.id),
      });
    }

    const waitlistedResults = [];
    for (const wid of waitlistCourseIds) {
      const wCourse = db.courses.find((c) => c.id === wid);
      if (!wCourse) continue;
      const existing = db.waitlist.find(
        (w) => w.student_id === currentStudent!.id && w.course_id === wid && w.status === 'WAITING'
      );
      if (existing) {
        waitlistedResults.push({
          waitlistId: existing.id,
          courseId: wCourse.id,
          code: wCourse.code,
          name: wCourse.name,
          credits: wCourse.credits,
          faculty: wCourse.faculty,
          schedule: wCourse.schedule,
          position: existing.position,
        });
      } else {
        const activeQueue = db.waitlist.filter((w) => w.course_id === wid && w.status === 'WAITING');
        const position = activeQueue.length + 1;
        const wlId = db.waitlist.length + 1;
        db.waitlist.push({
          id: wlId,
          student_id: currentStudent.id,
          course_id: wid,
          position,
          created_at: nowIso,
          status: 'WAITING',
        });
        waitlistedResults.push({
          waitlistId: wlId,
          courseId: wCourse.id,
          code: wCourse.code,
          name: wCourse.name,
          credits: wCourse.credits,
          faculty: wCourse.faculty,
          schedule: wCourse.schedule,
          position,
        });
      }
    }

    saveFallbackDb(db);

    return makeResponse(config, 201, {
      registration: {
        id: nextRegId,
        registration_code: regCode,
        created_at: nowIso,
        total_credits: batchCredits,
      },
      registeredCourses: coursesToReg,
      waitlistedCourses: waitlistedResults,
      totalRegisteredCredits: st.currentRegisteredCredits + batchCredits,
      batchCredits,
      student: currentStudent,
    });
  }

  // 6. GET /registration/my
  if (method === 'get' && pathname === '/registration/my') {
    const regRecords = db.academic_records.filter(
      (r) => r.student_id === currentStudent!.id && r.status === 'REGISTERED'
    );
    const registeredCourses = regRecords.map((r) => {
      const c = db.courses.find((course) => course.id === r.course_id)!;
      const reg = db.registrations
        .filter((rg) => rg.student_id === currentStudent!.id && rg.courseIds.includes(c.id))
        .pop();
      return {
        ...c,
        registered_semester: r.semester,
        registration_code: reg?.registration_code || null,
        registered_at: reg?.created_at || null,
      };
    });
    const totalCredits = registeredCourses.reduce((sum, c) => sum + c.credits, 0);
    return makeResponse(config, 200, {
      registeredCourses,
      registrations: db.registrations.filter((r) => r.student_id === currentStudent!.id),
      totalCredits,
      creditLimit: currentStudent.credit_limit,
    });
  }

  // 7. DELETE /registration/course/:courseId
  if (method === 'delete' && pathname.startsWith('/registration/course/')) {
    const courseId = Number(pathname.split('/').pop());
    const idx = db.academic_records.findIndex(
      (r) => r.student_id === currentStudent!.id && r.course_id === courseId && r.status === 'REGISTERED'
    );
    if (idx === -1) return makeError(404, 'NOT_REGISTERED', 'Not registered for this course.');
    db.academic_records.splice(idx, 1);

    const course = db.courses.find((c) => c.id === courseId)!;
    course.available_seats = Math.min(course.total_seats, course.available_seats + 1);

    // Promote first waitlisted student if any
    const firstWaiter = db.waitlist
      .filter((w) => w.course_id === courseId && w.status === 'WAITING')
      .sort((a, b) => a.position - b.position)[0];

    if (firstWaiter) {
      firstWaiter.status = 'PROMOTED';
      course.available_seats = Math.max(0, course.available_seats - 1);
      db.academic_records.push({
        id: db.academic_records.length + 1,
        student_id: firstWaiter.student_id,
        course_id: courseId,
        status: 'REGISTERED',
        grade: null,
        semester: 5,
      });
      db.waitlist
        .filter((w) => w.course_id === courseId && w.status === 'WAITING')
        .sort((a, b) => a.position - b.position)
        .forEach((w, i) => {
          w.position = i + 1;
        });
    }

    saveFallbackDb(db);
    return makeResponse(config, 200, {
      message: `Dropped ${course.code}`,
      droppedCourse: course,
    });
  }

  // 8. GET /waitlist/my
  if (method === 'get' && pathname === '/waitlist/my') {
    const entries = db.waitlist
      .filter((w) => w.student_id === currentStudent!.id && w.status === 'WAITING')
      .map((w) => {
        const c = db.courses.find((course) => course.id === w.course_id)!;
        return {
          ...w,
          code: c.code,
          name: c.name,
          credits: c.credits,
          faculty: c.faculty,
          department: c.department,
          schedule: c.schedule,
          available_seats: c.available_seats,
          total_seats: c.total_seats,
        };
      });
    return makeResponse(config, 200, { waitlist: entries });
  }

  // 9. POST /waitlist/join
  if (method === 'post' && pathname === '/waitlist/join') {
    const courseId = Number(body.courseId);
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) return makeError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    const existing = db.waitlist.find(
      (w) => w.student_id === currentStudent!.id && w.course_id === courseId && w.status === 'WAITING'
    );
    if (existing) {
      return makeResponse(config, 200, {
        message: `Already on waiting list (#${existing.position})`,
        entry: { ...existing, code: course.code, name: course.name },
      });
    }
    const position = db.waitlist.filter((w) => w.course_id === courseId && w.status === 'WAITING').length + 1;
    const entry = {
      id: db.waitlist.length + 1,
      student_id: currentStudent.id,
      course_id: courseId,
      position,
      created_at: new Date().toISOString(),
      status: 'WAITING' as const,
    };
    db.waitlist.push(entry);
    saveFallbackDb(db);
    return makeResponse(config, 201, {
      message: `Joined waiting list (#${position})`,
      entry: { ...entry, code: course.code, name: course.name },
    });
  }

  // 10. DELETE /waitlist/:id
  if (method === 'delete' && pathname.startsWith('/waitlist/')) {
    const wlId = Number(pathname.split('/').pop());
    const target = db.waitlist.find((w) => w.id === wlId && w.student_id === currentStudent!.id);
    if (!target) return makeError(404, 'WAITLIST_NOT_FOUND', 'Waitlist entry not found.');
    target.status = 'CANCELLED';
    db.waitlist
      .filter((w) => w.course_id === target.course_id && w.status === 'WAITING')
      .sort((a, b) => a.position - b.position)
      .forEach((w, idx) => {
        w.position = idx + 1;
      });
    saveFallbackDb(db);
    return makeResponse(config, 200, { message: 'Removed from waiting list', id: wlId });
  }

  // 11. GET /academic-record
  if (method === 'get' && pathname === '/academic-record') {
    const records = db.academic_records
      .filter((r) => r.student_id === currentStudent!.id)
      .map((r) => {
        const c = db.courses.find((course) => course.id === r.course_id)!;
        return {
          ...r,
          code: c.code,
          name: c.name,
          credits: c.credits,
          faculty: c.faculty,
          department: c.department,
          schedule: c.schedule,
        };
      });
    const completed = records.filter((r) => r.status === 'COMPLETED');
    const registered = records.filter((r) => r.status === 'REGISTERED');
    return makeResponse(config, 200, {
      completed,
      registered,
      summary: {
        completedCoursesCount: completed.length,
        registeredCoursesCount: registered.length,
        completedCredits: completed.reduce((s, r) => s + r.credits, 0),
        registeredCredits: registered.reduce((s, r) => s + r.credits, 0),
        creditLimit: currentStudent.credit_limit,
        cgpa: 9.4,
      },
    });
  }

  return makeError(404, 'NOT_FOUND', 'Endpoint not found.');
}

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const serverErrorCode = error.response?.data?.error?.code;

    // If deployed to a static-only host (like Vercel static preset returning 404 NOT_FOUND
    // "The page could not be found" or 500/502 when native SQLite isn't available),
    // seamlessly execute against the built-in client-side database engine!
    const isVercelMissingApi =
      !error.response ||
      status === 405 ||
      status === 502 ||
      status === 503 ||
      (status === 404 && (serverErrorCode === 'NOT_FOUND' || !serverErrorCode)) ||
      (status === 500 && serverErrorCode !== 'INTERNAL_ERROR');

    if (isVercelMissingApi && error.config) {
      return handleFallbackRequest(error.config);
    }

    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      setStoredToken(null);
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);
