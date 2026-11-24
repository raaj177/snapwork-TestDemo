// Axios helper for test-data setup and API checks. The base URL comes from config/environments (empty until known).
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { environmentConfig } from '../../config/environments';
import { logger, describeError } from '../utils/Logger';

export class ApiService {
    protected readonly logger = logger.child({ service: 'ApiService' });
    protected client: AxiosInstance | undefined;

    /** Lazily creates the client; fails clearly when no API base URL is configured. */
    http(): AxiosInstance {
        this.logger.debug('Getting the HTTP client');
        try {
            if (!this.client) {
                const baseURL = environmentConfig().apiBaseUrl;
                if (!baseURL) throw new Error('No API base URL configured for this TEST_ENV (config/environments)');
                this.client = axios.create({ baseURL, timeout: 20000, validateStatus: () => true });
            }
            return this.client;
        } catch (error) {
            this.logger.error(`Failed to create the HTTP client: ${describeError(error)}`);
            throw error;
        }
    }

    /** GET request; the response is returned whatever its status. */
    async get<T = unknown>(url: string): Promise<AxiosResponse<T>> {
        this.logger.info(`GET ${url}`);
        try {
            const response = await this.http().get<T>(url);
            this.logger.info(`GET ${url} -> ${response.status}`);
            return response;
        } catch (error) {
            this.logger.error(`GET ${url} failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** POST request; the body is never logged. */
    async post<T = unknown>(url: string, body: unknown): Promise<AxiosResponse<T>> {
        this.logger.info(`POST ${url}`);
        try {
            const response = await this.http().post<T>(url, body);
            this.logger.info(`POST ${url} -> ${response.status}`);
            return response;
        } catch (error) {
            this.logger.error(`POST ${url} failed: ${describeError(error)}`);
            throw error;
        }
    }
}

export const apiService = new ApiService();
