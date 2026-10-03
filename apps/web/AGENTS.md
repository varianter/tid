## Structure

One folder per feature. Start with `<feature>.routes.tsx` and split the rest out as it grows:

```
src/<feature>/
  <feature>.routes.tsx      # route handlers
  <feature>.views.tsx       # presentational JSX
  <feature>.validation.ts   # zod schemas for input
  <concept>.ts              # domain logic, named after the concept
  <concept>.test.ts         # tests sit next to the code they cover
```

Role files carry the feature prefix so they stay unique when searching by filename. Domain files are already unique, so they don't need it. Avoid catch-all names like `services` or `utils`.

## Shared code

Shared code lives in a folder named after its concept, not in `shared/` or `utils/`. Move code out of a feature when a second feature needs it, not before.

Shared folders hold no domain types or logic, and never import from a feature. Domain code shared between features stays in the feature that owns it; others import it from there.

Features may import each other's domain files, never their routes or views. Only `server.tsx` imports routes.

Generic UI belongs in `@tid/ui`. Components with domain knowledge stay in the app, even when several features use them. See `packages/ui/AGENTS.md` for what counts as domain knowledge.
