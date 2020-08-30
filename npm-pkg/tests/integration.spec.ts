import * as assert from 'assert';

describe('integration', function () {
  it('works', async function () {
    const EmailAddress = (await import('../')).default.EmailAddress;

    const email = EmailAddress.parse('foo@bar.com', true);
    assert.strictEqual(email?.local_part(), 'foo');
    assert.strictEqual(email?.domain(), 'bar.com');

    assert.strictEqual(EmailAddress.parse("foo@-bar.com", true), undefined);
  });
});