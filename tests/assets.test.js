import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApp } from "../server/app.js";
import { products } from "../shared/products.js";

const publicDirectory = new URL("../public/", import.meta.url);

async function assertLocalImage(imagePath) {
  assert.ok(imagePath.startsWith("/images/products/"));
  const image = await readFile(
    new URL(imagePath.slice(1), publicDirectory),
  );

  if (imagePath.endsWith(".svg")) {
    const svg = image.toString("utf8");
    assert.match(svg, /<svg\s[^>]*viewBox=/);
    assert.match(svg, /<title/);
    assert.doesNotMatch(svg, /<script\b/i);
    assert.doesNotMatch(svg, /(?:href|src)=["']https?:\/\//i);
  } else if (imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg")) {
    assert.ok(image.length > 1000, `${imagePath} should be a real photo`);
    assert.deepEqual([...image.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.deepEqual([...image.subarray(-2)], [0xff, 0xd9]);
  } else if (imagePath.endsWith(".png")) {
    assert.ok(image.length > 1000, `${imagePath} should be a real photo`);
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  } else {
    assert.fail(`Unsupported local image format: ${imagePath}`);
  }
}

test("catalogue product images are valid local assets with a safe local fallback", async () => {
  assert.ok(products.length > 0, "the product catalogue should not be empty");

  for (const product of products) {
    assert.ok(product.image, `${product.id} should have a main image`);
    assert.ok(product.extra, `${product.id} should have an extra image`);
    await assertLocalImage(product.image);
    await assertLocalImage(product.extra);
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  assert.equal(byId.get("casque").image, "/images/products/casque.png");
  assert.equal(byId.get("casque").extra, "/images/products/casque-extra.jpg");
  assert.equal(byId.get("sac").image, "/images/products/sac.jpg");
  assert.equal(byId.get("sac").extra, "/images/products/sac-extra.jpg");

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
  assert.match(applicationSource, /\[p\.image, p\.extra\]/);
  assert.match(applicationSource, /className=\{`product-stock/);
  assert.match(applicationSource, /selected\.stock === 1/);
  assert.match(applicationSource, /image: "\/images\/products\/sac\.jpg"/);
  assert.match(applicationSource, /image: "\/images\/products\/casque\.png"/);
});

test("photo-reference prices use local market comparators and seed quantities remain visible", () => {
  const byId = new Map(products.map((product) => [product.id, product]));
  assert.equal(byId.get("casque").price, 12900);
  assert.equal(byId.get("sac").price, 9200);
  assert.ok(byId.get("casque").stock > 0);
  assert.ok(byId.get("sac").stock > 0);
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
