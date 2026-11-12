import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { CourseRow, getDb, StudentRow } from './db.ts';
import { seedDatabase } from './seed.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'college-course-reg-secret-key-2026-team7';

export interface AuthPayload {
  id: number;
  student_code: string;
}

declare global {
  namespace Express {
    interface Request {
      student?: StudentRow;
    }
  }
}

function sendError(res: Response, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(extra || {}),
    },
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication token is required. Please sign in.');
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const db = getDb();
    const student = db
      .prepare('SELECT * FROM students WHERE id = ?')
      .get(decoded.id) as StudentRow | undefined;

    if (!student) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Student account not found.');
    }

    req.student = student;
    next();
  } catch {
    return sendError(res, 401, 'INVALID_TOKEN', 'Your session has expired or the token is invalid. Please sign in again.');
  }
}

const loginSchema = z.object({
  studentCode: z.string().trim().min(1, 'Student ID is required'),
  password: z.string().min(1, 'Password is required'),
});

const validateRegistrationSchema = z.object({
  courseIds: z.array(z.number().int().positive()).default([]),
});

const confirmRegistrationSchema = z.object({
  courseIds: z.array(z.number().int().positive()).default([]),
  waitlistCourseIds: z.array(z.number().int().positive()).default([]),
});

const joinWaitlistSchema = z.object({
  courseId: z.number().int().positive('Valid courseId is required'),
});

export function createApp() {
  const app = express();

  // Ensure DB is initialized and seeded on startup
  seedDatabase();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
  app.use(
    cors({
      origin: allowedOrigin === '*' ? true : allowedOrigin.split(','),
      credentials: true,
    })
  );

  app.use(express.json());

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 500 : 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendError(res, 429, 'RATE_LIMITED', 'Too many login attempts. Please wait a few minutes and try again.');
    },
  });

  // Helper to get student's completed and registered course IDs
  function getStudentCourseState(studentId: number) {
    const db = getDb();
    const records = db
      .prepare(
        `SELECT ar.course_id, ar.status, ar.grade, ar.semester, c.code, c.name, c.credits, c.faculty, c.schedule, c.department
         FROM academic_records ar
         JOIN courses c ON c.id = ar.course_id
         WHERE ar.student_id = ?`
      )
      .all(studentId) as Array<{
      course_id: number;
      status: 'COMPLETED' | 'REGISTERED';
      grade: string | null;
      semester: number;
      code: string;
      name: string;
      credits: number;
      faculty: string;
      schedule: string;
      department: string;
    }>;

    const completedIds = new Set<number>();
    const registeredIds = new Set<number>();
    let currentRegisteredCredits = 0;

    for (const r of records) {
      if (r.status === 'COMPLETED') {
        completedIds.add(r.course_id);
      } else if (r.status === 'REGISTERED') {
        registeredIds.add(r.course_id);
        currentRegisteredCredits += r.credits;
      }
    }

    const waitlists = db
      .prepare(
        `SELECT id, course_id, position, status, created_at
         FROM waitlist
         WHERE student_id = ? AND status = 'WAITING'`
      )
      .all(studentId) as Array<{
      id: number;
      course_id: number;
      position: number;
      status: string;
      created_at: string;
    }>;

    const waitlistMap = new Map<number, { id: number; position: number }>();
    for (const w of waitlists) {
      waitlistMap.set(w.course_id, { id: w.id, position: w.position });
    }

    return {
      records,
      completedIds,
      registeredIds,
      currentRegisteredCredits,
      waitlistMap,
    };
  }

  function getPrerequisitesForCourse(courseId: number, completedIds: Set<number>) {
    const db = getDb();
    const prereqs = db
      .prepare(
        `SELECT c.id, c.code, c.name
         FROM prerequisites p
         JOIN courses c ON c.id = p.prerequisite_course_id
         WHERE p.course_id = ?
         ORDER BY c.code ASC`
      )
      .all(courseId) as Array<{ id: number; code: string; name: string }>;

    const items = prereqs.map((p) => ({
      ...p,
      completed: completedIds.has(p.id),
    }));

    const missing = items.filter((i) => !i.completed);
    return {
      passed: missing.length === 0,
      items,
      missing,
    };
  }

  // 1. POST /api/auth/login
  app.post('/api/auth/login', loginLimiter, (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return sendError(res, 400, 'VALIDATION_ERROR', firstIssue ? firstIssue.message : 'Invalid login input.');
    }

    const { studentCode, password } = parsed.data;
    const db = getDb();
    const student = db
      .prepare('SELECT * FROM students WHERE UPPER(student_code) = UPPER(?)')
      .get(studentCode) as StudentRow | undefined;

    if (!student || !bcrypt.compareSync(password, student.password_hash)) {
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid Student ID or password. Please check your credentials.');
    }

    const token = jwt.sign(
      { id: student.id, student_code: student.student_code } satisfies AuthPayload,
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const { password_hash: _, ...safeStudent } = student;
    return res.json({
      token,
      student: safeStudent,
    });
  });

  // 2. GET /api/auth/me
  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const { password_hash: _, ...safeStudent } = student;
    const state = getStudentCourseState(student.id);
    return res.json({
      student: {
        ...safeStudent,
        registeredCredits: state.currentRegisteredCredits,
      },
    });
  });

  // 3. GET /api/courses
  app.get('/api/courses', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const db = getDb();
    const state = getStudentCourseState(student.id);

    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const department = typeof req.query.department === 'string' ? req.query.department.trim().toUpperCase() : '';
    const creditsFilter = typeof req.query.credits === 'string' && req.query.credits !== '' ? Number(req.query.credits) : null;
    const availability = typeof req.query.availability === 'string' ? req.query.availability.trim().toLowerCase() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'code';

    // Fetch upcoming semester courses (semester = student.semester)
    const rawCourses = db
      .prepare('SELECT * FROM courses WHERE semester = ? ORDER BY code ASC')
      .all(student.semester) as CourseRow[];

    let enriched = rawCourses.map((course) => {
      const prereqCheck = getPrerequisitesForCourse(course.id, state.completedIds);
      const isRegistered = state.registeredIds.has(course.id);
      const waitlistInfo = state.waitlistMap.get(course.id) || null;
      const waitlistCountRow = db
        .prepare("SELECT COUNT(*) as count FROM waitlist WHERE course_id = ? AND status = 'WAITING'")
        .get(course.id) as { count: number };

      let eligibilityStatus: 'ELIGIBLE' | 'PREREQUISITE_MISSING' | 'FULL_WAITLIST_AVAILABLE' | 'REGISTERED' = 'ELIGIBLE';
      if (isRegistered) {
        eligibilityStatus = 'REGISTERED';
      } else if (!prereqCheck.passed) {
        eligibilityStatus = 'PREREQUISITE_MISSING';
      } else if (course.available_seats <= 0) {
        eligibilityStatus = 'FULL_WAITLIST_AVAILABLE';
      }

      return {
        ...course,
        prerequisites: prereqCheck.items,
        prerequisitesPassed: prereqCheck.passed,
        missingPrerequisites: prereqCheck.missing,
        isRegistered,
        isWaitlisted: Boolean(waitlistInfo),
        waitlistId: waitlistInfo?.id ?? null,
        waitlistPosition: waitlistInfo?.position ?? null,
        totalWaitlisted: waitlistCountRow.count,
        eligibilityStatus,
      };
    });

    if (search) {
      enriched = enriched.filter(
        (c) =>
          c.code.toLowerCase().includes(search) ||
          c.name.toLowerCase().includes(search) ||
          c.faculty.toLowerCase().includes(search)
      );
    }

    if (department && department !== 'ALL') {
      enriched = enriched.filter((c) => c.department.toUpperCase() === department);
    }

    if (creditsFilter !== null && !Number.isNaN(creditsFilter)) {
      enriched = enriched.filter((c) => c.credits === creditsFilter);
    }

    if (availability === 'available') {
      enriched = enriched.filter((c) => c.available_seats > 0);
    } else if (availability === 'full') {
      enriched = enriched.filter((c) => c.available_seats === 0);
    } else if (availability === 'eligible') {
      enriched = enriched.filter((c) => c.eligibilityStatus === 'ELIGIBLE');
    }

    if (sort === 'credits_desc') {
      enriched.sort((a, b) => b.credits - a.credits || a.code.localeCompare(b.code));
    } else if (sort === 'seats_asc') {
      enriched.sort((a, b) => a.available_seats - b.available_seats || a.code.localeCompare(b.code));
    } else if (sort === 'name') {
      enriched.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      enriched.sort((a, b) => a.code.localeCompare(b.code));
    }

    return res.json({
      courses: enriched,
      meta: {
        currentRegisteredCredits: state.currentRegisteredCredits,
        creditLimit: student.credit_limit,
      },
    });
  });

  // 4. GET /api/courses/:id
  app.get('/api/courses/:id', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const courseId = Number(req.params.id);
    if (Number.isNaN(courseId)) {
      return sendError(res, 400, 'INVALID_COURSE_ID', 'Course ID must be a valid number.');
    }

    const db = getDb();
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as CourseRow | undefined;
    if (!course) {
      return sendError(res, 404, 'COURSE_NOT_FOUND', 'Course not found.');
    }

    const state = getStudentCourseState(student.id);
    const prereqCheck = getPrerequisitesForCourse(course.id, state.completedIds);
    const isRegistered = state.registeredIds.has(course.id);
    const waitlistInfo = state.waitlistMap.get(course.id) || null;

    return res.json({
      course: {
        ...course,
        prerequisites: prereqCheck.items,
        prerequisitesPassed: prereqCheck.passed,
        missingPrerequisites: prereqCheck.missing,
        isRegistered,
        isWaitlisted: Boolean(waitlistInfo),
        waitlistId: waitlistInfo?.id ?? null,
        waitlistPosition: waitlistInfo?.position ?? null,
      },
    });
  });

  // 5. POST /api/registration/validate
  app.post('/api/registration/validate', requireAuth, (req: Request, res: Response) => {
    const parsed = validateRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid courseIds payload.');
    }

    const student = req.student!;
    const db = getDb();
    const state = getStudentCourseState(student.id);
    const uniqueCourseIds = Array.from(new Set(parsed.data.courseIds));

    let selectedEligibleCredits = 0;
    let hasPrerequisiteMissing = false;
    let hasAlreadyRegistered = false;
    let eligibleCount = 0;
    let waitlistAvailableCount = 0;

    const courseResults = [];

    for (const courseId of uniqueCourseIds) {
      const course = db.prepare('SELECT * FROM courses WHERE id = ? AND semester = ?').get(courseId, student.semester) as
        | CourseRow
        | undefined;
      if (!course) {
        return sendError(res, 404, 'COURSE_NOT_FOUND', `Course ID ${courseId} does not exist for Semester ${student.semester}.`);
      }

      const prereqCheck = getPrerequisitesForCourse(course.id, state.completedIds);
      const alreadyRegistered = state.registeredIds.has(course.id);
      const isFull = course.available_seats <= 0;

      let status: 'ELIGIBLE' | 'PREREQUISITE_MISSING' | 'FULL_WAITLIST_AVAILABLE' | 'ALREADY_REGISTERED';
      if (alreadyRegistered) {
        status = 'ALREADY_REGISTERED';
        hasAlreadyRegistered = true;
      } else if (!prereqCheck.passed) {
        status = 'PREREQUISITE_MISSING';
        hasPrerequisiteMissing = true;
      } else if (isFull) {
        status = 'FULL_WAITLIST_AVAILABLE';
        waitlistAvailableCount += 1;
      } else {
        status = 'ELIGIBLE';
        selectedEligibleCredits += course.credits;
        eligibleCount += 1;
      }

      const waitlistCountRow = db
        .prepare("SELECT COUNT(*) as count FROM waitlist WHERE course_id = ? AND status = 'WAITING'")
        .get(course.id) as { count: number };

      courseResults.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        faculty: course.faculty,
        department: course.department,
        schedule: course.schedule,
        prerequisites: {
          passed: prereqCheck.passed,
          items: prereqCheck.items,
          missing: prereqCheck.missing,
        },
        seats: {
          available: course.available_seats,
          total: course.total_seats,
          full: isFull,
          currentWaitlistSize: waitlistCountRow.count,
        },
        alreadyRegistered,
        alreadyWaitlisted: state.waitlistMap.has(course.id),
        status,
      });
    }

    const totalCredits = state.currentRegisteredCredits + selectedEligibleCredits;
    const exceeded = totalCredits > student.credit_limit;
    const remaining = Math.max(0, student.credit_limit - totalCredits);

    const valid =
      uniqueCourseIds.length > 0 &&
      (eligibleCount > 0 || waitlistAvailableCount > 0) &&
      !hasPrerequisiteMissing &&
      !hasAlreadyRegistered &&
      !exceeded;

    return res.json({
      courses: courseResults,
      creditCheck: {
        currentRegisteredCredits: state.currentRegisteredCredits,
        selectedEligibleCredits,
        total: totalCredits,
        limit: student.credit_limit,
        remaining,
        exceeded,
      },
      valid,
    });
  });

  // 6. POST /api/registration/confirm
  app.post('/api/registration/confirm', requireAuth, (req: Request, res: Response) => {
    const parsed = confirmRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid confirmation payload.');
    }

    const student = req.student!;
    const db = getDb();
    const courseIds = Array.from(new Set(parsed.data.courseIds));
    const waitlistCourseIds = Array.from(
      new Set(parsed.data.waitlistCourseIds.filter((id) => !courseIds.includes(id)))
    );

    if (courseIds.length === 0 && waitlistCourseIds.length === 0) {
      return sendError(
        res,
        400,
        'EMPTY_SELECTION',
        'Please select at least one course to register or join the waiting list.'
      );
    }

    try {
      const confirmTx = db.transaction(() => {
        const state = getStudentCourseState(student.id);

        let batchCredits = 0;
        const coursesToRegister: CourseRow[] = [];

        // Validate all courses to register
        for (const courseId of courseIds) {
          const course = db
            .prepare('SELECT * FROM courses WHERE id = ? AND semester = ?')
            .get(courseId, student.semester) as CourseRow | undefined;

          if (!course) {
            throw {
              httpStatus: 404,
              code: 'COURSE_NOT_FOUND',
              message: `Course ID ${courseId} was not found.`,
            };
          }

          if (state.registeredIds.has(course.id)) {
            throw {
              httpStatus: 409,
              code: 'ALREADY_REGISTERED',
              message: `You are already registered for ${course.code} (${course.name}).`,
            };
          }

          const prereqCheck = getPrerequisitesForCourse(course.id, state.completedIds);
          if (!prereqCheck.passed) {
            const missingCodes = prereqCheck.missing.map((m) => `${m.code} (${m.name})`).join(', ');
            throw {
              httpStatus: 400,
              code: 'PREREQUISITE_MISSING',
              message: `Cannot register for ${course.code}: unmet prerequisite(s) ${missingCodes}.`,
            };
          }

          if (course.available_seats <= 0) {
            throw {
              httpStatus: 409,
              code: 'SEAT_UNAVAILABLE',
              message: `No seats remaining in ${course.code} (${course.name}). You may join the waiting list instead.`,
              extra: { courseId: course.id, courseCode: course.code },
            };
          }

          batchCredits += course.credits;
          coursesToRegister.push(course);
        }

        const projectedTotalCredits = state.currentRegisteredCredits + batchCredits;
        if (projectedTotalCredits > student.credit_limit) {
          throw {
            httpStatus: 400,
            code: 'CREDIT_LIMIT_EXCEEDED',
            message: `Credit limit exceeded: ${projectedTotalCredits} / ${student.credit_limit} maximum allowed credits.`,
          };
        }

        // Validate waitlist courses
        const coursesToWaitlist: CourseRow[] = [];
        for (const wCourseId of waitlistCourseIds) {
          const course = db
            .prepare('SELECT * FROM courses WHERE id = ? AND semester = ?')
            .get(wCourseId, student.semester) as CourseRow | undefined;

          if (!course) {
            throw {
              httpStatus: 404,
              code: 'COURSE_NOT_FOUND',
              message: `Waitlist course ID ${wCourseId} was not found.`,
            };
          }

          if (state.registeredIds.has(course.id)) {
            throw {
              httpStatus: 409,
              code: 'ALREADY_REGISTERED',
              message: `You are already registered for ${course.code}.`,
            };
          }

          const prereqCheck = getPrerequisitesForCourse(course.id, state.completedIds);
          if (!prereqCheck.passed) {
            const missingCodes = prereqCheck.missing.map((m) => m.code).join(', ');
            throw {
              httpStatus: 400,
              code: 'PREREQUISITE_MISSING',
              message: `Cannot join waiting list for ${course.code}: missing prerequisite ${missingCodes}.`,
            };
          }

          if (course.available_seats > 0) {
            throw {
              httpStatus: 400,
              code: 'SEATS_STILL_AVAILABLE',
              message: `${course.code} currently has ${course.available_seats} seat(s) open; register directly instead of joining the waitlist.`,
            };
          }

          coursesToWaitlist.push(course);
        }

        let registrationRecord: {
          id: number;
          registration_code: string;
          created_at: string;
          total_credits: number;
        } | null = null;

        const year = new Date().getFullYear();
        const random4 = Math.floor(1000 + Math.random() * 9000);
        const registrationCode = `REG-${year}-${student.student_code}-${random4}`;
        const nowIso = new Date().toISOString();

        if (coursesToRegister.length > 0) {
          const regResult = db
            .prepare(
              `INSERT INTO registrations (registration_code, student_id, created_at, total_credits)
               VALUES (?, ?, ?, ?)`
            )
            .run(registrationCode, student.id, nowIso, batchCredits);

          const regId = Number(regResult.lastInsertRowid);

          const updateSeatsStmt = db.prepare(
            `UPDATE courses
             SET available_seats = available_seats - 1
             WHERE id = ? AND available_seats > 0`
          );
          const insertRegItemStmt = db.prepare(
            `INSERT INTO registration_items (registration_id, course_id) VALUES (?, ?)`
          );
          const insertAcademicStmt = db.prepare(
            `INSERT INTO academic_records (student_id, course_id, status, grade, semester)
             VALUES (?, ?, 'REGISTERED', NULL, ?)`
          );

          for (const course of coursesToRegister) {
            const seatUpdate = updateSeatsStmt.run(course.id);
            if (seatUpdate.changes === 0) {
              throw {
                httpStatus: 409,
                code: 'SEAT_UNAVAILABLE',
                message: `The last seat in ${course.code} was just taken. You can join the waiting list.`,
                extra: { courseId: course.id, courseCode: course.code },
              };
            }
            insertRegItemStmt.run(regId, course.id);
            insertAcademicStmt.run(student.id, course.id, student.semester);

            // If student was previously on the waitlist for this course, mark it cancelled
            db.prepare(
              `UPDATE waitlist SET status = 'CANCELLED' WHERE student_id = ? AND course_id = ? AND status = 'WAITING'`
            ).run(student.id, course.id);
          }

          registrationRecord = {
            id: regId,
            registration_code: registrationCode,
            created_at: nowIso,
            total_credits: batchCredits,
          };
        }

        // Process waitlist additions
        const waitlistedResults: Array<{
          waitlistId: number;
          courseId: number;
          code: string;
          name: string;
          credits: number;
          faculty: string;
          schedule: string;
          position: number;
        }> = [];

        for (const wCourse of coursesToWaitlist) {
          const existingWaiting = db
            .prepare(
              `SELECT id, position FROM waitlist WHERE student_id = ? AND course_id = ? AND status = 'WAITING'`
            )
            .get(student.id, wCourse.id) as { id: number; position: number } | undefined;

          if (existingWaiting) {
            waitlistedResults.push({
              waitlistId: existingWaiting.id,
              courseId: wCourse.id,
              code: wCourse.code,
              name: wCourse.name,
              credits: wCourse.credits,
              faculty: wCourse.faculty,
              schedule: wCourse.schedule,
              position: existingWaiting.position,
            });
          } else {
            const maxPosRow = db
              .prepare(
                `SELECT COALESCE(MAX(position), 0) as maxPos FROM waitlist WHERE course_id = ? AND status = 'WAITING'`
              )
              .get(wCourse.id) as { maxPos: number };

            const nextPos = maxPosRow.maxPos + 1;
            const wlInfo = db
              .prepare(
                `INSERT INTO waitlist (student_id, course_id, position, created_at, status)
                 VALUES (?, ?, ?, ?, 'WAITING')`
              )
              .run(student.id, wCourse.id, nextPos, nowIso);

            waitlistedResults.push({
              waitlistId: Number(wlInfo.lastInsertRowid),
              courseId: wCourse.id,
              code: wCourse.code,
              name: wCourse.name,
              credits: wCourse.credits,
              faculty: wCourse.faculty,
              schedule: wCourse.schedule,
              position: nextPos,
            });
          }
        }

        const updatedCourses = coursesToRegister.map((c) => {
          const refreshed = db.prepare('SELECT * FROM courses WHERE id = ?').get(c.id) as CourseRow;
          return refreshed;
        });

        return {
          registration: registrationRecord || {
            id: 0,
            registration_code: registrationCode,
            created_at: nowIso,
            total_credits: 0,
          },
          registeredCourses: updatedCourses,
          waitlistedCourses: waitlistedResults,
          totalRegisteredCredits: projectedTotalCredits,
          batchCredits,
          student: {
            id: student.id,
            student_code: student.student_code,
            name: student.name,
            email: student.email,
            department: student.department,
            semester: student.semester,
            credit_limit: student.credit_limit,
          },
        };
      });

      const result = confirmTx();
      return res.status(201).json(result);
    } catch (err: any) {
      if (err && typeof err.httpStatus === 'number') {
        return sendError(res, err.httpStatus, err.code, err.message, err.extra);
      }
      console.error('Registration confirm error:', err);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to complete registration transaction.');
    }
  });

  // 7. GET /api/registration/my
  app.get('/api/registration/my', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const db = getDb();

    const registeredCourses = db
      .prepare(
        `SELECT c.*, ar.semester as registered_semester,
                (SELECT r.registration_code
                 FROM registrations r
                 JOIN registration_items ri ON ri.registration_id = r.id
                 WHERE r.student_id = ar.student_id AND ri.course_id = c.id
                 ORDER BY r.id DESC LIMIT 1) as registration_code,
                (SELECT r.created_at
                 FROM registrations r
                 JOIN registration_items ri ON ri.registration_id = r.id
                 WHERE r.student_id = ar.student_id AND ri.course_id = c.id
                 ORDER BY r.id DESC LIMIT 1) as registered_at
         FROM academic_records ar
         JOIN courses c ON c.id = ar.course_id
         WHERE ar.student_id = ? AND ar.status = 'REGISTERED'
         ORDER BY c.code ASC`
      )
      .all(student.id) as Array<
      CourseRow & {
        registered_semester: number;
        registration_code: string | null;
        registered_at: string | null;
      }
    >;

    const registrations = db
      .prepare(
        `SELECT id, registration_code, created_at, total_credits
         FROM registrations
         WHERE student_id = ?
         ORDER BY id DESC`
      )
      .all(student.id);

    const totalCredits = registeredCourses.reduce((sum, c) => sum + c.credits, 0);

    return res.json({
      registeredCourses,
      registrations,
      totalCredits,
      creditLimit: student.credit_limit,
    });
  });

  // 8. DELETE /api/registration/course/:courseId
  app.delete('/api/registration/course/:courseId', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const courseId = Number(req.params.courseId);
    if (Number.isNaN(courseId)) {
      return sendError(res, 400, 'INVALID_COURSE_ID', 'Valid courseId is required.');
    }

    const db = getDb();

    try {
      const dropTx = db.transaction(() => {
        const record = db
          .prepare(
            `SELECT id FROM academic_records WHERE student_id = ? AND course_id = ? AND status = 'REGISTERED'`
          )
          .get(student.id, courseId) as { id: number } | undefined;

        if (!record) {
          throw {
            httpStatus: 404,
            code: 'NOT_REGISTERED',
            message: 'You are not currently registered for this course.',
          };
        }

        const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as CourseRow;

        // Delete from academic_records
        db.prepare(`DELETE FROM academic_records WHERE id = ?`).run(record.id);

        // Remove from registration_items for this student
        const studentRegs = db
          .prepare(`SELECT id FROM registrations WHERE student_id = ?`)
          .all(student.id) as Array<{ id: number }>;
        for (const r of studentRegs) {
          db.prepare(`DELETE FROM registration_items WHERE registration_id = ? AND course_id = ?`).run(
            r.id,
            courseId
          );
        }

        // Increment available seats
        db.prepare(
          `UPDATE courses SET available_seats = MIN(total_seats, available_seats + 1) WHERE id = ?`
        ).run(courseId);

        // Check waiting list for this course to auto-promote the first eligible student
        let promotedStudent: { student_code: string; name: string } | null = null;
        const waitingQueue = db
          .prepare(
            `SELECT w.id, w.student_id, w.position, s.student_code, s.name, s.semester, s.credit_limit
             FROM waitlist w
             JOIN students s ON s.id = w.student_id
             WHERE w.course_id = ? AND w.status = 'WAITING'
             ORDER BY w.position ASC`
          )
          .all(courseId) as Array<{
          id: number;
          student_id: number;
          position: number;
          student_code: string;
          name: string;
          semester: number;
          credit_limit: number;
        }>;

        for (const candidate of waitingQueue) {
          const candidateState = getStudentCourseState(candidate.student_id);
          const prereqCheck = getPrerequisitesForCourse(courseId, candidateState.completedIds);

          if (
            !candidateState.registeredIds.has(courseId) &&
            prereqCheck.passed &&
            candidateState.currentRegisteredCredits + course.credits <= candidate.credit_limit
          ) {
            // Promote this student!
            db.prepare(`UPDATE waitlist SET status = 'PROMOTED' WHERE id = ?`).run(candidate.id);
            db.prepare(`UPDATE courses SET available_seats = available_seats - 1 WHERE id = ?`).run(courseId);

            const nowIso = new Date().toISOString();
            const year = new Date().getFullYear();
            const rand4 = Math.floor(1000 + Math.random() * 9000);
            const promoCode = `REG-${year}-${candidate.student_code}-${rand4}`;

            const regInfo = db
              .prepare(
                `INSERT INTO registrations (registration_code, student_id, created_at, total_credits)
                 VALUES (?, ?, ?, ?)`
              )
              .run(promoCode, candidate.student_id, nowIso, course.credits);

            db.prepare(`INSERT INTO registration_items (registration_id, course_id) VALUES (?, ?)`).run(
              Number(regInfo.lastInsertRowid),
              courseId
            );

            db.prepare(
              `INSERT INTO academic_records (student_id, course_id, status, grade, semester)
               VALUES (?, ?, 'REGISTERED', NULL, ?)`
            ).run(candidate.student_id, courseId, candidate.semester);

            promotedStudent = {
              student_code: candidate.student_code,
              name: candidate.name,
            };
            break;
          }
        }

        // Re-normalize remaining WAITING positions for this course
        const remainingWaiters = db
          .prepare(`SELECT id FROM waitlist WHERE course_id = ? AND status = 'WAITING' ORDER BY position ASC`)
          .all(courseId) as Array<{ id: number }>;

        remainingWaiters.forEach((w, idx) => {
          db.prepare(`UPDATE waitlist SET position = ? WHERE id = ?`).run(idx + 1, w.id);
        });

        const updatedCourse = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as CourseRow;

        return {
          droppedCourse: updatedCourse,
          promotedStudent,
        };
      });

      const result = dropTx();
      return res.json({
        message: result.promotedStudent
          ? `Dropped ${result.droppedCourse.code}. First waitlisted student (${result.promotedStudent.name}) was automatically promoted.`
          : `Successfully dropped ${result.droppedCourse.code} (${result.droppedCourse.name}).`,
        ...result,
      });
    } catch (err: any) {
      if (err && typeof err.httpStatus === 'number') {
        return sendError(res, err.httpStatus, err.code, err.message);
      }
      console.error('Drop course error:', err);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to drop course.');
    }
  });

  // 9. GET /api/waitlist/my
  app.get('/api/waitlist/my', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const db = getDb();

    const waitlistEntries = db
      .prepare(
        `SELECT w.id, w.course_id, w.position, w.created_at, w.status,
                c.code, c.name, c.credits, c.faculty, c.department, c.schedule, c.available_seats, c.total_seats
         FROM waitlist w
         JOIN courses c ON c.id = w.course_id
         WHERE w.student_id = ? AND w.status IN ('WAITING', 'PROMOTED')
         ORDER BY w.status ASC, w.position ASC`
      )
      .all(student.id);

    return res.json({
      waitlist: waitlistEntries,
    });
  });

  // 10. POST /api/waitlist/join
  app.post('/api/waitlist/join', requireAuth, (req: Request, res: Response) => {
    const parsed = joinWaitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Valid courseId is required.');
    }

    const student = req.student!;
    const { courseId } = parsed.data;
    const db = getDb();

    const course = db
      .prepare('SELECT * FROM courses WHERE id = ? AND semester = ?')
      .get(courseId, student.semester) as CourseRow | undefined;

    if (!course) {
      return sendError(res, 404, 'COURSE_NOT_FOUND', 'Course not found.');
    }

    const state = getStudentCourseState(student.id);
    if (state.registeredIds.has(course.id)) {
      return sendError(res, 409, 'ALREADY_REGISTERED', `You are already registered for ${course.code}.`);
    }

    const prereqCheck = getPrerequisitesForCourse(course.id, state.completedIds);
    if (!prereqCheck.passed) {
      const missingStr = prereqCheck.missing.map((m) => m.code).join(', ');
      return sendError(
        res,
        400,
        'PREREQUISITE_MISSING',
        `Cannot join waiting list for ${course.code}: unmet prerequisite (${missingStr}).`
      );
    }

    if (course.available_seats > 0) {
      return sendError(
        res,
        400,
        'COURSE_NOT_FULL',
        `${course.code} still has ${course.available_seats} seat(s) available. You can register directly.`
      );
    }

    const existing = db
      .prepare(`SELECT id, position FROM waitlist WHERE student_id = ? AND course_id = ? AND status = 'WAITING'`)
      .get(student.id, course.id) as { id: number; position: number } | undefined;

    if (existing) {
      return res.json({
        message: `You are already on the waiting list for ${course.code} at position #${existing.position}.`,
        entry: {
          id: existing.id,
          course_id: course.id,
          code: course.code,
          name: course.name,
          position: existing.position,
          status: 'WAITING',
        },
      });
    }

    const maxPosRow = db
      .prepare(`SELECT COALESCE(MAX(position), 0) as maxPos FROM waitlist WHERE course_id = ? AND status = 'WAITING'`)
      .get(course.id) as { maxPos: number };

    const position = maxPosRow.maxPos + 1;
    const nowIso = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO waitlist (student_id, course_id, position, created_at, status)
         VALUES (?, ?, ?, ?, 'WAITING')`
      )
      .run(student.id, course.id, position, nowIso);

    return res.status(201).json({
      message: `Joined waiting list for ${course.code} (${course.name}) at queue position #${position}.`,
      entry: {
        id: Number(info.lastInsertRowid),
        course_id: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        faculty: course.faculty,
        schedule: course.schedule,
        position,
        status: 'WAITING',
        created_at: nowIso,
      },
    });
  });

  // 11. DELETE /api/waitlist/:id
  app.delete('/api/waitlist/:id', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const waitlistId = Number(req.params.id);
    if (Number.isNaN(waitlistId)) {
      return sendError(res, 400, 'INVALID_ID', 'Valid waitlist ID is required.');
    }

    const db = getDb();
    const existing = db
      .prepare(`SELECT * FROM waitlist WHERE id = ? AND student_id = ? AND status = 'WAITING'`)
      .get(waitlistId, student.id) as { id: number; course_id: number; position: number } | undefined;

    if (!existing) {
      return sendError(res, 404, 'WAITLIST_NOT_FOUND', 'Active waitlist entry not found.');
    }

    const cancelTx = db.transaction(() => {
      db.prepare(`UPDATE waitlist SET status = 'CANCELLED' WHERE id = ?`).run(waitlistId);

      const remaining = db
        .prepare(`SELECT id FROM waitlist WHERE course_id = ? AND status = 'WAITING' ORDER BY position ASC`)
        .all(existing.course_id) as Array<{ id: number }>;

      remaining.forEach((row, idx) => {
        db.prepare(`UPDATE waitlist SET position = ? WHERE id = ?`).run(idx + 1, row.id);
      });
    });

    cancelTx();

    return res.json({
      message: 'Removed from waiting list.',
      id: waitlistId,
    });
  });

  // 12. GET /api/academic-record
  app.get('/api/academic-record', requireAuth, (req: Request, res: Response) => {
    const student = req.student!;
    const db = getDb();

    const records = db
      .prepare(
        `SELECT ar.id, ar.course_id, ar.status, ar.grade, ar.semester,
                c.code, c.name, c.credits, c.faculty, c.department, c.schedule
         FROM academic_records ar
         JOIN courses c ON c.id = ar.course_id
         WHERE ar.student_id = ?
         ORDER BY ar.semester ASC, c.code ASC`
      )
      .all(student.id) as Array<{
      id: number;
      course_id: number;
      status: 'COMPLETED' | 'REGISTERED';
      grade: string | null;
      semester: number;
      code: string;
      name: string;
      credits: number;
      faculty: string;
      department: string;
      schedule: string;
    }>;

    const completed = records.filter((r) => r.status === 'COMPLETED');
    const registered = records.filter((r) => r.status === 'REGISTERED');

    const completedCredits = completed.reduce((acc, r) => acc + r.credits, 0);
    const registeredCredits = registered.reduce((acc, r) => acc + r.credits, 0);

    const gradePoints: Record<string, number> = {
      'A+': 10,
      A: 9,
      'B+': 8,
      B: 7,
      C: 6,
      P: 5,
    };

    let weightedSum = 0;
    let gradedCredits = 0;
    for (const c of completed) {
      const gp = c.grade ? gradePoints[c.grade] ?? 9 : 9;
      weightedSum += gp * c.credits;
      gradedCredits += c.credits;
    }

    const cgpa = gradedCredits > 0 ? Number((weightedSum / gradedCredits).toFixed(2)) : 0;

    return res.json({
      completed,
      registered,
      summary: {
        completedCoursesCount: completed.length,
        registeredCoursesCount: registered.length,
        completedCredits,
        registeredCredits,
        creditLimit: student.credit_limit,
        cgpa,
      },
    });
  });

  // 13. POST /api/demo/reset (Restores initial demo state for convenient live demonstrations)
  app.post('/api/demo/reset', requireAuth, (_req: Request, res: Response) => {
    seedDatabase(undefined, true);
    return res.json({
      message: 'Database reset to clean initial demo state.',
    });
  });

  return app;
}
