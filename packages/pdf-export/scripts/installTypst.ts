import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { typstBinaryPath, typstVersion } from "../src/typstBinary";

// From the release's asset digests. Upgrading Typst means changing the version and these together.
const releases: Record<string, { target: string; sha256: string }> = {
  "darwin-arm64": {
    target: "aarch64-apple-darwin",
    sha256: "48f62ed034aa3a7978309579ac6ca00045e2ef0da73114e8af27cfd8e74dc05a",
  },
  "darwin-x64": {
    target: "x86_64-apple-darwin",
    sha256: "7f9fdd9584866245de9a79e0add8f9236fae6f40a8a45e2c4771ccc14db4e0fa",
  },
  "linux-arm64": {
    target: "aarch64-unknown-linux-musl",
    sha256: "5aa8d74a3d906e60ea12a66ac2f37f8eef1b14cbad7182a745e393a10c23dcee",
  },
  "linux-x64": {
    target: "x86_64-unknown-linux-musl",
    sha256: "a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c",
  },
};

/** Retried, since this runs on every install and GitHub's release downloads fail now and then. */
async function download(url: string, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Downloading ${url} failed with ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= attempts) throw error;
      await Bun.sleep(2 ** attempt * 1000);
    }
  }
}

if (await Bun.file(typstBinaryPath).exists()) process.exit(0);

const platform = `${process.platform}-${process.arch}`;
const release = releases[platform];
if (!release) throw new Error(`No Typst ${typstVersion} release is pinned for ${platform}`);

const url = `https://github.com/typst/typst/releases/download/v${typstVersion}/typst-${release.target}.tar.xz`;
const archive = await download(url);
const sha256 = new Bun.CryptoHasher("sha256").update(archive).digest("hex");
if (sha256 !== release.sha256) throw new Error(`${url} has SHA-256 ${sha256}, not the pinned one`);

// Unpacked beside its destination, so moving it into place stays on one file system.
await mkdir(dirname(typstBinaryPath), { recursive: true });
const unpacked = await mkdtemp(`${typstBinaryPath}-download-`);
try {
  const archivePath = join(unpacked, "typst.tar.xz");
  await Bun.write(archivePath, archive);
  await Bun.$`tar -xJf ${archivePath} -C ${unpacked}`;
  await rename(join(unpacked, `typst-${release.target}`, "typst"), typstBinaryPath);
} finally {
  await rm(unpacked, { recursive: true, force: true });
}
console.log(`Installed Typst ${typstVersion} at ${typstBinaryPath}`);
