/** Bundles the elements for the browser. The path holds a hash, so it can be cached forever. */
export async function bundleElements() {
  const build = await Bun.build({
    entrypoints: [`${import.meta.dir}/index.ts`],
    target: "browser",
    minify: true,
  });
  const [output] = build.outputs;
  if (!build.success || !output) throw new AggregateError(build.logs, "Bundling elements failed");
  const code = await output.text();
  return { path: `/elements/${Bun.hash(code).toString(36)}.js`, code };
}
