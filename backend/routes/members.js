const express = require('express');
const router = express.Router();
const { db, upperKeys, nextId, asyncRoute } = require('../services/common');
const { Checker, parseId, AppError, MEMBER_STATUSES } = require('../validation');

// Equivalent of the Oracle view VW_MEMBERS_FULL (PERSON JOIN MEMBERS LEFT JOIN MEMBERSHIP_PLANS):
// in the graph the PERSON superclass and MEMBERS subclass are the same node.
const MEMBER_COLUMNS = `
    m.member_id AS member_id, m.person_id AS person_id, m.first_name AS first_name, m.middle_name AS middle_name,
    m.last_name AS last_name, m.email AS email, m.phone AS phone, m.street AS street, m.city AS city,
    m.state AS state, m.pin AS pin, pl.plan_id AS plan_id, pl.plan_name AS plan_name,
    pl.monthly_fee AS monthly_fee, toString(m.join_date) AS join_date, m.status AS status`;

// GET all members with Person details and Membership Plan
router.get('/', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (m:Person:Member)
    OPTIONAL MATCH (m)-[:HAS_PLAN]->(pl:MembershipPlan)
    RETURN ${MEMBER_COLUMNS}
    ORDER BY member_id ASC`);
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

// GET membership plans
router.get('/plans', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (p:MembershipPlan)
    RETURN p.plan_id AS plan_id, p.plan_name AS plan_name, p.monthly_fee AS monthly_fee, p.duration_months AS duration_months
    ORDER BY plan_id ASC`);
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

function readMember(body, { forUpdate = false } = {}) {
  const c = new Checker();
  const m = {
    first_name: c.str(body.first_name, 'First name', { required: true, max: 50 }),   // NOT NULL
    middle_name: c.str(body.middle_name, 'Middle name', { max: 50 }),
    last_name: c.str(body.last_name, 'Last name', { required: true, max: 50 }),      // NOT NULL
    email: c.email(body.email, 'Email', { required: true }),                          // UNIQUE NOT NULL (constraint in Neo4j)
    phone: c.str(body.phone, 'Phone', { max: 20 }),
    street: c.str(body.street, 'Street', { max: 150 }),
    city: c.str(body.city, 'City', { max: 50 }),
    plan_id: c.id(body.plan_id, 'Plan', { required: false }),
    status: c.oneOf(body.status, 'Status', MEMBER_STATUSES, { fallback: forUpdate ? null : 'ACTIVE' })
  };
  c.done();
  return m;
}

async function assertPlan(run, planId) {
  if (planId === null) return;
  const plan = await run('MATCH (p:MembershipPlan {plan_id: $plan_id}) RETURN p.plan_id AS id', { plan_id: db.int(planId) });
  if (!plan.rows.length) throw new AppError(400, `Membership plan #${planId} does not exist`); // fk_member_plan
}

// POST add member (PERSON superclass + MEMBERS subclass = one :Person:Member node)
router.post('/', asyncRoute(async (req, res) => {
  const m = readMember(req.body);
  const { value, executed } = await db.writeTransaction(async run => {
    await assertPlan(run, m.plan_id);
    const person_id = await nextId(run, 'SEQ_PERSON');
    const member_id = await nextId(run, 'SEQ_MEMBERS');
    await run(`
      CREATE (p:Person:Member {person_id: $person_id, member_id: $member_id,
              first_name: $first_name, middle_name: $middle_name, last_name: $last_name, email: $email,
              phone: $phone, street: $street, city: $city, state: 'Tamil Nadu',
              join_date: date(), status: $status, created_at: datetime()})
      WITH p
      OPTIONAL MATCH (pl:MembershipPlan {plan_id: $plan_id})
      FOREACH (_ IN CASE WHEN pl IS NULL THEN [] ELSE [1] END | CREATE (p)-[:HAS_PLAN]->(pl))`,
      {
        ...m, city: m.city ?? 'Chennai', // original route defaulted city to 'Chennai'
        person_id: db.int(person_id), member_id: db.int(member_id),
        plan_id: m.plan_id === null ? null : db.int(m.plan_id)
      });
    return member_id;
  });
  res.status(201).json({ success: true, message: 'Member registered successfully as a :Person:Member node!', id: value, cypher: executed });
}));

// PUT update member (PERSON fields + MEMBERS plan/status)
router.put('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'member_id');
  const m = readMember(req.body, { forUpdate: true });
  const { value, executed } = await db.writeTransaction(async run => {
    await assertPlan(run, m.plan_id);
    const updated = await run(`
      MATCH (p:Member {member_id: $member_id})
      SET p.first_name = $first_name, p.last_name = $last_name, p.email = $email, p.phone = $phone,
          p.middle_name = CASE WHEN $middle_name_given THEN $middle_name ELSE p.middle_name END,
          p.status = coalesce($status, p.status)
      WITH p
      OPTIONAL MATCH (p)-[old:HAS_PLAN]->(:MembershipPlan)
      DELETE old
      WITH DISTINCT p
      OPTIONAL MATCH (pl:MembershipPlan {plan_id: $plan_id})
      FOREACH (_ IN CASE WHEN pl IS NULL THEN [] ELSE [1] END | CREATE (p)-[:HAS_PLAN]->(pl))
      RETURN p.member_id AS member_id`,
      {
        ...m, member_id: db.int(id), middle_name_given: req.body.middle_name !== undefined,
        plan_id: m.plan_id === null ? null : db.int(m.plan_id)
      });
    return updated.rows.length;
  });
  if (!value) throw new AppError(404, `Member #${id} not found`);
  res.json({ success: true, message: 'Member details updated successfully!', cypher: executed });
}));

// DELETE member - original deleted the PERSON row, cascading to MEMBERS -> BOOKINGS -> PAYMENTS
router.delete('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'member_id');
  const result = await db.write(`
    MATCH (p:Member {member_id: $id})
    OPTIONAL MATCH (p)-[:MADE]->(b:Booking)
    OPTIONAL MATCH (b)-[:PAID_BY]->(pay:Payment)
    WITH p, collect(DISTINCT b) + collect(DISTINCT pay) AS dependents
    FOREACH (n IN dependents | DETACH DELETE n)
    DETACH DELETE p
    RETURN size(dependents) AS cascaded`, { id: db.int(id) });
  if (!result.rows.length) throw new AppError(404, `Member #${id} not found`);
  res.json({
    success: true,
    message: `Member deleted successfully! (${result.counters.nodesDeleted} nodes removed by cascade)`,
    counters: result.counters, cypher: [result.cypher]
  });
}));

module.exports = router;
