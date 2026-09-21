# regextoy

**A from-scratch regex engine in plain Node.js — backtracking matcher, capture groups, zero dependencies.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Supports: literals, `.`, `*`, `+`, `?`, `{n,m}`, character classes
`[a-z]` / `[^...]`, anchors `^` `$`, capture groups `(...)`, alternation
`|`, and escapes `\d` `\w` `\s` `\D` `\W` `\S` — with proper backtracking.

## Usage

```js
const { match } = require('./src/engine.js');
match('\\d+', 'abc123def'); // { match: '123', start: 3, end: 6, groups: [] }
match('(\\w+)@(\\w+)', 'user@host'); // groups: ['user', 'host']
```

## Tests

```sh
npm test
```

## License

MIT — see [LICENSE](LICENSE).
