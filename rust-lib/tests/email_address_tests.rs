use email_address_parser::EmailAddress;

#[test]
fn test_clone() {
    let actual: EmailAddress;

    {
        let expected = EmailAddress::new("foo", "bar.com", None).unwrap();
        actual = expected.clone();

        // check they are the same
        assert_eq!(&expected, &actual);
    }

    // ensure it exists after the source is dropped
    assert_eq!("foo", actual.get_local_part());
    assert_eq!("bar.com", actual.get_domain());
}
