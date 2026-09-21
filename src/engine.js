'use strict';
// A backtracking regex engine supporting: literals, ., *, +, ?, {n,m},
// character classes [a-z^], anchors ^ $, groups (), alternation |,
// escapes \d \w \s \. \* etc., capture groups.

function tokenize(pattern) {
  const tokens = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '\\') {
      const next = pattern[i + 1];
      if (next === undefined) throw new Error('trailing backslash');
      if ('dws'.includes(next)) tokens.push({ type: 'class', cls: next === 'd' ? '0-9' : next === 'w' ? 'a-zA-Z0-9_' : ' \\t\\n\\r' });
      else if ('WDS'.includes(next)) tokens.push({ type: 'nclass', cls: next === 'D' ? '0-9' : next === 'W' ? 'a-zA-Z0-9_' : ' \\t\\n\\r' });
      else tokens.push({ type: 'lit', ch: next });
      i += 2;
    } else if (c === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end < 0) throw new Error('unclosed [');
      tokens.push({ type: pattern[i + 1] === '^' ? 'nclass' : 'class', cls: pattern.slice(i + (pattern[i + 1] === '^' ? 2 : 1), end) });
      i = end + 1;
    } else if (c === '(') {
      if (pattern[i + 1] === '?') { i += 2; tokens.push({ type: 'group_start', capturing: false }); }
      else { tokens.push({ type: 'group_start', capturing: true, idx: ++groupCounter }); }
      i++;
    } else if (c === ')') { tokens.push({ type: 'group_end' }); i++; }
    else if (c === '|') { tokens.push({ type: 'alt' }); i++; }
    else if (c === '*') { tokens.push({ type: 'star' }); i++; }
    else if (c === '+') { tokens.push({ type: 'plus' }); i++; }
    else if (c === '?') { tokens.push({ type: 'opt' }); i++; }
    else if (c === '{') {
      const end = pattern.indexOf('}', i);
      if (end < 0) throw new Error('unclosed {');
      const parts = pattern.slice(i + 1, end).split(',');
      tokens.push({ type: 'repeat', min: parseInt(parts[0]) || 0, max: parts[1] !== undefined ? (parts[1] === '' ? Infinity : parseInt(parts[1])) : parseInt(parts[0]) });
      i = end + 1;
    } else if (c === '.') { tokens.push({ type: 'dot' }); i++; }
    else if (c === '^') { tokens.push({ type: 'anchor_start' }); i++; }
    else if (c === '$') { tokens.push({ type: 'anchor_end' }); i++; }
    else { tokens.push({ type: 'lit', ch: c }); i++; }
  }
  return tokens;
}

let groupCounter = 0;

// Builds a tree from tokens: alternation of sequences of atoms
function parse(tokens) {
  let pos = 0;
  function parseAlt() {
    const branches = [parseSeq()];
    while (pos < tokens.length && tokens[pos].type === 'alt') { pos++; branches.push(parseSeq()); }
    return branches.length === 1 ? branches[0] : { type: 'alt_node', branches };
  }
  function parseSeq() {
    const atoms = [];
    while (pos < tokens.length && !['alt', 'group_end'].includes(tokens[pos].type)) {
      atoms.push(parseAtom());
    }
    return { type: 'seq', atoms };
  }
  function parseAtom() {
    const tok = tokens[pos];
    if (tok.type === 'group_start') {
      pos++;
      const inner = parseAlt();
      if (pos < tokens.length && tokens[pos].type === 'group_end') pos++;
      return applyQuant({ type: 'group', capturing: !!tok.capturing, idx: tok.idx || 0, inner });
    }
    const simple = ['lit', 'class', 'nclass', 'dot', 'anchor_start', 'anchor_end'];
    if (simple.includes(tok.type)) { pos++; return applyQuant({ type: tok.type, ...tok }); }
    throw new Error(`unexpected ${tok.type}`);
  }
  function applyQuant(atom) {
    if (pos >= tokens.length) return atom;
    const t = tokens[pos];
    if (t.type === 'star') { pos++; return { type: 'quant', min: 0, max: Infinity, atom }; }
    if (t.type === 'plus') { pos++; return { type: 'quant', min: 1, max: Infinity, atom }; }
    if (t.type === 'opt') { pos++; return { type: 'quant', min: 0, max: 1, atom }; }
    if (t.type === 'repeat') { pos++; return { type: 'quant', min: t.min, max: t.max, atom }; }
    return atom;
  }

  groupCounter = 0;
  // count groups
  for (const t of tokens) if (t.type === 'group_start' && t.capturing) groupCounter++;
  const tree = parseAlt();
  if (pos < tokens.length) throw new Error('unexpected token');
  return tree;
}

function matchClass(cls, ch) {
  for (let i = 0; i < cls.length; i++) {
    if (cls[i + 1] === '-' && i + 2 < cls.length) {
      if (ch >= cls[i] && ch <= cls[i + 2]) return true;
      i += 2;
    } else if (cls[i] === ch) return true;
  }
  return false;
}

function matchNode(node, text, pos, groups, continuation) {
  switch (node.type) {
    case 'seq': {
      let k = pos;
      const atoms = node.atoms;
      function step(i) {
        if (i === atoms.length) return continuation(pos_tracker(pos));
        return matchNode(atoms[i], text, k, groups, (newPos) => { k = newPos; return step(i + 1); });
      }
      function pos_tracker(_) { return k; }
      return step(0);
    }
    case 'lit':
      if (pos < text.length && text[pos] === node.ch) return continuation(pos + 1);
      return null;
    case 'dot':
      if (pos < text.length && text[pos] !== '\n') return continuation(pos + 1);
      return null;
    case 'class':
      if (pos < text.length && matchClass(node.cls, text[pos])) return continuation(pos + 1);
      return null;
    case 'nclass':
      if (pos < text.length && !matchClass(node.cls, text[pos])) return continuation(pos + 1);
      return null;
    case 'anchor_start':
      return pos === 0 ? continuation(pos) : null;
    case 'anchor_end':
      return pos === text.length ? continuation(pos) : null;
    case 'group': {
      if (!node.capturing) return matchNode(node.inner, text, pos, groups, continuation);
      const start = pos;
      return matchNode(node.inner, text, pos, groups, (end) => {
        const saved = groups[node.idx];
        groups[node.idx] = [start, end];
        const r = continuation(end);
        if (r !== null) return r;
        groups[node.idx] = saved; // backtrack
        return null;
      });
    }
    case 'alt_node': {
      for (const branch of node.branches) {
        const r = matchNode(branch, text, pos, groups, continuation);
        if (r !== null) return r;
      }
      return null;
    }
    case 'quant': {
      const matches = [];
      let p = pos;
      while (matches.length < node.max) {
        const start = p;
        const end = matchNode(node.atom, text, p, groups, (np) => np);
        if (end === undefined || end === null || end === p) break;
        p = end;
        matches.push(p);
        if (p >= text.length && node.min <= matches.length) break;
      }
      // try longest match first (greedy)
      for (let n = matches.length; n >= node.min; n--) {
        const saved = p;
        const newPos = n === 0 ? pos : matches[n - 1];
        const r = continuation(newPos);
        if (r !== null) return r;
      }
      return null;
    }
    default:
      throw new Error(`unknown node type ${node.type}`);
  }
}

function match(pattern, text) {
  const tokens = tokenize(pattern);
  const tree = parse(tokens);
  const groups = new Array(groupCounter + 1).fill(null);
  for (let start = 0; start <= text.length; start++) {
    const end = matchNode(tree, text, start, groups, (p) => p);
    if (end !== null && end !== undefined) {
      const result = { match: text.slice(start, end), start, end };
      if (groups.length > 1) {
        result.groups = groups.slice(1).map(g => g ? text.slice(g[0], g[1]) : undefined);
      }
      return result;
    }
  }
  return null;
}

module.exports = { match };
