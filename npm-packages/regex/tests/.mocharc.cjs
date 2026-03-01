const path = require("path");

process.env.TS_NODE_PROJECT = path.resolve(__dirname, "tsconfig.json");

module.exports = {
  spec: "./tests/**/*.spec.ts",
  loader: "ts-node/esm",
  "node-option": ["experimental-specifier-resolution=node"],
  require: ["source-map-support/register"],
  reporter: "spec",
};