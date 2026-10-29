# Architecture and design decisions

## Capture before analysis

`captureJobDetail` runs inside the active LinkedIn tab after user interaction. It checks the requested job ID, waits for changed/stable detail content, attempts to expand the description and returns a completeness flag. An unchanged neighboring description is rejected. These are DOM heuristics, not an authoritative guarantee; paste is the fallback.

The popup keeps records in `chrome.storage.local`, keyed by LinkedIn job ID when available. Refreshes preserve application status. A full-page workspace supports sequential capture without relying on an open toolbar popup.

## Two independent analysis paths

`engine.js` is deterministic. Its vocabulary and resume profiles are fixed presets. Coverage percentages measure recognized terms and are not normalized estimates of candidate suitability.

`api-ui.js` collects user-provided profiles and sends a single confirmed job to `server.cjs`. The backend uses the OpenAI Responses API with a strict schema from `api-contract.cjs`. AI analysis is stored separately and does not silently overwrite the keyword score.

## Output contract

The model returns a summary, recommended resume, rationale, requirement classifications, JD/resume excerpts, strengths, questions and a next step. Requirements carry a `required`, `preferred` or `unclear` category and a `supported`, `partial`, `not_documented` or `unclear` assessment.

Validation checks JSON shape, allowed enum values, supplied-resume availability and verbatim source excerpts. Exact quotation checks can reject otherwise valid whitespace-normalized excerpts. They do not prove that a quote supports the conclusion. Human review remains part of the workflow.

## Local trust boundary

- The OpenAI key is read from the server environment, not extension storage.
- A separate minimum-32-character local bearer token authenticates extension requests.
- The server binds only to loopback and checks Host and browser Origin.
- A single in-flight analysis is allowed; failed requests are never retried automatically.
- Body size, text lengths, output tokens and timeouts are bounded.
- JD and resume contents are labeled untrusted evidence in model instructions.
- Provider errors are mapped to user-facing messages without logging raw payloads or keys.

These controls target a personal local installation. This is not a multi-user hosted service and should not be exposed to a public network.

## Verification boundary

Unit and local HTTP tests cover deterministic behavior and mocked provider responses. A local browser smoke run covered configuration, explicit-send gating, safe text rendering, persistence, stale-result labels and CSV export. It is not included in the portable automated suite yet. Live provider compatibility, live LinkedIn selectors and recommendation quality remain separate verification tasks.

