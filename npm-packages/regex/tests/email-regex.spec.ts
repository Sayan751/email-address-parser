import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "url";
import {
  DOMAIN_REGEX_LAX,
  DOMAIN_REGEX_STRICT,
  EmailAddress,
  EMAIL_REGEX_LAX,
  EMAIL_REGEX_STRICT,
  LOCAL_PART_REGEX_LAX,
  LOCAL_PART_REGEX_STRICT,
  ParsingOptions,
  isValidEmail,
  parseEmail,
} from "../src/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("email_regex corpus parity", function () {
  const testDataDir = path.resolve(__dirname, "../../../.test_data");

  function decodeCorpusEscapes(value: string): string {
    // Test data is stored as escaped Rust string-literal fragments.
    return value.replace(/\\(["\\])/g, "$1");
  }

  function readCorpus(filename: string): string[] {
    const filePath = path.join(testDataDir, filename);
    const content = fs.readFileSync(filePath, "utf8").replace(/\r/g, "");
    const lines = content.split("\n");

    // Rust str::lines() does not keep trailing empty lines.
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines.map(decodeCorpusEscapes);
  }

  function cartesianEmails(localParts: string[], domains: string[]): string[] {
    const emails: string[] = [];
    for (const localPart of localParts) {
      for (const domain of domains) {
        emails.push(`${localPart}@${domain}`);
      }
    }
    return emails;
  }

  function asCaseLabel(value: string): string {
    return JSON.stringify(value);
  }

  function decodeXmlEntities(value: string): string {
    const namedEntities: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: "\"",
      apos: "'",
    };

    return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (match, entity) => {
      if (entity[0] === "#") {
        const isHex = entity[1] === "x" || entity[1] === "X";
        const numericPart = isHex ? entity.slice(2) : entity.slice(1);
        const codePoint = Number.parseInt(numericPart, isHex ? 16 : 10);
        if (!Number.isFinite(codePoint)) {
          return match;
        }
        try {
          return String.fromCodePoint(codePoint);
        } catch (_) {
          return match;
        }
      }

      return Object.prototype.hasOwnProperty.call(namedEntities, entity)
        ? namedEntities[entity]
        : match;
    });
  }

  function normalizeIsEmailAddress(value: string): string {
    return value
      .replace(/\u240D/g, "\r")
      .replace(/\u240A/g, "\n")
      .replace(/\u2400/g, "\0")
      .replace(/\u2407/g, "\x07")
      .replace(/\u2409/g, "\t");
  }

  function readIsEmailCorpus(): Array<{ caseName: string; email: string; expected: boolean }> {
    const filePath = path.join(testDataDir, "isemail_tests.xml");
    const xml = fs.readFileSync(filePath, "utf8");
    const testBlocks = xml.match(/<test\b[\s\S]*?<\/test>/g) ?? [];

    const ignoredEmails = new Set<string>([
      "test@[RFC-5322-\\\t-domain-literal]",
      "test@[RFC-5322-\\\x07-domain-literal]",
      "test@[RFC-5322-\\]-domain-literal]",
    ]);

    const parsed: Array<{ caseName: string; email: string; expected: boolean }> = [];
    let sourceCaseIndex = 0;

    for (const block of testBlocks) {
      const addressMatch = block.match(/<address(?:\s*\/>|>([\s\S]*?)<\/address>)/);
      const categoryMatch = block.match(/<category>([\s\S]*?)<\/category>/);
      if (!addressMatch || !categoryMatch) {
        continue;
      }

      sourceCaseIndex += 1;

      const addressEncoded = addressMatch[1] ?? "";
      const category = decodeXmlEntities(categoryMatch[1].trim());
      const email = normalizeIsEmailAddress(decodeXmlEntities(addressEncoded));

      if (ignoredEmails.has(email)) {
        continue;
      }

      parsed.push({
        caseName: `case${sourceCaseIndex}`,
        email,
        expected: category !== "ISEMAIL_ERR",
      });
    }

    return parsed;
  }

  const validLocalParts = readCorpus("valid_local_parts.txt");
  const invalidLocalParts = readCorpus("invalid_local_parts.txt");
  const validDomains = readCorpus("valid_domains.txt");
  const invalidDomains = readCorpus("invalid_domains.txt");

  const strictValidCases = cartesianEmails(validLocalParts, validDomains).map((email, index) => {
    const atIndex = email.lastIndexOf("@");
    return {
      caseName: `case${index + 1}`,
      email,
      localPart: email.slice(0, atIndex),
      domain: email.slice(atIndex + 1),
    };
  });
  const strictInvalidCases = [
    ...cartesianEmails(invalidLocalParts, validDomains),
    ...cartesianEmails(validLocalParts, invalidDomains),
    ...cartesianEmails(invalidLocalParts, invalidDomains),
  ].map((email, index) => ({
    caseName: `case${index + 1}`,
    email,
  }));

  const strictIsValidCases = [
    ...strictValidCases.map((testCase) => ({
      email: testCase.email,
      expected: true,
    })),
    ...strictInvalidCases.map((testCase) => ({
      email: testCase.email,
      expected: false,
    })),
  ].map((testCase, index) => ({
    caseName: `case${index + 1}`,
    ...testCase,
  }));

  const strictValidEmails = strictValidCases.map((testCase) => testCase.email);
  const isEmailLaxCases = readIsEmailCorpus();

  describe("strict corpus", function () {
    describe("parses_valid_email_address", function () {
      for (const { caseName, email } of strictValidCases) {
        it(`${caseName} - ${asCaseLabel(email)}`, function () {
          assert.strictEqual(
            EMAIL_REGEX_STRICT.test(email),
            true,
            `Expected strict regex to accept: "${email}"`
          );
        });
      }
    });

    describe("does_not_parse_invalid_email_address", function () {
      for (const { caseName, email } of strictInvalidCases) {
        it(`${caseName} - ${asCaseLabel(email)}`, function () {
          assert.strictEqual(
            EMAIL_REGEX_STRICT.test(email),
            false,
            `Expected strict regex to reject: "${email}"`
          );
        });
      }
    });

    describe("LOCAL_PART_REGEX_STRICT", function () {
      for (let index = 0; index < validLocalParts.length; index++) {
        const localPart = validLocalParts[index];
        it(`case${index + 1} - ${asCaseLabel(localPart)}`, function () {
          assert.strictEqual(
            LOCAL_PART_REGEX_STRICT.test(localPart),
            true,
            `Expected strict local-part regex to accept: "${localPart}"`
          );
        });
      }
      for (let index = 0; index < invalidLocalParts.length; index++) {
        const localPart = invalidLocalParts[index];
        it(`case${index + 1} - ${asCaseLabel(localPart)}`, function () {
          assert.strictEqual(
            LOCAL_PART_REGEX_STRICT.test(localPart),
            false,
            `Expected strict local-part regex to reject: "${localPart}"`
          );
        });
      }
    });

    describe("DOMAIN_REGEX_STRICT", function () {
      for (let index = 0; index < validDomains.length; index++) {
        const domain = validDomains[index];
        it(`case${index + 1} - ${asCaseLabel(domain)}`, function () {
          assert.strictEqual(
            DOMAIN_REGEX_STRICT.test(domain),
            true,
            `Expected strict domain regex to accept: "${domain}"`
          );
        });
      }
      for (let index = 0; index < invalidDomains.length; index++) {
        const domain = invalidDomains[index];
        it(`case${index + 1} - ${asCaseLabel(domain)}`, function () {
          assert.strictEqual(
            DOMAIN_REGEX_STRICT.test(domain),
            false,
            `Expected strict domain regex to reject: "${domain}"`
          );
        });
      }
    });

    describe("is_valid_email_address", function () {
      for (const { caseName, email, expected } of strictIsValidCases) {
        it(`${caseName} - ${asCaseLabel(email)}`, function () {
          assert.strictEqual(
            isValidEmail(email, false),
            expected,
            `Expected strict validator to return ${expected} for: "${email}"`
          );
        });
      }
    });

    describe("parseEmail/parses_valid_email_address", function () {
      for (const { caseName, email, localPart, domain } of strictValidCases) {
        it(`${caseName} - ${asCaseLabel(email)}`, function () {
          const parsed = parseEmail(email, false);
          assert.ok(parsed, `Expected parseEmail to parse: "${email}"`);
          assert.strictEqual(parsed!.localPart, localPart, `Local part mismatch for "${email}"`);
          assert.strictEqual(parsed!.domain, domain, `Domain mismatch for "${email}"`);
        });
      }
    });

    describe("parseEmail/does_not_parse_invalid_email_address", function () {
      for (const { caseName, email } of strictInvalidCases) {
        it(`${caseName} - ${asCaseLabel(email)}`, function () {
          assert.strictEqual(
            parseEmail(email, false),
            null,
            `Expected parseEmail to reject: "${email}"`
          );
        });
      }
    });

  });

  describe("lax surface checks", function () {
    for (const email of strictValidEmails) {
      it(`EMAIL_REGEX_LAX accepts strict-valid ${asCaseLabel(email)}`, function () {
        assert.strictEqual(
          EMAIL_REGEX_LAX.test(email),
          true,
          `Expected lax regex to accept strict-valid address: "${email}"`
        );
      });
      it(`isValidEmail(lax) accepts strict-valid ${asCaseLabel(email)}`, function () {
        assert.strictEqual(
          isValidEmail(email, true),
          true,
          `Expected lax validator to accept strict-valid address: "${email}"`
        );
      });
    }

    for (const localPart of validLocalParts) {
      it(`LOCAL_PART_REGEX_LAX accepts strict-valid ${asCaseLabel(localPart)}`, function () {
        assert.strictEqual(
          LOCAL_PART_REGEX_LAX.test(localPart),
          true,
          `Expected lax local-part regex to accept strict-valid local part: "${localPart}"`
        );
      });
    }
    for (const domain of validDomains) {
      it(`DOMAIN_REGEX_LAX accepts strict-valid ${asCaseLabel(domain)}`, function () {
        assert.strictEqual(
          DOMAIN_REGEX_LAX.test(domain),
          true,
          `Expected lax domain regex to accept strict-valid domain: "${domain}"`
        );
      });
    }
  });

  describe("instantiates_valid_email_address", function () {
    for (const { caseName, localPart, domain } of strictValidCases) {
      it(`${caseName} - ${asCaseLabel(`${localPart}@${domain}`)}`, function () {
        const address = new EmailAddress(localPart, domain, new ParsingOptions(true));
        assert.strictEqual(address.localPart, localPart, `Local part mismatch for "${localPart}@${domain}"`);
        assert.strictEqual(address.domain, domain, `Domain mismatch for "${localPart}@${domain}"`);
        assert.strictEqual(`${address}`, `${localPart}@${domain}`, "incorrect display");
        address.free();
      });
    }
  });

  describe("panics_instantiating_invalid_email_address", function () {
    for (const { caseName, email } of strictInvalidCases) {
      const atIndex = email.lastIndexOf("@");
      const localPart = email.slice(0, atIndex);
      const domain = email.slice(atIndex + 1);

      it(`${caseName} - ${asCaseLabel(email)}`, function () {
        assert.throws(() => {
          new EmailAddress(localPart, domain, new ParsingOptions(false));
        });
        const address = new EmailAddress(localPart, domain, new ParsingOptions(true));
        assert.strictEqual(address.localPart, localPart);
        assert.strictEqual(address.domain, domain);
        address.free();
      });
    }
  });

  describe("is_email_parsing_tests", function () {
    for (const { caseName, email, expected } of isEmailLaxCases) {
      it(`${caseName} - ${asCaseLabel(email)}`, function () {
        const parsed = EmailAddress.parse(email, new ParsingOptions(true));
        assert.strictEqual(!!parsed, expected, `Expected ${email} to be valid: ${expected}`);
        if (expected) {
          assert.strictEqual(`${parsed}`, email, "incorrect display");
          parsed!.free();
        }
      });
    }
  });

  describe("regex_wrapper_api", function () {
    it("constructor, parse, isValid, getters and toString", function () {
      const emailStr = "foo@bar.com";
      const email = EmailAddress.parse(emailStr);
      assert.strictEqual(email?.localPart, "foo");
      assert.strictEqual(email?.domain, "bar.com");
      assert.strictEqual(`${email}`, emailStr);
      email?.free();

      const email1 = new EmailAddress("foo", "bar.com");
      assert.strictEqual(`${email1}`, emailStr);
      email1.free();

      assert.strictEqual(EmailAddress.parse("foo@-bar.com", new ParsingOptions(true)), undefined);

      assert.throws(() => {
        new EmailAddress("foo", "-bar.com");
      });
      assert.throws(() => {
        new EmailAddress("-foo", "-bar.com");
      });

      const laxAddress = new EmailAddress("-foo", "-bar.com", new ParsingOptions(true));
      assert.strictEqual(laxAddress.localPart, "-foo");
      assert.strictEqual(laxAddress.domain, "-bar.com");
      laxAddress.free();

      const unicode = new EmailAddress("foö", "bücher.de");
      assert.strictEqual(`${unicode}`, "foö@bücher.de");
      assert.strictEqual(`${EmailAddress.parse("foö@bücher.de")}`, "foö@bücher.de");
      assert.strictEqual(EmailAddress.isValid("foö@bücher.de"), true);
      unicode.free();
    });
  });
});
