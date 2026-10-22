# AGENTS.md

Generic UI components for the apps in this repo.

## Rules

Only components with no domain knowledge belong here. A component has domain knowledge if its props, copy or behavior only make sense in one app's business, or if it imports from `@tid/db`. Those stay in the app, even when several features use them.

Nothing here imports from an app.

## CSS

We're using Varde to do the heavy lifting for our CSS needs. See `https://varde.variant.dev/llms.txt` for docs and examples. To get all the available classes, grab `https://varde.variant.dev/v/1.0.0/styles.css`.
