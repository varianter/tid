/**
 * Bundles a package's browser entry, given as `import.meta.resolve("<package>/browser")` so
 * tooling sees the dependency, into one script. The path holds a hash, so it can be cached forever.
 */
export async function bundleBrowserScript(entry: string) {
  const build = await Bun.build({
    entrypoints: [Bun.fileURLToPath(entry)],
    target: "browser",
    minify: true,
  });
  const [output] = build.outputs;
  if (!build.success || !output) throw new AggregateError(build.logs, `Bundling ${entry} failed`);
  const code = await output.text();
  return { path: `/scripts/${Bun.hash(code).toString(36)}.js`, code };
}
