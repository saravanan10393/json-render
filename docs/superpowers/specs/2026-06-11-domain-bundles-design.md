# Domain-Specific Fragment Bundles — Design

Date: 2026-06-11
Status: approved (extends the fragments-benchmark work)
Branch: `fragments-benchmark`

## Goal

Add four domain bundles alongside the existing ecommerce bundle and the generic
kit: **CRM**, **Helpdesk**, **Project management**, **Blog/CMS**. Each is a set
of standalone, hand-built fragments (built from catalog primitives like the
ecommerce bundle — NOT thin wrappers over the generic kit) keyed to a fixed
entity contract with specific field ids. ~5 fragments per bundle, ~20 total.

## Why standalone (not generic-kit wrappers)

The user chose standalone hand-built. Each fragment emits its own
elements/datasources, giving domain-tuned UX. Tradeoff accepted: more code, and
they do not auto-inherit generic-kit fixes. To limit risk, every fragment reuses
the proven runtime contracts the generic kit established (repeat-row tables with
`displayElements`/`flexCell`-style flex wrapping, two-step `$template` repeat
writes, `bdo.metric` series → `Chart`, `skipUntilReady` on id-bound reads,
`$cond` action params now resolve correctly, clickable `Stack`, max-respecting
`Progress`). Authors copy these patterns; they do not import the generic
fragments.

## Shared conventions (every bundle fragment)

- `fragments/<bundle>/<Name>.ts` exports a `Fragment<P>` (`name`, `version`
  "1.0.0", `description` (LLM-facing — name datasources + pairing + the entity
  contract fields it needs), `category`, `params: Params as z.ZodType<P>`,
  `build(params, ns)`).
- `build()` returns `{ root: ns, elements, datasources?, state?, init? }` with
  `elements as never` / `datasources as never` casts; root === ns; every
  element/datasource key is `ns` or `ns-`-prefixed (expander enforces).
- `fragments/<bundle>/index.ts` exports `<bundle>Fragments` `as unknown as
  FragmentRegistry`, header comment listing the entity contracts (verbatim
  pattern of `fragments/ecommerce/index.ts`).
- `fragments/index.ts` merges all bundles into `fragmentRegistry`.
- Fragment names are GLOBALLY unique across all bundles (registry is one flat
  map). Domain-prefix where a generic word collides (e.g. `DealStats`, not
  `Stats`; `CategoryList` not `CategoryNav` which ecommerce owns).
- READ datasources auto-refire on `$state` deps; WRITE fire via
  `datasource.fire`; actions limited to the 5 local types; metric GroupBy
  series read at `<ds>/data/series` (`{<groupField>, value}`); `bdo.save` with
  no `_id` creates, `_id` set updates.

## Entity contracts (FIXED field ids — agent defines + seeds these first)

### CRM (`fragments/crm/`)
- **Contact**: Name(text), Email(text), Phone(text), Company(text),
  Title(text), Status(select: Lead|Active|Inactive)
- **Company**: Name(text), Industry(select), Size(select:
  Small|Medium|Large|Enterprise), Website(text)
- **Deal**: Name(text), ContactName(text), Company(text), Value(number),
  Stage(select: Lead|Qualified|Proposal|Won|Lost), CloseDate(date),
  Owner(text)
- **Activity**: Subject(text), Type(select: Call|Email|Meeting|Note),
  RelatedTo(text), Date(date), Notes(text)

Fragments:
| Fragment | Stamps out | Datasources |
|---|---|---|
| DealStats | KPI row: total deals, won count, total/won Value sum, by-stage Chart | `bdo.metric` ×N |
| DealPipeline | Kanban by Stage (Lead→Qualified→Proposal→Won/Lost), drag-equivalent ← / → stage moves, value per card | per-stage `bdo.list` + `<ns>-move` |
| ContactCard | Contact grid: name/title/company/status badge, click→detail select | `<ns>-list` |
| ContactDetail | One Contact: header (name/company/status), facts (email/phone/title), related deals (Deal list filtered by ContactName) | `<ns>-get` + `<ns>-deals` |
| ActivityLog | Recent Activity timeline (Type badge + Subject + Date) + inline quick-add note | `<ns>-list` + `<ns>-add` |

### Helpdesk (`fragments/helpdesk/`)
- **Ticket**: Subject(text), Description(text), Status(select:
  Open|In Progress|Waiting|Resolved|Closed), Priority(select:
  Low|Medium|High|Urgent), Requester(text), Assignee(text), Category(select),
  CreatedAt(date)
- **Agent**: Name(text), Email(text), Team(select), ResolvedCount(number)
- **Reply**: TicketId(text), Author(text), Body(text), CreatedAt(date),
  Internal(boolean)

Fragments:
| Fragment | Stamps out | Datasources |
|---|---|---|
| SLAStats | KPI: open, urgent, resolved-today-equivalent (resolved count), by-Priority Chart | `bdo.metric` ×N |
| TicketQueue | Ticket table: Subject/Status/Priority(badge)/Assignee/CreatedAt, search + Status + Priority filters, row→detail select, New Ticket → dialog | `<ns>-list` (+ optional save) |
| TicketDetail | One Ticket: header (subject/status/priority), facts (requester/assignee/category), status-transition buttons (set Status via save), description | `<ns>-get` + `<ns>-status` |
| AgentLeaderboard | Agents ranked by ResolvedCount (Chart leaderboard) | `<ns>-metric` (GroupBy Name, SUM ResolvedCount) |
| ReplyThread | Replies for a ticket (filtered by TicketId from idPath), Internal-note badge, inline reply add | `<ns>-list` + `<ns>-add` |

### Project management (`fragments/projects/`)
- **Project**: Name(text), Description(text), Status(select:
  Planning|Active|OnHold|Done), Owner(text), DueDate(date)
- **Task**: Title(text), ProjectName(text), Assignee(text), Status(select:
  Todo|In Progress|Review|Done), Priority(select: Low|Medium|High),
  Estimate(number), DueDate(date)
- **Member**: Name(text), Role(text), Email(text)

Fragments:
| Fragment | Stamps out | Datasources |
|---|---|---|
| SprintStats | KPI: total tasks, done, in-progress, total Estimate; by-Status Chart | `bdo.metric` ×N |
| ProjectBoard | Kanban by Task Status (Todo→In Progress→Review→Done), ← / → moves, assignee+priority per card | per-status `bdo.list` + `<ns>-move` |
| TaskList | Task table: Title/Assignee/Status/Priority/Estimate/DueDate, filters, row actions edit/delete (pairs with a RecordFormDialog or its own save) | `<ns>-list` + `<ns>-delete` |
| MilestoneTimeline | Projects by DueDate timeline (Status badge + name + date) | `<ns>-list` (DESC/ASC by DueDate) |
| MemberWorkload | Members ranked by assigned open-task count (Chart leaderboard, GroupBy Assignee COUNT) | `<ns>-metric` |

### Blog/CMS (`fragments/blog/`)
- **Post**: Title(text), Slug(text), Excerpt(text), Body(text),
  AuthorName(text), Category(select), Status(select: Draft|Published|Archived),
  CoverUrl(text), PublishedAt(date)
- **Author**: Name(text), Bio(text), AvatarUrl(text), Email(text)
- **Category**: Name(text), Description(text)

Fragments:
| Fragment | Stamps out | Datasources |
|---|---|---|
| PublishStats | KPI: total posts, published, drafts; by-Category Chart | `bdo.metric` ×N |
| PostGrid | Post card grid: cover image, title, excerpt, author, status badge, category; search + Status/Category filters; click→detail/edit | `<ns>-list` |
| PostEditor | Create/edit Post dialog or page form: Title/Slug/Excerpt/Body(textarea)/Category/Status/CoverUrl, save | `<ns>-save` (+ `<ns>-prefill` for edit) |
| AuthorCard | Author profile card: avatar, name, bio, post count (metric by AuthorName) | `<ns>-get` + `<ns>-count` |
| CategoryList | Category list with per-category post count, click filters a target PostGrid (writes /filters/<targetNs>/Category) | `<ns>-list` + `<ns>-counts` |

## Naming collision audit (against existing registry)

Existing names: HeroBanner, CategoryNav, ProductFilters, ProductGrid,
CartSummary, CheckoutForm, OrderHistoryList, SalesStats (ecommerce);
PageHeader, StatsRow, ChartCard, Leaderboard, ProgressTracker, RecentList,
ActivityTimeline, DataTable, CardGrid, RelatedList, KanbanBoard,
RecordFormDialog, FormCard, DetailHeader, RecordView, FilterBar, StepperForm,
NotesPanel (generic). New names above are all distinct (note: `ActivityLog` ≠
generic `ActivityTimeline`; `CategoryList` ≠ ecommerce `CategoryNav`).

## Testing

- Per bundle: a `scripts/test-<bundle>-fragments.ts` (mirror
  `test-generic-fragments.ts`) with the bundle's entities + 2-3 pages
  referencing every fragment in the bundle; expansion + `validatePageSpec`
  must be clean.
- `bunx tsc --noEmit` clean after each bundle.
- After all four: extend a combined check or run all four bundle tests +
  the generic + ecommerce tests.

## Instructions + docs

- `mastra/instructions.ts` FRAGMENTS_SECTION: add a compact ENTITY CONTRACTS
  block per bundle (field ids only) so the agent can define entities before
  using a bundle. The registry enumeration already lists each fragment's
  description automatically — no per-fragment prose needed.
- README: bump fragment counts and name the bundles.

## Out of scope

- Workflow/activity datasource types (still stubbed locally — these bundles
  use bdo.* only; e.g. helpdesk status changes are bdo.save, not workflow).
- Cross-bundle composition guarantees beyond globally-unique names.
- Real auth/multi-tenant (unchanged).

## Execution order

design (this doc) → CRM → Helpdesk → Projects → Blog → instructions+README+verify.
Each bundle: build fragments + index + test (TDD red/green) → spec+quality
review → fix → commit, before the next bundle.
