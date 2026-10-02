# demo-jev

Small TypeScript samples showing what [TypeSafe](https://docs.typesafe.ai)'s **Jev** model does best. Jev is fast and returns typed, calibrated judgments that ordinary code can compose. It does not generate text.

```sh
npm install
# put your key in .env: TYPESAFE_API_KEY=...  (https://console.typesafe.ai/keys)
npm run triage                # or: commands | find | rank | extract
npm run typecheck
```

| # | Script | What it shows |
| - | - | - |
| 1 | `npm run triage` | **Speculative fan-out.** Choice, Score and Noul questions in one request, including questions only some tickets need. Code turns the answers into routing, paging and priority. |
| 2 | `npm run commands` | **Function calling.** Picks a handler and fills its typed arguments in one request. Risky actions such as unlocking doors need more confidence; uncertain ones ask the user to confirm. |
| 3 | `npm run find` | **Semantic find.** A Choice over line IDs points at the line that answers a question, and a Noul detects when the document has no answer. Lines are quoted verbatim. |
| 4 | `npm run rank` | **Composite scoring.** Scores each candidate once on independent dimensions, then ranks for three roles using weights set in code, with no extra model calls. |
| 5 | `npm run extract` | **Select, don't generate.** A regex finds candidate amounts and emails, Jev picks which one is the amount due, the discount or the reply-to address, and code does the math. |

Every sample follows the same rule: **code owns the workflow; Jev supplies narrow judgments.** Thresholds in these samples are illustrative. Tune them on your own data.
