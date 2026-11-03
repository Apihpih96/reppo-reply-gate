const test = require('node:test');
const assert = require('node:assert/strict');
const { cases, evaluateReplyGateMock } = require('../app.js');

test('contains exactly three fictional sample cases', () => {
  assert.deepEqual(cases.map((item) => item.id), [
    'delivery-status', 'refund-status', 'account-deletion'
  ]);
  for (const item of cases) {
    assert.match(item.customerMessage, /\?|\./);
    assert.ok(item.evidence.length >= 2);
  }
});

test('returns the fixed local allow, revise, and hold examples', () => {
  assert.equal(evaluateReplyGateMock('delivery-status').outcome, 'allow');
  assert.equal(evaluateReplyGateMock('refund-status').outcome, 'revise');
  assert.equal(evaluateReplyGateMock('account-deletion').outcome, 'hold');
  assert.equal(evaluateReplyGateMock('refund-status').source, 'preset-local-mock');
});

test('revision has a safer sample and deletion hold does not claim completion', () => {
  const revised = evaluateReplyGateMock('refund-status');
  assert.match(revised.saferDraft, /promise a settlement date/i);
  const held = evaluateReplyGateMock('account-deletion');
  assert.match(held.critique, /Do not claim the action happened/i);
});

test('unknown cases fail closed', () => {
  assert.throws(() => evaluateReplyGateMock('not-a-case'), /Unknown fictional case/);
});
