import { closeOtherConnections, createDatabase, rebuildDatabase } from "../src/client";
import { startDevelopmentDatabase } from "../src/container";
import { seedDatabase } from "../src/fixture";

const container = await startDevelopmentDatabase();
const database = createDatabase(container.getConnectionUri());
await closeOtherConnections(database);
await rebuildDatabase(database);
await seedDatabase(database);
await database.$client.close();
console.log("Development database reset to the fixture");
