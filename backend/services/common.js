// Shared helpers for the route handlers.
const db = require('../db/neo4j');

// The original Oracle API returned column names in UPPERCASE (Oracle's default),
// and the ported frontend reads them that way (e.g. room.ROOM_ID). Cypher queries
// alias columns with the original lowercase column names; this keeps the JSON contract.
function upperKeys(rows) {
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) out[k.toUpperCase()] = v;
    return out;
  });
}

// Replacement for Oracle SEQUENCE.NEXTVAL. The SET takes a write lock on the
// :Sequence node, so concurrent transactions can never receive the same value.
const NEXT_ID_CYPHER = `
MATCH (s:Sequence {name: $name})
SET s.next = s.next + 1
RETURN s.next - 1 AS id`;

async function nextId(run, name) {
  const res = await run(NEXT_ID_CYPHER, { name });
  if (!res.rows.length) throw new Error(`Sequence ${name} not found - run "npm run seed" first`);
  return res.rows[0].id;
}

// Express wrapper so async errors reach the error middleware.
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { db, upperKeys, nextId, asyncRoute, NEXT_ID_CYPHER };
