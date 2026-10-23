const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { splitStatements, tokenize } = require('../../backend/services/cypherLexer');

test('splits on top-level semicolons only', () => {
  const s = splitStatements("RETURN 'a;b' AS x;\n// c;omment\nRETURN \"q;\" AS y; RETURN `we;ird` AS z");
  assert.deepEqual(s, ["RETURN 'a;b' AS x", 'RETURN "q;" AS y', 'RETURN `we;ird` AS z']);
});

test('handles escaped quotes', () => {
  const toks = tokenize("RETURN 'it\\'s' AS x");
  assert.equal(toks.find(t => t.type === 'string').value, "it's");
});

test('every neo4j/*.cypher file splits into non-empty statements', () => {
  const dir = path.join(__dirname, '../../neo4j');
  const expected = { '01_constraints.cypher': 18, '02_seed.cypher': 12, '04_reset.cypher': 1, '05_facility_categories.cypher': 2 };
  for (const [file, count] of Object.entries(expected)) {
    const stmts = splitStatements(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.equal(stmts.length, count, file);
    stmts.forEach(st => assert.ok(st.length > 0));
  }
});
