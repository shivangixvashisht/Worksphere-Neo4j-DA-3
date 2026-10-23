const express = require('express');
const router = express.Router();
const { db, upperKeys, nextId, asyncRoute } = require('../services/common');
const { Checker, parseId, AppError, ROOM_TYPES, ROOM_STATUSES } = require('../validation');

// GET all rooms with space name and facilities.
// The original needed two SQL queries plus a JavaScript merge; here one traversal
// returns each room with its space, facilities and (DA-3) facility categories.
router.get('/', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom)
    OPTIONAL MATCH (r)-[:HAS_FACILITY]->(f:Facility)
    OPTIONAL MATCH (f)-[:IN_CATEGORY]->(c:FacilityCategory)
    WITH s, r, f, collect(c.name) AS cats
    ORDER BY f.facility_id
    WITH s, r, collect(f {.facility_id, .facility_name, .quantity, categories: cats}) AS facs
    RETURN r.room_id AS room_id, s.space_id AS space_id, r.room_name AS room_name, r.room_type AS room_type,
           r.capacity AS capacity, r.hourly_rate AS hourly_rate, r.status AS status,
           s.space_name AS space_name, s.city AS city,
           [x IN facs | x.facility_name] AS facilities,
           facs AS facility_details,
           reduce(acc = [], x IN facs | acc + [c IN x.categories WHERE NOT c IN acc]) AS facility_categories
    ORDER BY room_id ASC`);
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

function readRoom(body) {
  const c = new Checker();
  const room = {
    space_id: c.id(body.space_id, 'Space'),                                                          // NOT NULL FK
    room_name: c.str(body.room_name, 'Room name', { required: true, max: 100 }),
    room_type: c.oneOf(body.room_type, 'Room type', ROOM_TYPES, { required: true }),                 // chk_room_type
    capacity: c.num(body.capacity, 'Capacity', { required: true, integer: true, min: 0, minExclusive: true, max: 9999 }), // chk_room_capacity, NUMBER(4)
    hourly_rate: c.num(body.hourly_rate, 'Hourly rate', { required: true, min: 0, minExclusive: true, max: 999999.99 }),   // chk_room_rate, NUMBER(8,2)
    status: c.oneOf(body.status, 'Status', ROOM_STATUSES, { fallback: 'AVAILABLE' })                 // DEFAULT 'AVAILABLE'
  };
  c.done();
  return room;
}

function roomParams(room) {
  return { ...room, space_id: db.int(room.space_id), capacity: db.int(room.capacity) };
}

// POST add meeting room (Insert button)
router.post('/', asyncRoute(async (req, res) => {
  const room = readRoom(req.body);
  const { value, executed } = await db.writeTransaction(async run => {
    const space = await run('MATCH (s:CoworkingSpace {space_id: $space_id}) RETURN s.space_id AS id', roomParams(room));
    if (!space.rows.length) throw new AppError(400, `Coworking Space #${room.space_id} does not exist`); // fk_room_space
    const room_id = await nextId(run, 'SEQ_ROOMS');
    await run(`
      MATCH (s:CoworkingSpace {space_id: $space_id})
      CREATE (r:MeetingRoom {room_id: $room_id, room_name: $room_name, room_type: $room_type,
                             capacity: $capacity, hourly_rate: $hourly_rate, status: $status})
      CREATE (s)-[:CONTAINS]->(r)`, { ...roomParams(room), room_id: db.int(room_id) });
    return room_id;
  });
  res.status(201).json({ success: true, message: 'Meeting room added successfully in Neo4j!', id: value, cypher: executed });
}));

// PUT update meeting room (Update button) - may also move the room to another space
router.put('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'room_id');
  const room = readRoom(req.body);
  const { value, executed } = await db.writeTransaction(async run => {
    const space = await run('MATCH (s:CoworkingSpace {space_id: $space_id}) RETURN s.space_id AS id', roomParams(room));
    if (!space.rows.length) throw new AppError(400, `Coworking Space #${room.space_id} does not exist`);
    const updated = await run(`
      MATCH (r:MeetingRoom {room_id: $room_id})
      MATCH (newSpace:CoworkingSpace {space_id: $space_id})
      OPTIONAL MATCH (:CoworkingSpace)-[old:CONTAINS]->(r)
      DELETE old
      MERGE (newSpace)-[:CONTAINS]->(r)
      SET r.room_name = $room_name, r.room_type = $room_type, r.capacity = $capacity,
          r.hourly_rate = $hourly_rate, r.status = $status
      RETURN r.room_id AS room_id`, { ...roomParams(room), room_id: db.int(id) });
    return updated.rows.length;
  });
  if (!value) throw new AppError(404, `Meeting room #${id} not found`);
  res.json({ success: true, message: 'Meeting room updated successfully!', cypher: executed });
}));

// DELETE meeting room - ON DELETE CASCADE to ROOM_FACILITIES and BOOKINGS -> PAYMENTS
router.delete('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'room_id');
  const result = await db.write(`
    MATCH (r:MeetingRoom {room_id: $id})
    OPTIONAL MATCH (r)-[:HAS_FACILITY]->(f:Facility)
    OPTIONAL MATCH (b:Booking)-[:BOOKED_IN]->(r)
    OPTIONAL MATCH (b)-[:PAID_BY]->(p:Payment)
    WITH r, collect(DISTINCT f) + collect(DISTINCT b) + collect(DISTINCT p) AS dependents
    FOREACH (n IN dependents | DETACH DELETE n)
    DETACH DELETE r
    RETURN size(dependents) AS cascaded`, { id: db.int(id) });
  if (!result.rows.length) throw new AppError(404, `Meeting room #${id} not found`);
  res.json({
    success: true,
    message: `Meeting room deleted successfully! (${result.counters.nodesDeleted} nodes removed by cascade)`,
    counters: result.counters, cypher: [result.cypher]
  });
}));

module.exports = router;
