const express = require('express');
const router = express.Router();
const { db, asyncRoute } = require('../services/common');

// GET live system stats - the five Oracle COUNT/SUM queries combined into one Cypher query
router.get('/', asyncRoute(async (req, res) => {
  const result = await db.read(`
    CALL () { MATCH (s:CoworkingSpace) RETURN count(s) AS total_spaces }
    CALL () { MATCH (r:MeetingRoom)
              RETURN count(r) AS total_rooms, count(CASE WHEN r.status = 'AVAILABLE' THEN 1 END) AS available_rooms }
    CALL () { MATCH (m:Member {status: 'ACTIVE'}) RETURN count(m) AS total_members }
    CALL () { MATCH (b:Booking {status: 'CONFIRMED'}) RETURN count(b) AS total_bookings }
    CALL () { MATCH (p:Payment {status: 'COMPLETED'}) RETURN coalesce(sum(p.amount), 0) AS total_revenue }
    RETURN total_spaces, total_rooms, available_rooms, total_members, total_bookings, total_revenue`);
  const s = result.rows[0];
  res.json({
    success: true,
    stats: {
      totalSpaces: s.total_spaces,
      totalRooms: s.total_rooms,
      availableRooms: s.available_rooms,
      totalMembers: s.total_members,
      activeBookings: s.total_bookings,
      totalRevenue: s.total_revenue
    },
    cypher: [result.cypher]
  });
}));

module.exports = router;
