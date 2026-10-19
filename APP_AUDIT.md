# FindLoop app audit — 18 October 2026

## Borrow request delivery repair — 19 October 2026

The notifications table was absent from `supabase_realtime`, preventing live request/approval alerts. Added an idempotent migration publishing notifications while retaining recipient RLS. Added a direct Borrow requests route/sidebar entry and review links on lending pages. Request notifications now open lender review; approval notifications and approved outgoing requests open Borrowed. Submission confirms the saved request and shows feedback. Approval invalidates loan/request caches; reconnect refresh and 10-second polling cover missed events.

Eight rollback-only database checks passed for lender notification visibility, incoming request queries, current and future approval, borrower loan/item visibility, approval notifications, and outsider denial. Seven service regression tests and production builds passed. Existing users' requests and loans were not approved or changed during these checks.

Borrow requests are reviewed in **Borrow requests** or **Notifications → Incoming**; the **Messages** inbox remains for lost/found conversations. Clicking Request to borrow opens the form; completing it and pressing Send borrow request submits the request.

Reviewed all source areas: routes/auth, dashboard, lost/found, lending discovery and editing, borrow approvals and returns, profile/avatar editing, conversations and attachments, notifications, installation/offline handling, build/deployment configuration, dependencies, and live Supabase access rules.

## Repairs
- Failed workspace/profile/edit queries display errors rather than false empty states. Return and notification mutations expose failures; return buttons prevent repeat submissions.
- Keyboard activation on nested action buttons no longer opens the surrounding lending row.
- Lost/found filters honor query-string links and browser history. The incoming-request route opens the correct tab. Sign-in preserves the originally requested route and query.
- Date-only values render as local calendar days; today’s loans remain current throughout the due date. Return-requested status remains visible even after the due date. New listings default to the local date.
- A missing/inaccessible private image no longer hides an entire page. Unavailable verification images are labeled without exposing raw storage paths. Incoming ID signing is limited to pending reviews.
- Profile cancellation discards unsaved fields/photos. Failed zero-row profile saves clean up uploaded avatars; successful profile writes remain successful if display-metadata synchronization fails.
- Potential-match lost/found listings can be marked recovered/returned. New uploads reject empty files and use MIME-derived extensions. Listing fields validate database length/integer limits; photo previews are released on unmount.
- Development port is consistently 5174, matching the configured auth redirects.
- Patched source-map-js 1.2.1 → 1.2.2; dependency audit reports zero known vulnerabilities.

## Verification
- 13 backend workflow assertions and 7 storage-policy assertions passed on the connected Supabase project. Both suites end in ROLLBACK.
- Four automated service regression tests cover private-media failure isolation/cache reset, calendar-day behavior, profile partial failures/upload cleanup, and potential-match recovery. Run with npm test.
- TypeScript and production builds verified, including the GitHub Pages base path.
- Browser smoke checks cover public auth/recovery/install pages and deployed authenticated workspaces. No real requests, messages, returns, or passwords were changed during browser checks.

## Remaining limits
Leaked-password protection remains a Supabase paid-plan feature. Six intentional authenticated workflow SECURITY DEFINER RPC warnings remain; ownership/anonymous denial checks pass. Performance notices concern unused indexes, retained for growing data. APK download remains unavailable until an actual signed Android binary is supplied. Browser microphone recording and password-email delivery require real user/device interaction and were not exercised.
