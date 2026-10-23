// Verifies a REAL connection to the configured Neo4j server and prints its version.
// Usage: npm run db:check
const db = require('../db/neo4j');

(async () => {
  const { uri, database } = db.getConfig();
  console.log(`Connecting to ${uri} (database "${database}") ...`);
  try {
    const info = await db.verifyConnectivity();
    const res = await db.read('CALL dbms.components() YIELD name, versions, edition RETURN name, versions[0] AS version, edition');
    const counts = await db.read('MATCH (n) RETURN count(n) AS nodes');
    console.log('Connected to', info.address, '-', info.agent);
    console.table(res.rows);
    console.log('Nodes currently in database:', counts.rows[0].nodes);
    process.exitCode = 0;
  } catch (err) {
    console.error('Neo4j connection FAILED:', err.code || '', err.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();
