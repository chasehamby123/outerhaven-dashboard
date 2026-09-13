# OuterHaven Originator Portal Production Manifest

This file defines the supported external Originator / Partner Portal architecture.

## System boundary

The external portal is isolated from the internal OuterHaven employee dashboard.

- External Supabase project: `xanyalooekgrywntxfxn`
- External portal entry: `originator-entry.js`
- External admin entry: `originator-admin.html` + `originator-portal-admin.js`
- Do not use the internal dashboard database, internal dashboard scripts, or `originator-admin.js` for the external portal.

## Production source of truth

Only scripts explicitly loaded by `originator-entry.js` are part of the production user portal. A file existing in the repository does not make it production code.

Current portal layers:

1. `originator.js` - core account, deal submission, submissions, messages and mandate UI
2. `originator-pdf-import.js` - PDF import surface
3. `originator-pdf-intelligence-v2.js` - deterministic PDF extraction + OCR fallback
4. `originator-location-normalizer-v4.js` - conservative geography normalization
5. `outerhaven-matcher-v4.js` - canonical mandate matching model
6. `originator-matching-ui-v3.js` - matcher presentation
7. `originator-mandate-tabs.js` - mandate geography tabs
8. `originator-capital-shell-v1.js` - lightweight Capital Suite navigation, deal selector and output container
9. `originator-capital-documents-v11.js` - base investor-document renderer/API
10. `originator-capital-generation-v5.js` - transaction-aware narrative generation
11. `originator-investor-name-cleaner-v1.js` - investor-facing entity-name cleanup
12. `originator-investor-teaser-v3.js` - transaction-aware teaser specialization
13. `originator-investor-doc-specializer-v2.js` - memo/capital/diligence specialization
14. `originator-capital-suite-v17.js` - live Capital Suite workflow
15. `originator-required-fact-validator-v3.js` - universal core diligence plus transaction-specific package-readiness validation
16. `originator-output-role-copy-v1.js` - output-role UI copy
17. `originator-document-controller-v1.js` - canonical document routing and visible-preview export
18. `originator-nav-guards-v2.js` - Capital Suite navigation guard
19. `originator-tutorial-v6.js` - current guided walkthrough

## Universal core diligence

Every deal must have the following twelve diligence questions addressed. Capital Suite should first use the original deal record and extracted core-document text. It should only ask the user questions that remain unanswered, one at a time.

1. Total project / transaction size
2. Exact capital ask
3. Capital structure: equity, debt, mezzanine or combination
4. Basic sources and uses
5. Direct sponsor / management access
6. Signed exclusive mandate status
7. Time in market
8. Number of other firms representing / circulating the opportunity
9. Prior investor, bank, family-office or institutional exposure
10. Lead investor, term sheet or committed-capital status
11. Sponsor / management track record
12. Sponsor capital invested / committed

A negative answer is still an answer. For example, "No exclusive mandate," "Not yet marketed," "No lead investor," or "No other firms" should satisfy the diligence question while remaining visible as the factual answer. Do not invent positive answers from weak source language.

## Investor-output rules

All generated outputs are investor-facing by default.

- Do not show placeholders such as "not provided", "not added", "source required", or internal workflow commentary.
- Omit unavailable metrics cleanly.
- Keep private notes and mandate-fit intelligence out of investor materials.
- The teaser, memo, capital summary and diligence package have different jobs and must not be four rewrites of the same summary.
- Real-estate pre-sales must distinguish LOI/reservation, contracted sale, and funded/collected proceeds.
- Required facts must be validated by field meaning, not merely by text length. A reference to construction costs does not equal a complete development budget, for example.

## Legacy quarantine

The repository contains historical versions retained for reference. They must not be added to `originator-entry.js` without a deliberate migration and regression review.

This includes, but is not limited to:

- `originator-capital-suite.js`, the retired original Capital Suite runtime
- `originator-advisor-workspace-v12.js`
- `originator-advisor-workspace-v13.js`
- `originator-advisor-workspace-v14.js`
- `originator-capital-suite-v15.js`
- `originator-capital-suite-v16.js`
- old investor-suite v6-v11 files
- old capital-document v2-v10 files
- old capital-generation v1-v4 files
- old teaser v1-v2 files
- old document-specializer v1
- `originator-required-fact-validator-v2.js`, superseded by v3 universal diligence logic
- old auto-fix / done-for-you / service-request UI layers
- `originator-preview.js`, which belongs to a retired legacy preview architecture and must not be loaded by the current external portal

The known v13 Advisor Workspace build is specifically quarantined because it previously caused an empty Capital Suite after a JavaScript failure.

## Change discipline

Before changing production portal behavior:

1. Confirm the change is for the external portal, not the internal dashboard.
2. Check this manifest and the current `originator-entry.js` load path.
3. Avoid adding broad `MutationObserver` loops to areas the same script mutates.
4. Prefer one canonical implementation over another patch layer.
5. Verify the production Vercel deployment and live file after merge.
6. Treat deployment READY as deployment verification, not authenticated browser E2E verification.
