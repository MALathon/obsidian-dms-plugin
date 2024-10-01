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

    addExternalLink(link: ExternalLink): void {
        this.externalLinks.push(link);
        this.saveExternalLinks();
        this.createProxyNote(link);
    }

    editExternalLink(index: number, updatedLink: ExternalLink): void {
        this.externalLinks[index] = updatedLink;
        this.saveExternalLinks();
        this.createProxyNote(updatedLink);
    }

    deleteExternalLink(index: number): void {
        this.externalLinks.splice(index, 1);
        this.saveExternalLinks();
    }

    searchExternalLinks(query: string): ExternalLink[] {
        const lowercaseQuery = query.toLowerCase();
        return this.externalLinks.filter(link =>
            link.title.toLowerCase().includes(lowercaseQuery) ||
            link.category.toLowerCase().includes(lowercaseQuery) ||
            link.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
            link.audience.some(aud => aud.toLowerCase().includes(lowercaseQuery))
        );
    }

    findExternalLinkByTitle(title: string): ExternalLink | undefined {
        return this.externalLinks.find(link => link.title === title);
    }

    async openExternalFile(path: string): Promise<void> {
        const link = this.externalLinks.find(l => l.path === path);
        if (link) {
            const fileName = `${link.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
            const filePath = `${this.settings.defaultFolder}/${fileName}`;
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const activeLeaf = this.app.workspace.activeLeaf;
                if (activeLeaf) {
                    await activeLeaf.openFile(file);
                } else {
                    new Notice('No active leaf to open the file');
                }
                return;
            }
        }

        console.log("Attempting to open:", path);
        if (path.startsWith('http://') || path.startsWith('https://')) {
            window.open(path, '_blank');
        } else {
            const sanitizedPath = sanitizeFilePath(path);
            const encodedPath = encodeURI(`file://${sanitizedPath}`);
            console.log("Encoded file path:", encodedPath);
            window.open(encodedPath, '_blank');
        }
    }

    async createProxyNote(link: ExternalLink): Promise<void> {
        const fileName = `${link.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
        const filePath = `${this.settings.proxyNotesFolder}/${fileName}`;
        const content = `---
title: ${link.title}
category: ${link.category}
audience: ${link.audience.join(', ')}
tags: ${link.tags.join(', ')}
path: ${link.path}
---

${link.notes}

[Open External Link](${link.path})`;

        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(filePath, content);
            }
        } catch (error) {
            console.error('Failed to create/update proxy note:', getErrorMessage(error));
            new Notice('Failed to create/update proxy note. Check the console for details.');
        }
    }

    async addNewTag(tag: string): Promise<void> {
        const dummyFilePath = 'dms-tags.md';
        let dummyFile = this.app.vault.getAbstractFileByPath(dummyFilePath);
        if (!(dummyFile instanceof TFile)) {
            dummyFile = await this.app.vault.create(dummyFilePath, '---\ntags: []\n---\n');
        }

        if (dummyFile instanceof TFile) {
            try {
                const content = await this.app.vault.read(dummyFile);
                const [frontmatter, ...bodyParts] = content.split('---\n');
                const body = bodyParts.join('---\n');
                let yaml = frontmatter.trim();
                if (!yaml) {
                    yaml = 'tags: []';
                }
                const parsedYaml = parse(yaml);
                if (!parsedYaml.tags) {
                    parsedYaml.tags = [];
                }
                if (!parsedYaml.tags.includes(tag)) {
                    parsedYaml.tags.push(tag);
                }
                const newFrontmatter = stringify(parsedYaml);
                const newContent = `---\n${newFrontmatter}---\n${body}`;
                await this.app.vault.modify(dummyFile, newContent);
            } catch (error) {
                console.error('Failed to add new tag:', getErrorMessage(error));
                new Notice('Failed to add new tag. Check the console for details.');
            }
        } else {
            console.error('Failed to create or access dms-tags.md file');
            new Notice('Failed to add new tag. Check the console for details.');
        }

        // Add the new tag to all proxy notes
        for (const link of this.externalLinks) {
            if (!link.tags.includes(tag)) {
                link.tags.push(tag);
                await this.createProxyNote(link);
            }
        }
        await this.saveExternalLinks();
    }
}