# Reply Gate — Reppo-track prototype

Reply Gate shows an evidence-first review flow for support drafts. It has three fictional cases and two clearly separated review paths: deterministic local presets, and an optional server-side call to SERV Reasoning. It does not call Reppo, send replies, or take customer actions.

## Run the local demo

Requirements: Node.js 18+; no package installation is needed.

1. In this folder, copy `.env.example` to `.env` and add your account-generated `SERV_API_KEY` if you want to enable the live path. Keep `.env` private; never put the key in browser code, a public repository, or chat.
2. Load the local environment and start the server:
   ```sh
   set -a
   . ./.env
   set +a
   npm start
   ```
3. Open `http://127.0.0.1:4173`.
4. Use **Run local mock review** for preset results. With a server-side key configured, **Run live SERV review** sends only the selected fictional sample case to SERV Reasoning and displays its response.
5. Stop the server with Ctrl+C.

The live button is disabled until the server reports a configured key. Each live request uses your SERV account and may consume available credits or incur usage charges under its current terms. The UI discloses the request before it is made. The API key stays on the local Node server; the browser never receives it. Do not add real customer data.

## Tests

```sh
npm test
```

The Node built-in test runner covers the preset outcomes and the server integration route, including missing-key behavior, server-side key handling, fixed SERV endpoint/model configuration, fictional-case-only requests, and validation of model output. Tests use a stubbed upstream response; they make no real SERV request and do not prove that a live account/key works.

## What it demonstrates

- Three synthetic support cases with hand-written sample drafts and visible evidence/rules.
- A no-network, deterministic local `allow / revise / hold` mock.
- An optional backend request to SERV Reasoning's OpenAI-compatible Chat Completions endpoint (`https://inference-api.openserv.ai/v1/chat/completions`, default model `gpt-5.4-mini`).
- A server-side system prompt and validation of the model's returned JSON before showing it.
- Clear labeling that a live SERV model response is not a Reppo Evaluation response.
- No customer reply, account change, refund, deletion, or other action is performed.

The local mock and SERV model response are illustrative review outputs, not production safety controls or a guarantee that a draft is safe. A human must review wording and make any consequential decision.

## Architecture and privacy

`server.js` serves the static app and holds the key from `SERV_API_KEY` in the server process. It accepts only a known synthetic `caseId`, constructs the prompt from the fixed sample in `app.js`, and calls SERV. It does not accept arbitrary message text from the browser. The UI uses same-origin `/api/status` and `/api/review` routes; no key is embedded in client JavaScript. The server binds to `127.0.0.1` by default and uses Node built-ins only. There is no database, analytics, telemetry, or external message sending.

The optional live route has not been tested against a real SERV account. A real call requires an account-generated key and may use credits or incur charges. No key is included in this package. Never commit `.env` or any credential.

## Track and submission status

This is a prototype, not a submitted hackathon entry. It demonstrates a server-side SERV Reasoning path, but does not implement Reppo Evaluation API calls. The local `allow / revise / hold` examples are presets, not Reppo verdicts. Any future Reppo evaluation would be a separate step and should use synthetic data; submitted evaluations may be visible to peer assessors and signed-in network users.

### Live smoke-test record

On 2026-11-03, one live request from the local app sent the fictional delivery-status case to SERV Reasoning using `gpt-5.4-mini`; the displayed result was `ALLOW`, with the critique “Evidence-grounded and safe; no unsupported promise or action claim.” The app showed “NOT A REPPO EVALUATION,” and no reply was sent. This confirms only that one configured request returned a result; it does not validate other cases, models, repeated use, or production safety. Do not publish an API key or real customer data.

## Demo walkthrough (about 60 seconds)

1. **Delivery status — allow:** The fictional tracking record says “label created” with no pickup scan. Run either the local preset or, if configured and deliberately selected, the live SERV review.
2. **Refund request — revise:** The draft claims approval and a two-day arrival despite pending status; show the review and safer wording when returned.
3. **Account deletion — hold:** Identity verification is incomplete; show that a consequential request should stay with a person.
4. **Close with the boundary:** Explain whether the result shown was a preset or a SERV model response. Neither is a Reppo result; all cases are fictional, no customer reply is sent, and the integration is not a production safety control.

## References

- OpenServ Hackathon 2: https://www.openserv.ai/hackathon-2
- SERV Reasoning quickstart: https://docs.openserv.ai/serv-reasoning/tutorials/first-request
- SERV Reasoning API overview: https://docs.openserv.ai/serv-reasoning/api
- Reppo Evaluation API overview: https://docs.reppo.ai/concepts/evaluation-api
- Reppo evaluation API documentation: https://docs.reppo.ai/api/eval/overview
