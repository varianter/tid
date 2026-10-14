## Terms

- **Generic** code knows nothing about this business: `@tid/ui`, or app folders like `dates/`. It never imports from a feature.
- **Domain** code knows the business: its rules, queries and components. It lives in a feature, even when several features use it.
- A **command** is a use case that changes state: a `POST` that redirects when it succeeds.
- A **query** is a use case that reads state and renders a page: a `GET`.
- A **slice** is a command or a query, in one file, from request to database to page.
- A **form** is what a command accepts: its schema, and the markup that posts to it.
- **Routes** map a feature's URLs to its slices, and do nothing else.

## Structure

One folder per feature. `projects/` is the reference.

```
src/<feature>/
  <feature>.routes.tsx         # routes
  <verb><Noun>.command.tsx     # command
  <noun><View>.query.tsx       # query
  <noun>.ts(x)                 # domain file
  <noun>.test.ts               # tests sit next to the code they cover
```

A suffix names a file's role. A file without one is a domain file.

## Slices

Everything a use case needs that no other slice uses stays in its slice: the form, the database calls, the rules and the page. A query's page stays private to it.

A command with a page of its own uses `formAction`. A command shown on another page, like a button or an inline form, exports its form component next to its handler, so what it accepts is defined in one place.

A slice exports one handler per way its use case is answered. A `GET` that only redirects to a query's page, such as to the current month, belongs to that query as `<query>Redirect`. A command that answers a plain form post and a script's request differently exports a handler for each.

## Naming use cases

Name a command after what the user is doing, as a verb and a noun, in words the user would use: `logHours`, not `createTimeEntry`. To test a name, ask the user "what did you just do?". A CRUD verb is fine when it's the honest answer. A form that edits many unrelated fields is `edit<Noun>`. Don't hide that behind a business-sounding name.

The name carries through to everything that belongs to the command: its schema (`<verb><Noun>Form`) and inline form component (`<Verb><Noun>Form`).

Name a query after what the page shows: `<noun>List`, `<noun>Details`.

## Domain files

A domain file is named after a domain noun, never `shared`, `utils` or `services`. Code moves from a slice into one when a second slice needs it, or when it's a rule worth testing on its own with no database or HTTP code.

A domain file holds what changes with its noun. A form shared by two commands, its fields and the page that renders them change together, so they share a `<noun>Form.tsx`.

## Imports

Only routes import a slice, with one exception: a page may import a command's form component. Only `server.tsx` imports routes. Slices may import domain files from any feature. `src/architecture.test.ts` checks this.

Generic code stays generic: `packages/ui/AGENTS.md` says what counts as domain knowledge.

A feature with more than about ten slices holds more than one subject. Split it by subject, the way `assignments/` is split from `projects/`.
