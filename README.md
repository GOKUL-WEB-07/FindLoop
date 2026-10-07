# FindLoop

A responsive campus lost-and-found and borrow-and-lend application built with React, TypeScript, Vite, TanStack Query, React Hook Form, Zod, and Supabase.

## Run locally

1. Copy `.env.example` to `.env` and set your Supabase URL and anonymous key.
2. In Supabase SQL Editor, apply the baseline migrations `001` through `010`, then the timestamped repair migrations in filename order. Existing projects should apply only repairs that are missing; the connected project already has the repair migrations recorded.
3. Run `npm install` then `npm run dev`.

Without environment variables, the browsing interface renders safe local sample listings; authentication and writes intentionally require Supabase.

## Architecture

- `src/features/auth`: session context and route guard
- `src/services`: isolated Supabase data/auth calls
- `src/hooks`: TanStack Query hooks
- `src/pages`: route compositions
- `supabase/migrations`: database schema, auth profile trigger, indexes, and baseline RLS policies

## Supabase configuration

The repair migration configures public `avatars` and private `item-images`, `student-id-cards`, and `message-attachments` Storage buckets. Listing photos and student IDs use authenticated signed URLs. Student IDs are readable by the uploader and the owner reviewing that request. Deploy the updated frontend before relying on old public image URLs. Configure the Site URL to your deployed app and allow its origin/base path plus local port 5174 reset URLs in Auth > URL Configuration.

The migrations create profiles, lost/found listings, lending listings, request verification, transactions, messages, notifications, storage policies, and atomic approval/return functions. All migrations must be applied for the current interface to work.

## Android APK download

The public `/download` page is linked from sign-in/sign-up and the app header. Set `VITE_APK_DOWNLOAD_URL` in `.env` to a public HTTPS APK URL, or place your signed APK at `public/downloads/FindLoop.apk` and set `VITE_APK_DOWNLOAD_URL=/downloads/FindLoop.apk`. Restart the dev server or rebuild after changing this value. Leave it blank to show the coming-soon state.

The APK must be built and signed separately; this web project does not generate an Android binary. For externally hosted files, configure the file server to return `Content-Type: application/vnd.android.package-archive` and `Content-Disposition: attachment; filename="FindLoop.apk"`, since browsers may ignore the download attribute for cross-origin URLs. Verify the configured URL downloads the actual APK after deployment.

## Browser installation (PWA)

FindLoop includes `public/manifest.json`, app icons, and an install option at `/download`. Deploy the production build over HTTPS (localhost is supported for development). Supporting browsers offer installation when their eligibility criteria are met; iOS users can use Safari > Share > Add to Home Screen. This installs the web app and does not require an APK.

The service worker registers in production and serves a generic offline page if navigation fails. Listings, messages, and account operations still require internet access; private API data is not cached. Run `npm run build` and `npm run preview` to check the production install flow. Hosting must serve public files directly and rewrite application routes to `index.html`.

## GitHub Pages

In repository Settings > Pages, select GitHub Actions as the source. The included workflow builds and deploys dist when main changes. Add repository Actions secrets VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for authentication and data access. The Pages build uses /FindLoop/ and hash routes so navigation and refresh work on static hosting.
