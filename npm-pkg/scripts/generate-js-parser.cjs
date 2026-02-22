/// <reference types="node" />
// @ts-check
"use strict";

const fs = require("fs");
const path = require("path");
const peggy = require("peggy");

const grammarPath = path.resolve(__dirname, "../grammar/rfc5322.peggy");
const parserOutputPath = path.resolve(
  __dirname,
  "../src/generated/rfc5322.parser.mjs"
);

function main() {
  const grammar = fs.readFileSync(grammarPath, "utf8");
  const parserSource = peggy.generate(grammar, {
    output: "source",
    format: "es",
    cache: true,
    allowedStartRules: ["address_single", "address_single_obs"],
  });

  fs.mkdirSync(path.dirname(parserOutputPath), { recursive: true });
  fs.writeFileSync(parserOutputPath, parserSource, "utf8");
  console.log(`Generated JavaScript parser: ${parserOutputPath}`);
}

main();
