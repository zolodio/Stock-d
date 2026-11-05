// Pulls your Collectr showcase and writes products.json. Run by .github/workflows/sync.yml (Node 20).
import { writeFileSync } from "node:fs";

const API = "https://api-v2.getcollectr.com/data/showcase/@tzarchard";
const PARAMS = {
  id: "0b53c897-2a54-43dd-99a3-e719f41a752a",
  filters: "",
  unstackedView: "true",
  username: "997b8446-ad86-47a5-91db-92faecba8b92",
};
const LIMIT = 30;

// Field names are guesses until we see a real response: first match wins.
const pick = (o, keys) => keys.map((k) => o?.[k]).find((v) => v != null && v !== "");
const findList = (j) =>
  Array.isArray(j) ? j : Object.values(j ?? {}).find(Array.isArray) ?? Object.values(j?.data ?? {}).find(Array.isArray) ?? [];

const rows = new Map();
for (let offset = 0, page = 0; page < 30; offset += LIMIT, page++) {
  const res = await fetch(`${API}?${new URLSearchParams({ offset, limit: LIMIT, ...PARAMS })}`, {
    headers: {
      accept: "application/json",
      origin: "https://app.getcollectr.com",
      referer: "https://app.getcollectr.com/",
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
  });
  if (!res.ok) { console.error(`Collectr returned ${res.status} at offset ${offset}`); process.exit(1); }
  const list = findList(await res.json());
  if (!list.length) break;

  for (const it of list) {
    if (pick(it, ["is_sealed", "sealed"]) === false) continue; // sealed only
    const id = String(pick(it, ["product_id", "productId", "id"]) ?? "");
    const price = parseFloat(pick(it, ["market_price", "marketPrice", "price", "current_price"]));
    if (!id || isNaN(price)) continue;
    const qty = parseInt(pick(it, ["quantity", "qty"]) ?? 1) || 1;
    if (rows.has(id)) { rows.get(id).qty += qty; continue; } // unstacked view repeats copies: add them up
    rows.set(id, {
      id,
      name: String(pick(it, ["product_name", "productName", "name"]) ?? "Unknown").trim(),
      set_name: pick(it, ["set_name", "setName", "set", "group_name"]) ?? "",
      price, qty,
      image_url: pick(it, ["image_url", "imageUrl", "image", "image_path"]) ?? "",
    });
  }
  if (list.length < LIMIT) break;
  await new Promise((r) => setTimeout(r, 300));
}

if (!rows.size) { console.error("Parsed 0 products; field names probably differ."); process.exit(1); }
// Full replacement: anything no longer in your collection disappears from the shop.
writeFileSync("products.json", JSON.stringify({ updated: new Date().toISOString().slice(0, 10), products: [...rows.values()] }, null, 1));
console.log(`Wrote ${rows.size} products`);
