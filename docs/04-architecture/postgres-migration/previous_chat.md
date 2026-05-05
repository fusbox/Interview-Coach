Database client and query layer

Repositories like supabase-session-repository.ts (line 1), supabase-invite-repository, supabase-template-repository, and supabase-feedback-repository all use Supabase’s JS query API directly.

There are also Supabase RPC calls for things like metrics, rate limits, invite batch creation, and engagement increments.

Your schema and migration history live in the supabase folder, including SQL migrations and custom functions.



Authentication and session management

Login, signup, logout, auth callback, middleware, and “get current user” all currently rely on Supabase Auth.

Files like server.ts (line 1), middleware.ts, the login page, and many API routes call supabase.auth.getUser().

So if your company DB server is just PostgreSQL, it does not replace Supabase Auth by itself.



Authorization model / server privilege model

The app uses both a user-scoped client and an admin client.

Supabase’s service-role behavior currently acts like a privileged backend access path.

Some logic also depends on stored procedures, row filtering, and server-side cookies that Supabase handles for you.




So the short answer is:


Migrating from Supabase to “plain PostgreSQL plus your own connection string” is feasible.

Migrating from Supabase to “plain PostgreSQL with no replacement auth system” is not seamless.

The database migration and the auth migration are really two related but separate projects.


A helpful way to think about scope is this:

If your company wants only the data moved


Keep Supabase Auth temporarily.

Point repository code at your company Postgres instead of Supabase for reads/writes.

Leave login/session middleware alone for phase 1.


That is still real work, but much more manageable.

If your company wants Supabase fully removed


You need a replacement for:

recruiter login/signup

cookie/session handling

current-user lookup in API routes and server components

admin/service-role style DB access

possibly any RLS assumptions now enforced in Supabase





That becomes a broader platform migration.

What would be involved, concretely:

Recreate the schema in your company Postgres

Apply the SQL in supabase/schema.sql

Review all migration files in supabase/migrations

Recreate tables, indexes, enums, constraints, and functions

Recreate every RPC/function the app currently calls




This part is straightforward mechanically, but it must be thorough. Missing one function can break specific flows later.

Replace the server-side data access layer

Anywhere using .from(...).select(...), .insert(...), .update(...), .upsert(...), .rpc(...) needs to move to pg or a query builder/ORM

The cleanest approach is to replace repository implementations first, not route logic first




In this repo, the main seams are:


SupabaseSessionRepository

SupabaseInviteRepository

SupabaseTemplateRepository

SupabaseFeedbackRepository

metrics backend

rate-limit backend

idempotency store

candidate token storage/validation paths


That’s good news, because there is already some repository abstraction in place.

Decide what replaces Supabase Auth

This is the big architectural question. Before touching much code, I’d want a firm answer to:

Are you keeping Supabase Auth temporarily?

Is the company providing another auth system already, like Azure AD, Auth0, Cognito, or custom SSO?

Do recruiters still need email/password login, or will they use SSO?

Do candidate flows need auth changes too, or are they still token-link based?




If there is no auth replacement yet, I would strongly recommend not trying to remove Supabase Auth in the same first pass as the DB migration.

Replace middleware/session code

Current auth/session touchpoints include:

src/lib/supabase/server.ts

src/lib/supabase/middleware.ts

src/app/auth/callback/route.ts

src/app/login/page.tsx

components that call createBrowserClient(...).auth.getUser()

many API routes that call createClient().auth.getUser()




This is why the migration is not just backend-only. Some frontend and app-shell code will move too.

Rework admin vs user DB access

Today you have:

user-context access via Supabase client

admin-context access via service role




With plain Postgres, you’ll likely replace that with:


one server-side pool using pg

explicit authorization checks in application code

no browser-direct DB access


That’s a healthier long-term architecture, but it means pushing some current “Supabase convenience” into your own server layer.

Recreate operational backends

There are additional Supabase-backed features beyond core CRUD:

rate limiting

idempotency keys

metrics rollups and SLO queries

invite batch tracking

engagement increment functions




Those are easy to forget, and they matter in production.

How hard is this in practice?

I’d break it down like this:


Pure schema/data move: medium

Repository/query layer replacement: medium to large

Auth/session replacement: large

Full Supabase removal: definitely large


So if you’re asking “Can I do this by just setting DATABASE_URL and changing a couple files?” the answer is no.

A realistic low-risk migration strategy would be:

Phase 1: move database reads/writes, keep Supabase Auth

Add a Postgres client using DATABASE_URL

Recreate schema/functions on company DB

Replace repository implementations one by one

Keep getUser() and existing login/session flows on Supabase for now

This gets the app’s data off Supabase first



Phase 2: migrate auth

Choose the company auth provider

Replace login/session middleware

Update API route auth checks

Update recruiter settings/login/logout/profile guards

Remove Supabase Auth dependencies



Phase 3: remove Supabase-specific leftovers

delete Supabase client wrappers

remove service-role usage

remove remaining Supabase packages

retire the supabase/ migration folder or treat it as historical




What I’d want answered before estimating implementation:

Is the company DB server plain PostgreSQL only, or does the company also provide auth/SSO?
Is the goal “move data off Supabase” or “remove Supabase entirely”?
Do you need existing Supabase data migrated into the new DB, or is this a fresh environment?
Can you keep Supabase Auth temporarily during the DB move?
Does the company DB allow creating SQL functions/procedures, or is it more locked down?

My honest recommendation:


If you’re less familiar with backend, do not attempt the full “DB + auth” migration as one big bang.

The safest version is: migrate database access first, leave auth alone temporarily.

This repo is actually in decent shape for that because the repository layer gives us a natural seam.


If you want, I can do the next useful step and produce a repo-specific migration plan:


exact files/modules to change first

which Supabase features need replacements

what can stay temporarily

a suggested order of implementation with rough risk levels

---

Migration Plan

This is a full de-Supabase migration, but with no historical data migration, which helps a lot. I’d run it in two engineering phases even if deployment waits until both are done.

Track 0: Decisions To Lock Immediately


Confirm target hostnames:

candidate: interview-coach.talentarbor.ai

recruiter: recruiter.interview-coach.talentarbor.ai




Confirm auth direction:

recruiter/admin: Okta SSO

candidate: token invite flow only, or candidate login later




Confirm deployment shape:

single Next app with multi-host routing

or split candidate/recruiter apps later




Confirm DB capabilities:

can your team create SQL functions/procedures?

can the app use one privileged application user?




Confirm ATS integration intent:

whether recruiter launches from ATS is now in-scope or phase 2





Phase 1: Replace Supabase Data Layer While Leaving Existing Auth Temporarily

Goal: get all app data operations off Supabase and onto your company Postgres.

Stand up a plain Postgres access layer

Add a shared DB module around pg using DATABASE_URL

Keep it server-only

Add env support for:

DATABASE_URL

or composed POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB






Recreate schema in company Postgres

Use supabase/schema.sql (line 1)

Apply all files in supabase/migrations (line 1)

Inventory and recreate SQL functions used by the app, especially:

invite batch creation

rate limiting

metrics rollups

engagement increment




Because this is a fresh env, you can clean this up while porting instead of preserving every Supabase-ism exactly



Replace repository implementations

Start with the repositories because they are the best seam:

SupabaseSessionRepository (line 1)

SupabaseInviteRepository

SupabaseTemplateRepository

SupabaseFeedbackRepository




Recommended order:

session repository
invite repository
template repository
feedback repository

Why this order:


session/invite are the product core

template/feedback are useful but less foundational


Replace Supabase-backed infrastructure utilities

These are easy to miss and matter a lot:

src/lib/server/idempotency.ts

src/lib/server/rate-limit.ts and backend

src/lib/server/metrics/backend.ts

candidate token persistence/lookup in src/lib/server/auth/candidate-token.ts



Keep Supabase Auth only as a temporary shell

During Phase 1, it is fine if these still use Supabase while DB is being moved:

src/lib/supabase/server.ts (line 1)

src/middleware.ts (line 1)

recruiter login/signup

getCachedUser()

This reduces migration risk while you untangle data access.




Phase 2: Replace Supabase Auth With Okta

Goal: fully remove Supabase from runtime architecture.

Define auth boundaries

Recruiter/admin routes require Okta-authenticated employee users

Candidate routes should remain invite-token based unless product explicitly wants candidate accounts

Admin authorization should move from hardcoded email checks in rbac.ts (line 1) to Okta claims/groups if possible



Replace session middleware

Current middleware is entirely Supabase-driven in src/middleware.ts (line 1).

Replace with:

Okta session validation

protected-route logic for recruiter/admin surfaces

optional host-based routing behavior if using separate candidate/recruiter subdomains



Replace current-user helpers

Replace getCachedUser() and createClient().auth.getUser() usage with your Okta/session abstraction.

Common impacted areas:

recruiter layouts/pages

API routes under src/app/api/...

settings/admin/recruiter pages



Remove Supabase login/signup/callback

Current Supabase auth surfaces:

login page (line 1)

src/app/auth/callback/route.ts

These will become:

redirect to Okta

or no standalone login page at all if ATS/Okta is the entry point



Replace browser Supabase client usage

Any createBrowserClient(...) calls need to be removed from recruiter UI and replaced with:

server actions

app API routes

or session data passed from server components




Phase 3: Product/Integration Hardening

ATS deep-link flow

Add “Practice Interview” button in ATS

Pass candidate/job context to recruiter app

Prefill invite creation form

Optionally create invite in one click later



Hostname-aware public URL generation

You already generate invite URLs and email links. Once domains are finalized, make sure:

candidate-facing links always resolve to candidate host

recruiter admin links stay on recruiter host



Authorization cleanup

move admin checks from hardcoded emails to Okta groups/claims

make recruiter identity explicit in app DB records




Practical Guidance Updated By Your Answers


Since there is no data migration, favor clean replacement over compatibility hacks.

Since Supabase must be removed entirely, treat Okta as a first-class dependency, not a later detail.

Since the recruiter flow may be internal/ATS-launched, prioritize recruiter auth design now.

Since candidate traffic is public token-based, keep candidate and recruiter origins separated unless infra strongly prefers a single-host app.


What I’d Advocate Internally Right Now


Lock the recruiter domain now

Lock Okta for recruiter/admin now

Confirm whether candidate remains token-only

Prioritize ATS launch flow if recruiter adoption matters

Ask infra now whether Postgres functions/procedures are allowed


Risk Areas


Auth migration is the highest-risk part, not raw SQL

Supabase utility backends like metrics/rate limits/idempotency are easy to overlook

Browser-side Supabase usage in recruiter UI must be removed, not just server repositories

Hostname decisions made late will cause churn in auth, redirects, emails, and ATS links


Recommended Implementation Order

Lock hostnames and Okta approach
Add Postgres client layer
Port schema/functions
Replace repositories
Replace rate limit / idempotency / metrics / candidate token backends
Replace auth middleware and current-user abstraction with Okta
Remove login/signup/callback Supabase flows
Remove remaining Supabase packages and config
Add ATS deep-link integration

If you want, the next high-value step is for me to turn this into a file-by-file checklist with “change here / replace with this / blocked by infra?” so you can start execution without holding the whole architecture in your head.

Before that, when my colleague provided: 
# PostgreSQL Database Connection String
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db-name>
 
# DB Credentials
POSTGRES_HOST=
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=

Is there anything you can infer about what he thinks I should be doing, exactly? We have timezone and language barriers with me being in the US and much of our dev team in India, so I want to stage everything as best I can prior to sending communications.

Yes. There are a few useful inferences you can make from what he sent, and they help narrow what he likely assumes the migration means.

The strongest inference is: he is thinking in terms of “connect the app to our PostgreSQL server” more than “replace Supabase as a full platform.” In other words, he likely gave you database access details, not a complete replacement architecture.

What his message most likely implies:

He expects the app to connect to a plain PostgreSQL database using either:
one full DATABASE_URL, or
the individual POSTGRES_* fields
He is probably thinking about backend data storage first
He probably is not, from this message alone, accounting for:
auth/session replacement
SSO/Okta integration
cookie/session middleware
Supabase RPC/function replacements
browser-side Supabase client removal
That does not mean he’s unaware of those pieces. It just means the information he sent is scoped like “here is the DB connection,” not “here is the complete Supabase replacement plan.”

There are a few more specific clues:

He gave both DATABASE_URL and split credentials
This usually means one of two things:
they don’t know which style your app expects yet, so they gave both
or they expect you to choose the format most convenient for the app/framework
That suggests he likely expects an application-side DB client integration, not necessarily a managed platform abstraction.

POSTGRES_USER=postgres
That often implies:
a fairly direct Postgres setup
possibly an admin-ish or default database user
not a polished app-specific least-privilege service account yet
That’s worth noting. For production, I would not want to ship with the generic postgres superuser if that’s what it actually is. It may just be a placeholder, but it’s a good question to ask.

No mention of auth provider
If he expected you to replace Supabase Auth too, I would have expected at least one of these to come with it:
Okta app/client settings
SSO callback URLs
session/token expectations
identity/group/claim mapping guidance
Because none of that was included, he probably assumes either:

auth is a separate workstream
or he doesn’t yet realize how much of the app depends on Supabase beyond raw DB
No mention of migrations, schema ownership, or SQL functions
That suggests he may be assuming:
“point the app at Postgres and create the tables”
rather than
“rebuild Supabase-specific DB behavior including stored procedures and operational tables”
Again, that’s a normal assumption from someone thinking at the infrastructure handoff level.

So if I had to summarize what he likely thinks you should be doing, I’d phrase it like this:

“He probably thinks I should refactor the app to use our company PostgreSQL database instead of Supabase for data persistence, and he may not yet be fully distinguishing that from replacing Supabase Auth/session/platform behavior.”

That’s actually a very good thing to clarify early, because it prevents a lot of “I thought this was just a DB swap” confusion later.

What I would stage before messaging him is a short distinction between these two scopes:

Scope A: database-only replacement
replace Supabase data access with Postgres
keep Supabase Auth temporarily
Scope B: full Supabase removal
replace database
replace auth/session/cookies
replace platform-specific functions/utilities
integrate Okta
That framing is useful across language/timezone barriers because it turns an ambiguous architecture conversation into a scope confirmation.

A few concrete questions you should probably ask next:

Are you expecting me to replace only the database connection first, or remove Supabase entirely in one effort?
Will Okta be the replacement for recruiter authentication?
Should I assume candidate flows remain token-link based without login?
Are Postgres functions/stored procedures allowed in the target DB environment?
Should I use the provided postgres user temporarily, or will there be an app-specific service account?
Which env format should I standardize on: DATABASE_URL or individual POSTGRES_* variables?
My recommendation for communication is to lead with a short “what I think you mean” summary before asking questions. Something like:

“My understanding is that you want me to migrate app data storage from Supabase to your PostgreSQL server using the provided connection details. I want to confirm whether this is only the DB migration first, or full Supabase removal including auth/session replacement, since Supabase currently handles both.”

That kind of message is very effective because:

it shows you understood the handoff
it exposes the hidden architectural issue
it makes it easy for your colleague to correct scope without a long back-and-forth
One more practical inference: since he gave you raw DB credentials now, you can probably start useful prep work immediately even before final scope confirmation:

inventory Supabase DB usage
prepare a Postgres connection layer
list required tables/functions/migrations
separate data-layer work from auth-layer work
So yes, there is something meaningful to infer: he’s almost certainly pointing you toward a plain Postgres migration path, and probably not yet handing you a full Supabase replacement design.

