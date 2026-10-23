// Read-only Cypher console: each security layer tested against the real server.
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, db, reseed } = require('./helpers');
const neo4j = require('neo4j-driver');

test.before(reseed);
test.after(() => db.close());

const run = cypher => api().post('/api/query').send({ cypher });

async function graphFingerprint() {
  const r = await db.read('MATCH (n) OPTIONAL MATCH (n)-[r]->() RETURN count(DISTINCT n) AS n, count(r) AS r');
  return r.rows[0];
}

test('read queries return rows, columns and graph data', async () => {
  const res = await run('MATCH p = (m:Member {member_id: 1001})-[:MADE]->(b:Booking) RETURN p').expect(200);
  assert.equal(res.body.rowCount, 3);
  assert.equal(res.body.queryType, 'r');
  assert.ok(res.body.graph.nodes.length >= 4 && res.body.graph.edges.length === 3);
});

test('layer 1 (allowlist) blocks writes before they reach Neo4j', async () => {
  const before = await graphFingerprint();
  for (const q of ['CREATE (:Hacked)', 'MATCH (n) DETACH DELETE n', 'MATCH (n) SET n.x = 1',
    'MATCH (n) CALL (n) { DELETE n }', "CALL apoc.cypher.runWrite('CREATE (:Hacked)', {})", 'SHOW USERS',
    'MATCH (n) RETURN n; CREATE (:Hacked)']) {
    const res = await run(q).expect(400);
    assert.match(res.body.error, /^Read-only console/, q);
  }
  assert.deepEqual(await graphFingerprint(), before);
});

test('layer 3 (server-enforced READ transaction) rejects writes even without the allowlist', async () => {
  // Bypass the API on purpose and send writes straight into READ transactions.
  for (const q of ['CREATE (x:Hacked) RETURN x', 'MATCH (n:Booking) SET n.pwned = true', 'CALL () { CREATE (:Hacked) } RETURN 1']) {
    await assert.rejects(db.read(q), err => err.code === 'Neo.ClientError.Statement.AccessMode', q);
  }
  const s = db.getDriver().session({ defaultAccessMode: neo4j.session.READ, database: db.getConfig().database });
  try {
    await assert.rejects(s.executeRead(tx => tx.run('MERGE (:Hacked {x: 1})')), err => err.code === 'Neo.ClientError.Statement.AccessMode');
  } finally {
    await s.close();
  }
  const hacked = await db.read('MATCH (h:Hacked) RETURN count(h) AS c');
  assert.equal(hacked.rows[0].c, 0);
});

test('layer 2 (EXPLAIN) classifies write queries as non-read', async () => {
  const s = db.getDriver().session({ database: db.getConfig().database });
  try {
    const w = await s.run('EXPLAIN CREATE (:Hacked)');
    const r = await s.run('EXPLAIN MATCH (n) RETURN n');
    assert.notEqual(w.summary.queryType, 'r');
    assert.equal(r.summary.queryType, 'r');
  } finally {
    await s.close();
  }
});

test('row cap and timeout protect the server', async () => {
  const big = await run('UNWIND range(1, 2000) AS x RETURN x').expect(200);
  assert.equal(big.body.rowCount, 500);
  assert.equal(big.body.truncated, true);
  // 10 billion rows cannot finish inside the 5 s console timeout -> Neo4j terminates it
  const slow = await run('UNWIND range(1, 10000000000) AS x WITH x WHERE x % 7 = 0 RETURN count(x)').expect(408);
  assert.match(slow.body.error, /time limit/);
});

test('syntax errors are reported as 400 with the Neo4j message', async () => {
  const res = await run('MATCH (n RETURN n').expect(400);
  assert.match(res.body.error, /Invalid input|syntax/i);
});
