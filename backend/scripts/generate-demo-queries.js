// Generates neo4j/03_demo_queries.cypher from backend/services/demos.js so the
// documented queries are exactly the ones the application runs.
// Usage: npm run docs:queries
const fs = require('fs');
const path = require('path');
const { DEMOS, PARAM_TYPES } = require('../services/demos');

const OUT = path.resolve(__dirname, '../../neo4j/03_demo_queries.cypher');

function paramLiteral(name) {
  const def = PARAM_TYPES[name];
  if (def.default === 'today') return 'toString(date())';
  if (typeof def.default === 'number') return String(def.default);
  return `'${def.default}'`;
}

function render() {
  const lines = [
    '// ====================================================================',
    '// WorkSphere DA-3 - 03_demo_queries.cypher',
    '// GENERATED from backend/services/demos.js (npm run docs:queries) - do not edit by hand.',
    '//',
    '// Every query here is runnable in Neo4j Browser (http://localhost:7474) or',
    '// cypher-shell. Queries with $parameters list the matching :param commands',
    '// (Neo4j Browser syntax) first. The "SQL" comment shows the original DA-II',
    '// Oracle query, or a comparison query written for DA-3 where marked.',
    '// ===================================================================='
  ];
  let group = null;
  DEMOS.forEach((d, i) => {
    if (d.group !== group) {
      group = d.group;
      lines.push('', '// ####################################################################', `// ${group}`, '// ####################################################################');
    }
    lines.push('', `// --- ${i + 1}. ${d.title} [${d.key}]`, `// ${d.description}`);
    lines.push(`// SQL (${d.sqlSource === 'original' ? 'original DA-II project' : 'DA-3 comparison, not in the original'}):`);
    d.sql.split('\n').forEach(l => lines.push(`//   ${l}`));
    (d.params || []).forEach(p => lines.push(`// :param ${p} => ${paramLiteral(p)}`));
    lines.push(`${d.cypher};`);
  });
  return lines.join('\n') + '\n';
}

module.exports = { render, OUT };

if (require.main === module) {
  fs.writeFileSync(OUT, render());
  console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${DEMOS.length} queries)`);
}
