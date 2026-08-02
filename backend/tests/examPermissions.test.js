const { canManageExam } = require('../src/services/examService');

const ADMIN = { id: 'u-admin', role: 'ADMIN' };
const STAFF_A = { id: 'u-a', role: 'STAFF' };
const STAFF_B = { id: 'u-b', role: 'STAFF' };

describe('canManageExam (exam ownership)', () => {
  it('lets an admin manage any exam', () => {
    expect(canManageExam({ createdById: 'someone-else' }, ADMIN)).toBe(true);
    expect(canManageExam({ createdById: null }, ADMIN)).toBe(true);
  });

  it('lets staff manage only exams they created', () => {
    expect(canManageExam({ createdById: 'u-a' }, STAFF_A)).toBe(true);
    expect(canManageExam({ createdById: 'u-a' }, STAFF_B)).toBe(false);
    expect(canManageExam({ createdById: null }, STAFF_A)).toBe(false);
  });

  it('is false for missing exam or user', () => {
    expect(canManageExam(null, ADMIN)).toBe(false);
    expect(canManageExam({ createdById: 'u-a' }, null)).toBe(false);
  });
});
