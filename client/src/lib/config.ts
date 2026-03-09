export const isProd = import.meta.env.PROD;
export const apiUrl = import.meta.env.VITE_API_URL ?? (typeof window !== 'undefined' ? '' : 'http://localhost:4000');
export const appVersion = import.meta.env.VITE_APP_VERSION ?? '1.0.0';

export const config = {
  isProd,
  apiUrl,
  appVersion,
};

export function logError(message: string, err?: unknown): void {
  if (!config.isProd) {
    console.error(message, err ?? '');
  }
}
