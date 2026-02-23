use nom::branch::alt;
use nom::bytes::complete::tag;
use nom::combinator::{all_consuming, consumed};
use nom::error::{Error, ErrorKind};
use nom::IResult;

type Res<'a, T> = IResult<&'a str, T>;

const MAX_RECURSION_DEPTH: usize = 128;

// Entry point for `address_single` / `address_single_obs` (SOI/EOI via `all_consuming`).
pub(crate) fn parse_address<'a>(input: &'a str, is_lax: bool) -> Option<(&'a str, &'a str)> {
    if let Ok((_, parsed)) = all_consuming(address_spec_strict)(input) {
        return Some(parsed);
    }

    if is_lax {
        return all_consuming(address_spec_obs)(input).ok().map(|(_, parsed)| parsed);
    }

    None
}

#[cfg(test)]
pub(crate) fn test_parse_domain_complete(input: &str) -> bool {
    all_consuming(domain_strict)(input).is_ok()
}

#[cfg(test)]
pub(crate) fn test_parse_domain_obs(input: &str) -> bool {
    all_consuming(domain_obs)(input).is_ok()
}

#[cfg(test)]
pub(crate) fn test_parse_local_part_obs(input: &str) -> bool {
    all_consuming(local_part_obs)(input).is_ok()
}

#[cfg(test)]
pub(crate) fn test_parse_address_obs(input: &str) -> bool {
    all_consuming(address_spec_obs)(input).is_ok()
}

#[cfg(test)]
pub(crate) fn test_parse_domain_literal(input: &str) -> bool {
    all_consuming(domain_literal)(input).is_ok()
}

#[cfg(test)]
pub(crate) fn test_parse_local_part_complete(input: &str) -> bool {
    all_consuming(local_part_strict)(input).is_ok()
}

// `address_spec = local_part "@" domain`
fn address_spec_strict(input: &str) -> Res<'_, (&str, &str)> {
    let (input, local_part) = local_part_strict(input)?;
    let (input, _) = tag("@")(input)?;
    let (input, domain) = domain_strict(input)?;
    Ok((input, (local_part, domain)))
}

// `address_spec_obs = local_part_obs "@" domain_obs`
fn address_spec_obs(input: &str) -> Res<'_, (&str, &str)> {
    let (input, local_part) = local_part_obs(input)?;
    let (input, _) = tag("@")(input)?;
    let (input, domain) = domain_obs(input)?;
    Ok((input, (local_part, domain)))
}

// `local_part = dot_atom | quoted_string`
fn local_part_strict(input: &str) -> Res<'_, &str> {
    alt((dot_atom, quoted_string))(input)
}

// `domain = dot_atom | domain_literal`
fn domain_strict(input: &str) -> Res<'_, &str> {
    alt((dot_atom, domain_literal))(input)
}

// `local_part_obs = obs_local_part | dot_atom | quoted_string`
fn local_part_obs(input: &str) -> Res<'_, &str> {
    alt((obs_local_part, dot_atom, quoted_string))(input)
}

// `domain_obs = obs_domain | dot_atom | domain_literal`
fn domain_obs(input: &str) -> Res<'_, &str> {
    alt((obs_domain, dot_atom, domain_literal))(input)
}

// `dot_atom` capture wrapper (used where the grammar captures the full token).
fn dot_atom(input: &str) -> Res<'_, &str> {
    let (input, (matched, _)) = consumed(dot_atom_inner)(input)?;
    Ok((input, matched))
}

// `dot_atom = WSP? dot_atom_text WSP?`
fn dot_atom_inner(input: &str) -> Res<'_, ()> {
    let input = opt_wsp(input);
    let (input, _) = dot_atom_text(input)?;
    let input = opt_wsp(input);
    Ok((input, ()))
}

// `dot_atom_text` (with project-specific domain label dash restrictions and optional CFWS after '.').
fn dot_atom_text(input: &str) -> Res<'_, ()> {
    let (mut input, _) = dot_atom_label(input)?;

    loop {
        let Some(after_dot) = input.strip_prefix('.') else {
            break;
        };
        let after_dot = skip_cfws0(after_dot);
        let (next, _) = dot_atom_label(after_dot)?;
        input = next;
    }

    Ok((input, ()))
}

// Label parser derived from `atext_wo_dash+ ...`; prevents leading/trailing `-` in each segment.
fn dot_atom_label(input: &str) -> Res<'_, ()> {
    let (mut input, first) = take_char_if(input, is_atext_no_dash)?;
    let mut last = first;

    while let Some((ch, rest)) = next_char(input) {
        if !is_atext(ch) {
            break;
        }
        last = ch;
        input = rest;
    }

    if last == '-' {
        return fail(input);
    }

    Ok((input, ()))
}

// `obs_local_part` capture wrapper.
fn obs_local_part(input: &str) -> Res<'_, &str> {
    let (input, (matched, _)) = consumed(obs_local_part_inner)(input)?;
    Ok((input, matched))
}

// `obs_local_part = FWS* word (CFWS* "." CFWS* word)*`
fn obs_local_part_inner(input: &str) -> Res<'_, ()> {
    let mut input = skip_fws0(input);
    let (next, _) = word(input)?;
    input = next;

    loop {
        let checkpoint = input;
        let mut candidate = skip_cfws0(input);
        let Some(rest) = candidate.strip_prefix('.') else {
            break;
        };
        candidate = skip_cfws0(rest);
        match word(candidate) {
            Ok((next, _)) => input = next,
            Err(_) => {
                return fail(checkpoint);
            }
        }
    }

    Ok((input, ()))
}

// `word = atom | quoted_string`
fn word(input: &str) -> Res<'_, ()> {
    alt((atom, quoted_string_unit))(input)
}

// `atom = CFWS? atext+ CFWS?`
fn atom(input: &str) -> Res<'_, ()> {
    let mut input = input;
    if let Ok((next, _)) = cfws(input) {
        input = next;
    }
    let (next, _) = atext1(input)?;
    input = next;
    if let Ok((next, _)) = cfws(input) {
        input = next;
    }
    Ok((input, ()))
}

// `atext+`
fn atext1(input: &str) -> Res<'_, ()> {
    let (mut input, _) = take_char_if(input, is_atext)?;
    while let Some((ch, rest)) = next_char(input) {
        if !is_atext(ch) {
            break;
        }
        input = rest;
    }
    Ok((input, ()))
}

// `atext_wo_dash+`
fn atext_no_dash1(input: &str) -> Res<'_, ()> {
    let (mut input, _) = take_char_if(input, is_atext_no_dash)?;
    while let Some((ch, rest)) = next_char(input) {
        if !is_atext_no_dash(ch) {
            break;
        }
        input = rest;
    }
    Ok((input, ()))
}

// `obs_domain` capture wrapper.
fn obs_domain(input: &str) -> Res<'_, &str> {
    let (input, (matched, _)) = consumed(|i| obs_domain_inner(i, 0))(input)?;
    Ok((input, matched))
}

// Recursive `obs_domain` core:
// `CFWS* atext_wo_dash+ (CFWS* ("." obs_domain+ | "-"{1,} obs_domain+))* FWS*`
fn obs_domain_inner(input: &str, depth: usize) -> Res<'_, ()> {
    if depth >= MAX_RECURSION_DEPTH {
        return fail(input);
    }

    let mut input = skip_cfws0(input);
    let (next, _) = atext_no_dash1(input)?;
    input = next;

    loop {
        let checkpoint = input;
        let mut candidate = skip_cfws0(input);

        if let Some(rest) = candidate.strip_prefix('.') {
            let (next, _) = obs_domain_plus(rest, depth + 1)?;
            input = next;
            continue;
        }

        let (after_hyphen, hyphen_count) = take_repeated_char(candidate, '-');
        if hyphen_count > 0 {
            let (next, _) = obs_domain_plus(after_hyphen, depth + 1)?;
            input = next;
            continue;
        }

        if candidate.len() != checkpoint.len() {
            // Leading CFWS without a following separator cannot be consumed here.
            candidate = checkpoint;
            let _ = candidate;
        }
        break;
    }

    input = skip_fws0(input);
    Ok((input, ()))
}

// Helper for the `obs_domain+` sub-productions used by `obs_domain_inner`.
fn obs_domain_plus(input: &str, depth: usize) -> Res<'_, ()> {
    let (mut input, _) = obs_domain_inner(input, depth)?;

    loop {
        match obs_domain_inner(input, depth) {
            Ok((next, _)) if next.len() < input.len() => input = next,
            _ => break,
        }
    }

    Ok((input, ()))
}

// `quoted_string` capture wrapper.
fn quoted_string(input: &str) -> Res<'_, &str> {
    let (input, (matched, _)) = consumed(quoted_string_inner)(input)?;
    Ok((input, matched))
}

// Unit wrapper so `quoted_string` can participate in `word`.
fn quoted_string_unit(input: &str) -> Res<'_, ()> {
    let (input, _) = quoted_string(input)?;
    Ok((input, ()))
}

// `quoted_string = CFWS? DQUOTE (FWS? qcontent)* FWS? DQUOTE CFWS?`
fn quoted_string_inner(mut input: &str) -> Res<'_, ()> {
    if let Ok((next, _)) = cfws(input) {
        input = next;
    }

    let (next, _) = tag("\"")(input)?;
    input = next;

    loop {
        let checkpoint = input;
        let mut candidate = input;
        if let Ok((next, _)) = fws(candidate) {
            candidate = next;
        }
        if let Ok((next, _)) = qcontent(candidate) {
            input = next;
            continue;
        }
        input = checkpoint;
        break;
    }

    if let Ok((next, _)) = fws(input) {
        input = next;
    }

    let (next, _) = tag("\"")(input)?;
    input = next;

    if let Ok((next, _)) = cfws(input) {
        input = next;
    }

    Ok((input, ()))
}

// `qcontent = qtext | quoted_pair`
fn qcontent(input: &str) -> Res<'_, ()> {
    alt((qtext, quoted_pair))(input)
}

// `qtext`
fn qtext(input: &str) -> Res<'_, ()> {
    let (input, _) = take_char_if(input, is_qtext_char)?;
    Ok((input, ()))
}

// `domain_literal` capture wrapper.
fn domain_literal(input: &str) -> Res<'_, &str> {
    let (input, (matched, _)) = consumed(domain_literal_inner)(input)?;
    Ok((input, matched))
}

// `domain_literal = CFWS? "[" (FWS? dtext)* FWS? "]" CFWS?`
fn domain_literal_inner(mut input: &str) -> Res<'_, ()> {
    if let Ok((next, _)) = cfws(input) {
        input = next;
    }

    let (next, _) = tag("[")(input)?;
    input = next;

    loop {
        let checkpoint = input;
        let mut candidate = input;
        if let Ok((next, _)) = fws(candidate) {
            candidate = next;
        }
        if let Ok((next, _)) = dtext(candidate) {
            input = next;
            continue;
        }
        input = checkpoint;
        break;
    }

    if let Ok((next, _)) = fws(input) {
        input = next;
    }

    let (next, _) = tag("]")(input)?;
    input = next;

    if let Ok((next, _)) = cfws(input) {
        input = next;
    }

    Ok((input, ()))
}

// `dtext`
fn dtext(input: &str) -> Res<'_, ()> {
    let (input, _) = take_char_if(input, is_dtext_char)?;
    Ok((input, ()))
}

// `CFWS = ((FWS? comment)+ FWS?) | FWS`
fn cfws(input: &str) -> Res<'_, ()> {
    if let Ok((input, _)) = cfws_with_comment(input) {
        return Ok((input, ()));
    }
    fws(input)
}

// `CFWS` branch for `((FWS? comment)+ FWS?)`.
fn cfws_with_comment(mut input: &str) -> Res<'_, ()> {
    let start = input;
    let mut found_comment = false;

    loop {
        let checkpoint = input;
        let mut candidate = input;
        if let Ok((next, _)) = fws(candidate) {
            candidate = next;
        }
        match comment(candidate) {
            Ok((next, _)) => {
                input = next;
                found_comment = true;
            }
            Err(_) => {
                input = checkpoint;
                break;
            }
        }
    }

    if !found_comment {
        return fail(start);
    }

    if let Ok((next, _)) = fws(input) {
        input = next;
    }

    Ok((input, ()))
}

// `comment = "(" (FWS? ccontent)* FWS? ")"`
fn comment(mut input: &str) -> Res<'_, ()> {
    let (next, _) = tag("(")(input)?;
    input = next;

    loop {
        let checkpoint = input;
        let mut candidate = input;
        if let Ok((next, _)) = fws(candidate) {
            candidate = next;
        }
        match ccontent(candidate) {
            Ok((next, _)) => input = next,
            Err(_) => {
                input = checkpoint;
                break;
            }
        }
    }

    if let Ok((next, _)) = fws(input) {
        input = next;
    }

    let (next, _) = tag(")")(input)?;
    Ok((next, ()))
}

// `ccontent = ctext | quoted_pair | comment`
fn ccontent(input: &str) -> Res<'_, ()> {
    alt((ctext, quoted_pair, comment))(input)
}

// `ctext`
fn ctext(input: &str) -> Res<'_, ()> {
    let (input, _) = take_char_if(input, is_ctext_char)?;
    Ok((input, ()))
}

// `quoted_pair` + obsolete quoted-pair allowances (`obs_qp`) via `is_quoted_pair_char`.
fn quoted_pair(input: &str) -> Res<'_, ()> {
    let (input, _) = tag("\\")(input)?;
    let (input, _) = take_char_if(input, is_quoted_pair_char)?;
    Ok((input, ()))
}

// Folding white space (`FWS`) with `obs_FWS`-compatible handling for lax parsing paths.
fn fws(input: &str) -> Res<'_, ()> {
    let start = input;
    let (mut input, leading_wsp_count) = wsp0(input);

    if let Some(after_crlf) = consume_crlf(input) {
        let (after_wsp, count) = wsp0(after_crlf);
        if count == 0 {
            return fail(start);
        }
        input = after_wsp;
    } else if leading_wsp_count == 0 {
        return fail(start);
    }

    while let Some(after_crlf) = consume_crlf(input) {
        let (after_wsp, count) = wsp0(after_crlf);
        if count == 0 {
            break;
        }
        input = after_wsp;
    }

    Ok((input, ()))
}

// Repeated `FWS*` helper.
fn skip_fws0(mut input: &str) -> &str {
    loop {
        match fws(input) {
            Ok((next, _)) if next.len() < input.len() => input = next,
            _ => break,
        }
    }
    input
}

// Repeated `CFWS*` helper.
fn skip_cfws0(mut input: &str) -> &str {
    loop {
        let should_try = matches!(input.as_bytes().first(), Some(b' ' | b'\t' | b'\r' | b'('));
        if !should_try {
            break;
        }

        match cfws(input) {
            Ok((next, _)) if next.len() < input.len() => input = next,
            _ => break,
        }
    }
    input
}

// Optional `WSP` for strict `dot_atom`.
fn opt_wsp(input: &str) -> &str {
    match next_char(input) {
        Some((ch, rest)) if is_wsp(ch) => rest,
        _ => input,
    }
}

// `WSP*`
fn wsp0(mut input: &str) -> (&str, usize) {
    let mut count = 0;
    while let Some((ch, rest)) = next_char(input) {
        if !is_wsp(ch) {
            break;
        }
        count += 1;
        input = rest;
    }
    (input, count)
}

fn consume_crlf(input: &str) -> Option<&str> {
    input.strip_prefix("\r\n")
}

fn next_char(input: &str) -> Option<(char, &str)> {
    let ch = input.chars().next()?;
    let next = &input[ch.len_utf8()..];
    Some((ch, next))
}

fn take_repeated_char(mut input: &str, needle: char) -> (&str, usize) {
    let mut count = 0;
    while let Some((ch, rest)) = next_char(input) {
        if ch != needle {
            break;
        }
        count += 1;
        input = rest;
    }
    (input, count)
}

// Primitive terminal matcher used by the handwritten rule parsers above.
fn take_char_if<F>(input: &str, predicate: F) -> Res<'_, char>
where
    F: Fn(char) -> bool,
{
    match next_char(input) {
        Some((ch, rest)) if predicate(ch) => Ok((rest, ch)),
        _ => fail(input),
    }
}

fn fail<'a, T>(input: &'a str) -> Res<'a, T> {
    Err(nom::Err::Error(Error::new(input, ErrorKind::Char)))
}

// Character-class helpers mirroring grammar terminals (`WSP`, `atext`, `qtext`, `dtext`, etc.).
fn is_wsp(ch: char) -> bool {
    matches!(ch, ' ' | '\t')
}

fn is_printable_us_ascii(ch: char) -> bool {
    matches!(ch as u32, 0x21..=0x7e)
}

fn is_utf8_non_ascii(ch: char) -> bool {
    (ch as u32) >= 0x80
}

fn is_obs_no_ws_ctl(ch: char) -> bool {
    matches!(ch as u32, 0x01..=0x08 | 0x0b | 0x0c | 0x0e..=0x1f | 0x7f)
}

fn is_quoted_pair_char(ch: char) -> bool {
    is_printable_us_ascii(ch)
        || is_wsp(ch)
        || matches!(ch, '\0' | '\r' | '\n')
        || is_obs_no_ws_ctl(ch)
}

fn is_ctext_char(ch: char) -> bool {
    ch != '('
        && ch != ')'
        && ch != '\\'
        && (is_printable_us_ascii(ch) || is_utf8_non_ascii(ch) || is_obs_no_ws_ctl(ch))
}

fn is_qtext_char(ch: char) -> bool {
    ch != '"'
        && ch != '\\'
        && (is_printable_us_ascii(ch) || is_utf8_non_ascii(ch) || is_obs_no_ws_ctl(ch))
}

fn is_dtext_char(ch: char) -> bool {
    ch != '['
        && ch != ']'
        && ch != '\\'
        && (is_printable_us_ascii(ch) || is_utf8_non_ascii(ch) || is_obs_no_ws_ctl(ch))
}

fn is_atext(ch: char) -> bool {
    ch.is_ascii_alphanumeric()
        || is_utf8_non_ascii(ch)
        || matches!(
            ch,
            '!' | '#' | '$' | '%' | '&' | '\'' | '*' | '+' | '-' | '/' | '=' | '?' | '^'
                | '_' | '`' | '{' | '|' | '}' | '~'
        )
}

fn is_atext_no_dash(ch: char) -> bool {
    ch != '-' && is_atext(ch)
}
