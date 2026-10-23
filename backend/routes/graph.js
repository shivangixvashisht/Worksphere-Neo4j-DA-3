const express = require('express');
const router = express.Router();
const { db, asyncRoute } = require('../services/common');
const { extractGraph } = require('../services/graphShape');

const OVERVIEW_CYPHER = `
MATCH (n)
WHERE NOT n:Sequence
OPTIONAL MATCH (n)-[r]->(m)
WHERE NOT m:Sequence
RETURN n, r, m`;

// GET the whole WorkSphere graph (small dataset) for the visualizer
router.get('/overview', asyncRoute(async (req, res) => {
  const result = await db.read(OVERVIEW_CYPHER);
  res.json({ success: true, cypher: result.cypher, graph: extractGraph(result.rows) });
}));

// GET label / relationship counts and the facility categories (DA-3)
router.get('/meta', asyncRoute(async (req, res) => {
  const labels = await db.read(`
    MATCH (n) UNWIND labels(n) AS label
    RETURN label, count(*) AS count ORDER BY label`);
  const rels = await db.read(`
    MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS count ORDER BY type`);
  const categories = await db.read(`
    MATCH (c:FacilityCategory) RETURN c.name AS name, c.description AS description ORDER BY name`);
  res.json({
    success: true,
    labels: labels.rows, relationships: rels.rows, categories: categories.rows,
    cypher: [labels.cypher, rels.cypher, categories.cypher]
  });
}));

module.exports = router;
