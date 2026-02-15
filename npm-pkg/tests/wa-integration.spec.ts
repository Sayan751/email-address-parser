import * as assert from "assert";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import * as path from "path";

const require = createRequire(import.meta.url);
const specDir = path.dirname(fileURLToPath(import.meta.url));

describe("wa integration", function () {
  it("works", function () {
    const wasm = require(path.resolve(specDir, "../dist/cjs/email_address_parser.js"));
    const { EmailAddress, ParsingOptions } = wasm;

    const emailStr = "foo@bar.com";
    const email = EmailAddress.parse(emailStr);
    assert.strictEqual(email?.localPart, "foo");
    assert.strictEqual(email?.domain, "bar.com");
    assert.strictEqual(`${email}`, emailStr);
    if (email?.free) {
      email.free();
    }

    const email1 = new EmailAddress("foo", "bar.com");
    assert.strictEqual(`${email1}`, emailStr);

    assert.strictEqual(
      EmailAddress.parse("foo@-bar.com", new ParsingOptions(true)),
      undefined
    );

    assert.throws(() => {
      new EmailAddress("foo", "-bar.com");
    });
    assert.throws(() => {
      new EmailAddress("-foo", "-bar.com");
    });

    assert.strictEqual(`${new EmailAddress("foö", "bücher.de")}`, "foö@bücher.de");
    assert.strictEqual(
      `${EmailAddress.parse("foö@bücher.de")}`,
      "foö@bücher.de"
    );
    assert.strictEqual(EmailAddress.isValid("foö@bücher.de"), true);
  });
});
