use quick_xml::events::Event;
use quick_xml::Reader;
use std::env;
use std::fs;
use std::io::Write;
use std::path;

fn main() {
    // cargo env var reference: https://doc.rust-lang.org/cargo/reference/environment-variables.html
    let root = env::var_os("CARGO_MANIFEST_DIR").unwrap();
    let out_dir = env::var_os("OUT_DIR").unwrap();
    let test_file_path = path::Path::new(&out_dir).join("generated_tests.rs");
    let mut test_file = fs::File::create(&test_file_path).unwrap();
    let test_data_root = path::Path::new(&root).join(".test_data");

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

    let mut content = String::new();
    create_valid_parsing_tests(&mut content, &valid_local_parts, &valid_domains);
    create_invalid_parsing_tests(
        &mut content,
        &valid_local_parts,
        &valid_domains,
        &invalid_local_parts,
        &invalid_domains,
    );

    create_is_email_tests(&mut content, &test_data_root);

    create_valid_instantiation_tests(&mut content, &valid_local_parts, &valid_domains);
    create_invalid_instantiation_tests(
        &mut content,
        &valid_local_parts,
        &valid_domains,
        &invalid_local_parts,
        &invalid_domains,
    );

    create_is_valid_tests(
        &mut content,
        &valid_local_parts,
        &valid_domains,
        &invalid_local_parts,
        &invalid_domains,
    );

    write!(test_file, "{}", content.trim()).unwrap();
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=resources/.test_data/valid_local_parts.txt");
    println!("cargo:rerun-if-changed=resources/.test_data/valid_domains.txt");
    println!("cargo:rerun-if-changed=resources/.test_data/invalid_local_parts.txt");
    println!("cargo:rerun-if-changed=resources/.test_data/invalid_domains.txt");
}

fn create_case(
    content: &mut String,
    case_index: &mut i32,
    local_parts: &Vec<String>,
    domains: &Vec<String>,
) {
    for local_part in local_parts {
        for domain in domains {
            *case_index += 1;
            content.push_str(&format!(
                "  {}: (\"{}\", \"{}\"),\n",
                &format!("case{}", case_index),
                local_part,
                domain
            ));
        }
    }
}

fn create_valid_parsing_tests(
    content: &mut String,
    local_parts: &Vec<String>,
    domains: &Vec<String>,
) {
    content.push_str(
        "
macro_rules! generate_positive_parsing_test {
  ($($case:ident: ($local_part:literal, $domain:literal),)+) => {
    #[cfg(test)]
    mod parses_valid_email_address {
      use email_address_parser::*;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          let address_str = concat!($local_part, \"@\", $domain);
          let address = EmailAddress::parse(&address_str, None);
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

generate_positive_parsing_test!{
",
    );
    create_case(content, &mut 0, local_parts, domains);

    content.push_str("}\n");
}

fn create_invalid_parsing_tests(
    content: &mut String,
    valid_local_parts: &Vec<String>,
    valid_domains: &Vec<String>,
    invalid_local_parts: &Vec<String>,
    invalid_domains: &Vec<String>,
) {
    content.push_str(
    "
macro_rules! generate_negative_parsing_test {
  ($($case:ident: ($local_part:literal, $domain:literal),)+) => {
    #[cfg(test)]
    mod does_not_parse_invalid_email_address {
      use email_address_parser::*;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          let address_str = concat!($local_part, \"@\", $domain);
          assert_eq!(EmailAddress::parse(&address_str, None).is_none(), true, \"expected {} not to be parsed\", address_str);
        }
      )*
    }
  };
}

generate_negative_parsing_test!{
",
  );
    let mut i = 0;
    create_case(content, &mut i, invalid_local_parts, valid_domains);
    create_case(content, &mut i, valid_local_parts, invalid_domains);
    create_case(content, &mut i, invalid_local_parts, invalid_domains);

    content.push_str("}\n");
}

fn create_is_email_tests(content: &mut String, test_data_root: &path::Path) {
    let is_email_xml = fs::read_to_string(test_data_root.join("isemail_tests.xml")).unwrap();

    content.push_str(
    "
macro_rules! generate_is_email_test {
  ($($case:ident: ($email:literal, $is_email:literal),)+) => {
    #[cfg(test)]
    mod is_email_parsing_tests {
      use email_address_parser::*;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          let email = EmailAddress::parse(&$email, Some(ParsingOptions::new(true)));
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
}

fn create_valid_instantiation_tests(
    content: &mut String,
    local_parts: &Vec<String>,
    domains: &Vec<String>,
) {
    content.push_str(
    "
macro_rules! generate_positive_instantiation_test {
  ($($case:ident: ($local_part:literal, $domain:literal),)+) => {
    #[cfg(test)]
    mod instantiates_valid_email_address {
      use email_address_parser::*;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          let address = EmailAddress::new(&$local_part, &$domain, Some(ParsingOptions::new(true))).unwrap();
          assert_eq!(address.get_local_part(), $local_part);
          assert_eq!(address.get_domain(), $domain);
          assert_eq!(format!(\"{}\", address), concat!($local_part, \"@\", $domain), \"incorrect display\");
        }
      )*
    }
  };
}

generate_positive_instantiation_test!{
",
  );
    create_case(content, &mut 0, local_parts, domains);

    content.push_str("}\n");
}

fn create_invalid_instantiation_tests(
    content: &mut String,
    valid_local_parts: &Vec<String>,
    valid_domains: &Vec<String>,
    invalid_local_parts: &Vec<String>,
    invalid_domains: &Vec<String>,
) {
    content.push_str(
    "
macro_rules! generate_negative_instantiation_test {
  ($($case:ident: ($local_part:literal, $domain:literal),)+) => {
    #[cfg(test)]
    mod panics_instantiating_invalid_email_address {
      use email_address_parser::*;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          assert_eq!(EmailAddress::new(&$local_part, &$domain, Some(ParsingOptions::new(true))).is_err(), true);
        }
      )*
    }
  };
}

generate_negative_instantiation_test!{
",
  );
    let mut i = 0;
    create_case(content, &mut i, invalid_local_parts, valid_domains);
    create_case(content, &mut i, valid_local_parts, invalid_domains);
    create_case(content, &mut i, invalid_local_parts, invalid_domains);

    content.push_str("}\n");
}

fn create_is_valid_tests(
    content: &mut String,
    valid_local_parts: &Vec<String>,
    valid_domains: &Vec<String>,
    invalid_local_parts: &Vec<String>,
    invalid_domains: &Vec<String>,
) {
    fn create_is_valid_case(
        content: &mut String,
        case_index: &mut i32,
        local_parts: &Vec<String>,
        domains: &Vec<String>,
        is_valid: bool,
    ) {
        for local_part in local_parts {
            for domain in domains {
                *case_index += 1;
                content.push_str(&format!(
                    "  {}: (\"{}\", {}),\n",
                    &format!("case{}", case_index),
                    format!("{}@{}", local_part, domain),
                    is_valid
                ));
            }
        }
    }
    content.push_str(
    "
macro_rules! generate_is_valid_test {
  ($($case:ident: ($address:literal, $is_valid:literal),)+) => {
    #[cfg(test)]
    mod is_valid_email_address {
      use email_address_parser::*;
      use wasm_bindgen_test::*;
      wasm_bindgen_test_configure!(run_in_browser);
      $(
        #[test]
        #[wasm_bindgen_test]
        fn $case() {
          assert_eq!(EmailAddress::is_valid(&$address, None), $is_valid, \"expected {} to be valid: {}\", $address, $is_valid);
        }
      )*
    }
  };
}

generate_is_valid_test!{
",
  );
    let mut i = 0;
    create_is_valid_case(content, &mut i, valid_local_parts, valid_domains, true);
    create_is_valid_case(content, &mut i, invalid_local_parts, valid_domains, false);
    create_is_valid_case(content, &mut i, valid_local_parts, invalid_domains, false);
    create_is_valid_case(content, &mut i, invalid_local_parts, invalid_domains, false);

    content.push_str("}\n");
}
