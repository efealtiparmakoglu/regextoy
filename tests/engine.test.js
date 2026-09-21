'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { match } = require('../src/engine.js');

test('literals', () => {
  assert.strictEqual(match('abc', 'xxabcxx').match, 'abc');
  assert.strictEqual(match('abc', 'xxx'), null);
});

test('dot wildcard', () => {
  assert.strictEqual(match('a.c', 'abc').match, 'abc');
  assert.strictEqual(match('a.c', 'axc').match, 'axc');
});

test('star quantifier', () => {
  assert.strictEqual(match('a*b', 'aaab').match, 'aaab');
  assert.strictEqual(match('a*b', 'b').match, 'b');
});

test('plus quantifier', () => {
  assert.ok(match('a+', 'aaa'));
  assert.strictEqual(match('a+', 'b'), null);
});

test('optional quantifier', () => {
  assert.strictEqual(match('colou?r', 'color').match, 'color');
  assert.strictEqual(match('colou?r', 'colour').match, 'colour');
});

test('character classes', () => {
  assert.strictEqual(match('[0-9]+', 'abc123def').match, '123');
  assert.strictEqual(match('[^0-9]+', 'abc123').match, 'abc');
  assert.strictEqual(match('\\d+', 'abc123def').match, '123');
  assert.strictEqual(match('\\w+', '  hello ').match, 'hello');
});

test('anchors', () => {
  assert.strictEqual(match('^abc', 'abcdef').match, 'abc');
  assert.strictEqual(match('^abc', 'xxabc'), null);
  assert.strictEqual(match('abc$', 'xxabc').match, 'abc');
});

test('alternation', () => {
  assert.strictEqual(match('cat|dog', 'hotdog').match, 'dog');
  assert.strictEqual(match('cat|dog', 'bird'), null);
});

test('capture groups', () => {
  const r = match('(\\d+)-(\\d+)', 'range 12-45');
  assert.strictEqual(r.match, '12-45');
  assert.strictEqual(r.groups[0], '12');
  assert.strictEqual(r.groups[1], '45');
});

test('repetition {n,m}', () => {
  assert.strictEqual(match('a{3}', 'aaa').match, 'aaa');
  assert.strictEqual(match('a{2,4}', 'aaaaa').match, 'aaaa');
});

test('group quantifier', () => {
  assert.strictEqual(match('(ab)+', 'abababx').match, 'ababab');
});
