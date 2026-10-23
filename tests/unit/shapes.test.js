const test = require('node:test');
const assert = require('node:assert/strict');
const { upperKeys } = require('../../backend/services/common');
const { extractGraph } = require('../../backend/services/graphShape');
const { DEMOS, buildParams } = require('../../backend/services/demos');

test('upperKeys keeps the original Oracle-style JSON contract', () => {
  assert.deepEqual(upperKeys([{ room_id: 1, room_name: 'A' }]), [{ ROOM_ID: 1, ROOM_NAME: 'A' }]);
});

test('extractGraph collects nodes and relationships, dropping dangling edges', () => {
  const a = { _type: 'node', elementId: 'a', labels: ['Member'], properties: { first_name: 'Arjun', last_name: 'Mehta' } };
  const b = { _type: 'node', elementId: 'b', labels: ['Booking'], properties: { booking_id: 5001 } };
  const r = { _type: 'relationship', elementId: 'r', type: 'MADE', start: 'a', end: 'b', properties: {} };
  const dangling = { _type: 'relationship', elementId: 'x', type: 'BOOKED_IN', start: 'b', end: 'zzz', properties: {} };
  const g = extractGraph([{ p: { _type: 'path', nodes: [a, b], relationships: [r] }, extra: [dangling] }]);
  assert.equal(g.nodes.length, 2);
  assert.deepEqual(g.edges.map(e => e.type), ['MADE']);
  assert.equal(g.nodes[0].caption, 'Arjun Mehta');
});

test('every demo has unique key, Cypher, SQL and known parameters', () => {
  const keys = new Set();
  for (const d of DEMOS) {
    assert.ok(!keys.has(d.key), d.key);
    keys.add(d.key);
    assert.ok(d.cypher && d.sql && d.title && ['original', 'comparison'].includes(d.sqlSource), d.key);
    assert.doesNotThrow(() => buildParams(d, {}), d.key);   // defaults are valid
  }
});

test('demo parameters are validated', () => {
  const rec = DEMOS.find(d => d.key === 'room_recommendation');
  assert.throws(() => buildParams(rec, { start_time: '12:00', end_time: '10:00' }), /End time must be after start time/);
  assert.throws(() => buildParams(rec, { date: '2026-13-01' }), /valid date/);
});
