## Terms

- **Generic** code knows nothing about this business: `@tid/ui` and `@tid/calendar`. It never imports from a feature.
- **Domain** code knows the business: its rules, queries and components. It lives in a feature, even when several features use it.
- A **command** is a use case that changes state: a `POST` that redirects when it succeeds.
- A **query** is a use case that reads state and renders a page: a `GET`.
- A **slice** is a command or a query, in one file, from request to database to page.
- A **form** is what a command accepts: its schema, and the markup that posts to it. It changes with the screen.
- **Routes** map a feature's URLs to its slices, and do nothing else.

## Structure

One folder per feature. `projects/` is the reference.

```
src/<feature>/
  <feature>.routes.tsx         # routes
  <verb><Noun>.command.ts      # command: its rules and writes, no markup
  <verb><Noun>.form.tsx        # form: schema and markup, no database
  <noun><View>.query.tsx       # query
  <noun>.data.ts               # data: the database reads and writes for a noun
  <noun>.ts(x)                 # domain file: pure rules, or a component
  <noun>.test.ts               # tests sit next to the code they cover
```

A suffix names a file's role. A file without one is a domain file. A command is `.ts`, so it can't hold markup.

Only `.routes`, `.command`, `.query`, `.middleware` and `.data` files do I/O: they read the database or the request. Every other file is pure, so it can be tested without a database. Building SQL is pure; running it isn't.

## Slices

Everything a use case needs that no other slice uses stays in its slice: the database calls, the rules and the page. A query's page stays private to it, because the query and its page change together.

A command is split from its form, because the screen and the business change for different reasons. The command loads what it needs, applies the rules, writes and redirects. The form is everything the user sees and sends. A form shared by several commands is named after its noun: `<noun>.form.tsx`.

A command with a page of its own uses `formAction`, passing it the form's schema and view. A command shown on another page, like a button or an inline form, has its form imported by that page.

A slice exports one handler per way its use case is answered. A `GET` that only redirects to a query's page, such as to the current month, belongs to that query as `<query>Redirect`. A command that answers a plain form post and a script's request differently exports a handler for each.

## Naming use cases

Name a command after what the user is doing, as a verb and a noun, in words the user would use: `logHours`, not `createTimeEntry`. To test a name, ask the user "what did you just do?". A CRUD verb is fine when it's the honest answer. A form that edits many unrelated fields is `edit<Noun>`. Don't hide that behind a business-sounding name.

The name carries through to everything that belongs to the command: its form file, its schema (`<verb><Noun>Form`) and its inline form component (`<Verb><Noun>Form`).

Name a query after what the page shows: `<noun>List`, `<noun>Details`.

## Domain files

A domain file is named after a domain noun, never `shared`, `utils` or `services`. Code moves from a slice into one when a second slice needs it, or when it's a rule worth testing on its own with no database or HTTP code. Database calls that several slices share move into the noun's `.data.ts` instead.

## Imports

Only routes import a slice. Pages import forms. Only `server.tsx` imports routes. Slices may import domain and data files from any feature. Pure files import only pure files. `src/architecture.test.ts` checks this.

Plumbing that every feature builds on, like `formAction` and the database client, isn't a feature and sits outside these rules.

Generic code stays generic: `packages/ui/AGENTS.md` says what counts as domain knowledge.

A feature with more than about ten slices holds more than one subject. Split it by subject, the way `assignments/` is split from `projects/`.
