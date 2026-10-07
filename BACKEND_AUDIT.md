# Backend audit — 7 October 2026

Connected project: qbiathghrwtmrlghkztd.

## Applied repairs

- Restored missing rejection RPC and borrow/message notification triggers.
- Required authenticated callers and owner/borrower checks in workflow RPCs.
- Scoped and deduplicated due reminders per borrower.
- Repaired RLS policies and restricted editable columns: profile roles and identities, received message content, and notification generation cannot be changed by client updates.
- Validated availability, future start dates, maximum loan duration, ownership, and blocked users when requests are inserted.
- Replaced the historical status uniqueness constraint with a pending-request index, permitting repeat borrowing and repeated rejection. Added one-open-loan enforcement.
- Protected active loans against direct archiving/deletion.
- Created the missing avatar bucket and private student ID bucket. Made existing item images private to protect legacy student IDs; signed listing photo links preserve authenticated photo access.
- Preserved conversation access after a listing is closed.
- Added missing foreign-key indexes and removed overlapping RLS policies.

Applied migrations: 20261007151744_repair_missing_backend_workflows and 20261007152255_repair_backend_validation_and_permissions. The earlier lending availability repair is also applied.

## Application fixes

- Private ID uploads and signed media links, including existing ID URLs.
- Failed-request upload cleanup, consistent image MIME checks, duplicate-request errors, and detection of zero-row edits/deletes.
- Return-requested loans remain visible; transaction errors are reported rather than hidden behind synthetic loans.
- Account switches clear query and media caches. Auth initialization errors cannot leave the app permanently loading.
- Added a working reset-password page, recovery callback initialization before routing, and email-confirmation feedback.
- Refreshed dependent listing, profile, dashboard, and notification queries after writes.

## Validation

- 13 backend integration assertions passed under lender, borrower, outsider, and anonymous roles.
- 7 storage policy assertions passed: private bucket flags, request-owner ID access, outsider denial, listing photos, avatar uploads, and message media participation.
- Fixtures ran inside transactions ending in ROLLBACK; no audit accounts remain.
- TypeScript checks, local production build, and GitHub Pages base-path build passed.
- Browser smoke check confirmed login and reset-password routes render. No real password was changed and no email was sent.
- No missing listing media objects, approved requests without loans, or active-loan/listing state mismatches were found.

Reproducible SQL checks are in supabase/tests/backend_workflows.sql and supabase/tests/storage_access.sql.

## Remaining configuration and deployment

Auth Site URL was repaired to https://gokul-web-07.github.io/FindLoop/. Five exact redirect URLs were saved for the production base path and localhost/127.0.0.1 on port 5174, including reset-password. The updated frontend supports the repaired backend and private media on GitHub Pages. Both changes were explicitly approved.

The security advisor reports the six authenticated workflow RPCs because they deliberately use SECURITY DEFINER for atomic cross-user transitions; their caller/ownership checks were verified. Anonymous privileged RPC exposure is removed. Leaked-password protection remains disabled and needs to be enabled through Supabase Auth if supported by the project's plan. Performance notices are only unused-index observations on this small dataset; useful indexes were retained.
