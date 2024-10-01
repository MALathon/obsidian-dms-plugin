import { TFile } from 'obsidian';

export interface DMSPluginSettings {
    proxyNotesFolder: string;
    defaultFolder: string;
    // Add any other settings here
}

export interface ExternalLink {
    title: string;
    path: string;
    category: string;
    audience: string[];
    tags: string[];
    notes: string;
    // Add any other properties your ExternalLink might have
}

export interface ErrorWithMessage {
    message: string;
}