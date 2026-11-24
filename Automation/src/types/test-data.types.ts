export type { TestData, LocalTestData, OverrideSection } from '../data/test-data.schema';

export interface ResolvedUser {
    readonly key: string;
    readonly username: string;
    readonly password?: string;
    readonly description?: string;
}
