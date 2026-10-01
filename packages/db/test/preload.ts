import { afterAll } from "bun:test";
import { startTestDatabase } from "../src/container";

const container = await startTestDatabase();
process.env.DATABASE_URL = container.getConnectionUri();
afterAll(() => container.stop());
