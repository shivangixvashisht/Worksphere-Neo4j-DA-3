// ====================================================================
// Seeds the live Neo4j database from the files in neo4j/.
//   npm run seed              reset + constraints + original seed + DA-3 categories
//   npm run db:reset          reset only (delete all nodes; constraints kept)
// ====================================================================
const fs = require('fs');
const path = require('path');
const db = require('../db/neo4j');
const { splitStatements } = require('../services/cypherLexer');

const NEO4J_DIR = path.resolve(__dirname, '../../neo4j');

function localToday() {
  // Same idea as Oracle SYSDATE on the original server: the date of the machine running the seed.
  const d = new Date();
  const pad = v => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function runFile(file, params = {}, log = console.log) {
  const text = fs.readFileSync(path.join(NEO4J_DIR, file), 'utf8');
  const statements = splitStatements(text);
  const session = db.session('WRITE');
  const totals = {};
  try {
    for (const stmt of statements) {
      // Auto-commit transactions: required for schema commands and CALL {} IN TRANSACTIONS.
      const result = await session.run(stmt, params);
      const updates = result.summary.counters.updates();
      for (const [k, v] of Object.entries(updates)) totals[k] = (totals[k] || 0) + v;
      const schema = result.summary.counters.systemUpdates();
      if (schema) totals.schemaUpdates = (totals.schemaUpdates || 0) + schema;
    }
  } finally {
    await session.close();
  }
  const shown = Object.fromEntries(Object.entries(totals).filter(([, v]) => v));
  log(`  ${file}: ${statements.length} statements`, shown);
  return { statements: statements.length, totals: shown };
}

async function seed({ resetOnly = false, today = localToday(), log = console.log } = {}) {
  log(`Seeding Neo4j at ${db.getConfig().uri} (today = ${today})`);
  await runFile('04_reset.cypher', {}, log);
  if (resetOnly) return;
  await runFile('01_constraints.cypher', {}, log);
  await runFile('02_seed.cypher', { today }, log);
  await runFile('05_facility_categories.cypher', {}, log);
  const counts = await db.read(
    'MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS nodes ORDER BY label'
  );
  const rels = await db.read('MATCH ()-[r]->() RETURN type(r) AS relationship, count(*) AS count ORDER BY relationship');
  return { nodes: counts.rows, relationships: rels.rows };
}

module.exports = { seed, runFile, localToday };

if (require.main === module) {
  const resetOnly = process.argv.includes('--reset-only');
  seed({ resetOnly })
    .then(summary => {
      if (summary) {
        console.table(summary.nodes);
        console.table(summary.relationships);
      }
      console.log(resetOnly ? 'Database cleared.' : 'Seed complete.');
    })
    .catch(err => {
      console.error('Seed FAILED:', err.code || '', err.message);
      process.exitCode = 1;
    })
    .finally(() => db.close());
}
