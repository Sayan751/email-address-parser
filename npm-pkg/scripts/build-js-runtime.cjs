/// <reference types="node" />
// @ts-check
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const distRoot = path.join(root, "dist/esm");

const artifacts = [
  ["src/generated/rfc5322.parser.mjs", "dist/esm/generated/rfc5322.parser.mjs"],
];

for (const [from] of artifacts) {
  const sourcePath = path.join(root, from);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required artifact: ${sourcePath}`);
  }
}

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });

for (const [from, to] of artifacts) {
  const sourcePath = path.join(root, from);
  const targetPath = path.join(root, to);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

console.log("Copied JS runtime artifacts to dist/esm");
