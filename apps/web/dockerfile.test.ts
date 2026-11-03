import { expect, test } from "bun:test";

test("the image runs the Bun version CI verifies with", async () => {
  const bunVersion = (await Bun.file(`${import.meta.dir}/../../.bun-version`).text()).trim();
  const dockerfile = await Bun.file(`${import.meta.dir}/Dockerfile`).text();
  expect(dockerfile).toContain(`FROM oven/bun:${bunVersion}-slim`);
  // The build stages too, so an upgrade can't leave one behind.
  const stageVersions = [...dockerfile.matchAll(/^FROM oven\/bun:([\d.]+)/gm)].map(
    ([, version]) => version,
  );
  expect(new Set(stageVersions)).toEqual(new Set([bunVersion]));
});
