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

// Shorter than a test, so whatever gets stuck is named in the failure.
const giveUpAfter = 5000;

/**
 * Clicks the way a user would, scrolling the target into view first: a click only targets what's
 * on screen and would otherwise wait for it.
 */
export async function scrollToAndClick(view: Bun.WebView, selector: string) {
  try {
    await view.scrollTo(selector, { timeout: giveUpAfter });
    await view.click(selector, { timeout: giveUpAfter });
  } catch (error) {
    throw new Error(`Couldn't click ${selector}`, { cause: error });
  }
}

/**
 * Navigates and waits for the new page. In Bun 1.4.3 and 1.4.4, after a click had loaded a page,
 * the next `navigate()` sometimes resolved before its own page arrived. Later versions may fix it;
 * check before removing this.
 */
export async function navigateAndWait(view: Bun.WebView, url: string) {
  // A view that hasn't loaded a page yet has nothing to run a script in.
  if (view.url) await view.evaluate("window.leftBehind = true");
  await view.navigate(url);
  // `view.url` is compared too, as it lagged behind the page in the same way. It leaves out a
  // fragment the page adds itself, such as the timesheet's `#today`.
  await waitUntil(`the page at ${url}`, async () => {
    const page = (await view.evaluate(
      "window.leftBehind ? undefined : document.readyState === 'complete' && location.href.split('#')[0]",
    )) as string | false | undefined;
    return page === view.url;
  });
}

/**
 * A phone's narrow screen and touch, so the page takes its coarse-pointer layout. CDP needs a
 * navigation first. The page is loaded again, as a page shrunk in place can keep the wider
 * viewport it had, and then a touch misses what it aims at.
 */
export async function emulatePhone(view: Bun.WebView) {
  await view.cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await view.cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await navigateAndWait(view, view.url);
}

/**
 * Taps the target's centre with a touch, as a finger would. A touch moves focus and fires
 * pointer events differently from a click. Unlike a click, a touch lands wherever it's sent, so
 * it waits for scrolling, snapping included, to settle on the target first.
 */
export async function scrollToAndTap(view: Bun.WebView, selector: string) {
  await view.scrollTo(selector, { timeout: giveUpAfter });
  const centre = async () =>
    JSON.stringify(
      await view.evaluate(
        `(({ left, top, width, height }) => ({ x: left + width / 2, y: top + height / 2 }))(document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect())`,
      ),
    );
  let previous = "";
  const settled = await waitUntil(`${selector} to stop moving`, async () => {
    const current = await centre();
    if (current === previous) return current;
    previous = current;
    await Bun.sleep(100);
    return undefined;
  });
  const { x, y } = JSON.parse(settled) as { x: number; y: number };
  await view.cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await view.cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Polls for what the page or database does a moment after an action. */
export async function waitUntil<Value>(
  description: string,
  check: () => Value | Promise<Value>,
): Promise<NonNullable<Value>> {
  const deadline = Date.now() + giveUpAfter;
  while (true) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) throw new Error(`Gave up waiting for ${description}`);
    await Bun.sleep(50);
  }
}
