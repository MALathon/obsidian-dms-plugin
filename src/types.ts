import { TFile } from 'obsidian';

export interface DMSSettings {
    proxyNotesPath: string;
    // Add any other settings properties here
}

// Remove this line as it's redundant
// export type DMSPluginSettings = DMSSettings;

export interface ExternalLink {
    title: string;
    path: string;
    categories: string[];
    audience: string[];
    tags: string[];
    notes: string;
    summary: string;
    fileType: string;
    size: number;
    createdDate: number;
    lastModified?: number;
}

export interface ErrorWithMessage {
    message: string;
}