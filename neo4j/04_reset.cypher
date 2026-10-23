// ====================================================================
// WorkSphere DA-3 - 04_reset.cypher
// Deletes ALL WorkSphere nodes and relationships (constraints are kept).
// Used by `npm run seed` before re-seeding, and by integration tests.
// ====================================================================
MATCH (n)
CALL (n) { DETACH DELETE n } IN TRANSACTIONS OF 1000 ROWS;
