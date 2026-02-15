export interface AddressSpec {
  local_part: string;
  domain: string;
}

export interface ParseOptions {
  startRule?: "address_single" | "address_single_obs";
}

export function parse(input: string, options?: ParseOptions): AddressSpec;
