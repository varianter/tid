import { rm } from "node:fs/promises";
import { iconNames } from "@tid/ui";

const iconsDirectory = `${import.meta.dir}/../public/icons`;

// Emptied first so icons dropped from the list don't linger.
await rm(iconsDirectory, { recursive: true, force: true });

for (const name of iconNames) {
  const url = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/${name}/fill1/24px.svg`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No Material Symbol named "${name}" (${response.status})`);
  await Bun.write(`${iconsDirectory}/${name}.svg`, response);
}
console.log(`Downloaded ${iconNames.length} icons to public/icons`);
