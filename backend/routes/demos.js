const express = require('express');
const router = express.Router();
const { db, asyncRoute } = require('../services/common');
const { DEMOS, BY_KEY, describe, buildParams } = require('../services/demos');
const { extractGraph } = require('../services/graphShape');
const { AppError } = require('../validation');

// GET list of preset demonstrations (Cypher + the SQL it replaces)
router.get('/', (req, res) => {
  res.json({ success: true, data: DEMOS.map(describe) });
});

// POST run one preset with validated parameters. Presets are fixed server-side
// Cypher with $parameters, executed in a READ transaction.
router.post('/:key', asyncRoute(async (req, res) => {
  const demo = BY_KEY.get(req.params.key);
  if (!demo) throw new AppError(404, `Unknown demo "${req.params.key}"`);
  const params = buildParams(demo, req.body || {});
  const started = Date.now();
  const result = await db.read(demo.cypher, params);
  res.json({
    success: true,
    key: demo.key,
    cypher: demo.cypher,
    params: db.toNative(params),
    executionTimeMs: Date.now() - started,
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rows.length,
    graph: extractGraph(result.rows)
  });
}));

module.exports = router;
