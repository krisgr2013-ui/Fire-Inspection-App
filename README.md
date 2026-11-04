# Gold Standard

Gold Standard is being developed as a field-first fire-protection service platform, initially limited to kitchen fire-suppression systems and portable fire extinguishers.

## Current status

- The new multi-file React + Vite application lives in `src/` and is the active development target.\n- `gold-standard-v2.html` is retained as a legacy prototype/reference, not the current app entry point.
- The current React app is mobile-first and desktop-responsive, with touch-friendly navigation and local browser storage. It is still a single-device workspace until authentication and cloud synchronization are connected.
- `supabase/schema.sql` is a proposed production database foundation with organization-level row security and role-scoped policies; it still requires application, migration, and security testing before production use.
- `.github/workflows/quality.yml` runs HTML parsing and JavaScript syntax checks on pushes and pull requests.
- No live database, authentication provider, file storage, payment processor, or production hosting has been provisioned.

## Production architecture

- Front end: React + Vite responsive web application (mobile-first; desktop sidebar and mobile slide-out navigation).
- Authentication and data: Supabase Auth + PostgreSQL with row-level security.
- Files: private object storage for inspection photos and signatures; signed URLs for access.
- Hosting: static frontend deployment with environment-specific public configuration.
- Observability: error reporting, audit events, backups, and restore drills before customer data is used.

## Database setup (owner action required)

1. Create a Supabase project in an account you control.
2. Open SQL Editor and run `supabase/schema.sql`.
3. After signing in, call `public.create_organization_with_owner('Your Company Name')` from the authenticated client to create the first organization and owner membership atomically. Do not expose the service-role key in browser code.
4. Configure private storage buckets and policies for inspection evidence.
5. Supply the project URL and anon/public key through deployment environment settings. Never commit secrets.

## Security notes

- Every business record carries an `organization_id`; row-level security scopes records to organization membership.
- The service-role key is server-only and must never be placed in HTML, JavaScript, or a public repository.
- User invitations, role changes, customer portal access, and storage policies require additional trusted server-side workflows before production. Organization bootstrap is provided by `create_organization_with_owner`.
- Do not store payment card data. Use a compliant payment provider if payments are added.

## Inspection and compliance disclaimer

Checklist content is an operational aid, not a substitute for the current adopted code, licensed NFPA standards, manufacturer instructions, technician qualifications, or the authority having jurisdiction. Edition references and acceptance criteria must be validated before compliance claims or automated pass/fail certification.

## Release gates

- [ ] Browser and mobile-device QA on supported browsers.\n- [ ] Build and inspect the Vite production bundle.
- [ ] Auth, tenant-isolation, and role-permission tests.
- [ ] Offline queue, conflict handling, and sync recovery tests.
- [ ] Photo/signature upload and retention policies.
- [ ] Database backup and restore test.
- [ ] Accessibility, privacy, terms, and security review.
- [ ] Pilot with real technicians using supervised, non-production records first.

## Local preview

Install Node.js 22 or later, run `npm install`, then `npm run dev` for local development or `npm run build` to create the production bundle in `dist/`. The legacy HTML prototype is not the active entry point. Do not use browser-local storage as the sole record system for business-critical inspections.
