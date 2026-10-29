# Validation record

Validated locally on 29 October 2026 using Docker Desktop on macOS and the desktop app's browser. This is evidence for the local demonstration, not a production certification or load test.

## Automated suite

**20 tests passed in 10.646 seconds** in the Python 3.13 application image. Full output: [test-results.txt](test-results.txt).

The suite uses isolated temporary SQLite databases and a real HTTP CMS endpoint. It covers:

- Missing approval, missing attestation and requested changes.
- Approval invalidation after edits, stale editors/reviewers and modified content fingerprints.
- Live-page preservation during revision and updating one existing article.
- Duplicate-safe publication, concurrent publication attempts and lost acknowledgements.
- Rejecting a changed payload under an existing publication key, slug conflicts and unseen older revisions.
- Persistence across reopening the database.
- Unsupported numbers, basic privacy patterns and invalid citation IDs.
- Source fixture quarantine before generation.
- Prompt version selection/rollback for newly created runs.
- CMS key and cross-origin rejection; HTML and JSON-LD escaping.
- Local model schema/usage integration and no sample fallback after invalid model output (mocked model responses in these two automated cases).

## Live verification

- Built and started both Compose services; both reported healthy.
- Approved a sample revision in the UI with the label “Portfolio demo reviewer”, published it, and opened its real CMS article.
- Verified the blocked numeric-claim example displays the failing claim and no approval action.
- Created a CMS timeout workflow in the UI, approved and published it, observed Delivery pending, then retried successfully. The trace reported `replay=True`; the publishing library held one page for that workflow.
- Verified saved content and publication state remained after rebuilding/restarting the containers.
- Tested desktop (1440 × 1000) and narrow mobile (390 × 844) layouts. Opened the mobile navigation drawer. Corrected a table accessibility-label overflow; the dashboard's document width then matched the 390px viewport.
- Ran genuine local inference using the existing `qwen2.5:1.5b` model via host Ollama. The corrected schema-based call produced a valid four-section draft in 3.7 seconds, reporting 787 input and 330 output tokens. These are one run's measurements, not performance guarantees. Its paraphrased prose still requires human verification.
- Created a genuine local AI draft through the browser UI, edited its wording and saved revision 2. It remained unapproved and available for review.
- Validated merged syntax for the optional Ollama Compose configuration. The optional model container was not downloaded or run; native Ollama was the path tested on this laptop.

## Limits

No production CMS vendor, external client system, paid provider or public deployment was used. No load testing, independent security audit, complete accessibility audit or cross-platform execution was performed. The screenshots show actual local synthetic demo state. The sample passages and approval labels are not client results or verified human identities.
