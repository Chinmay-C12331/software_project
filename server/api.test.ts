import Database from 'better-sqlite3';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { closeDb, initializeSchema, setDbInstance } from './db.ts';
import { seedDatabase } from './seed.ts';

describe('College Course Registration System — Pre-Deployment Verification Suite', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const memoryDb = new Database(':memory:');
    memoryDb.pragma('foreign_keys = ON');
    initializeSchema(memoryDb);
    setDbInstance(memoryDb);
    seedDatabase(memoryDb, true);
    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  it('1. authenticates all 5 seeded students, verifies /api/auth/me, and rejects invalid credentials', async () => {
    const expectedStudents = [
      { code: '20241CSE0837', name: 'Shalini K' },
      { code: '20241CSE0838', name: 'Sahana H C' },
      { code: '20241CSE0839', name: 'Ranjan Gowda N' },
      { code: '20241CSE0840', name: 'Ayaj Rajak Valasang' },
      { code: '20241CSE0841', name: 'Chinmay J C' },
    ];

    for (const s of expectedStudents) {
      const res = await request(app).post('/api/auth/login').send({
        studentCode: s.code,
        password: 'student123',
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.student.name).toBe(s.name);

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.student.student_code).toBe(s.code);
    }

    const badRes = await request(app).post('/api/auth/login').send({
      studentCode: '20241CSE0837',
      password: 'wrongpassword',
    });
    expect(badRes.status).toBe(401);
    expect(badRes.body.error.code).toBe('INVALID_CREDENTIALS');

    const emptyRes = await request(app).post('/api/auth/login').send({
      studentCode: '',
      password: '',
    });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2. enforces prerequisite rules across students with different academic histories', async () => {
    // Shalini (missing MA201 -> CS401 blocked)
    const shaliniLogin = await request(app).post('/api/auth/login').send({
      studentCode: '20241CSE0837',
      password: 'student123',
    });
    const shaliniToken = shaliniLogin.body.token;

    const coursesRes = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${shaliniToken}`);
    expect(coursesRes.status).toBe(200);
    expect(coursesRes.body.courses).toHaveLength(12);

    const cs401 = coursesRes.body.courses.find((c: any) => c.code === 'CS401');
    expect(cs401.eligibilityStatus).toBe('PREREQUISITE_MISSING');
    expect(cs401.missingPrerequisites.map((m: any) => m.code)).toContain('MA201');

    // Validate & Confirm block CS401 for Shalini
    const validateRes = await request(app)
      .post('/api/registration/validate')
      .set('Authorization', `Bearer ${shaliniToken}`)
      .send({ courseIds: [cs401.id] });
    expect(validateRes.body.valid).toBe(false);
    expect(validateRes.body.courses[0].status).toBe('PREREQUISITE_MISSING');

    const confirmRes = await request(app)
      .post('/api/registration/confirm')
      .set('Authorization', `Bearer ${shaliniToken}`)
      .send({ courseIds: [cs401.id], waitlistCourseIds: [] });
    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.error.code).toBe('PREREQUISITE_MISSING');

    // Chinmay J C (completed MA201 -> CS401 eligible!)
    const chinmayLogin = await request(app).post('/api/auth/login').send({
      studentCode: '20241CSE0841',
      password: 'student123',
    });
    const chinmayCourses = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${chinmayLogin.body.token}`);
    const chinmayCs401 = chinmayCourses.body.courses.find((c: any) => c.code === 'CS401');
    expect(chinmayCs401.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('3. handles full course (CS305) waiting list join, viewing, and cancellation', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      studentCode: '20241CSE0837',
      password: 'student123',
    });
    const token = loginRes.body.token;

    const coursesRes = await request(app)
      .get('/api/courses?availability=full')
      .set('Authorization', `Bearer ${token}`);
    expect(coursesRes.body.courses).toHaveLength(1);
    const cs305 = coursesRes.body.courses[0];
    expect(cs305.code).toBe('CS305');
    expect(cs305.available_seats).toBe(0);

    // Join waitlist
    const joinRes = await request(app)
      .post('/api/waitlist/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId: cs305.id });
    expect(joinRes.status).toBe(201);
    expect(joinRes.body.entry.position).toBe(2);

    // Check /api/waitlist/my
    const myWaitlist = await request(app)
      .get('/api/waitlist/my')
      .set('Authorization', `Bearer ${token}`);
    expect(myWaitlist.status).toBe(200);
    expect(myWaitlist.body.waitlist).toHaveLength(1);
    expect(myWaitlist.body.waitlist[0].position).toBe(2);

    // Leave waitlist
    const delRes = await request(app)
      .delete(`/api/waitlist/${joinRes.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
  });

  it('4. blocks registration when selected courses exceed the 24-credit limit', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      studentCode: '20241CSE0841',
      password: 'student123',
    });
    const token = loginRes.body.token;

    const coursesRes = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${token}`);

    const eligibleFourCredit = coursesRes.body.courses.filter(
      (c: any) => c.eligibilityStatus === 'ELIGIBLE' && c.credits >= 3
    );
    const sevenIds = eligibleFourCredit.slice(0, 7).map((c: any) => c.id);

    const validateRes = await request(app)
      .post('/api/registration/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseIds: sevenIds });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.creditCheck.exceeded).toBe(true);
    expect(validateRes.body.creditCheck.total).toBeGreaterThan(24);
    expect(validateRes.body.valid).toBe(false);

    const confirmRes = await request(app)
      .post('/api/registration/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseIds: sevenIds, waitlistCourseIds: [] });

    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.error.code).toBe('CREDIT_LIMIT_EXCEEDED');
  });

  it('5. completes registration, decrements seats, updates academic record, and promotes waitlisted student on drop', async () => {
    // 1. Chinmay registers for CS301 and CS306 (which has only 1 seat left!)
    const chinmayLogin = await request(app).post('/api/auth/login').send({
      studentCode: '20241CSE0841',
      password: 'student123',
    });
    const chinmayToken = chinmayLogin.body.token;

    const coursesRes = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${chinmayToken}`);
    const cs301 = coursesRes.body.courses.find((c: any) => c.code === 'CS301');
    const cs306 = coursesRes.body.courses.find((c: any) => c.code === 'CS306');
    expect(cs306.available_seats).toBe(1);

    const confirmRes = await request(app)
      .post('/api/registration/confirm')
      .set('Authorization', `Bearer ${chinmayToken}`)
      .send({ courseIds: [cs301.id, cs306.id], waitlistCourseIds: [] });

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.registration.registration_code).toMatch(/^REG-\d{4}-20241CSE0841-\d{4}$/);

    // Verify CS306 now has 0 seats left
    const singleCourseRes = await request(app)
      .get(`/api/courses/${cs306.id}`)
      .set('Authorization', `Bearer ${chinmayToken}`);
    expect(singleCourseRes.body.course.available_seats).toBe(0);

    // 2. Shalini tries to register for CS306 (now 0 seats) -> gets 409 SEAT_UNAVAILABLE, then joins waitlist
    const shaliniLogin = await request(app).post('/api/auth/login').send({
      studentCode: '20241CSE0837',
      password: 'student123',
    });
    const shaliniToken = shaliniLogin.body.token;

    const conflictRes = await request(app)
      .post('/api/registration/confirm')
      .set('Authorization', `Bearer ${shaliniToken}`)
      .send({ courseIds: [cs306.id], waitlistCourseIds: [] });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('SEAT_UNAVAILABLE');

    const wlJoinRes = await request(app)
      .post('/api/waitlist/join')
      .set('Authorization', `Bearer ${shaliniToken}`)
      .send({ courseId: cs306.id });
    expect(wlJoinRes.status).toBe(201);
    expect(wlJoinRes.body.entry.position).toBe(1);

    // 3. Chinmay drops CS306 -> Shalini is automatically promoted from waitlist to REGISTERED!
    const dropRes = await request(app)
      .delete(`/api/registration/course/${cs306.id}`)
      .set('Authorization', `Bearer ${chinmayToken}`);
    expect(dropRes.status).toBe(200);
    expect(dropRes.body.promotedStudent?.student_code).toBe('20241CSE0837');

    // Verify Shalini's academic record now shows CS306 as REGISTERED
    const shaliniRecord = await request(app)
      .get('/api/academic-record')
      .set('Authorization', `Bearer ${shaliniToken}`);
    expect(shaliniRecord.status).toBe(200);
    expect(shaliniRecord.body.registered.map((r: any) => r.code)).toContain('CS306');
  });
});
