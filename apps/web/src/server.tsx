import { createDatabase } from "@tid/db/client";
import { clients } from "@tid/db/schema";
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { z } from "zod";
import { formAction } from "./form/formAction";
import { Layout } from "./layout";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const database = createDatabase(databaseUrl);

const app = new Hono();
app.use(jsxRenderer(({ children }) => <Layout title="Tid">{children}</Layout>));

// ponytail: smoke test for the database, replace with real pages.
app.on(
  ["GET", "POST"],
  "/",
  formAction({
    schema: z.object({ name: z.string().trim().min(1) }),
    loader: async () => ({ clients: await database.select().from(clients).orderBy(clients.name) }),
    onSubmit: async (_c, { name }) => {
      const inserted = await database
        .insert(clients)
        .values({ name })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) return { fieldErrors: { name: ["Already exists"] } };
      return { redirect: "/" };
    },
    view: ({ clients, values, fieldErrors }) => (
      <main class="p-xl stack-v gap-xl">
        <div>
          <h1 class="fs-m">Clients</h1>
          <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
            {clients.map((client) => (
              <li class="p-xs px-m surface-tinted">{client.name}</li>
            ))}
          </ul>
        </div>
        <form method="post" class="w-max-5">
          <label class="stack-v">
            <span class="form-label">Client name</span>{" "}
            <input class="v-input" name="name" value={values?.name} required />
            {fieldErrors?.name && (
              <color-mode palette="coral" class="d-block ink-default mt-3xs">
                {fieldErrors.name[0]}
              </color-mode>
            )}
          </label>

          <button class="v-button mt-s" type="submit">
            Add client
          </button>
        </form>
      </main>
    ),
  }),
);
app.get("/health", (c) => c.text("ok"));

export default app;
