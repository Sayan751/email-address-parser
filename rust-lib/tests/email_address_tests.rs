use serde_json::{Error, json};

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

#[test]
fn test_serialize() {
    let actual = serde_json::to_value(EmailAddress::new("foo", "bar.baz", None).unwrap()).unwrap();

    assert_eq!(json!({"local_part":"foo","domain":"bar.baz"}), actual);
}

#[test]
fn test_deserialize_valid() {
    let actual: EmailAddress = serde_json::from_value(json!({"local_part":"foo","domain":"bar.baz"})).unwrap();

    assert_eq!(EmailAddress::new("foo", "bar.baz", None).unwrap(), actual);
}

#[test]
fn test_deserialize_invalid() {
    let error_1: Result<EmailAddress, Error> = serde_json::from_value(json!({"local_part":"foo","domain":""}));
    let error_2: Result<EmailAddress, Error> = serde_json::from_value(json!({"local_part":"","domain":"bar.baz"}));
    let error_3: Result<EmailAddress, Error> = serde_json::from_value(json!({"localpart":"foo","domain":"bar.baz"}));
    let error_4: Result<EmailAddress, Error> = serde_json::from_value(json!({"local_part":"foo","domaine":"bar.baz"}));
    let error_5: Result<EmailAddress, Error> = serde_json::from_value(json!({"local_part":"foo","domain":"bar.baz","ques":"que.se"}));
    let error_6: Result<EmailAddress, Error> = serde_json::from_value(json!({"local_part":"foo"}));
    let error_7: Result<EmailAddress, Error> = serde_json::from_value(json!({"domain":"bar.baz"}));
    let error_8: Result<EmailAddress, Error> = serde_json::from_value(json!({}));

    assert!(error_1.is_err());
    assert!(error_2.is_err());
    assert!(error_3.is_err());
    assert!(error_4.is_err());
    assert!(error_5.is_err());
    assert!(error_6.is_err());
    assert!(error_7.is_err());
    assert!(error_8.is_err());
}
