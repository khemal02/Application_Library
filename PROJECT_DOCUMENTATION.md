# ALMS — Project Documentation

Full structural, architectural, and workflow reference for the Application Library Management
System. `README.md` (root) stays the quick-start; this file is the deep reference — structure,
how requests actually flow, and the domain rules baked into the Ideas/Suggestions review models,
which have changed substantially since `README.md` was last written (that file still describes
the old fixed-chain review model — see "Known documentation drift" at the bottom).

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3, MUI 5, React Router, Redux Toolkit, Axios, React Hook Form, Vite |
| Backend | Node.js, Express 4 (routes → validate → auth → RBAC → controller → service → model) |
| Database | PostgreSQL 16 via Sequelize (migrations, no ORM-level seeding in normal dev) |
| Auth | JWT, data-driven RBAC (`roles` / `role_permissions` tables — not hard-coded per role) |
| Repo shape | npm workspaces — root `package.json` lists `["backend", "frontend"]` |

---

## 2. Repository layout

```
Application_Library/
├── package.json              workspaces root — dev/migrate/seed/test proxy into workspaces
├── README.md                  quick-start (see drift note at the end of this file)
├── docs/                      repo-level docs (OpenAPI lives under backend/src/docs instead)
├── backend/
│   ├── server.js               entry point — requires src/app.js, starts listening
│   ├── .sequelizerc
│   └── src/
│       ├── app.js               Express app: middleware stack, static /uploads, /health, /api-docs, mounts routes
│       ├── config/               env.js, database.js, logger.js
│       ├── docs/                 openapi.yaml — served at /api-docs via swagger-ui-express
│       ├── middlewares/          auth, rbac, ownership, validate, error, requestLogger, rateLimit, upload
│       ├── migrations/           40 files, timestamp-prefixed — see §7
│       ├── seeders/               8 files — demo data, run manually, never in normal dev
│       ├── models/                31 Sequelize models + index.js auto-loader — see §6
│       ├── modules/               28 module folders, one per domain — see §5
│       ├── routes/index.js       single central router — mounts every module's routes.js
│       └── utils/                 shared helpers — see §4
└── frontend/
    └── src/
        ├── main.jsx / App.jsx     bootstrap + Redux Provider + theme + router
        ├── app/                    store.js (Redux Toolkit), hooks.js
        ├── features/               Redux slices: auth, ui, notifications, toast
        ├── routes/                 AppRoutes.jsx (sitemap), ProtectedRoute.jsx, usePermission.js
        ├── services/               api.js (axios), resourceApiFactory.js, domains.js (every *Api export)
        ├── theme/                  theme.js
        ├── pages/                  one folder per feature area — see §9
        └── components/
            ├── common/              shared, reusable, entity-agnostic components — see §10
            └── layout/              MainLayout, Sidebar, Topbar, NotificationPanel, GlobalSearchBox, navConfig
```

---

## 3. Backend request lifecycle

Every module follows the same layering, enforced by convention rather than a framework:

```
HTTP request
  → routes.js       (express.Router — path + method + which middleware chain)
  → authenticate     (auth.middleware.js — verifies JWT, populates req.user)
  → authorize        (rbac.middleware.js — checks req.user.permissions against a required
                       {resource, action}, using utils/permissions.js#hasPermission)
  → validate(schema)  (validate.middleware.js — Joi; body by default, or {body,query,params})
  → controller        (thin — calls the service, wraps the result in ApiResponse, logs to audit)
  → service            (all real logic — queries, transactions, notifications)
  → model               (Sequelize)
```

`req.user` (populated by `auth.middleware.js` from the JWT) is a **flat** object:

```js
{ id, name, email, roleId, roleName, departmentId, functionalAreas, permissions, jti }
```

`permissions` is the array of `{resource, action}` rows for the user's role, resolved once at
login/token-verify time — not re-queried per request.

### RBAC predicate (`backend/src/utils/permissions.js`)

```js
function hasPermission(permissions, resource, action) {
  return (permissions || []).some((p) => {
    const resourceMatches = p.resource === resource || p.resource === '*';
    const actionMatches = p.action === action || p.action === 'manage';
    return resourceMatches && actionMatches;
  });
}

function isSuperAdmin(permissions) {
  return (permissions || []).some((p) => p.resource === '*' && p.action === 'manage');
}
```

`*` resource and `manage` action are both wildcards. `isSuperAdmin` is strictly the `*`+`manage`
combination — only Admin holds it — used wherever code needs "the one true bypass," not just
"this role manages resource X" (a Manager's `('ideas','manage')` row satisfies `hasPermission`
but not `isSuperAdmin`).

### Generic CRUD, factored out (`backend/src/utils/controllerFactory.js` + `crudFactory.js`)

Most simple resources (departments, tech stack, releases, ...) don't write bespoke
controller/service code at all — they call one factory each:

```js
// controllerFactory.js — turns {list, getById, create, update, remove} on a service into
// Express handlers, auto-writing the audit log on every mutation:
function createCrudController(service, { entityName, entityType, hooks = {} } = {}) {
  return {
    create: asyncHandler(async (req, res) => {
      const record = await service.create(req.body, req);
      await logAction({ req, action: 'create', entityType, entityId: record.id, newValue: record.toJSON() });
      if (hooks.afterCreate) await hooks.afterCreate(record, req);
      return ApiResponse.created(res, record, `${entityName} created`);
    }),
    // ...update/remove/getById/list follow the same shape
  };
}
```

A module only reaches for custom controller/service code when it needs something the factory
can't express — a transaction, a notification side-effect, or (Ideas/Suggestions) an entire
review-workflow engine. **`controllerFactory.js`, `crudFactory.js`, and `rbac.middleware.js` are
treated as off-limits for ad-hoc edits** in this project's own working conventions — any module
needing different behavior overrides the specific method instead of changing the shared factory.

### Nested sub-resources (`utils/nestedResourceRouter.js` + `scopeToParent.js`)

The 12 Application sub-resources (tech stack, features, AI prompts, docs, releases, bugs, known
issues, roadmap, timeline, change requests) are mounted as `/applications/:applicationId/X` and
share one router builder that wires `authenticate` → (ownership check) → `authorize` → `validate`
→ controller, with `scopeToParent` injecting `applicationId` into `req.query`/`req.body` so
`crudFactory`'s filtering and writes pick up the FK automatically. None of the 12 modules
hand-write this plumbing themselves — each just configures the builder differently: 11 of them
pass `requireApplicationAccess` (must own the app or share its department); `changeRequests`
deliberately passes `requireOwnership: false` instead — any logged-in role can create/read/update
a change request regardless of department, only its own delete is ownership-gated (to whoever
raised it, or a super-admin).

---

## 4. Shared backend utils (`backend/src/utils/`)

| File | Purpose |
|---|---|
| `permissions.js` | `hasPermission` / `isSuperAdmin` — the RBAC predicate, above. |
| `reviewPanel.js` | Shared by Ideas and Suggestions' review panels — functional-area-matched eligibility, `buildReviewPanel`/`buildMyReviewSlot` (Suggestions only — Ideas has its own panel logic now, see §11). |
| `entityCleanup.js` | `cleanupEntityRefs(entityType, entityId, {transaction})` — deletes every polymorphic row referencing a deleted entity (comments + their attachments, votes, taggables, status history, notifications matched by link prefix). Returns file paths without touching disk — callers unlink files only after their transaction commits. |
| `controllerFactory.js` | Generic CRUD → Express handlers, with audit logging built in. |
| `crudFactory.js` | Generic CRUD service layer (list/getById/create/update/remove) built on `paginate.js`. |
| `nestedResourceRouter.js` | Full router builder for `/applications/:id/X` sub-resources. |
| `scopeToParent.js` | Injects the parent id into `req.query`/`req.body` for nested routes. |
| `paginate.js` | `buildQueryOptions`/`buildPaginationMeta` — default limit 20, max 100. |
| `ApiError.js` / `ApiResponse.js` | Error subclass with `statusCode`; response envelope `{success, message, data, meta}`. |
| `asyncHandler.js` | Wraps async Express handlers so rejected promises reach `error.middleware.js`. |
| `auditLogger.js` | `logAction()` — writes a row to `audit_logs` for every mutation the factories or a module calls it for. |
| `validators.js` | Shared Joi fragments (industries, functional areas, password policy: 10–72 chars). |
| `parseUserAgent.js` | Dependency-free UA parser, used for the Profile → Security "active sessions" list. |

---

## 5. Backend modules (`backend/src/modules/`)

28 folders. Each follows `X.routes.js` / `X.controller.js` / `X.service.js` / `X.validator.js`
(Ideas and Suggestions additionally have `X.constants.js`).

| Module | Covers |
|---|---|
| `auth` | Login/logout/me/change-password, JWT issuance. |
| `profile` | Self-service "my profile" (account, privacy, active sessions, activity) — distinct from admin `users`. |
| `users`, `roles`, `departments` | Admin-side org/RBAC administration — `roles` includes `/roles/:id/permissions`. |
| `notifications` | Polymorphic per-user notifications; polled every 30s by the frontend, not pushed. |
| `auditLogs` | Read-only viewer over the audit trail every mutation writes to. |
| `dashboard` | Aggregate summary stats for the dashboard page. |
| `search` | Global cross-entity search. |
| `comments` | Polymorphic comments + replies, shared by ideas/idea_note/suggestions/applications. |
| `votes` | Polymorphic upvote/downvote toggle + summary. |
| `tags` | Free-form polymorphic tagging. |
| `attachments` | Polymorphic file attachments; `storage.js` is the on-disk driver behind a `{save, remove}` interface (swappable for S3). |
| `applications` | The core catalog entity — everything else in "Application Tracking & Documentation" hangs off it. |
| `techStack`, `features`, `aiPrompts`, `architectureDocs`, `apiDocs`, `dbDocs`, `releases`, `bugs`, `knownIssues`, `roadmap`, `timeline`, `changeRequests` | The 12 nested Application sub-resources — one CRUD module each, built on `nestedResourceRouter`. `changeRequests` is the newest: lightweight ad-hoc change tickets against an application (title/description/priority, `pending → in_review → approved/rejected/implemented`), open to every role to create/read/update regardless of department, delete restricted to whoever raised it (or a super-admin). |
| `ideas` | New Ideas + Modify Current Application (feature requests) — one table, one review-panel engine. Full detail in §11. |
| `suggestions` | Per-application improvement suggestions — its own review panel + execution lifecycle. Full detail in §12. |

---

## 6. Database models (`backend/src/models/`)

31 model files, auto-loaded and associated by `models/index.js` (reads every `*.model.js`, calls
`.associate(db)`). All UUID primary keys except `Idea.ideaNumber` (an auto-increment *display*
number, not the PK). Grouped by area:

**Org / auth** — `user`, `role`, `rolePermission`, `department`, `userSession`.

**Applications & its 12 sub-resource tables** — `application`, `applicationTechStack`,
`applicationFeature` (+ `featureDependency`), `aiPrompt`, `architectureDoc`, `apiEndpoint`,
`dbTableDoc`, `releaseNote`, `bugHistory`, `knownIssue`, `roadmapItem`, `timelineMilestone`,
`changeRequest`.

**Ideas** — `idea`, `ideaReview` (the panel row: `ideaId, userId, kind ('reviewer'|'approver'|
'tiebreaker'), decision, note, addedBy, addedAt` — `decision` is a 3-value enum,
`approve`/`request_changes`/`reject`, but only a `reviewer` row may actually hold
`request_changes`; an `approver`/`tiebreaker` row is restricted to `approve`/`reject` in the
service layer — plus legacy `reviewerId`/`roleName` columns kept nullable for rows backfilled
from the old fixed chain).

**Suggestions** — `applicationSuggestion`, `suggestionReview`.

**Shared polymorphic infrastructure** — `comment` (self-referential for replies), `attachment`,
`vote`, `tag` + `taggable`, `notification`, `auditLog`, `statusHistory` (the generic
from→to status log every workflow writes to, keyed by `entityType`/`entityId`).

---

## 7. Migrations & dev workflow — no seeding after initial setup

40 files in `backend/src/migrations/`, timestamp-prefixed kebab-case
(`YYYYMMDDHHMMSS-description.js`). 8 files in `backend/src/seeders/` (roles, role-permissions,
departments, users, demo applications/ideas/suggestions).

**Normal day-to-day development only ever runs `npm run migrate`** (`sequelize-cli db:migrate`)
against the existing database — seeders are a one-time initial-setup step (or `npm run db:reset`
if you want to wipe back to the demo dataset), never part of the regular dev loop. Running a
seeder against a live-with-real-data database would duplicate demo rows, not refresh anything.

---

## 8. Frontend bootstrap, routing, and state

**Bootstrap**: `main.jsx` mounts `App.jsx`, which wraps everything in the Redux `Provider`, the
MUI theme, and the router. On load, `authSlice`'s `fetchMe` thunk resolves the stored token (if
any) into a real user before `ProtectedRoute` will render anything gated — `state.auth.bootstrapped`
is what a route waits on to avoid a false "not logged in" flash.

**Routing** (`frontend/src/routes/AppRoutes.jsx`):

| Path | Page | Gate |
|---|---|---|
| `/login` | `Auth/LoginPage.jsx` | none |
| `/` | → redirects to `/applications` | — |
| `/dashboard` | `Dashboard/DashboardPage.jsx` | logged in |
| `/applications`, `/applications/:id` | `Applications/ApplicationsListPage.jsx`, `ApplicationDetailPage.jsx` | logged in |
| `/ideas`, `/ideas/:id` | `Ideas/IdeasListPage.jsx`, `IdeaDetailPage.jsx` | logged in |
| `/feature-requests`, `/feature-requests/:id` | `Ideas/FeatureRequestsListPage.jsx`, `IdeaDetailPage.jsx` (reused) | logged in |
| `/suggestions`, `/suggestions/:id` | `Suggestions/SuggestionsListPage.jsx`, `SuggestionDetailPage.jsx` | logged in |
| `/admin/users`, `/admin/roles`, `/admin/departments` | `Admin/*Page.jsx` | `resource: 'users'` |
| `/admin/audit-logs` | `Admin/AuditLogsPage.jsx` | `resource: 'audit_logs'` |
| `/profile` | `Profile/ProfilePage.jsx` | logged in |
| `*` | `NotFoundPage.jsx` | logged in |

Only the `/admin/*` routes carry a `resource`/`action` gate at the routing layer — every other
route is reachable by any logged-in user; finer-grained gating (who can actually *do* something
once there) happens inside the page/API, the same `hasPermission` predicate via `usePermission()`.

**State** (`frontend/src/app/store.js`, Redux Toolkit): four slices — `auth` (token/user/
bootstrapped, `selectHasPermission`), `ui` (theme mode, sidebar collapse, breadcrumb label),
`notifications` (unread bell count, polled), `toast` (the app-wide `GlobalToast`/`useToast()`
backing store).

---

## 9. Frontend services layer (`frontend/src/services/`)

- **`api.js`** — one axios instance; request interceptor attaches `Authorization: Bearer <token>`
  from `localStorage`; response interceptor clears the token and redirects to `/login` on a 401.
- **`resourceApiFactory.js`** — `createResourceApi(basePath)` (list/getById/create/update/remove
  for a top-level resource) and `createNestedResourceApi(buildBasePath)` (the same shape,
  parameterized by a parent id) — most `*Api` objects in `domains.js` are built from one of these
  two, plus a handful of extra named methods for anything not-plain-CRUD (e.g. `ideasApi.
  submitReview`, `ideasApi.panelCandidates`).
- **`domains.js`** — every API client the frontend uses: `authApi`, `profileApi`, `applicationsApi`,
  `ideasApi`, `suggestionsApi`, the 12 nested sub-resource APIs (`techStackApi`, `featuresApi`,
  `changeRequestsApi`, …), `usersApi`, `rolesApi`, `departmentsApi`, `auditLogsApi`, `commentsApi`,
  `votesApi`, `tagsApi`, `attachmentsApi`, `dashboardApi`, `searchApi`, `notificationsApi`. (The
  Excel/PDF export feature and its `reportsApi`/`reports` backend module were removed from the
  project entirely.)

## Frontend pages (`frontend/src/pages/`)

- **`Admin/`** — Users, Roles, Departments, AuditLogs.
- **`Applications/`** — list + detail + form dialog, plus `tabs/` with one component per
  sub-resource (Overview, TechStack, Features, AiPrompts, ArchitectureDocs, ApiDocs, DbDocs,
  Releases, Bugs, KnownIssues, Roadmap, Timeline, ChangeRequests, Suggestions — 14 tabs).
- **`Ideas/`** — `IdeasListPage`, `FeatureRequestsListPage` (both filter the same list by
  `category`), `IdeaDetailPage` (shared by both lanes), `IdeaFormDialog`, `IdeaPanelCard`,
  `PanelPickerDialog`.
- **`Suggestions/`** — list, detail, form dialog.
- **`Dashboard/`, `Auth/`, `Profile/`** — one page each (Profile has a `sections/` subfolder,
  one component per settings section).

## 10. Shared frontend components (`frontend/src/components/common/`)

Entity-agnostic building blocks used across Ideas, Suggestions, and Applications:
`CommentThread.jsx` (comments+replies, opt into a richer "rich mode" via named boolean props —
Ideas uses it fully, Suggestions and Applications get the plain/simple rendering by default),
`NotesThread.jsx` (lighter-weight notes thread), `ReviewPanel.jsx` (Suggestions' own panel —
**not** the same component as `IdeaPanelCard.jsx`, which is Ideas-specific and lives under
`pages/Ideas/`), `ConfirmDialog.jsx`, `DataTable.jsx`, `FilterBar.jsx`,
`StatusBadge.jsx`, `WorkflowStepper.jsx`, `AttachmentGallery.jsx` + `AttachmentsPanel.jsx`,
`VoteButtons.jsx`, `TagInput.jsx`, `AsyncState.jsx` (Loading/Error blocks), `BackButton.jsx`,
`GenericFormDialog.jsx` / `SubResourceTab.jsx` (the scaffold most sub-resource tabs are built on),
`StatCard.jsx`, `GlobalToast.jsx`, `ErrorBoundary.jsx`.

`components/layout/` (separate from `common/`) holds the app shell: `MainLayout`, `Sidebar`
(+ `navConfig.js`, which filters nav items by permission), `Topbar`, `Breadcrumb`,
`NotificationPanel`, `GlobalSearchBox`.

---

## 11. The Ideas module — how the review actually works

This is the module that changed the most and is worth the most explanation, since `README.md`'s
description of it is now wrong.

**One table, two lanes.** `category` is `'new_idea'` or `'existing_app_feature'` ("Modify Current
Application"). Same model, same form (`IdeaFormDialog.jsx`, branched by a `category` prop), same
detail page, same review engine — a feature request just already has a target `applicationId`
and skips industry/functional-area/technologies fields (inherited from the target Application
instead).

**The panel, not a fixed chain.** Every idea carries an open panel of participants
(`idea_reviews` rows), each either a **reviewer** or an **approver**, added by the submitter (or a
CEO/Admin) via `POST /ideas/:id/panel`. Eligibility is identical for both kinds — **any active
user** — the only other eligibility rule in the system is who may be picked as an Application
*owner* on approval (`applications:update`/`manage`), which is unrelated to panel membership.

**Reviewers are advisory.** Their vote has three tiers — `approve`/`request_changes`/`reject`,
displayed as **Fully supported**/**Partially supported**/**Not supported** — recorded and visible
but never changing the idea's status. Approvers and the CEO tie-break stay strictly binary
(`approve`/`reject` only, enforced server-side): their vote can actually end the idea, so there's
no meaningful middle option for it the way there is for an advisory reviewer.

**Approvers decide by majority, fully in parallel with reviewers.** Every approver votes
whenever they want — no waiting on reviewers, no waiting on each other except to know when the
set is complete. Once every approver has voted, whichever side has more wins:

- Majority approve → idea `approved`. For a `new_idea` with no Application yet, this also
  registers a real Application (owner picked by whichever approver's vote completed the set). For
  a feature request, it just attaches to the existing target Application — nothing new is created.
- Majority reject → idea `rejected`. Nobody's *single* reject short-circuits anything anymore —
  that was the old rule, replaced deliberately with real majority voting.
- **A tie** doesn't resolve on its own. Any active user holding the CEO role (or Admin) can cast
  a deciding vote directly — they don't need to be a panel member first; this is the one place in
  the whole system where authorization is a role check instead of panel membership.

**Panel management rules** (`R3`–`R8` in this project's own working shorthand, still accurate):
the submitter can never be added to their own panel; adding someone is always allowed while the
idea is live, and is logged; removing someone who hasn't yet voted is allowed (the *only* escape
hatch for a stalled panel — no bypass/override/timeout exists on purpose); removing someone who
already voted is refused, their verdict stays on the record; only the submitter, a CEO, or an
Admin may change the panel at all; an idea with zero approvers can never be decided (surfaced in
the UI, not a silent stall); everything freezes immutably once decided — no more panel changes,
votes, comments, or description edits.

**Where it lives in code**: `backend/src/modules/ideas/ideas.service.js` (`buildPanel`,
`addParticipants`, `removeParticipant`, `panelCandidates`, `submitReview`, `submitTieBreak`,
`finalizeIdea`) and `frontend/src/pages/Ideas/IdeaPanelCard.jsx` (the panel UI) +
`PanelPickerDialog.jsx` (the add-reviewer/add-approver picker).

---

## 12. The Suggestions module

Per-application improvement suggestions, grouped by department. Its own review panel
(`utils/reviewPanel.js` — team_lead/manager/ceo, functional-area-matched eligibility, still
shared infrastructure with nothing Ideas-specific in it) governs the `technical_review` stage;
approval requires all three panel roles' approval by majority, same underlying rule shape as
Ideas but resolved through a different, older code path (`ReviewPanel.jsx`, not
`IdeaPanelCard.jsx` — the two are genuinely separate components, don't confuse them).

Beyond review, a suggestion has its own execution tail that Ideas has no equivalent of:
`submitted → technical_review → approved → assigned → implemented → closed` — assigning an
implementer, marking it implemented, and closing it out are plain status transitions gated by the
flat `suggestions:review` permission, not by the review panel.

---

## 13. Shared polymorphic infrastructure

Comments, attachments, votes, tags, and status history are **not** reimplemented per entity —
every one of `entityType`/`entityId` pairs (`idea`, `idea_note`, `suggestion`, `suggestion_note`,
`application`, `comment` for attachments-on-comments) hits the same generic table and the same
generic module. Deleting a parent entity runs `entityCleanup.js#cleanupEntityRefs` inside the
same transaction as the entity's own delete, so nothing is ever left orphaned — attachment files
themselves are only unlinked from disk *after* that transaction commits, so a rollback can never
leave "file gone, row still there."

---

## 14. Development conventions specific to this project

- **Migrate, don't seed**, once the database already has real data — seeders are for a fresh
  environment or an intentional full reset only.
- **Don't hand-edit `controllerFactory.js`, `crudFactory.js`, or `rbac.middleware.js`** — a module
  needing different behavior overrides its own controller/service method instead.
- **Prove backend behavior with real HTTP calls as real distinct users**, not by reading the code
  and assuming it works — this project's own working history treats "I read the code" and "I
  called the endpoint and watched it happen" as different claims.
- **Report a contradiction between what's asked and what the code actually does *before* writing
  code for it** — several rounds of work on this project turned up a stale assumption (in a
  prompt, in a comment, or in `README.md` itself) that needed correcting before implementing
  anything on top of it.
- Comments in code explain the non-obvious **why** (a constraint, an invariant, a deliberate
  tradeoff) — not what the code already says by being well-named.

---

## Known documentation drift (as of this file)

`README.md`'s module descriptions for Ideas and Suggestions describe the **old** fixed
team_lead→manager→ceo review chain (and, for Ideas, an old submitted→discussion→technical
review→review→approved→development-ready stage machine). Both have since been replaced by the
open reviewer/approver panel model described in §11–12 above. `README.md` has not been updated to
match — this file is the accurate one.
