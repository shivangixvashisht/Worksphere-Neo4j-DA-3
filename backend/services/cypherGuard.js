// ====================================================================
// Read-only Cypher console guard ("Type query & fetch it", Neo4j edition)
//
// Defence in depth - a query must pass ALL layers:
//  1. Static allowlist check on the lexed query (this file):
//     - one statement only, bounded length
//     - must start with a read clause (MATCH / OPTIONAL MATCH / WITH / UNWIND / RETURN / CALL)
//     - any write / admin / schema keyword anywhere (outside strings, comments and
//       `backtick` names) is rejected
//     - CALL is only allowed for read-only subqueries CALL { ... } / CALL (x) { ... }
//       or for an explicit allowlist of read-only procedures
//     - APOC / GDS namespaces are rejected outright
//  2. The server is asked to EXPLAIN the query; only query type 'r' (read-only) passes.
//  3. Execution happens in a READ transaction (session access mode READ + executeRead).
//     Neo4j itself rejects any write in such a transaction
//     (Neo.ClientError.Statement.AccessMode) - verified against Neo4j 5.26.
//  4. Transaction timeout + row cap limit resource use.
//
// Neo4j Community Edition has no role-based access control (custom read-only roles
// are an Enterprise / AuraDB Professional feature), which is why layers 1-3 exist.
// ====================================================================
const { tokenize } = require('./cypherLexer');
const { AppError } = require('../validation');

const MAX_QUERY_LENGTH = 4000;

const ALLOWED_FIRST_KEYWORDS = new Set(['MATCH', 'OPTIONAL', 'WITH', 'UNWIND', 'RETURN', 'CALL']);

// Any of these words (as a bare keyword token) makes the query invalid.
const FORBIDDEN_KEYWORDS = new Set([
  'CREATE', 'MERGE', 'DELETE', 'DETACH', 'SET', 'REMOVE', 'DROP', 'FOREACH', 'LOAD', 'CSV',
  'ALTER', 'RENAME', 'GRANT', 'DENY', 'REVOKE', 'START', 'STOP', 'TERMINATE', 'ENABLE',
  'USE', 'SHOW', 'TRANSACTIONS', 'PERIODIC', 'COMMIT', 'IMPORT', 'EXPLAIN', 'PROFILE', 'CYPHER',
  'INDEX', 'CONSTRAINT', 'DATABASE', 'DATABASES', 'USER', 'USERS', 'ROLE', 'ROLES', 'PRIVILEGES',
  'FINISH', 'INSERT'
]);

const FORBIDDEN_NAMESPACES = new Set(['apoc', 'gds']);

// Read-only built-in procedures that may be CALLed from the console.
const ALLOWED_PROCEDURES = new Set([
  'db.labels', 'db.relationshipTypes', 'db.propertyKeys',
  'db.schema.visualization', 'db.schema.nodeTypeProperties', 'db.schema.relTypeProperties',
  'dbms.components'
]);

function reject(message) {
  throw new AppError(400, `Read-only console: ${message}`);
}

// Layer 1: static allowlist validation. Returns the cleaned query text.
function validateReadOnlyCypher(input) {
  if (typeof input !== 'string' || !input.trim()) reject('query cannot be empty.');
  if (input.length > MAX_QUERY_LENGTH) reject(`query is longer than ${MAX_QUERY_LENGTH} characters.`);

  let tokens;
  try {
    tokens = tokenize(input);
  } catch (err) {
    reject(err.message);
  }
  // Allow ONE trailing semicolon; any other semicolon means multiple statements.
  while (tokens.length && tokens[tokens.length - 1].type === 'symbol' && tokens[tokens.length - 1].value === ';') tokens.pop();
  if (!tokens.length) reject('query cannot be empty.');
  if (tokens.some(t => t.type === 'symbol' && t.value === ';')) reject('only a single statement is allowed.');
  if (tokens.some(t => t.type === 'param')) reject('$parameters are not supported in the console.');

  const first = tokens[0];
  if (first.type !== 'word' || !ALLOWED_FIRST_KEYWORDS.has(first.value.toUpperCase())) {
    reject('query must start with MATCH, OPTIONAL MATCH, WITH, UNWIND, RETURN or CALL.');
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'word') continue;
    const upper = t.value.toUpperCase();
    const prev = tokens[i - 1];
    // Property access such as b.start / r.status is a property key, not a keyword.
    const isPropertyKey = prev && prev.type === 'symbol' && prev.value === '.';
    if (!isPropertyKey && FORBIDDEN_KEYWORDS.has(upper)) reject(`keyword ${upper} is not allowed (read-only).`);
    if (FORBIDDEN_NAMESPACES.has(t.value.toLowerCase())) reject(`${t.value} procedures/functions are not allowed.`);

    if (upper === 'CALL' && !isPropertyKey) {
      const next = tokens[i + 1];
      if (!next) reject('incomplete CALL.');
      // CALL { ... }  or  CALL (vars) { ... }  - a read-only subquery (its body is checked by this same loop)
      if (next.type === 'symbol' && (next.value === '{' || next.value === '(')) continue;
      if (next.type !== 'word') reject('CALL must be followed by a procedure name or a subquery.');
      // Read a dotted procedure name: db.schema.visualization
      const parts = [next.value];
      let j = i + 2;
      while (tokens[j] && tokens[j].type === 'symbol' && tokens[j].value === '.' && tokens[j + 1] && tokens[j + 1].type === 'word') {
        parts.push(tokens[j + 1].value);
        j += 2;
      }
      const name = parts.join('.');
      if (!ALLOWED_PROCEDURES.has(name)) {
        reject(`procedure ${name} is not on the read-only allowlist (${[...ALLOWED_PROCEDURES].join(', ')}).`);
      }
    }
  }
  return input.trim().replace(/;+\s*$/, '');
}

module.exports = { validateReadOnlyCypher, ALLOWED_PROCEDURES, FORBIDDEN_KEYWORDS, MAX_QUERY_LENGTH };
