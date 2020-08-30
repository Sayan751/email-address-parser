const path = require("path");

module.exports = {
	spec: './tests/**/*.spec.ts',
	require: [path.resolve('tests/ts-hook.js'), 'source-map-support/register'],
  reporter: 'spec',
};