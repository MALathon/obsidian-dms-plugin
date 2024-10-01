import { App, Notice, TFile } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink, DMSPluginSettings } from './types';
import { sanitizeFilePath, getErrorMessage } from './utils';
import { parse, stringify } from 'yaml';

export class ExternalLinkService {
    plugin: DMSPlugin;
    app: App;
    settings: DMSPluginSettings;
    externalLinks: ExternalLink[] = [];

    constructor(plugin: DMSPlugin, settings: DMSPluginSettings) {
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
        this.externalLinks.push(link);
        await this.saveExternalLinks();
        await this.createProxyNote(link);
    }

    async editExternalLink(oldLink: ExternalLink, updatedLink: ExternalLink): Promise<void> {
        const index = this.externalLinks.findIndex(link => link.path === oldLink.path);
        if (index !== -1) {
            this.externalLinks[index] = updatedLink;
            await this.saveExternalLinks();
            await this.updateProxyNote(oldLink, updatedLink);
        }
    }

    async deleteExternalLink(link: ExternalLink): Promise<void> {
        this.externalLinks = this.externalLinks.filter(l => l.path !== link.path);
        await this.saveExternalLinks();
        await this.deleteProxyNote(link);
    }

    async createProxyNote(link: ExternalLink): Promise<void> {
        const fileName = sanitizeFilePath(`${link.title}.md`);
        const filePath = `${this.settings.proxyNotesFolder}/${fileName}`;

        const content = `---
title: ${link.title}
url: ${link.path}
fileType: ${link.fileType}
audience: ${link.audience.join(', ')}
categories: ${link.categories.join(', ')} // Changed from category to categories
tags: ${link.tags.join(', ')}
createdDate: ${new Date(link.createdDate).toISOString()}
size: ${link.size}
---

${link.summary}

${link.notes}`;

        try {
            await this.app.vault.create(filePath, content);
        } catch (error) {
            if (error.message.includes('File already exists')) {
                await this.app.vault.modify(this.app.vault.getAbstractFileByPath(filePath) as TFile, content);
            } else {
                console.error('Failed to create proxy note:', getErrorMessage(error));
                new Notice('Failed to create proxy note. Check the console for details.');
            }
        }
    }

    async updateProxyNote(oldLink: ExternalLink, updatedLink: ExternalLink): Promise<void> {
        const oldFileName = sanitizeFilePath(`${oldLink.title}.md`);
        const newFileName = sanitizeFilePath(`${updatedLink.title}.md`);
        const oldFilePath = `${this.settings.proxyNotesFolder}/${oldFileName}`;
        const newFilePath = `${this.settings.proxyNotesFolder}/${newFileName}`;

        try {
            if (oldFileName !== newFileName) {
                await this.app.vault.rename(this.app.vault.getAbstractFileByPath(oldFilePath) as TFile, newFilePath);
            }
            await this.createProxyNote(updatedLink);
        } catch (error) {
            console.error('Failed to update proxy note:', getErrorMessage(error));
            new Notice('Failed to update proxy note. Check the console for details.');
        }
    }

    async deleteProxyNote(link: ExternalLink): Promise<void> {
        const fileName = sanitizeFilePath(`${link.title}.md`);
        const filePath = `${this.settings.proxyNotesFolder}/${fileName}`;

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
        return Array.from(new Set(this.externalLinks.flatMap(link => link.categories)));
    }

    getTags(): string[] {
        return Array.from(new Set(this.externalLinks.flatMap(link => link.tags)));
    }

    async addNewTag(tag: string): Promise<void> {
        for (const link of this.externalLinks) {
            if (!link.tags.includes(tag)) {
                link.tags.push(tag);
                await this.updateProxyNote(link, link);
            }
        }
        await this.saveExternalLinks();
    }

    async addNewCategory(category: string): Promise<void> {
        for (const link of this.externalLinks) {
            if (!link.categories.includes(category)) {
                link.categories.push(category);
                await this.updateProxyNote(link, link);
            }
        }
        await this.saveExternalLinks();
    }

    async openExternalFile(path: string): Promise<void> {
        const link = this.externalLinks.find(l => l.path === path);
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