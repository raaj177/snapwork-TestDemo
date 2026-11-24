// Schema of src/data/test-data.json (shared, committed) and test-data.local.json (Git-ignored, override form).
// Secrets are never stored: a user names the variable that holds the password (passwordEnv).
import { z } from 'zod';

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

export const UserSchema = z
    .object({
        username: z.string(),
        passwordEnv: z.string().regex(ENV_NAME).optional(),
        description: z.string().optional(),
    })
    .strict();

export const UserOverrideSchema = UserSchema.partial().strict();

const valueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const SectionSchema = z
    .object({
        users: z.record(z.string(), UserSchema).default({}),
        messages: z.record(z.string(), z.string()).default({}),
        values: z.record(z.string(), valueSchema).default({}),
    })
    .strict();

export const OverrideSectionSchema = z
    .object({
        users: z.record(z.string(), UserOverrideSchema).optional(),
        messages: z.record(z.string(), z.string()).optional(),
        values: z.record(z.string(), valueSchema).optional(),
    })
    .strict();

export const TestDataSchema = z
    .object({
        $schema: z.string().optional(),
        common: SectionSchema,
        overrides: z
            .object({ android: OverrideSectionSchema.default({}), ios: OverrideSectionSchema.default({}) })
            .strict()
            .default({ android: {}, ios: {} }),
        environments: z.record(z.string(), OverrideSectionSchema).default({}),
    })
    .strict();

export const LocalTestDataSchema = z
    .object({
        $schema: z.string().optional(),
        common: OverrideSectionSchema.optional(),
        overrides: z.object({ android: OverrideSectionSchema.optional(), ios: OverrideSectionSchema.optional() }).strict().optional(),
        environments: z.record(z.string(), OverrideSectionSchema).optional(),
    })
    .strict();

export type TestData = z.infer<typeof TestDataSchema>;
export type LocalTestData = z.infer<typeof LocalTestDataSchema>;
export type OverrideSection = z.infer<typeof OverrideSectionSchema>;
