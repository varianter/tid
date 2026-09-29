import { client } from "@tid/db/client";
import { Hono } from "hono";

const app = new Hono();
app.get("/", (c) => c.text(client));

export default app;
