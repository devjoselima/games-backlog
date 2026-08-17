import { igdbQuery } from "./src/lib/igdb.server.ts";
async function run() {
  const res = await igdbQuery("games", `search "Dispatch"; fields name, cover.image_id; limit 10;`);
  console.log(res);
}
run();
