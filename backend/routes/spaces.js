const express = require('express');
const router = express.Router();
const { db, upperKeys, nextId, asyncRoute } = require('../services/common');
const { Checker, parseId, AppError } = require('../validation');

// GET all spaces (same columns + aliases as the original Oracle route)
router.get('/', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (s:CoworkingSpace)
    RETURN s.space_id AS space_id, s.space_name AS space_name, s.space_name AS name,
           s.address AS address, s.address AS street, s.city AS city, s.state AS state, s.pin AS pin
    ORDER BY space_id ASC`);
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

function readSpace(body) {
  const c = new Checker();
  const space = {
    space_name: c.str(body.space_name ?? body.name, 'Space name', { required: true, max: 100 }), // NOT NULL
    address: c.str(body.address ?? body.street, 'Address', { max: 150 }),
    city: c.str(body.city, 'City', { required: true, max: 50 }),                                  // NOT NULL
    state: c.str(body.state, 'State', { max: 50 }) ?? 'Tamil Nadu',                                // DEFAULT 'Tamil Nadu'
    pin: c.str(body.pin, 'PIN', { max: 10 })
  };
  c.done();
  return space;
}

// POST add space (Insert button)
router.post('/', asyncRoute(async (req, res) => {
  const space = readSpace(req.body);
  const { value, executed } = await db.writeTransaction(async run => {
    const space_id = await nextId(run, 'SEQ_SPACES');
    await run(`
      CREATE (s:CoworkingSpace {space_id: $space_id, space_name: $space_name, address: $address,
                                city: $city, state: $state, pin: $pin, created_at: datetime()})`,
      { space_id: db.int(space_id), ...space });
    return space_id;
  });
  res.status(201).json({ success: true, message: 'Coworking Space added successfully in Neo4j!', id: value, cypher: executed });
}));

// PUT update space (Update button)
router.put('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'space_id');
  const space = readSpace(req.body);
  const result = await db.write(`
    MATCH (s:CoworkingSpace {space_id: $id})
    SET s.space_name = $space_name, s.address = $address, s.city = $city, s.state = $state, s.pin = $pin
    RETURN s.space_id AS space_id`, { id: db.int(id), ...space });
  if (!result.rows.length) throw new AppError(404, `Coworking Space #${id} not found`);
  res.json({ success: true, message: 'Coworking Space updated successfully!', cypher: [result.cypher] });
}));

// DELETE space - reproduces ON DELETE CASCADE:
// COWORKING_SPACES -> MEETING_ROOMS -> (ROOM_FACILITIES, BOOKINGS -> PAYMENTS)
router.delete('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'space_id');
  const result = await db.write(`
    MATCH (s:CoworkingSpace {space_id: $id})
    OPTIONAL MATCH (s)-[:CONTAINS]->(r:MeetingRoom)
    OPTIONAL MATCH (r)-[:HAS_FACILITY]->(f:Facility)
    OPTIONAL MATCH (b:Booking)-[:BOOKED_IN]->(r)
    OPTIONAL MATCH (b)-[:PAID_BY]->(p:Payment)
    WITH s, collect(DISTINCT r) + collect(DISTINCT f) + collect(DISTINCT b) + collect(DISTINCT p) AS dependents
    FOREACH (n IN dependents | DETACH DELETE n)
    DETACH DELETE s
    RETURN size(dependents) AS cascaded`, { id: db.int(id) });
  if (!result.rows.length) throw new AppError(404, `Coworking Space #${id} not found`);
  res.json({
    success: true,
    message: `Coworking Space deleted successfully! (${result.counters.nodesDeleted} nodes removed by cascade)`,
    counters: result.counters, cypher: [result.cypher]
  });
}));

module.exports = router;
