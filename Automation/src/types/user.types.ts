export interface UserCredentials {
    readonly username: string;
    /** Read from the environment variable named by passwordEnv; never stored in test data. */
    readonly password?: string;
}
