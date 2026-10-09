import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApp } from "../server/app.js";
import { products } from "../shared/products.js";

const publicDirectory = new URL("../public/", import.meta.url);

test("each product uses two named, local SVG illustrations and a local fallback", async () => {
  assert.ok(products.length > 0, "the product catalogue should not be empty");

  for (const product of products) {
    assert.equal(product.image, `/images/products/${product.id}.svg`);
    assert.equal(product.extra, `/images/products/${product.id}-extra.svg`);

    for (const imagePath of [product.image, product.extra]) {
      const svg = await readFile(
        new URL(imagePath.slice(1), publicDirectory),
        "utf8",
      );
      assert.match(svg, /<svg\s[^>]*viewBox=/);
      assert.match(svg, /<title/);
      assert.doesNotMatch(svg, /<script\b/i);
      assert.doesNotMatch(svg, /(?:href|src)=["']https?:\/\//i);
    }
  }

  const fallback = await readFile(
    new URL("images/products/produit-indisponible.svg", publicDirectory),
    "utf8",
  );
  assert.match(fallback, /<svg\s/);
  assert.doesNotMatch(JSON.stringify(products), /https?:\/\//i);

  const applicationSource = await readFile(
    new URL("../src/main.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(applicationSource, /images\.unsplash\.com|photo-\d+/i);
});

test("production image CSP allows only same-origin assets", async (t) => {
  const app = createApp({
    store: {
      ensureReady: async () => {},
      listStock: async () => new Map(),
    },
    production: true,
  });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/health`,
  );
  assert.equal(response.status, 200);
  const policy = response.headers.get("content-security-policy") || "";
  assert.match(policy, /(?:^|;)\s*img-src 'self'(?:;|$)/);
  assert.doesNotMatch(policy, /unsplash|https:/i);
});
