const test = require('node:test');
const assert = require('node:assert/strict');
const { Checker, parseId, ROOM_TYPES, PAYMENT_METHODS } = require('../../backend/validation');

function errorsOf(fn) {
  try { fn(); return []; } catch (e) { return e.details || [e.message]; }
}

test('enumerations match the Oracle CHECK constraints', () => {
  assert.deepEqual(ROOM_TYPES, ['Conference Room', 'Meeting Pod', 'Boardroom Elite', 'Hot Desk Lounge', 'Training Hall']);
  assert.deepEqual(PAYMENT_METHODS, ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Corporate Account', 'Cash']);
});

test('capacity and hourly_rate must be > 0 (chk_room_capacity, chk_room_rate)', () => {
  const errs = errorsOf(() => {
    const c = new Checker();
    c.num(0, 'Capacity', { integer: true, min: 0, minExclusive: true, max: 9999 });
    c.num(-5, 'Hourly rate', { min: 0, minExclusive: true });
    c.done();
  });
  assert.equal(errs.length, 2);
});

test('NOT NULL and VARCHAR2 length limits', () => {
  const errs = errorsOf(() => {
    const c = new Checker();
    c.str('', 'First name', { required: true, max: 50 });
    c.str('x'.repeat(51), 'Last name', { required: true, max: 50 });
    c.done();
  });
  assert.deepEqual(errs, ['First name is required', 'Last name must be at most 50 characters']);
});

test('date and time formats', () => {
  const c = new Checker();
  assert.equal(c.date('2026-02-28', 'd'), '2026-02-28');
  assert.equal(c.time('09:30', 't'), '09:30');
  c.date('2026-02-30', 'd');
  c.time('9:30', 't');
  c.time('24:00', 't');
  assert.equal(c.errors.length, 3);
});

test('parseId rejects non-positive and non-integer ids', () => {
  assert.equal(parseId('301'), 301);
  for (const bad of ['0', '-1', '3.5', 'abc', '1 OR 1=1']) assert.throws(() => parseId(bad));
});

test('money is rounded to 2 decimals (NUMBER(10,2))', () => {
  assert.equal(new Checker().num('1234.567', 'amt'), 1234.57);
});
