const express = require('express');
const router = express.Router();
const { db, upperKeys, asyncRoute } = require('../services/common');
const { parseId, AppError } = require('../validation');

// GET all employees - equivalent of the Oracle view VW_EMPLOYEES_FULL
router.get('/', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (e:Person:Employee)
    OPTIONAL MATCH (boss:Employee)-[:SUPERVISES]->(e)
    RETURN e.employee_id AS employee_id, e.person_id AS person_id,
           e.first_name + ' ' + e.last_name AS employee_name,
           e.email AS email, e.phone AS phone, e.job_title AS job_title, e.salary AS salary,
           boss.employee_id AS supervisor_id,
           CASE WHEN boss IS NULL THEN null ELSE boss.first_name + ' ' + boss.last_name END AS supervisor_name
    ORDER BY employee_id ASC`);
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

// GET supervisory hierarchy - same columns as the original self-join query
router.get('/hierarchy', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (e:Person:Employee)
    OPTIONAL MATCH (s:Employee)-[:SUPERVISES]->(e)
    RETURN e.employee_id AS employee_id,
           e.first_name + ' ' + e.last_name AS employee_name,
           e.job_title AS job_title, e.salary AS salary,
           s.employee_id AS supervisor_id,
           coalesce(s.first_name + ' ' + s.last_name, 'TOP-LEVEL DIRECTOR') AS supervisor_name,
           coalesce(s.job_title, 'EXECUTIVE BOARD') AS supervisor_title
    ORDER BY supervisor_id IS NOT NULL, supervisor_id, employee_id`); // = NULLS FIRST
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

// DA-3 graph extension: full reporting chain (any depth) above and below one employee.
// SQL needs CONNECT BY / a recursive CTE for this; Cypher uses a variable-length pattern.
router.get('/:id/chain', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'employee_id');
  const result = await db.read(`
    MATCH (e:Employee {employee_id: $id})
    OPTIONAL MATCH up = (top:Employee)-[:SUPERVISES*1..]->(e)
    WHERE NOT ()-[:SUPERVISES]->(top)
    OPTIONAL MATCH down = (e)-[:SUPERVISES*1..]->(report:Employee)
    RETURN e.first_name + ' ' + e.last_name AS employee,
           [n IN nodes(up) | n.first_name + ' ' + n.last_name + ' (' + n.job_title + ')'] AS chain_of_command,
           collect(DISTINCT {name: report.first_name + ' ' + report.last_name, job_title: report.job_title,
                             levels_below: length(down)}) AS all_reports`, { id: db.int(id) });
  if (!result.rows.length) throw new AppError(404, `Employee #${id} not found`);
  const row = result.rows[0];
  row.all_reports = row.all_reports.filter(r => r.name !== null);
  res.json({ success: true, data: row, cypher: [result.cypher] });
}));

module.exports = router;
