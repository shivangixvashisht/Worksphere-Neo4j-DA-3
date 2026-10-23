// ====================================================================
// WorkSphere DA-3 - Express server backed by Neo4j
// Same REST paths as the original Oracle version (backend/server.js in
// the DA-II project) plus /api/demos, /api/graph and a read-only /api/query.
// ====================================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/neo4j');
const { AppError } = require('./validation');

function mapNeo4jError(err) {
  const code = err.code || '';
  if (code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
    const m = /property `(\w+)` = (.+)$/m.exec(err.message);
    return new AppError(409, m ? `A record with ${m[1]} ${m[2]} already exists (uniqueness constraint)` : 'Uniqueness constraint violated');
  }
  if (code === 'Neo.ClientError.Statement.AccessMode') return new AppError(403, 'Read-only console: Neo4j rejected a write in a READ transaction.');
  if (code === 'Neo.ClientError.Statement.SyntaxError') return new AppError(400, `Cypher syntax error: ${err.message.split('\n')[0]}`);
  if (code === 'Neo.ClientError.Transaction.TransactionTimedOut' || code === 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration') {
    return new AppError(408, 'Query exceeded the console time limit and was terminated.');
  }
  if (code === 'Neo.ClientError.Security.Unauthorized') return new AppError(503, 'Neo4j rejected the credentials in .env (NEO4J_USER / NEO4J_PASSWORD).');
  if (code === 'ServiceUnavailable' || code === 'SessionExpired') return new AppError(503, 'Neo4j database is not reachable. Is the server running?');
  if (code.startsWith('Neo.ClientError.Statement') || code.startsWith('Neo.ClientError.Procedure')) {
    return new AppError(400, err.message.split('\n')[0]);
  }
  return null;
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve frontend static files
  app.use(express.static(path.join(__dirname, '../frontend')));
  // vis-network is served from node_modules so the graph view works without a CDN
  app.use('/vendor/vis-network', express.static(path.join(__dirname, '../node_modules/vis-network/standalone/umd')));

  // API Routes (same paths as the original project)
  app.use('/api/spaces', require('./routes/spaces'));
  app.use('/api/rooms', require('./routes/rooms'));
  app.use('/api/members', require('./routes/members'));
  app.use('/api/employees', require('./routes/employees'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/query', require('./routes/query'));
  app.use('/api/stats', require('./routes/stats'));
  // DA-3 additions
  app.use('/api/demos', require('./routes/demos'));
  app.use('/api/graph', require('./routes/graph'));

  // Health check: proves a live Neo4j connection by asking the server for its version
  app.get('/api/health', async (req, res) => {
    try {
      const info = await db.verifyConnectivity();
      const comp = await db.read('CALL dbms.components() YIELD name, versions, edition RETURN name, versions[0] AS version, edition');
      const nodes = await db.read('MATCH (n) RETURN count(n) AS nodes');
      const { uri, database } = db.getConfig();
      res.json({
        status: 'UP',
        database: `Neo4j ${comp.rows[0].version} (${comp.rows[0].edition} edition)`,
        connectivity: 'Official neo4j-driver over the Bolt protocol',
        server: info.address,
        agent: info.agent,
        uri: uri.replace(/\/\/[^@]*@/, '//'),
        databaseName: database,
        nodeCount: nodes.rows[0].nodes,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(503).json({ status: 'DOWN', error: err.message, code: err.code });
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ success: false, error: `No API route ${req.method} ${req.originalUrl}` }));

  // Fallback to index.html for SPA
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

  // Central error handler -> { success: false, error }
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') err = new AppError(400, 'Request body is not valid JSON');
    const appErr = err instanceof AppError ? err : mapNeo4jError(err);
    if (!appErr) {
      console.error('[WorkSphere] Unexpected error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
    const body = { success: false, error: appErr.message };
    if (appErr.details) body.details = appErr.details;
    if (err.executionTimeMs !== undefined) body.executionTimeMs = err.executionTimeMs;
    res.status(appErr.status).json(body);
  });

  return app;
}

async function start() {
  const PORT = process.env.PORT || 5000;
  const { uri } = db.getConfig();
  try {
    const info = await db.verifyConnectivity();
    console.log('=======================================================');
    console.log('🚀 WorkSphere DA-3 (Neo4j edition) Server Running!');
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`🕸️  Connected to ${info.agent} at ${info.address} (${uri})`);
    console.log('=======================================================');
  } catch (err) {
    console.error(`❌ Cannot connect to Neo4j at ${uri}: ${err.message}`);
    console.error('   Start Neo4j (see README) and check NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD in .env');
    await db.close();
    process.exit(1);
  }
  const server = createApp().listen(PORT);
  const shutdown = async () => {
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) start();

module.exports = { createApp, mapNeo4jError };
