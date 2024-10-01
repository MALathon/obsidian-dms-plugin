import { ErrorWithMessage } from './types';

export const sanitizeFilePath = (path: string): string => {
    // Replace backslashes with forward slashes
    path = path.replace(/\\/g, '/');
    // Remove any duplicated slashes (except for the double slash after the colon)
    path = path.replace(/([^:])\/+/g, '$1/');
    // Encode only specific characters
    return path.replace(/%/g, '%25')
        .replace(/\s/g, '%20')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
};

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    );
}

export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
    if (isErrorWithMessage(maybeError)) return maybeError;

    try {
        return new Error(JSON.stringify(maybeError));
    } catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError));
    }
}

export function getErrorMessage(error: unknown) {
    return toErrorWithMessage(error).message;
}