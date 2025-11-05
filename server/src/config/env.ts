import dotenv from 'dotenv';

const result = dotenv.config();

if (result.error) {
    console.warn('Falling back to process environment variables.');
}

// Verify required env vars are set
export function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(
            `${key} environment variable is not set. ` +
            `Make sure you have a .env file in the server directory with ${key} set.`
        );
    }
    return value;
}

export const DATABASE_URL = requireEnv('DATABASE_URL');
export const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-key-in-production';
export const PORT = process.env.PACKETPILOT_SERVER_PORT
    ? parseInt(process.env.PACKETPILOT_SERVER_PORT, 10)
    : 8080;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
