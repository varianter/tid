import type { clients } from "@tid/db/schema";

export type Client = typeof clients.$inferSelect;
