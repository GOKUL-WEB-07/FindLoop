# CampusBorrow QA report

Date: 2026-09-24  
Environment: local Vite app at `127.0.0.1:5173`, connected to the configured Supabase project. One existing test account was used. This is a live-browser verification, not a claim that every multi-user workflow passed.

## Result

**Not ready for an all-functions-passing sign-off.** The tested single-user flows mostly work, but the live database is missing a lending column, and completion/deletion paths have defects. Two-party workflows remain unverified.

| Flow | Result | Evidence |
| --- | --- | --- |
| Production build | Pass | `npm run build` completed (`tsc -b` and Vite). Main bundle is about 721 kB and triggers Vite's size warning. |
| Login and password visibility | Pass | Existing account signed in; showing the password did not alter the email field. Signup, reset, and email delivery were not retested. |
| Dashboard and existing borrowing | Pass for read/navigation | Dashboard loaded real counts; an existing scheduled loan appeared in Borrowed and opened its detail page. |
| Requests and notifications | Pass for read/navigation | Pending and approved requests loaded; the approved request opened its listing detail. Notification count loaded. Approval/rejection and reminder delivery were not tested. |
| Lost & Found CRUD | Pass with defects | A temporary found listing was created with an uploaded image, found via search/filter, edited, completed, and deleted. Required-field validation and delete confirmation worked. |
| Lending CRUD | Pass with migration fallback | A temporary lending item was created, appeared in My Lending, edited, and removed. Create/edit first produced HTTP 400, then succeeded on retry without `available_from`. |
| Profile edit | Pass | A temporary department was saved, displayed, then restored to its original blank value. |
| Messages | Partial | Inbox rendered existing conversations at mobile width. Sending/receiving text, image, and voice across two accounts was not tested. |
| Mobile | Partial pass | My Lending and Messages rendered at 390px and 320px with bottom navigation and no document-level horizontal overflow. Other screens/devices were not visually audited. |

## Defects found

1. **Live schema mismatch — lending date silently lost.** Supabase rejects the first lending create/update request with `PGRST204: Could not find the 'available_from' column of 'lending_items' in the schema cache`. The client retries without the field, so the form appears to succeed but the chosen availability date is not persisted; detail falls back to `created_at`. The repository's `007_fix_media_and_archiving.sql` adds this column, but the connected project does not expose it. Verify/apply the migration in the Supabase project, reload the PostgREST schema, and remove the lossy fallback after confirming compatibility.
2. **Wrong found-item completion status.** The UI says “Mark as returned,” but the completed found report was stored and displayed as `recovered`. It did disappear from active results. `markFoundItemRecovered` always writes `recovered`; it should write `returned` for found reports, while lost reports use `recovered`.
3. **React Query error after deletion.** Deleting either temporary listing navigated correctly and removed the record, but logged `Query data cannot be undefined` for the deleted item key. The detail query should return `null` or invalidate/remove its cache instead of resolving `undefined`.
4. **Large initial bundle.** Vite reported a ~721 kB JavaScript chunk. This is a performance concern, especially on campus mobile networks, not a functional blocker.

## Not yet verified

- New-account signup, confirmation email/rate limits, forgot/reset password, session expiry, and cross-user RLS boundaries.
- Borrow request submission with student ID, owner approval/rejection, conflict handling, Borrowed/My Lending updates across two accounts, borrower return, owner confirmation, and overdue reminder delivery.
- Two-way messaging and photo/voice attachments, avatar upload, drag-and-drop on every upload surface, and notification delivery/read state across accounts.
- Full responsive/accessibility audit across every route and target device width.

The temporary QA found and lending listings were deleted. The profile's temporary department was restored. Existing loans, requests, and messages were not modified.
