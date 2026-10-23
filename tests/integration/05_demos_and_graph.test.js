// Every preset demo runs on the live graph; key results are checked against the seed data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, db, reseed } = require('./helpers');

test.before(reseed);
test.after(() => db.close());

test('every preset demo executes successfully', async () => {
  const list = await api().get('/api/demos').expect(200);
  assert.ok(list.body.data.length >= 20);
  for (const d of list.body.data) {
    const res = await api().post(`/api/demos/${d.key}`).send({});
    assert.equal(res.status, 200, `${d.key}: ${res.body.error}`);
    assert.ok(res.body.rowCount > 0, `${d.key} returned no rows`);
  }
});

const runDemo = (key, body = {}) => api().post(`/api/demos/${key}`).send(body).expect(200).then(r => r.body);

test('revenue_by_room matches FN_ROOM_TOTAL_REVENUE of the seed', async () => {
  const d = await runDemo('revenue_by_room');
  assert.deepEqual(d.rows[0], { room_id: 305, room_name: 'Silicon Boardroom Elite', total_bookings: 4, total_revenue: 30000 });
  const f = await runDemo('fn_room_total_revenue', { room_id: 301 });
  assert.equal(f.rows[0].total_revenue, 12000);   // 5001, 5002, 5010, 5016, 5020 x 2400
});

test('supervision_chain walks the hierarchy to any depth', async () => {
  const d = await runDemo('supervision_chain');
  const manoj = d.rows.find(r => r.employee_id === 9005);
  assert.equal(manoj.level, 2);
  assert.deepEqual(manoj.chain_of_command, ['Vikram Venkatesh', 'Ananya Subramanian', 'Manoj Pillai']);
  assert.ok(d.graph.edges.every(e => e.type === 'SUPERVISES'));
});

test('room_recommendation excludes rooms booked in the slot and small rooms', async () => {
  const d = await runDemo('room_recommendation', { start_time: '10:00', end_time: '12:00', min_capacity: 4 });
  const ids = d.rows.map(r => r.room_id).sort();
  // busy today 10-12: 301, 302 (09-11), 303 (11-13), 306 (10-13), 312 (09-11); 311 has capacity 2
  assert.deepEqual(ids, [304, 305, 307, 308, 309, 310, 313, 314]);
  const withVideo = await runDemo('room_recommendation', { start_time: '10:00', end_time: '12:00', min_capacity: 4, category: 'Video Conferencing' });
  assert.deepEqual(withVideo.rows.map(r => r.room_id).sort(), [310]);   // 301/303 busy, 312 busy; 310 Samsung VC screen
});

test('member_network and shortest_path return connected subgraphs', async () => {
  const n = await runDemo('member_network', { member_id: 1001 });
  assert.ok(n.rows.length > 0 && n.graph.edges.length > 0);
  const p = await runDemo('shortest_path', { member_id: 1001, member_b: 1004 });
  assert.ok(p.rows[0].hops >= 2);
  assert.equal(p.graph.nodes.length, p.rows[0].hops + 1);
});

test('graph overview excludes internal :Sequence nodes', async () => {
  const res = await api().get('/api/graph/overview').expect(200);
  assert.equal(res.body.graph.nodes.length, 121 - 10);
  assert.ok(!res.body.graph.nodes.some(n => n.labels.includes('Sequence')));
});

test('unknown demo -> 404, invalid parameter -> 400', async () => {
  await api().post('/api/demos/nope').send({}).expect(404);
  await api().post('/api/demos/room_recommendation').send({ date: 'tomorrow' }).expect(400);
});
