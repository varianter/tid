import { setDefaultTimeout } from "bun:test";

// Longer than a wait, so a stuck wait reports what it waited for.
setDefaultTimeout(15_000);

/**
 * Chrome rather than macOS's WebKit, so a Mac and Linux behave the same. Wide enough for the
 * month to fit: otherwise the sticky total column can cover a cell, and a click waits for an
 * uncovered target.
 */
export function openBrowser() {
  const consoleErrors: string[] = [];
  const view = new Bun.WebView({
    width: 1920,
    height: 1080,
    backend: "chrome",
    console: (type, ...args) => {
      if (type === "error") consoleErrors.push(args.join(" "));
    },
  });
  return { view, consoleErrors };
}

/** Polls for what the page or database does a moment after an action. */
export async function waitUntil<Value>(
  description: string,
  check: () => Value | Promise<Value>,
): Promise<NonNullable<Value>> {
  const deadline = Date.now() + 5000;
  while (true) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) throw new Error(`Gave up waiting for ${description}`);
    await Bun.sleep(50);
  }
}
