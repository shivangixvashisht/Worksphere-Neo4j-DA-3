// Executes console queries under the read-only guarantees described in cypherGuard.js.
const db = require('../db/neo4j');
const { validateReadOnlyCypher } = require('./cypherGuard');
const { AppError } = require('../validation');

const TIMEOUT_MS = Number(process.env.CONSOLE_TIMEOUT_MS) || 5000;
const MAX_ROWS = Number(process.env.CONSOLE_MAX_ROWS) || 500;

async function runReadOnlyQuery(input) {
  const cypher = validateReadOnlyCypher(input);             // layer 1
  const session = db.session('READ');                        // layer 3: READ access mode
  const txConfig = { timeout: TIMEOUT_MS, metadata: { app: 'worksphere-da3-console' } };
  try {
    // Layer 2: the server classifies the query without running it.
    const plan = await session.executeRead(tx => tx.run(`EXPLAIN ${cypher}`), txConfig);
    const queryType = plan.summary.queryType;
    if (queryType !== 'r') {
      throw new AppError(400, `Read-only console: Neo4j classified this query as type "${queryType}", only read-only ("r") queries may run.`);
    }
    // Layer 3 + 4: run inside a READ transaction with timeout and a row cap.
    return await session.executeRead(async tx => {
      const result = tx.run(cypher);
      const keys = await result.keys();
      const rows = [];
      let truncated = false;
      for await (const record of result) {
        if (rows.length >= MAX_ROWS) { truncated = true; break; }
        rows.push(db.toNative(record.toObject()));
      }
      return { cypher, columns: keys, rows, truncated, maxRows: MAX_ROWS, queryType };
    }, txConfig);
  } finally {
    await session.close();
  }
}

module.exports = { runReadOnlyQuery, TIMEOUT_MS, MAX_ROWS };
