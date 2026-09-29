import { client } from "@tid/db/client";
import { Hono } from "hono";

const app = new Hono();
app.get("/", (c) => c.text(client));
app.get("/health", (c) => c.text("ok"));

export default app;
