// Explicit field -> label map and Faker generators for the opt-in synthetic fallback (references/test-data-sources.md).
// Empty at bootstrap. Add a field only with a generator built from the requirement's rules (length, characters, format),
// and write the requirement reference in a comment. Never add credentials, OTPs, real contacts, account/card numbers,
// values the back end must recognise, or expected values.
import type { Faker } from '@faker-js/faker';

export interface SyntheticField {
    /** Labels accepted in a workbook Test Data cell as "<label>: <value>". */
    readonly labels: readonly string[];
    /** Generator built from the requirement's format rules; undefined = no synthetic fallback for this field. */
    readonly generate?: (faker: Faker) => string;
    /** Requirement reference for the format rule. */
    readonly requirement?: string;
}

export const SYNTHETIC_FIELDS: Readonly<Record<string, SyntheticField>> = {};

/** Fields that are never generated, whatever the map says. */
export const FORBIDDEN_FIELDS: readonly RegExp[] = [
    /password/i,
    /\bpin\b|pin$/i,
    /otp/i,
    /token/i,
    /secret/i,
    /mobile|phone/i,
    /email/i,
    /account|card/i,
];
