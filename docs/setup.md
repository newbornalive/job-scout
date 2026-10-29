# OpenAI API setup


Requires Node.js 22+; no npm dependencies. API usage is billed to each user's own OpenAI account, separately from ChatGPT subscriptions. No shared key or hosted proxy is supplied.

### Setup

1. Copy `.env.example` to `.env` in the project folder.
2. Set `OPENAI_API_KEY` to your own key. Never enter it in the extension, commit it, or share it in screenshots.
3. Set `OPENAI_MODEL` to a model your API project can access that supports Responses and strict Structured Outputs. Model is deliberately configurable, with no assumed subscription access.
4. Generate a local connection token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; put it in `JOB_SCOUT_TOKEN` in `.env`.
5. Run `npm start` from this folder. The server listens only on `127.0.0.1:43127`.
6. Reload the unpacked extension to grant its new loopback host permission. Expand **OpenAI API 模式**, enter the local connection token, and paste your own resume text into the DS / DA / Research slots (at least one). Enter your own preferences; API mode does not assume citizenship or location.
7. Click **检查本机连接**. This checks local configuration only, not key validity or model access, and does not call OpenAI.
8. Read a job or use **载入 / API 分析** on a saved record. Confirm the complete JD, review the data-sharing checkbox, then click **用 OpenAI 分析当前职位**. Keep the extension page open until it finishes. For a stable full-page UI, open `chrome-extension://YOUR_EXTENSION_ID/popup.html` in a tab; paste a JD or load a saved record there.

### Result and cost behavior

- Required/preferred/unclear requirements, exact JD and resume evidence, supported/partial/not-documented assessments, recommended resume, strengths and follow-up questions.
- No model-generated match percentage, automatic application, or automatic paid batch processing. Existing keyword ranking remains separate.
- One paid request per explicit analysis. No automatic retries. Duplicate concurrent requests are rejected. Input limits and a 6,000 output-token cap bound each call; they are not a dollar budget. Set account controls separately.
- Results persist on the job record with model, timestamp and token usage, and appear in JSON and CSV exports. A changed JD/title labels the previous result stale. Resume edits require a fresh analysis; prior results describe the resume used at that time.
- Missing config, unavailable models, billing/rate limits, refusal, incomplete output, invalid JSON/schema, invalid source excerpts and timeouts produce errors without replacing a previous successful result. A failed/timed-out call can still incur provider charges; there is no refund mechanism here.

### Privacy and security

The backend holds the API key in environment variables. The extension stores resume text/preferences in local browser storage (not encrypted) and the separate connection token in session storage. After a browser restart, re-enter the token. Exports never include settings, tokens or full profile objects, but can contain JD text and model-selected resume excerpts. Treat exports as private.

Only the current title, JD, nonempty resume text and preferences are sent for analysis. Contact details can be omitted. Requests use `store: false`; this does not promise zero provider retention. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). The backend does not write payloads, keys or upstream error bodies to logs. It requires a local bearer token, rejects non-extension web origins and non-loopback Host values, and binds to loopback only. Do not expose this local server publicly.

JD and resume contents are treated as untrusted evidence in model instructions. Returned source excerpts are checked against their supplied texts. This reduces fabricated citations but cannot guarantee semantic correctness; users review the result before applying.

### Verification

Run `npm test`. Tests use a mocked OpenAI transport and local HTTP requests, never a real API key. Live OpenAI access and Chrome/Edge integration must be verified separately using an available model and a configured account.

The API integration follows [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Rule-mode defaults are generic examples; API mode accepts each user's own profiles. Before publishing, review those defaults and do not add `.env`, personal PDFs, browser exports or `tmp/` to the repository.
