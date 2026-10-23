// Extracts nodes and relationships from query rows for the vis-network graph view.
function captionFor(node) {
  const p = node.properties || {};
  if (p.first_name) return `${p.first_name} ${p.last_name || ''}`.trim();
  return p.room_name || p.space_name || p.organization_name || p.plan_name || p.facility_name ||
    (p.booking_id ? `Booking #${p.booking_id}` : null) ||
    (p.payment_id ? `Payment #${p.payment_id}` : null) ||
    p.name || node.labels[0];
}

function extractGraph(rows) {
  const nodes = new Map();
  const edges = new Map();
  const visit = v => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(visit);
    if (v._type === 'node') {
      if (!nodes.has(v.elementId)) {
        nodes.set(v.elementId, { id: v.elementId, labels: v.labels, caption: captionFor(v), properties: v.properties });
      }
      return;
    }
    if (v._type === 'relationship') {
      edges.set(v.elementId, { id: v.elementId, from: v.start, to: v.end, type: v.type, properties: v.properties });
      return;
    }
    if (v._type === 'path') { v.nodes.forEach(visit); v.relationships.forEach(visit); return; }
    Object.values(v).forEach(visit);
  };
  rows.forEach(visit);
  // Only keep edges whose endpoints are present
  const edgeList = [...edges.values()].filter(e => nodes.has(e.from) && nodes.has(e.to));
  return { nodes: [...nodes.values()], edges: edgeList };
}

module.exports = { extractGraph };
