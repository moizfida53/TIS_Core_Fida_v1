# TIS.NET10 — Claude Project Rules

> **Project**: Telecom Invoice System — ASP.NET Core MVC / .NET 10  
> **Migration source**: `F:\DAD Projects\TIS_MVC` (legacy .NET 4.8 / jqWidgets)  
> **Working paths**: `F:\DAD Projects\TIS_Core-master` (new), `F:\DAD Projects\TIS_NET10` (new)

---

## Architecture Constraints

### Backend — non-negotiable
- **Zero inline SQL** in controllers. Every DB call goes through a stored procedure
  via `DB.ExecuteStoredProc` or `DB.ExecuteStoredProcDataSet`.
- Controllers call repositories (or `DB` directly where no repo exists yet).
  Never call raw SQL or `DbContext` from a controller action.
- Verify with `/verify-no-inline-sql` before declaring any module done.
- All SP parameters must use `SqlParameter` with explicit `SqlDbType`.

### Frontend — non-negotiable
- **Bootstrap 5** for all layout and responsive behaviour. No jqWidgets.
- **DataTables.net** for all data grids (server-side or client-side).
- Responsive down to **250 px** via Bootstrap utilities + SCSS media queries.
  Test columns at 250 / 375 / 576 / 768 / 1024 / 1440 px.
- Tab text hidden on xs (`d-none d-sm-inline`); icon + badge always visible.
- Mobile tables use card-stack layout (data-label driven via `::before`).

### SCSS
- SCSS only — never edit `wwwroot/css/site.css` directly.
- Import order in `site.scss`: variables → mixins → Bootstrap → base → layout → pages.
- New page styles go in `wwwroot/scss/pages/_<page-name>.scss`.
- Remove any CSS that Bootstrap utilities already cover; document the removal with a comment.

---

## Skills (slash commands)

| Command | When to use |
|---|---|
| `/migrate-module ControllerName` | Port a full MVC5 controller + its views to .NET 10 |
| `/migrate-jqx-view path/to/View.cshtml` | Convert a single jqWidgets view to Bootstrap 5 + DataTables |
| `/add-sp-repo sp_Name` | Wrap an existing stored procedure in a repository method |
| `/new-datatable EntityName` | Scaffold a DataTables grid (controller endpoint + repo call) |
| `/new-report ReportName` | Scaffold a QuestPDF/ClosedXML report replacing RDLC |
| `/verify-no-inline-sql` | Gate check before committing — must pass for every module |

---

## Migration Order

Migrate modules in this priority order (most user-facing first):

1. **User / Bill Workflow** — UserController, AjaxController (identification, approval, history)
2. **Admin — Employee** — ManageEmployee
3. **Admin — Telephone** — AddTelephone, assignment
4. **Admin — Delegation** — DelegateBills
5. **Admin — Packages** — Package management
6. **Admin — Countries / Cost Centres** — lookup tables
7. **Reports** — Replace RDLC with QuestPDF + ClosedXML exports

---

## Per-Module Checklist

Before marking a module complete:
- [ ] All DB calls use stored procedures (run `/verify-no-inline-sql`)
- [ ] View is Bootstrap 5 only — no jqWidgets references
- [ ] Grid uses DataTables; `dt-section` class applied to `<table>`
- [ ] Responsive at 250 px — tables stack to card-style on xs
- [ ] `data-label` attributes on dynamic `<td>` elements (added in JS)
- [ ] SCSS in appropriate page partial; no inline `<style>` blocks

---

## Naming Conventions

| Item | Convention |
|---|---|
| Controllers | `PascalCaseController.cs` |
| Repository interface | `I<Entity>Repository.cs` |
| Repository implementation | `<Entity>Repository.cs` |
| SCSS partials | `_kebab-case.scss` |
| JS files | `camelCase.js` |
| Stored procedure calls | `sp_VerbNoun` (matches legacy DB naming) |

---

## Token-Efficient Workflow

- Use skills (`/migrate-module`, `/new-datatable`, etc.) for each unit of work.
- Read only the files relevant to the current module — avoid reading the entire codebase.
- Use `/verify-no-inline-sql` once per module, not repeatedly.
- Keep commits small and module-scoped; one PR per module migration.

---

## Forbidden Patterns

- ❌ `<script>` inline in `.cshtml` files — use `@section Scripts { }` or a `.js` file
- ❌ `style="..."` inline on elements (except truly one-off values like `display:none`)
- ❌ Direct `DataContext` / `DbContext` usage — use stored procedures via `DB`
- ❌ `$.ajax` direct calls to URLs with hardcoded connection strings
- ❌ jqWidgets (`jqxGrid`, `jqxDropdownList`, etc.) in any new or migrated view
- ❌ `HttpContext.Session.GetString(...)` in views — pass data via ViewBag/Model only
