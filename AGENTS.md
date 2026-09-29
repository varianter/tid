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

### Comments

Comments shouldn't hold metadata. Comments are for technical notes about code only.

- If a comment describes code that no longer exists or works differently, delete it immediately. Stale comments become "floating islands of irrelevance and misdirection."
- Comments explain WHY, not WHAT.
- If a comment is worth writing, write it well:
- - Choose words carefully
- - Use correct grammar
- - Don't ramble or state the obvious
- - Be brief

## Tooling

- **Bun doesn't type-check.** Run `tsc --noEmit` (`bun run typecheck`) — CI does, and so should you.
- Keep typecheck, lint and tests green (`bun run check`).
- Pin exact versions (no `^`).
-

## CSS

We're using Varde to do the heavy lifting for our CSS needs. See `https://varde.variant.dev/llms.txt` for docs and examples. To get all the available classes, grab `https://varde.variant.dev/v/1.0.0/styles.css`.
