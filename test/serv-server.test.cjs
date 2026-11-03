const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, parseModelJson } = require('../server.js');

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('status reports whether a server-side key is configured without exposing it', async () => {
  const secret = 'test-only-secret-do-not-expose';
  await withServer({ apiKey: secret }, async (base) => {
    const status = await fetch(`${base}/api/status`).then((response) => response.json());
    assert.equal(status.configured, true);
    assert.equal(status.provider, 'SERV Reasoning');
    const js = await fetch(`${base}/app.js`).then((response) => response.text());
    assert.equal(js.includes(secret), false);
  });
});

test('live endpoint is unavailable without a key and does not call upstream', async () => {
  let calls = 0;
  await withServer({ apiKey: '', fetchImpl: async () => { calls += 1; } }, async (base) => {
    const response = await fetch(`${base}/api/review`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId: 'delivery-status' })
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /SERV_API_KEY/);
    assert.equal(calls, 0);
  });
});

test('live endpoint sends only the chosen synthetic case to SERV and validates its response', async () => {
  let request;
  await withServer({
    apiKey: 'server-only-test-key',
    model: 'gpt-5.4-mini',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          outcome: 'revise',
          critique: 'Remove the unsupported refund promise.',
          saferDraft: 'Your request is under review.'
        }) } }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  }, async (base) => {
    const response = await fetch(`${base}/api/review`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId: 'refund-status' })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      outcome: 'revise',
      critique: 'Remove the unsupported refund promise.',
      saferDraft: 'Your request is under review.',
      source: 'serv-reasoning',
      model: 'gpt-5.4-mini'
    });
    assert.equal(request.url, 'https://inference-api.openserv.ai/v1/chat/completions');
    assert.equal(request.options.headers.authorization, 'Bearer server-only-test-key');
    assert.equal(request.body.model, 'gpt-5.4-mini');
    assert.equal(request.body.messages[0].role, 'system');
    assert.match(request.body.messages[0].content, /fictional/);
    const submitted = JSON.parse(request.body.messages[1].content);
    assert.equal(submitted.caseTitle, 'Refund request');
    assert.match(submitted.customerMessage, /fictional|refund/i);
    assert.equal(Object.hasOwn(submitted, 'apiKey'), false);
  });
});

test('rejects unknown cases and malformed or unsafe model output', async () => {
  let calls = 0;
  await withServer({ apiKey: 'test-key', fetchImpl: async () => { calls += 1; } }, async (base) => {
    const unknown = await fetch(`${base}/api/review`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId: 'not-a-case' })
    });
    assert.equal(unknown.status, 400);
    assert.equal(calls, 0);
    assert.throws(() => parseModelJson('{"outcome":"delete","critique":"bad","saferDraft":null}'));
    assert.throws(() => parseModelJson('not json'));
  });
});
