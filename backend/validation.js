// ====================================================================
// WorkSphere DA-3 - business-rule validation
// Neo4j Community has no CHECK / NOT NULL / type constraints, so the
// rules from the ORIGINAL database/schema_oracle.sql are enforced here.
// Each rule cites the Oracle constraint it reproduces.
// ====================================================================

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// --- Enumerations copied from the Oracle CHECK constraints ---
const ROOM_TYPES = ['Conference Room', 'Meeting Pod', 'Boardroom Elite', 'Hot Desk Lounge', 'Training Hall']; // chk_room_type
const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'];            // chk_room_status
const MEMBER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];               // MEMBERS.status CHECK
const BOOKING_STATUSES = ['CONFIRMED', 'CANCELLED', 'COMPLETED'];          // chk_booking_status
const PAYMENT_METHODS = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Corporate Account', 'Cash']; // chk_payment_method
const PAYMENT_STATUSES = ['COMPLETED', 'PENDING', 'FAILED'];               // chk_payment_status

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

// Collects errors for one request so the client sees all problems at once.
class Checker {
  constructor() { this.errors = []; }

  fail(msg) { this.errors.push(msg); }

  // VARCHAR2(n) [NOT NULL]
  str(value, field, { required = false, max = 100 } = {}) {
    if (isBlank(value)) {
      if (required) this.fail(`${field} is required`);
      return null;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      this.fail(`${field} must be text`);
      return null;
    }
    const s = String(value).trim();
    if (s.length > max) this.fail(`${field} must be at most ${max} characters`);
    return s;
  }

  // NUMBER(p,s) with bounds
  num(value, field, { required = false, min = null, minExclusive = false, max = null, integer = false, scale = 2 } = {}) {
    if (isBlank(value)) {
      if (required) this.fail(`${field} is required`);
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) { this.fail(`${field} must be a number`); return null; }
    if (integer && !Number.isInteger(n)) { this.fail(`${field} must be a whole number`); return null; }
    if (min !== null && (minExclusive ? n <= min : n < min)) {
      this.fail(`${field} must be ${minExclusive ? 'greater than' : 'at least'} ${min}`);
    }
    if (max !== null && n > max) this.fail(`${field} must be at most ${max}`);
    return integer ? n : Math.round(n * 10 ** scale) / 10 ** scale;
  }

  id(value, field, { required = true } = {}) {
    return this.num(value, field, { required, integer: true, min: 1, max: Number.MAX_SAFE_INTEGER });
  }

  oneOf(value, field, allowed, { required = false, fallback = null } = {}) {
    if (isBlank(value)) {
      if (required) this.fail(`${field} is required`);
      return fallback;
    }
    if (!allowed.includes(value)) {
      this.fail(`${field} must be one of: ${allowed.join(', ')}`);
      return null;
    }
    return value;
  }

  // BOOKINGS.booking_date is VARCHAR2(20) holding 'YYYY-MM-DD' in the original seed and UI.
  date(value, field, { required = false } = {}) {
    const s = this.str(value, field, { required, max: 20 });
    if (s === null) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!m || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
      this.fail(`${field} must be a valid date in YYYY-MM-DD format`);
      return null;
    }
    return s;
  }

  // BOOKINGS.start_time / end_time are VARCHAR2(10) 'HH:MM'. The overlap rule compares
  // them as strings (exactly like TRG_CHECK_ROOM_OVERLAP), so the format must be strict.
  time(value, field, { required = false } = {}) {
    const s = this.str(value, field, { required, max: 10 });
    if (s === null) return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) {
      this.fail(`${field} must be a time in 24-hour HH:MM format`);
      return null;
    }
    return s;
  }

  email(value, field, { required = false } = {}) {
    const s = this.str(value, field, { required, max: 100 });
    if (s !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) this.fail(`${field} must be a valid email address`);
    return s;
  }

  done() {
    if (this.errors.length) throw new AppError(400, this.errors.join('; '), this.errors);
  }
}

function parseId(value, field = 'id') {
  const c = new Checker();
  const id = c.id(value, field);
  c.done();
  return id;
}

module.exports = {
  AppError, Checker, parseId, isBlank,
  ROOM_TYPES, ROOM_STATUSES, MEMBER_STATUSES, BOOKING_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES
};
