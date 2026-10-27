import type { Context } from "hono";
import { css, Style } from "hono/css";
import { html } from "hono/html";
import type { Child } from "hono/jsx";
import { vardeStylesheet } from "./layout";

type PrintPage = {
  /** Browsers suggest the title as the PDF's file name. */
  title: string;
  /** The page's own styles, written with `css`, for when Varde's screen styles don't suit paper. */
  style?: ReturnType<typeof css>;
};

/**
 * Renders a page meant to be printed or saved as PDF, without the app's navigation.
 * A PDF service can load the same URL and get the same document.
 */
export function renderForPrint(c: Context, page: PrintPage, content: Child) {
  return c.html(html`<!doctype html>${<PrintLayout {...page}>{content}</PrintLayout>}`);
}

function PrintLayout({ title, style, children }: PrintPage & { children: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href={vardeStylesheet} />
        <Style>
          {css`
            @page { size: A4 landscape; }
            /* Paper is white, whatever the viewer's color scheme. */
            :root { color-scheme: light; print-color-adjust: exact; }
            body { background: #fff; color: #111; }
            @media screen { body { padding: 2rem; } }
            @media print { .screen-only { display: none; } }
          `}
        </Style>
        {style && <Style>{style}</Style>}
      </head>
      <body>{children}</body>
    </html>
  );
}
