/*
 * Peggy translation of rust-lib/src/rfc5322.pest.
 *
 * This file intentionally preserves the same rule layout:
 * - strict path: address_single -> address_spec
 * - obsolete path: address_single_obs -> address_spec_obs
 *
 * Notes:
 * - SOI/EOI in Pest map to !. checks at rule boundaries in Peggy.
 * - Pest's silent/atomic modifiers do not change acceptance semantics,
 *   so they are not represented as separate syntax here.
 */

address_single
  = spec:address_spec !. { return spec; }

address_spec
  = local:local_part "@" domain:domain {
      return { local_part: local, domain };
    }

local_part
  = value:$(dot_atom / quoted_string) { return value; }

domain
  = value:$(dot_atom / domain_literal) { return value; }

local_part_complete
  = value:local_part !. { return value; }

domain_complete
  = value:domain !. { return value; }

/*------------ lower level rules -------------*/

/* VCHAR - visible (printing characters): 33-126 */
printable_us_ascii
  = [\u0021-\u007E]

/* Space or horizontal tab */
WSP
  = " "
  / "\t"

CR
  = "\r"

LF
  = "\n"

CRLF
  = CR LF

FWS
  = ((WSP* CRLF)? WSP+)
  / obs_FWS

DQUOTE
  = "\""

quoted_pair
  = ("\\" (printable_us_ascii / WSP))
  / obs_qp

/* Printable US-ASCII characters not including "(", ")", or "\". */
ctext
  = !("(" / ")" / "\\") (printable_us_ascii / UTF8_non_ascii / obs_ctext)

ccontent
  = ctext
  / quoted_pair
  / comment

comment
  = "(" (FWS? ccontent)* FWS? ")"

CFWS
  = ((FWS? comment)+ FWS?)
  / FWS

ASCII_ALPHANUMERIC
  = [A-Za-z0-9]

atext
  = ASCII_ALPHANUMERIC
  / "!"
  / "#"
  / "$"
  / "%"
  / "&"
  / "'"
  / "*"
  / "+"
  / "-"
  / "/"
  / "="
  / "?"
  / "^"
  / "_"
  / "`"
  / "{"
  / "|"
  / "}"
  / "~"
  / UTF8_non_ascii

/*------------ UTF8 START -------------*/

UTF8_2
  = [\u0080-\u07FF]

UTF8_3
  = [\u0800-\uD7FF\uE000-\uFFFF]

UTF8_4
  = [\uD800-\uDBFF] [\uDC00-\uDFFF]

UTF8_non_ascii
  = UTF8_2
  / UTF8_3
  / UTF8_4

/*------------ UTF8 END -------------*/

/*
 * Intentional RFC5322 deviation preserved from Pest grammar.
 */
atext_wo_dash
  = !"-" atext

dot_atom_text
  = atext_wo_dash+
    (
      ("." CFWS* dot_atom_text+)
      /
      ((two_or_more_dashes dot_atom_text+) / ("-" dot_atom_text+))
    )*

dot_atom
  = WSP? dot_atom_text WSP?

/* Printable US-ASCII characters not including "[", "]", or "\". */
dtext
  = !("[" / "]" / "\\") (printable_us_ascii / UTF8_non_ascii / obs_dtext)

domain_literal
  = CFWS? "[" (FWS? dtext)* FWS? "]" CFWS?

/* Printable US-ASCII characters not including "\" or DQUOTE. */
qtext
  = !(DQUOTE / "\\") (printable_us_ascii / UTF8_non_ascii / obs_qtext)

qcontent
  = qtext
  / quoted_pair

quoted_string
  = CFWS? DQUOTE (FWS? qcontent)* FWS? DQUOTE CFWS?

/*------------ obsolete support -------------*/

address_single_obs
  = spec:address_spec_obs !. { return spec; }

address_spec_obs
  = local:local_part_obs "@" domain:domain_obs {
      return { local_part: local, domain };
    }

local_part_obs
  = value:$(obs_local_part / dot_atom / quoted_string) { return value; }

domain_obs
  = value:$(obs_domain / dot_atom / domain_literal) { return value; }

obs_local_part_complete
  = value:obs_local_part !. { return value; }

obs_domain_complete
  = value:obs_domain !. { return value; }

obs_local_part
  = FWS* word (CFWS* "." CFWS* word)*

obs_domain
  = CFWS*
    atext_wo_dash+
    (
      CFWS*
      (
        ("." obs_domain+)
        /
        ((two_or_more_dashes obs_domain+) / ("-" obs_domain+))
      )
    )*
    FWS*

two_or_more_dashes
  = "-" "-" "-"*

word
  = atom
  / quoted_string

atom
  = CFWS? atext+ CFWS?

obs_FWS
  = WSP+ (CRLF WSP+)*

/* US-ASCII control chars excluding CR, LF, and WSP */
obs_NO_WS_CTL
  = [\u0001-\u0008]
  / "\u000B"
  / "\u000C"
  / [\u000E-\u001F]
  / "\u007F"

obs_qp
  = "\\" ("\u0000" / obs_NO_WS_CTL / LF / CR)

obs_ctext
  = obs_NO_WS_CTL

obs_dtext
  = obs_NO_WS_CTL
  / quoted_pair

obs_qtext
  = obs_NO_WS_CTL
