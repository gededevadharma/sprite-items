// Manual smoke test: run the worker module directly. fast-png does the
// decoding, so no canvas shims are needed — the worker runs almost as-is
// under Node and under wrangler.
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import worker from "../src/worker.mjs.js";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const HOST = "https://x.test";

async function hit(q) {
  const r = await worker.fetch(new Request(`${HOST}/${q}`));
  const buf = Buffer.from(await r.arrayBuffer());
  const isPng = buf.length > 20 && PNG_SIG.equals(buf.subarray(0, 4));
  console.log(q.padEnd(34), "status", String(r.status).padStart(3), "bytes", String(buf.length).padStart(6), isPng ? "PNG" : "body=" + buf.toString("utf8").slice(0, 60));
  return { r, buf };
}

const main = async () => {
  const id2 = await hit("icon?id=2");
  if (id2.r.status === 200 && id2.buf.length > 20) writeFileSync(new URL("./dirt-icon.png", import.meta.url), id2.buf);

  await hit("icon?id=2&v=5.42");
  await hit("icon?id=2&v=2.78");
  await hit("icon?id=2&v=5.45.");
  await hit("icon?id=1");   // Blank Seed (seed-rendered)
  await hit("icon?id=999999"); // missing
  await hit("icon?file=seed.png&x=0&y=0"); // direct crop
  await hit("");            // root index
  await hit("bogus/path");  // 404 route
};
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });