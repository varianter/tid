import { typstBinaryPath, typstVersion } from "./typstBinary";

// Each render is a Typst process of a few tens of MB, so a burst of downloads queues instead of
// adding up.
const maxConcurrentRenders = 2;
const renderTimeoutMs = 15_000;
const fontsPath = `${import.meta.dir}/../fonts`;

let running = 0;
const waiting: (() => void)[] = [];

async function takeTurn() {
  if (running < maxConcurrentRenders) {
    running++;
    return;
  }
  // The finishing render hands its slot over, so `running` stays as it is.
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function passTurn() {
  const next = waiting.shift();
  if (next) next();
  else running--;
}

/**
 * Renders the Typst template at `templatePath` to a PDF. The template reads `data` with
 * `json(bytes(sys.inputs.data))`, and can reach files in its own folder. It's set in the fonts
 * this package holds, never the machine's, so a PDF looks the same wherever it's made.
 */
export async function renderPdf(templatePath: string, data: unknown): Promise<Uint8Array> {
  await takeTurn();
  try {
    return await runTypst(templatePath, data);
  } finally {
    passTurn();
  }
}

async function runTypst(templatePath: string, data: unknown) {
  const timeout = AbortSignal.timeout(renderTimeoutMs);
  const typst = spawnTypst(
    [
      "compile",
      "--font-path",
      fontsPath,
      "--ignore-system-fonts",
      "--input",
      `data=${JSON.stringify(data)}`,
      templatePath,
      "-",
    ],
    timeout,
  );
  const [pdf, stderr, exitCode] = await Promise.all([
    new Response(typst.stdout).bytes(),
    new Response(typst.stderr).text(),
    typst.exited,
  ]);
  const failure = `Rendering ${templatePath}`;
  const typstSaid = stderr.trim() ? `. Typst said:\n${stderr.trim()}` : "";
  if (timeout.aborted) {
    throw new Error(`${failure} took over ${renderTimeoutMs} ms, so it was stopped${typstSaid}`);
  }
  if (typst.signalCode) {
    throw new Error(`${failure} was stopped by ${typst.signalCode}${typstSaid}`);
  }
  if (exitCode !== 0) throw new Error(`${failure} failed with exit code ${exitCode}${typstSaid}`);
  return pdf;
}

function spawnTypst(args: string[], signal: AbortSignal) {
  try {
    return Bun.spawn([typstBinaryPath, ...args], { stdout: "pipe", stderr: "pipe", signal });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw new Error(
      `Typst ${typstVersion} isn't installed at ${typstBinaryPath}. \`bun install\` installs it.`,
      { cause: error },
    );
  }
}
