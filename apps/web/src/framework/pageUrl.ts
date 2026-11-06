import { z } from "zod";

type PageSchema = z.ZodObject<Record<string, z.ZodType<unknown, string | undefined>>>;

/** A page's state to link to, where a field that may be undefined can be left out. */
type LinkState<State> = {
  [Key in keyof State as undefined extends State[Key] ? Key : never]?: State[Key];
} & {
  [Key in keyof State as undefined extends State[Key] ? never : Key]: State[Key];
};

/** A path parameter naming a row by its id. */
export const idParam = z.codec(z.string().regex(/^\d+$/), z.number().refine(Number.isSafeInteger), {
  decode: Number,
  encode: String,
});

/**
 * A page's address: a route like `/<page>/:<param>`, and a Zod object for its path parameters and
 * query that decodes from the URL and encodes back. Give each query field a `.catch` so a sloppy URL
 * falls back rather than failing, and encode a default to `undefined` to leave it out of the URL.
 * A path parameter that fails to decode means there's no such page.
 */
export function pageUrl<Schema extends PageSchema>(route: string, schema: Schema) {
  const pattern = new URLPattern({ pathname: route });
  const paramNames = new Set([...route.matchAll(/:(\w+)/g)].map((match) => match[1]));
  const encode = (state: LinkState<z.output<Schema>>): Record<string, string | undefined> =>
    z.encode(schema, state as z.output<Schema>);
  const search = (state: LinkState<z.output<Schema>>) =>
    new URLSearchParams(
      Object.entries(encode(state)).filter(
        (entry): entry is [string, string] => entry[1] !== undefined && !paramNames.has(entry[0]),
      ),
    );
  return {
    // ponytail: one value per name; read with getAll when a field needs several.
    read: (url: string) => {
      const match = pattern.exec(url);
      if (!match) return undefined;
      const parsed = schema.safeParse({
        ...Object.fromEntries(new URL(url).searchParams),
        ...match.pathname.groups,
      });
      return parsed.success ? parsed.data : undefined;
    },
    /** The query alone, which a form on the page can submit to keep it. */
    search,
    path: (state: LinkState<z.output<Schema>>) => {
      const encoded = encode(state);
      const path = route.replace(/:(\w+)/g, (_, name: string) =>
        encodeURIComponent(encoded[name] ?? ""),
      );
      const query = search(state);
      return query.size ? `${path}?${query}` : path;
    },
  };
}

export type PageUrl<State> = {
  read: (url: string) => State | undefined;
  search: (state: State) => URLSearchParams;
  path: (state: State) => string;
};
