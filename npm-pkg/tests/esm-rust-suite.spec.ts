import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

const specDir = path.resolve(process.cwd(), "tests");
const testDataRoot = path.resolve(specDir, "../../.test_data");

const decodeRustStringLiteralText = (value: string): string =>
  value
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

const readLines = (fileName: string): string[] =>
  fs
    .readFileSync(path.join(testDataRoot, fileName), "utf8")
    .split(/\r?\n/)
    .map((line) => decodeRustStringLiteralText(line));

const validLocalParts = readLines("valid_local_parts.txt");
const validDomains = readLines("valid_domains.txt");
const invalidLocalParts = readLines("invalid_local_parts.txt");
const invalidDomains = readLines("invalid_domains.txt");

type PairCase = { caseId: string; localPart: string; domain: string };
type AddressCase = { caseId: string; address: string; isValid: boolean };
type IsEmailCase = { caseId: string; email: string; isEmail: boolean };

const ignoredIsEmailCases = new Set<string>([
  String.raw`test@[RFC-5322-\\\u{09}-domain-literal]`,
  String.raw`test@[RFC-5322-\\\u{07}-domain-literal]`,
  String.raw`test@[RFC-5322-\\]-domain-literal]`,
]);

const decodeXmlText = (value: string): string =>
  value
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_m, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const normalizeControlPictures = (value: string): string =>
  value
    .replace(/\u240D/g, "\r")
    .replace(/\u240A/g, "\n")
    .replace(/\u2400/g, "\u0000")
    .replace(/\u2407/g, "\u0007")
    .replace(/\u2409/g, "\t");

const createPairCases = (
  localParts: string[],
  domains: string[],
  startIndex: number
): PairCase[] => {
  const cases: PairCase[] = [];
  let i = startIndex;
  for (const localPart of localParts) {
    for (const domain of domains) {
      i += 1;
      cases.push({ caseId: `case${i}`, localPart, domain });
    }
  }
  return cases;
};

const createAddressCases = (
  localParts: string[],
  domains: string[],
  isValid: boolean,
  startIndex: number
): AddressCase[] => {
  const cases: AddressCase[] = [];
  let i = startIndex;
  for (const localPart of localParts) {
    for (const domain of domains) {
      i += 1;
      cases.push({
        caseId: `case${i}`,
        address: `${localPart}@${domain}`,
        isValid,
      });
    }
  }
  return cases;
};

const parseIsEmailCases = (): IsEmailCase[] => {
  const xml = fs.readFileSync(path.join(testDataRoot, "isemail_tests.xml"), "utf8");
  const tests = xml.match(/<test\b[\s\S]*?<\/test>/g) ?? [];
  const cases: IsEmailCase[] = [];
  let i = 0;

  for (const testBlock of tests) {
    const addressMatch =
      testBlock.match(/<address>([\s\S]*?)<\/address>/) ??
      testBlock.match(/<address\s*\/>/);
    const categoryMatch = testBlock.match(/<category>([\s\S]*?)<\/category>/);
    if (!addressMatch || !categoryMatch) {
      continue;
    }

    const addressRaw = addressMatch[1] ?? "";
    const address = normalizeControlPictures(decodeXmlText(addressRaw));
    if (ignoredIsEmailCases.has(addressRaw)) {
      continue;
    }
    i += 1;

    cases.push({
      caseId: `case${i}`,
      email: address,
      isEmail: categoryMatch[1] !== "ISEMAIL_ERR",
    });
  }

  return cases;
};

describe("peggy ESM", function () {
  const esmUrl = pathToFileURL(path.resolve(specDir, "../dist/esm/index.mjs")).href;
  const esmPromise = import(esmUrl);

  describe("parses valid email address", function () {
    const cases = createPairCases(validLocalParts, validDomains, 0);
    for (const testCase of cases) {
      const address = `${testCase.localPart}@${testCase.domain}`;
      it(`${testCase.caseId}: ${JSON.stringify(address)}`, async function () {
        const { EmailAddress } = await esmPromise;
        const parsed = EmailAddress.parse(address);
        assert.ok(parsed, `expected valid parse: ${address}`);
        assert.strictEqual(
          parsed.localPart,
          testCase.localPart,
          `localPart mismatch: ${address}`
        );
        assert.strictEqual(parsed.domain, testCase.domain, `domain mismatch: ${address}`);
        assert.strictEqual(`${parsed}`, address, `display mismatch: ${address}`);
      });
    }
  });

  describe("does not parse invalid email address", function () {
    const cases: PairCase[] = [];
    let i = 0;
    const invalidLocalValidDomain = createPairCases(invalidLocalParts, validDomains, i);
    i += invalidLocalValidDomain.length;
    const validLocalInvalidDomain = createPairCases(validLocalParts, invalidDomains, i);
    i += validLocalInvalidDomain.length;
    const invalidLocalInvalidDomain = createPairCases(invalidLocalParts, invalidDomains, i);
    cases.push(...invalidLocalValidDomain, ...validLocalInvalidDomain, ...invalidLocalInvalidDomain);

    for (const testCase of cases) {
      const address = `${testCase.localPart}@${testCase.domain}`;
      it(`${testCase.caseId}: ${JSON.stringify(address)}`, async function () {
        const { EmailAddress } = await esmPromise;
        assert.strictEqual(
          EmailAddress.parse(address),
          undefined,
          `expected invalid parse: ${address}`
        );
      });
    }
  });

  describe("is_email parsing tests", function () {
    const cases = parseIsEmailCases();
    for (const testCase of cases) {
      it(`${testCase.caseId}: ${JSON.stringify(testCase.email)} => ${testCase.isEmail}`, async function () {
        const { EmailAddress, ParsingOptions } = await esmPromise;
        const parsed = EmailAddress.parse(testCase.email, new ParsingOptions(true));
        assert.strictEqual(
          parsed !== undefined,
          testCase.isEmail,
          `isemail mismatch: ${JSON.stringify(testCase.email)}`
        );
        if (testCase.isEmail) {
          assert.strictEqual(
            `${parsed}`,
            testCase.email,
            `display mismatch: ${JSON.stringify(testCase.email)}`
          );
        }
      });
    }
  });

  describe("instantiates valid email address", function () {
    const cases = createPairCases(validLocalParts, validDomains, 0);
    for (const testCase of cases) {
      const address = `${testCase.localPart}@${testCase.domain}`;
      it(`${testCase.caseId}: ${JSON.stringify(address)}`, async function () {
        const { EmailAddress, ParsingOptions } = await esmPromise;
        const email = new EmailAddress(
          testCase.localPart,
          testCase.domain,
          new ParsingOptions(true)
        );
        assert.strictEqual(email.localPart, testCase.localPart);
        assert.strictEqual(email.domain, testCase.domain);
        assert.strictEqual(`${email}`, address, `display mismatch: ${address}`);
      });
    }
  });

  describe("throws instantiating invalid email address", function () {
    const cases: PairCase[] = [];
    let i = 0;
    const invalidLocalValidDomain = createPairCases(invalidLocalParts, validDomains, i);
    i += invalidLocalValidDomain.length;
    const validLocalInvalidDomain = createPairCases(validLocalParts, invalidDomains, i);
    i += validLocalInvalidDomain.length;
    const invalidLocalInvalidDomain = createPairCases(invalidLocalParts, invalidDomains, i);
    cases.push(...invalidLocalValidDomain, ...validLocalInvalidDomain, ...invalidLocalInvalidDomain);

    for (const testCase of cases) {
      const address = `${testCase.localPart}@${testCase.domain}`;
      it(`${testCase.caseId}: ${JSON.stringify(address)}`, async function () {
        const { EmailAddress, ParsingOptions } = await esmPromise;
        assert.throws(() => {
          new EmailAddress(testCase.localPart, testCase.domain, new ParsingOptions(false));
        }, `expected strict constructor to throw: ${address}`);
        assert.doesNotThrow(() => {
          new EmailAddress(testCase.localPart, testCase.domain, new ParsingOptions(true));
        }, `expected lax constructor to succeed: ${address}`);
      });
    }
  });

  describe("is_valid email address", function () {
    const cases: AddressCase[] = [];
    let i = 0;
    const validCases = createAddressCases(validLocalParts, validDomains, true, i);
    i += validCases.length;
    const invalidLocalCases = createAddressCases(invalidLocalParts, validDomains, false, i);
    i += invalidLocalCases.length;
    const invalidDomainCases = createAddressCases(validLocalParts, invalidDomains, false, i);
    i += invalidDomainCases.length;
    const fullyInvalidCases = createAddressCases(invalidLocalParts, invalidDomains, false, i);
    cases.push(...validCases, ...invalidLocalCases, ...invalidDomainCases, ...fullyInvalidCases);

    for (const testCase of cases) {
      it(`${testCase.caseId}: ${JSON.stringify(testCase.address)} => ${testCase.isValid}`, async function () {
        const { EmailAddress } = await esmPromise;
        assert.strictEqual(
          EmailAddress.isValid(testCase.address),
          testCase.isValid,
          `isValid mismatch: ${testCase.address}`
        );
      });
    }
  });
});
