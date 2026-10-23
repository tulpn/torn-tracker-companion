// The settings route's address (CMP-107); mounting it is covered in test/script.test.js.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { routeOf } from '../../src/core/page.js';

describe('CMP-107 the route is /index.php#/torn-tracker', () => {
  test('the root, a section, and nothing else', () => {
    assert.equal(routeOf({ pathname: '/index.php', hash: '#/torn-tracker' }), '');
    assert.equal(routeOf({ pathname: '/', hash: '#/torn-tracker/' }), '');
    assert.equal(routeOf({ pathname: '/index.php', hash: '#/torn-tracker/sharing' }), 'sharing');
    assert.equal(routeOf({ pathname: '/index.php', hash: '' }), null);
    assert.equal(routeOf({ pathname: '/index.php', hash: '#torn-tracker' }), null, 'the slash keeps it clear of Torn’s own anchors');
    assert.equal(routeOf({ pathname: '/index.php', hash: '#/torn-trackerx' }), null);
    assert.equal(routeOf({ pathname: '/factions.php', hash: '#/torn-tracker' }), null, 'only on Torn’s home page');
  });
});
