import { waitUntil } from "./browser";
import { server } from "./runningApp";

// People from the fixture.
export const managerEmail = "henrik.vik@example.com";
export const employeeEmail = "kari.nordmann@example.com";

export async function logInAs(view: Bun.WebView, email: string) {
  await view.navigate(`${server.url}dev/login`);
  const loginButton = `form:has(input[value="${email}"]) button`;
  // The list is longer than the window, and a click only targets what's on screen.
  await view.scrollTo(loginButton, { block: "center" });
  await view.click(loginButton);
  await waitUntil("the timesheet after logging in", () => /\/timesheet\//.test(view.url));
}
