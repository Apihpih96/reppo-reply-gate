const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { cases } = require('./app.js');

const ROOT = __dirname;
const MODEL = process.env.SERV_MODEL || 'gpt-5.4-mini';
const MAX_BODY_BYTES = 8 * 1024;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('body_too_large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid_json'), { statusCode: 400 });
  }
}

function parseModelJson(content) {
  if (typeof content !== 'string') throw new Error('invalid_model_response');
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  if (!['allow', 'revise', 'hold'].includes(parsed.outcome)) throw new Error('invalid_model_outcome');
  if (typeof parsed.critique !== 'string' || !parsed.critique.trim()) throw new Error('invalid_model_critique');
  if (parsed.saferDraft !== null && typeof parsed.saferDraft !== 'string') throw new Error('invalid_model_draft');
  return {
    outcome: parsed.outcome,
    critique: parsed.critique.trim(),
    saferDraft: parsed.saferDraft?.trim() || null
  };
}

function createServer({
  apiKey = process.env.SERV_API_KEY || '',
  model = MODEL,
  fetchImpl = globalThis.fetch
} = {}) {
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && pathname === '/api/status') {
      return json(res, 200, { configured: Boolean(apiKey), provider: 'SERV Reasoning', model });
    }

    if (req.method === 'POST' && pathname === '/api/review') {
      if (!apiKey) return json(res, 503, { error: 'SERV_API_KEY is not configured on this server.' });
      let input;
      try {
        input = await readJson(req);
      } catch (error) {
        return json(res, error.statusCode || 400, { error: error.message === 'body_too_large' ? 'Request is too large.' : 'Request must be valid JSON.' });
      }
      if (!input || typeof input.caseId !== 'string') return json(res, 400, { error: 'A caseId is required.' });
      const ticket = cases.find((item) => item.id === input.caseId);
      if (!ticket) return json(res, 400, { error: 'Unknown fictional case.' });

      const system = [
        'You review fictional customer-support reply drafts against the supplied evidence and support rule.',
        'Choose allow only if the draft is evidence-grounded and safe; revise if it contains unsupported claims that can be fixed; hold if identity, authorization, or consequential action needs human review.',
        'Never claim an action was performed. Never send a message. The only allowed outcomes are allow, revise, and hold.',
        'Return only one JSON object with keys outcome, critique, saferDraft. saferDraft must be a string or null. Keep the critique concise.'
      ].join(' ');
      const user = JSON.stringify({
        caseTitle: ticket.title,
        category: ticket.category,
        customerMessage: ticket.customerMessage,
        evidence: ticket.evidence,
        supportDraft: ticket.sampleDraft
      });

      let upstream;
      try {
        upstream = await fetchImpl('https://inference-api.openserv.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ],
            temperature: 0
          }),
          signal: AbortSignal.timeout(30000)
        });
      } catch {
        return json(res, 502, { error: 'Could not reach SERV Reasoning. Check the connection and try again.' });
      }
      if (!upstream.ok) {
        return json(res, 502, { error: `SERV Reasoning returned HTTP ${upstream.status}. Check the API key, model, and account balance.` });
      }
      let body;
      try {
        body = await upstream.json();
        const result = parseModelJson(body?.choices?.[0]?.message?.content);
        return json(res, 200, { ...result, source: 'serv-reasoning', model });
      } catch {
        return json(res, 502, { error: 'SERV returned an unreadable review. No action was taken.' });
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const filePath = path.resolve(ROOT, relative);
    if (!filePath.startsWith(`${ROOT}${path.sep}`)) return json(res, 403, { error: 'Forbidden.' });
    fs.readFile(filePath, (error, data) => {
      if (error) return json(res, error.code === 'ENOENT' ? 404 : 500, { error: 'File not found.' });
      const ext = path.extname(filePath);
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`Reply Gate available at http://127.0.0.1:${port}`);
    console.log(`SERV key: ${process.env.SERV_API_KEY ? 'configured (kept server-side)' : 'not configured; local mock remains available'}`);
  });
}

module.exports = { createServer, parseModelJson };
