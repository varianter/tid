import type { PropsWithChildren } from "hono/jsx";

type LayoutProps = PropsWithChildren<{ title: string }>;

export function Layout({ title, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="https://varde.variant.dev/v/1.0.0/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
