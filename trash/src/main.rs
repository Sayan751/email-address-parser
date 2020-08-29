// mod email_address_parser;
use email_address_parser::email_address::EmailAddress;

fn main() {
    assert!(EmailAddress::parse("foo@bar.com", Some(true)).is_some());
    assert!(EmailAddress::parse("foo@-bar.com", Some(true)).is_none());
}
