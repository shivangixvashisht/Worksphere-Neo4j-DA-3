// ====================================================================
// Minimal Cypher lexer.
// Used by (1) the seed runner to split .cypher files into statements and
// (2) the read-only console guard to inspect keywords/procedures safely
// (keywords inside strings, comments or `backtick` names are ignored).
// ====================================================================

// Returns an array of tokens: { type, value, pos }
// type: 'word' | 'string' | 'quoted' (backticks) | 'param' | 'number' | 'symbol'
function tokenize(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    // whitespace
    if (/\s/.test(ch)) { i++; continue; }
    // line comment
    if (ch === '/' && next === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    // block comment
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) throw new SyntaxError('Unterminated block comment');
      i = end + 2;
      continue;
    }
    // string literal ('...' or "...") with backslash escapes
    if (ch === "'" || ch === '"') {
      const start = i;
      i++;
      let value = '';
      while (i < n && text[i] !== ch) {
        if (text[i] === '\\' && i + 1 < n) { value += text[i + 1]; i += 2; continue; }
        value += text[i++];
      }
      if (i >= n) throw new SyntaxError('Unterminated string literal');
      i++;
      tokens.push({ type: 'string', value, pos: start, raw: text.slice(start, i) });
      continue;
    }
    // backtick-quoted identifier (`` escapes a backtick)
    if (ch === '`') {
      const start = i;
      i++;
      let value = '';
      while (i < n) {
        if (text[i] === '`' && text[i + 1] === '`') { value += '`'; i += 2; continue; }
        if (text[i] === '`') break;
        value += text[i++];
      }
      if (i >= n) throw new SyntaxError('Unterminated backtick identifier');
      i++;
      tokens.push({ type: 'quoted', value, pos: start, raw: text.slice(start, i) });
      continue;
    }
    // parameter
    if (ch === '$') {
      const start = i;
      i++;
      while (i < n && /[A-Za-z0-9_]/.test(text[i])) i++;
      tokens.push({ type: 'param', value: text.slice(start + 1, i), pos: start, raw: text.slice(start, i) });
      continue;
    }
    // number
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < n && /[0-9._eExXa-fA-F]/.test(text[i])) i++;
      tokens.push({ type: 'number', value: text.slice(start, i), pos: start, raw: text.slice(start, i) });
      continue;
    }
    // identifier / keyword
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_]/.test(text[i])) i++;
      tokens.push({ type: 'word', value: text.slice(start, i), pos: start, raw: text.slice(start, i) });
      continue;
    }
    tokens.push({ type: 'symbol', value: ch, pos: i, raw: ch });
    i++;
  }
  return tokens;
}

// Split a .cypher script into statements on top-level semicolons.
function splitStatements(text) {
  const tokens = tokenize(text);
  const statements = [];
  let startPos = null;
  for (const t of tokens) {
    if (t.type === 'symbol' && t.value === ';') {
      if (startPos !== null) statements.push(text.slice(startPos, t.pos).trim());
      startPos = null;
      continue;
    }
    if (startPos === null) startPos = t.pos;
  }
  if (startPos !== null) {
    const tail = text.slice(startPos).trim();
    if (tail) statements.push(tail);
  }
  return statements.filter(Boolean);
}

module.exports = { tokenize, splitStatements };
