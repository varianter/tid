# AGENTS.md

This project uses Bun as package manager and runtime.

Built on Hono, using it so render JSX and serve it as HTML.

## Style

### Names

Enforces Clean Code principles—descriptive names, appropriate length, no encodings.

Don't pick names that communicate implementation; choose names that reflect the level of abstraction of the class or function.

Use terms from the domain, design patterns, or well-known conventions.

Choose names that make the workings of a function or variable unambiguous.
Function name such as `rename` is ambiguous. `renameFile` is clear.

Short names are fine for tiny scopes. Longer scopes need longer, more descriptive names. Avoid single or double character names, like `d` or `e`. If it's an error, you write out error.

Name side effects. If a function does something beyond what its name suggests, the name is misleading.

### Modules

Group code by reason to change. Code that changes for the same reason belongs in the same module; code that changes for different reasons belongs in separate modules. Don't group by category, such as one file for formatters or one for validators.

A module should be describable in one sentence without "and". If it isn't, split it.

- **Bad:** `format.ts` with `formatDate`, `formatCurrency` and `formatFileSize`. They share a verb, but each changes for its own reason.
- **Good:** `date.ts`, `currency.ts` and `file-size.ts`.
- **Good:** `date.ts` with both `formatDate` and `parseDate`. A change to the date format changes both.

Before adding a function, check whether one already exists. Extend it rather than writing a second.

Import from the file that defines the code. Barrel files (an `index.ts` that re-exports a folder) are only for a package's public entry point, so apps can't reach into its internals.

### Comments

Comments shouldn't hold metadata. Comments are for technical notes about code only.

- If a comment describes code that no longer exists or works differently, delete it immediately. Stale comments become "floating islands of irrelevance and misdirection."
- Comments explain WHY, not WHAT.
- If a comment is worth writing, write it well:
- - Choose words carefully
- - Use correct grammar
- - Don't ramble or state the obvious
- - Be brief

### Documentation

Docs that drift are worse than no docs, so write them to stay true as the code changes.

- State the rule, not an inventory. Don't list features, files or other things that come and go; describe what makes something fit.
- Use placeholders like `<feature>` in examples rather than real names.
- Write each rule in one place and link to it from elsewhere.
- When a change makes a doc wrong, fix the doc in the same change.

## Tooling

- **Bun doesn't type-check.** Run `tsc --noEmit` (`bun run typecheck`) — CI does, and so should you.
- Keep typecheck, lint and tests green (`bun run check`).
- Pin exact versions (no `^`).

## CSS

We're using Varde to do the heavy lifting for our CSS needs. See `https://varde.variant.dev/llms.txt` for docs and examples. To get all the available classes, grab `https://varde.variant.dev/v/1.0.0/styles.css`.
