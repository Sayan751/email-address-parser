import("email-address-parser")
    .then((parser) => {
        const EmailAddress = parser.default.EmailAddress;
        const email = EmailAddress.parse("foo@bar.com", true);
        console.log(`lp: ${email.local_part()}, domain: ${email.domain()}`);

        console.log(EmailAddress.parse("foo@-bar.com", true));
    })
    .catch((reason) => {
        console.error(reason);
    });