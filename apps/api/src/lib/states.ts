// Canonical Indian state / union-territory codes.
//
// Shipping "zones" are stored as whatever the vendor typed (the UI suggests
// 2-letter codes like "DL, MH, KA"), but checkout collects the destination as a
// free-text state name ("Delhi"). Comparing those directly never matched. This
// module maps full names, common misspellings, alternate codes, and the codes
// themselves to ONE canonical 2-letter code so both sides line up.

const STATE_LOOKUP: Record<string, string> = {};

// helper: register a canonical code with all its aliases (compact, lowercase, alpha-only)
function reg(code: string, aliases: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  STATE_LOOKUP[norm(code)] = code;
  for (const a of aliases) STATE_LOOKUP[norm(a)] = code;
}

// States
reg('AP', ['Andhra Pradesh', 'andhra']);
reg('AR', ['Arunachal Pradesh', 'arunachal']);
reg('AS', ['Assam']);
reg('BR', ['Bihar']);
reg('CG', ['Chhattisgarh', 'chattisgarh', 'CT']);
reg('GA', ['Goa']);
reg('GJ', ['Gujarat', 'gujrat']);
reg('HR', ['Haryana']);
reg('HP', ['Himachal Pradesh', 'himachal']);
reg('JH', ['Jharkhand']);
reg('KA', ['Karnataka']);
reg('KL', ['Kerala']);
reg('MP', ['Madhya Pradesh']);
reg('MH', ['Maharashtra', 'maharastra']);
reg('MN', ['Manipur']);
reg('ML', ['Meghalaya']);
reg('MZ', ['Mizoram']);
reg('NL', ['Nagaland']);
reg('OD', ['Odisha', 'orissa', 'OR']);
reg('PB', ['Punjab']);
reg('RJ', ['Rajasthan', 'rajstahna', 'rajasthana']);
reg('SK', ['Sikkim']);
reg('TN', ['Tamil Nadu', 'tamilnadu']);
reg('TS', ['Telangana', 'telanagana', 'TG']);
reg('TR', ['Tripura']);
reg('UP', ['Uttar Pradesh', 'uttarpradesh']);
reg('UK', ['Uttarakhand', 'uttrakhand', 'UA']);
reg('WB', ['West Bengal', 'westbengal']);

// Union territories
reg('AN', ['Andaman and Nicobar Islands', 'andaman', 'andaman nicobar']);
reg('CH', ['Chandigarh']);
reg('DH', ['Dadra and Nagar Haveli and Daman and Diu', 'dadra', 'daman', 'diu', 'DN', 'DD']);
reg('DL', ['Delhi', 'New Delhi', 'NCT']);
reg('JK', ['Jammu and Kashmir', 'jammu kashmir', 'kashmir']);
reg('LA', ['Ladakh']);
reg('LD', ['Lakshadweep']);
reg('PY', ['Puducherry', 'pondicherry', 'PD']);

/**
 * Resolve a free-text state, alternate code, or "IN-XX" zone token to its
 * canonical 2-letter code. Unknown values fall back to their stripped, uppercased
 * form so two identical unknown inputs still compare equal.
 */
export function canonicalState(input: string | null | undefined): string {
  if (!input) return '';
  const stripped = input.trim().replace(/^IN[-\s]?/i, ''); // "IN-DL" / "IN DL" → "DL"
  const key = stripped.toLowerCase().replace(/[^a-z]/g, '');
  return STATE_LOOKUP[key] ?? stripped.toUpperCase();
}
