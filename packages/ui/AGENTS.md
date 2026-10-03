# AGENTS.md

Generic UI components for the apps in this repo.

## Rules

Only components with no domain knowledge belong here. A component has domain knowledge if its props, copy or behavior only make sense in one app's business, or if it imports from `@tid/db`. Those stay in the app, even when several features use them.

Nothing here imports from an app.
