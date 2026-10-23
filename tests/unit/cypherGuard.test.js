// Unit tests: static layer of the read-only console guard (no database needed).
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReadOnlyCypher } = require('../../backend/services/cypherGuard');

const allowed = [
  'MATCH (r:MeetingRoom) RETURN r.room_name ORDER BY r.capacity DESC LIMIT 3',
  'match (n) return n limit 5;',
  'OPTIONAL MATCH (b:Booking) RETURN count(b)',
  'WITH 1 AS x RETURN x',
  'UNWIND [1,2,3] AS x RETURN x',
  'RETURN 1 + 1 AS two',
  'CALL db.labels() YIELD label RETURN label',
  'CALL db.schema.visualization()',
  'CALL dbms.components() YIELD name RETURN name',
  'CALL () { MATCH (n:Booking) RETURN count(n) AS c } RETURN c',
  "MATCH (n) WHERE n.room_name = 'CREATE DELETE SET' RETURN n",  // keywords inside strings are fine
  'MATCH (n) RETURN n.set, n.create, n.delete',                     // property keys named like keywords
  'MATCH (n) RETURN n.`MERGE` AS quoted',                           // backtick identifiers
  '// CREATE in a comment\nMATCH (n) RETURN count(n)',
  '/* DETACH DELETE */ MATCH (n) RETURN count(n)'
];

const blocked = [
  ['CREATE (x:Hacked)', /must start with/],
  ['MERGE (x:Hacked)', /must start with/],
  ['MATCH (n) DETACH DELETE n', /DETACH/],
  ['MATCH (n) DELETE n', /DELETE/],
  ['MATCH (n) SET n.x = 1', /SET/],
  ['MATCH (n) REMOVE n.x', /REMOVE/],
  ['MATCH (n) WITH n CREATE (:X)', /CREATE/],
  ['MATCH (n) WITH n MERGE (:X)', /MERGE/],
  ['MATCH (n) FOREACH (x IN [1] | CREATE (:X))', /FOREACH/],
  ['MATCH (n) CALL (n) { DETACH DELETE n }', /DETACH/],
  ['MATCH (n) CALL { CREATE (:X) } IN TRANSACTIONS', /CREATE/],
  ['MATCH (n) RETURN n; MATCH (m) DELETE m', /single statement/],
  ["LOAD CSV FROM 'file:///etc/passwd' AS l RETURN l", /must start with/],
  ["WITH 1 AS x LOAD CSV FROM 'https://x' AS l RETURN l", /LOAD/],
  ['CALL dbms.security.createUser("a","b",false)', /allowlist/],
  ['CALL dbms.killQueries(["x"])', /allowlist/],
  ['CALL db.clearQueryCaches()', /allowlist/],
  ["CALL apoc.cypher.runWrite('CREATE (:X)', {})", /allowlist|apoc/],
  ['RETURN apoc.text.join(["a"], ",")', /apoc/],
  ['SHOW USERS', /must start with/],
  ['SHOW DATABASES', /must start with/],
  ['USE system MATCH (n) RETURN n', /must start with/],
  ['MATCH (n) USE system RETURN n', /USE/],
  ['EXPLAIN MATCH (n) RETURN n', /must start with/],
  ['PROFILE MATCH (n) RETURN n', /must start with/],
  ['CYPHER runtime=slotted MATCH (n) RETURN n', /must start with/],
  ['DROP CONSTRAINT person_id_unique', /must start with/],
  ['CREATE INDEX x FOR (n:A) ON (n.b)', /must start with/],
  ['GRANT ROLE admin TO neo4j', /must start with/],
  ['TERMINATE TRANSACTIONS "x"', /must start with/],
  ['MATCH (n) WHERE n.id = $id RETURN n', /parameters/],
  ["MATCH (n) RETURN 'unterminated", /Unterminated/],
  ['', /empty/],
  ['   ;  ', /empty/],
  ['RETURN ' + 'x'.repeat(5000), /longer than/]
];

test('allows read-only queries', () => {
  for (const q of allowed) assert.doesNotThrow(() => validateReadOnlyCypher(q), q);
});

test('blocks write, admin, multi-statement and unsafe queries', () => {
  for (const [q, msg] of blocked) {
    assert.throws(() => validateReadOnlyCypher(q), err => err.status === 400 && msg.test(err.message), q);
  }
});

test('strips a single trailing semicolon', () => {
  assert.equal(validateReadOnlyCypher('MATCH (n) RETURN n;'), 'MATCH (n) RETURN n');
});
