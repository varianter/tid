import { navigateAndWait, scrollToAndClick, waitUntil } from "./browser";
import { server } from "./runningApp";

// People from the fixture.
export const managerEmail = "henrik.vik@example.com";
export const employeeEmail = "kari.nordmann@example.com";

export async function logInAs(view: Bun.WebView, email: string) {
  await navigateAndWait(view, `${server.url}dev/login`);
  // A click waits for its target to stop moving, so smooth scrolling would slow every click.
  // CDP needs a navigation first, which is why this isn't set when the browser opens.
  await view.cdp("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const loginButton = `form:has(input[value="${email}"]) button`;
  await scrollToAndClick(view, loginButton);
  await waitUntil("the timesheet after logging in", () => /\/timesheet\//.test(view.url));
}
