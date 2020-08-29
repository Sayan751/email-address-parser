use email_address_parser::email_address::EmailAddress;

#[test]
fn email_parsing_works() {
    let email = EmailAddress::parse("foo@bar.com", Some(true));
    assert_eq!(email.is_some(), true);
}