import { expect, test } from "bun:test";
import { isInterceptable, type NavigationFacts, routeNavigation } from "./navigation";

const onPage: NavigationFacts = {
  interceptable: true,
  opensElsewhere: false,
  dismisses: false,
  opensLayer: false,
  inLayer: false,
};
const inLayer: NavigationFacts = { ...onPage, inLayer: true };

test("a layer link on the page opens a layer", () => {
  expect(routeNavigation({ ...onPage, opensLayer: true })).toBe("openLayer");
});

test("a layer link inside a layer opens a nested layer", () => {
  expect(routeNavigation({ ...inLayer, opensLayer: true })).toBe("openLayer");
});

test("a link inside a layer loads into it", () => {
  expect(routeNavigation(inLayer)).toBe("loadIntoLayer");
});

test("a link on the page is left to the browser", () => {
  expect(routeNavigation(onPage)).toBe("browser");
});

test("a link with a target goes where the browser sends it, even from a layer", () => {
  expect(routeNavigation({ ...inLayer, opensElsewhere: true, opensLayer: true })).toBe("browser");
});

test("a dismiss link closes the layer it's in", () => {
  expect(routeNavigation({ ...inLayer, dismisses: true })).toBe("dismiss");
});

test("a dismiss link outside any layer has nothing to close", () => {
  expect(routeNavigation({ ...onPage, dismisses: true })).toBe("browser");
});

test("a navigation the browser won't let us take over is left alone", () => {
  expect(routeNavigation({ ...inLayer, interceptable: false })).toBe("browser");
});

const pushNavigation = {
  navigationType: "push",
  cancelable: true,
  canIntercept: true,
  hashChange: false,
  downloadRequest: null,
} as const;

test("a push or replace from a link can be taken over", () => {
  expect(isInterceptable(pushNavigation)).toBe(true);
  expect(isInterceptable({ ...pushNavigation, navigationType: "replace" })).toBe(true);
});

test("going back, forward or reloading is left to the browser", () => {
  expect(isInterceptable({ ...pushNavigation, navigationType: "traverse" })).toBe(false);
  expect(isInterceptable({ ...pushNavigation, navigationType: "reload" })).toBe(false);
});

test("a hash change or a download is left to the browser", () => {
  expect(isInterceptable({ ...pushNavigation, hashChange: true })).toBe(false);
  expect(isInterceptable({ ...pushNavigation, downloadRequest: "report.pdf" })).toBe(false);
});
