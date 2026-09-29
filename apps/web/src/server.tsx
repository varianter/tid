import { client } from "@tid/db/client";
import { Hono } from "hono";
import { Layout } from "./layout";

const app = new Hono();
app.get("/", (c) =>
  c.html(
    <Layout title="Tid">
      <main>{client}</main>
    </Layout>,
  ),
);
app.get("/health", (c) => c.text("ok"));

export default app;
