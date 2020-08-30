use quick_xml::events::Event;
use quick_xml::Reader;
use std::env;
use std::fs;
use std::io::Write;
use std::path;

fn main() {
  // cargo env var reference: https://doc.rust-lang.org/cargo/reference/environment-variables.html
  let root = env::var_os("CARGO_MANIFEST_DIR").unwrap();
  let test_file_path = path::Path::new(&root)
    .join("tests")
    .join("generated_tests.rs");
  let mut test_file = fs::File::create(&test_file_path).unwrap();
  let test_data_root = path::Path::new(&root).join("resources").join(".test_data");

  let read_test_data = |file_name: &str| {
    fs::read_to_string(test_data_root.join(file_name))
      .expect(&format!("{} not found", file_name))
      .lines()
      .map(|v| String::from(v))
      .collect()
  };

  let valid_local_parts: Vec<String> = read_test_data("valid_local_parts.txt");
  let valid_domains: Vec<String> = read_test_data("valid_domains.txt");
  let invalid_local_parts: Vec<String> = read_test_data("invalid_local_parts.txt");
  let invalid_domains: Vec<String> = read_test_data("invalid_domains.txt");
  let is_email_xml = fs::read_to_string(test_data_root.join("isemail_tests.xml")).unwrap();

  let mut content = String::from(
    "
/**
 * This is a generated file by build.rs.
 * Do not edit manually.
 */
macro_rules! generate_test_positive_parsing_test {
  ($($case:ident: ($local_part:literal, $domain:literal),)+) => {
    #[cfg(test)]
    mod parses_valid_email_address {
      use email_address_parser::email_address::EmailAddress;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          let address_str = concat!($local_part, \"@\", $domain);
          let address = EmailAddress::parse(&address_str, Some(true));
          assert_eq!(address.is_some(), true, \"expected {} to be parsed\", address_str);
          let address = address.unwrap();
          assert_eq!(address.get_local_part(), $local_part, \"local_part of {}\", address_str);
          assert_eq!(address.get_domain(), $domain, \"domain of {}\", address_str);
          assert_eq!(format!(\"{}\", address), address_str, \"incorrect display\");
        }
      )*
    }
  };
}

generate_test_positive_parsing_test!{
",
  );

  let mut i = 0;
  for local_part in &valid_local_parts {
    for domain in &valid_domains {
      i += 1;
      content.push_str(&format!(
        "  {}: (\"{}\", \"{}\"),\n",
        &format!("case{}", i),
        local_part,
        domain
      ));
    }
  }

  content.push_str("}\n");

  content.push_str(
    "
macro_rules! generate_test_negative_parsing_test {
  ($($case:ident: ($local_part:literal, $domain:literal),)+) => {
    #[cfg(test)]
    mod does_not_parse_invalid_email_address {
      use email_address_parser::email_address::EmailAddress;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          let address_str = concat!($local_part, \"@\", $domain);
          assert_eq!(EmailAddress::parse(&address_str, Some(true)).is_none(), true, \"expected {} not to be parsed\", address_str);
        }
      )*
    }
  };
}

generate_test_negative_parsing_test!{
",
  );
  let mut i = 0;
  for local_part in &invalid_local_parts {
    for domain in &valid_domains {
      i += 1;
      content.push_str(&format!(
        "  {}: (\"{}\", \"{}\"),\n",
        &format!("case{}", i),
        local_part,
        domain
      ));
    }
  }
  for local_part in &valid_local_parts {
    for domain in &invalid_domains {
      i += 1;
      content.push_str(&format!(
        "  {}: (\"{}\", \"{}\"),\n",
        &format!("case{}", i),
        local_part,
        domain
      ));
    }
  }
  for local_part in &invalid_local_parts {
    for domain in &invalid_domains {
      i += 1;
      content.push_str(&format!(
        "  {}: (\"{}\", \"{}\"),\n",
        &format!("case{}", i),
        local_part,
        domain
      ));
    }
  }

  content.push_str("}\n");

  content.push_str(
    "
macro_rules! generate_is_email_test {
  ($($case:ident: ($email:literal, $is_email:literal),)+) => {
    #[cfg(test)]
    mod is_email_tests {
      use email_address_parser::email_address::EmailAddress;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          let email = EmailAddress::parse(&$email, None);
          assert_eq!(email.is_some(), $is_email, \"expected {} to be valid: {}\", $email, $is_email);
          if $is_email {
            assert_eq!(
              format!(\"{}\", email.unwrap()), 
              $email, 
              \"incorrect display\"
            );
          }
        }
      )*
    }
  };
}

generate_is_email_test!{
",
  );

  let mut reader = Reader::from_str(&is_email_xml);

  let mut buf = Vec::new();
  let mut email: String = String::new();
  let mut is_valid: bool = false;
  let mut capture: String = String::new();
  let mut should_capture = false;
  let mut i = 0;
  let ignored_emails: Vec<&str> = vec![
    r"test@[RFC-5322-\\\u{09}-domain-literal]",
    r"test@[RFC-5322-\\\u{07}-domain-literal]",
    r"test@[RFC-5322-\\]-domain-literal]",
  ];

  loop {
    match reader.read_event(&mut buf) {
      Ok(Event::Start(ref e)) => {
        should_capture = match e.name() {
          b"address" | b"category" => true,
          _ => false,
        }
      }
      Ok(Event::Text(e)) => {
        capture = if should_capture {
          e.unescape_and_decode(&reader).unwrap()
        } else {
          String::new()
        }
      }
      Ok(Event::End(ref e)) => match e.name() {
        b"address" => {
          email = capture
            .clone()
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\u{240D}", "\\u{0d}")
            .replace("\u{240A}", "\\u{0a}")
            .replace("\u{2400}", "\\u{00}")
            .replace("\u{2407}", "\\u{07}")
            .replace("\u{2409}", "\\u{09}")
        }
        b"category" => {
          is_valid = capture != "ISEMAIL_ERR";
        }
        b"test" => {
          i += 1;
          if !ignored_emails.contains(&email.as_str()) {
            content.push_str(&format!(
              "  {}: (\"{}\", {}),\n",
              &format!("case{}", i),
              email,
              is_valid,
            ));
          }
        }
        _ => (),
      },
      Ok(Event::Eof) => break, // exits the loop when reaching end of file
      Err(e) => panic!("Error at position {}: {:?}", reader.buffer_position(), e),
      _ => (), // There are several other `Event`s we do not consider here
    }

    // if we don't keep a borrow elsewhere, we can clear the buffer to keep memory usage low
    buf.clear();
  }

  content.push_str("}");

  write!(test_file, "{}", content.trim()).unwrap();
  println!("cargo:rerun-if-changed=build.rs");
  println!("cargo:rerun-if-changed=resources/.test_data/valid_local_parts.txt");
  println!("cargo:rerun-if-changed=resources/.test_data/valid_domains.txt");
  println!("cargo:rerun-if-changed=resources/.test_data/invalid_local_parts.txt");
  println!("cargo:rerun-if-changed=resources/.test_data/invalid_domains.txt");
}
