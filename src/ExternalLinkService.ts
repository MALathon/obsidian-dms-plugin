import { App, Notice, TFile } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink, DMSSettings } from './types';
import { sanitizeFilePath, getErrorMessage } from './utils';
import { parse, stringify } from 'yaml';

export class ExternalLinkService {
    plugin: DMSPlugin;
    app: App;
    settings: DMSSettings;
    private externalLinks: ExternalLink[] = [];

    constructor(plugin: DMSPlugin, settings: DMSSettings) {
        this.plugin = plugin;
        this.app = plugin.app;
        this.settings = settings;
    }

    async loadExternalLinks(): Promise<void> {
        try {
            const data = await this.plugin.loadData();
            this.externalLinks = data?.externalLinks || [];
        } catch (error) {
            console.error('Failed to load external links:', getErrorMessage(error));
            new Notice('Failed to load external links. Check the console for details.');
        }
    }

    async saveExternalLinks(): Promise<void> {
        try {
            await this.plugin.saveData({ externalLinks: this.externalLinks });
        } catch (error) {
            console.error('Failed to save external links:', getErrorMessage(error));
            new Notice('Failed to save external links. Check the console for details.');
        }
    }

    getAllExternalLinks(): ExternalLink[] {
        return this.externalLinks;
    }

    getExternalLink(index: number): ExternalLink {
        return this.externalLinks[index];
    }

    async addExternalLink(link: ExternalLink): Promise<void> {
        if (!link.path || !link.title) {
            throw new Error('External link must have a path and title');
        }

        this.externalLinks.push(link);
        await this.saveExternalLinks();
        await this.createProxyNote(link);
    }

    async editExternalLink(updatedLink: ExternalLink): Promise<void> {
        const index = this.externalLinks.findIndex((link: ExternalLink) => link.path === updatedLink.path);
        if (index !== -1) {
            this.externalLinks[index] = updatedLink;
            await this.saveExternalLinks();
            await this.updateProxyNote(updatedLink);
        }
    }

    async deleteExternalLink(link: ExternalLink): Promise<void> {
        this.externalLinks = this.externalLinks.filter((l: ExternalLink) => l.path !== link.path);
        await this.saveExternalLinks();
        await this.deleteProxyNote(link);
    }

    async createProxyNote(link: ExternalLink): Promise<void> {
        const fileName = sanitizeFilePath(`${link.title}.md`);
        const filePath = `${this.settings.proxyNotesPath}/${fileName}`;

        const content = `---
title: ${link.title}
external_path: ${link.path}
fileType: ${link.fileType}
audience: ${link.audience.join(', ')}
categories: ${link.categories.join(', ')}
tags: ${link.tags.join(', ')}
createdDate: ${new Date(link.createdDate).toISOString()}
size: ${link.size}
---

${link.summary}

${link.notes}

[Open External File](file://${encodeURI(link.path)})`;

        try {
            await this.app.vault.create(filePath, content);
        } catch (error) {
            console.error('Failed to create proxy note:', getErrorMessage(error));
            new Notice('Failed to create proxy note. Check the console for details.');
        }
    }

    async updateProxyNote(link: ExternalLink): Promise<void> {
        const fileName = sanitizeFilePath(`${link.title}.md`);
        const filePath = `${this.settings.proxyNotesPath}/${fileName}`;

        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.createProxyNote(link); // This will overwrite the existing file
            } else {
                throw new Error('Proxy note not found');
            }
        } catch (error) {
            console.error('Failed to update proxy note:', getErrorMessage(error));
            new Notice('Failed to update proxy note. Check the console for details.');
        }
    }

    async deleteProxyNote(link: ExternalLink): Promise<void> {
        const fileName = sanitizeFilePath(`${link.title}.md`);
        const filePath = `${this.settings.proxyNotesPath}/${fileName}`;

        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.delete(file);
            }
        } catch (error) {
            console.error('Failed to delete proxy note:', getErrorMessage(error));
            new Notice('Failed to delete proxy note. Check the console for details.');
        }
    }

    getCategories(): string[] {
        return Array.from(new Set(this.externalLinks.flatMap((link: ExternalLink) => link.categories)));
    }

    getTags(): string[] {
        return Array.from(new Set(this.externalLinks.flatMap((link: ExternalLink) => link.tags)));
    }

    async addNewTag(tag: string): Promise<void> {
        for (const link of this.externalLinks) {
            if (!link.tags.includes(tag)) {
                link.tags.push(tag);
                await this.updateProxyNote(link);
            }
        }
        await this.saveExternalLinks();
    }

    async addNewCategory(category: string): Promise<void> {
        for (const link of this.externalLinks) {
            if (!link.categories.includes(category)) {
                link.categories.push(category);
                await this.updateProxyNote(link);
            }
        }
        await this.saveExternalLinks();
    }

    async openExternalFile(path: string): Promise<void> {
        const link = this.externalLinks.find((l: ExternalLink) => l.path === path);
        if (link) {
            if (link.path.startsWith('http://') || link.path.startsWith('https://')) {
                // For web URLs
                window.open(link.path, '_blank');
            } else {
                // For local file paths
                const sanitizedPath = this.sanitizeFilePath(link.path);
                const encodedPath = encodeURI(`file://${sanitizedPath}`);
                window.open(encodedPath, '_blank');
            }
        } else {
            new Notice('External link not found');
        }
    }

    private sanitizeFilePath(path: string): string {
        // Replace backslashes with forward slashes
        path = path.replace(/\\/g, '/');
        // Remove any duplicated slashes (except for the double slash after the colon)
        path = path.replace(/([^:])\/+/g, '$1/');
        // Ensure the path starts with a drive letter for Windows paths
        if (!path.match(/^[a-zA-Z]:/)) {
            path = `C:${path}`; // Assuming C: drive, adjust if necessary
        }
        // Encode only specific characters
        return path.replace(/%/g, '%25')
                   .replace(/\s/g, '%20')
                   .replace(/\(/g, '%28')
                   .replace(/\)/g, '%29');
    }
}