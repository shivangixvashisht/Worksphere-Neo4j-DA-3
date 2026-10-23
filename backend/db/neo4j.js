// ====================================================================
// WorkSphere DA-3 - Neo4j connectivity layer
// Official Neo4j JavaScript driver (Bolt protocol). Replaces the
// original Oracle JDBC / SQL*Plus bridge in database/db.js.
// There is NO fallback or mock: if Neo4j is unreachable, calls fail.
// ====================================================================
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const neo4j = require('neo4j-driver');

let driver = null;

function getConfig() {
  return {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD,
    database: process.env.NEO4J_DATABASE || 'neo4j'
  };
}

function getDriver() {
  if (driver) return driver;
  const { uri, user, password } = getConfig();
  if (!password) {
    throw new Error('NEO4J_PASSWORD is not set. Copy .env.example to .env and set your Neo4j password.');
  }
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    disableLosslessIntegers: true,          // Neo4j integers arrive as JS numbers
    maxConnectionPoolSize: 20,
    connectionAcquisitionTimeout: 10000
  });
  return driver;
}

async function verifyConnectivity() {
  const info = await getDriver().getServerInfo({ database: getConfig().database });
  return info; // { address, agent, protocolVersion }
}

async function close() {
  if (driver) {
    const d = driver;
    driver = null;
    await d.close();
  }
}

// ---------- Value conversion: Neo4j types -> plain JSON ----------
function toNative(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(toNative);
  if (neo4j.isInt(value)) return value.toNumber();
  if (neo4j.isDate(value) || neo4j.isDateTime(value) || neo4j.isLocalDateTime(value) ||
      neo4j.isTime(value) || neo4j.isLocalTime(value) || neo4j.isDuration(value)) {
    return value.toString();
  }
  if (neo4j.isNode(value)) {
    return { _type: 'node', elementId: value.elementId, labels: value.labels, properties: toNative(value.properties) };
  }
  if (neo4j.isRelationship(value)) {
    return {
      _type: 'relationship', elementId: value.elementId, type: value.type,
      start: value.startNodeElementId, end: value.endNodeElementId, properties: toNative(value.properties)
    };
  }
  if (neo4j.isPath(value)) {
    return {
      _type: 'path',
      nodes: [value.start, ...value.segments.map(s => s.end)].map(toNative),
      relationships: value.segments.map(s => toNative(s.relationship))
    };
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toNative(v);
    return out;
  }
  return value;
}

function shapeResult(cypher, result) {
  const counters = result.summary.counters;
  return {
    cypher: cypher.trim(),
    columns: result.records.length ? result.records[0].keys : [],
    rows: result.records.map(r => toNative(r.toObject())),
    counters: counters.containsUpdates() ? counters.updates() : {},
    queryType: result.summary.queryType,
    resultAvailableAfterMs: toNative(result.summary.resultAvailableAfter)
  };
}

// Integer parameter helper: JS numbers are sent as Cypher FLOATs, so IDs are
// converted explicitly to Cypher INTEGERs to match the stored values.
function int(n) {
  return neo4j.int(Math.trunc(Number(n)));
}

async function read(cypher, params = {}) {
  const session = getDriver().session({ database: getConfig().database, defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.executeRead(tx => tx.run(cypher, params));
    return shapeResult(cypher, result);
  } finally {
    await session.close();
  }
}

async function write(cypher, params = {}) {
  const session = getDriver().session({ database: getConfig().database, defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.executeWrite(tx => tx.run(cypher, params));
    return shapeResult(cypher, result);
  } finally {
    await session.close();
  }
}

// Run several statements in ONE write transaction (all-or-nothing).
// work(tx) receives a helper: run(cypher, params) -> shaped result.
async function writeTransaction(work) {
  const session = getDriver().session({ database: getConfig().database, defaultAccessMode: neo4j.session.WRITE });
  try {
    return await session.executeWrite(async tx => {
      const executed = [];
      const run = async (cypher, params = {}) => {
        const shaped = shapeResult(cypher, await tx.run(cypher, params));
        executed.push(shaped.cypher);
        return shaped;
      };
      const value = await work(run);
      return { value, executed };
    });
  } finally {
    await session.close();
  }
}

function session(mode = 'READ') {
  return getDriver().session({
    database: getConfig().database,
    defaultAccessMode: mode === 'WRITE' ? neo4j.session.WRITE : neo4j.session.READ
  });
}

module.exports = { neo4j, getConfig, getDriver, verifyConnectivity, close, read, write, writeTransaction, session, toNative, int };
