import * as assert from 'assert';

describe('integration', function () {
  it('works', async function () {
    const { EmailAddress, ParsingOptions } = await import('../dist/cjs/email_address_parser.js');

    const emailStr = 'foo@bar.com';
    const email = EmailAddress.parse(emailStr);
    assert.strictEqual(email?.localPart, 'foo');
    assert.strictEqual(email?.domain, 'bar.com');
    assert.strictEqual(`${email}`, emailStr);
    email.free();

    const email1 = new EmailAddress('foo', 'bar.com');
    assert.strictEqual(`${email1}`, emailStr);

    assert.strictEqual(EmailAddress.parse('foo@-bar.com', new ParsingOptions(true)), undefined);

    assert.throws(() => { new EmailAddress('foo', '-bar.com'); });
    assert.throws(() => { new EmailAddress('-foo', '-bar.com'); });

    assert.strictEqual(`${new EmailAddress('foö', 'bücher.de')}`, 'foö@bücher.de');
    assert.strictEqual(`${EmailAddress.parse('foö@bücher.de')}`, 'foö@bücher.de');
    assert.strictEqual(EmailAddress.isValid('foö@bücher.de'), true);
  });
});