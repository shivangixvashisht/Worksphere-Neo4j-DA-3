// Integration-test helpers. These tests talk to a REAL Neo4j server - no mocks.
// They DELETE all data in the target database and re-seed it, so they refuse to
// run unless you opt in explicitly.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (process.env.NEO4J_TEST_URI) process.env.NEO4J_URI = process.env.NEO4J_TEST_URI;
if (process.env.NEO4J_TEST_USER) process.env.NEO4J_USER = process.env.NEO4J_TEST_USER;
if (process.env.NEO4J_TEST_PASSWORD) process.env.NEO4J_PASSWORD = process.env.NEO4J_TEST_PASSWORD;

if (!process.env.NEO4J_TEST_URI && process.env.WORKSPHERE_ALLOW_DB_RESET !== 'true') {
  throw new Error(
    'Integration tests wipe and re-seed the database. Set NEO4J_TEST_URI to a throwaway instance, ' +
    'or set WORKSPHERE_ALLOW_DB_RESET=true to use the database in NEO4J_URI.'
  );
}

const request = require('supertest');
const db = require('../../backend/db/neo4j');
const { seed, localToday } = require('../../backend/scripts/seed');
const { createApp } = require('../../backend/server');

const app = createApp();
const api = () => request(app);

async function reseed() {
  await seed({ log: () => {} });
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

module.exports = { api, db, reseed, today: localToday(), addDays };
