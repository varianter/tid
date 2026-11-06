/** The Typst release every machine renders with, so a PDF looks the same locally and in production. */
export const typstVersion = "0.15.1";

/** Where `scripts/installTypst.ts` puts the binary, one folder per version so an upgrade can't run a stale one. */
export const typstBinaryPath = `${import.meta.dir}/../.typst/${typstVersion}/typst`;
