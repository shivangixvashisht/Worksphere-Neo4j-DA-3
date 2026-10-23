const express = require('express');
const router = express.Router();
const { asyncRoute } = require('../services/common');
const { runReadOnlyQuery, TIMEOUT_MS, MAX_ROWS } = require('../services/console');
const { extractGraph } = require('../services/graphShape');

// POST run a custom READ-ONLY Cypher query ("Type query & fetch it", Neo4j edition)
router.post('/', asyncRoute(async (req, res) => {
  const started = Date.now();
  try {
    const out = await runReadOnlyQuery(req.body && req.body.cypher);
    res.json({
      success: true,
      cypher: out.cypher,
      executionTimeMs: Date.now() - started,
      columns: out.columns,
      rows: out.rows,
      rowCount: out.rows.length,
      truncated: out.truncated,
      queryType: out.queryType,
      graph: extractGraph(out.rows),
      message: out.truncated ? `Showing the first ${MAX_ROWS} rows` : 'Query executed successfully (read-only)'
    });
  } catch (err) {
    err.executionTimeMs = Date.now() - started;
    throw err;
  }
}));

router.get('/limits', (req, res) => {
  res.json({ success: true, timeoutMs: TIMEOUT_MS, maxRows: MAX_ROWS, mode: 'READ' });
});

module.exports = router;
