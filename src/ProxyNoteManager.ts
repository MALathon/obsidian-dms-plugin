import { App, TFile, Notice } from 'obsidian';
import { ExternalLink } from './types';
import { ExternalLinkService } from './ExternalLinkService';

export class ProxyNoteManager {
    private app: App;
    private proxyNotesPath: string;
    private externalLinkService: ExternalLinkService;

    constructor(app: App, proxyNotesPath: string, externalLinkService: ExternalLinkService) {
        this.app = app;
        this.proxyNotesPath = proxyNotesPath;
        this.externalLinkService = externalLinkService;
    }

    updateProxyNotesPath(newPath: string) {
        this.proxyNotesPath = newPath;
    }

    isProxyNote(file: TFile): boolean {
        return file.path.startsWith(this.proxyNotesPath);
    }

    async createProxyNote(externalLink: string, metadata: any): Promise<TFile> {
        const fileName = this.generateFileName(metadata.title);
        const filePath = this.proxyNotesPath ? `${this.proxyNotesPath}/${fileName}` : fileName;
        const content = this.generateProxyNoteContent(externalLink, metadata);

        try {
            const file = await this.app.vault.create(filePath, content);
            return file;
        } catch (error) {
            new Notice(`Failed to create proxy note: ${error}`);
            throw error;
        }
    }

    async updateProxyNote(file: TFile, externalLink: string, metadata: any) {
        const content = this.generateProxyNoteContent(externalLink, metadata);
        try {
            await this.app.vault.modify(file, content);
        } catch (error) {
            new Notice(`Failed to update proxy note: ${error}`);
            throw error;
        }
    }

    handleDeletedProxyNote(file: TFile) {
        const externalLink = this.findExternalLinkByProxyNote(file);
        if (externalLink) {
            this.externalLinkService.deleteExternalLink(externalLink);
        }
        new Notice(`Proxy note deleted: ${file.path}`);
    }

    handleRenamedProxyNote(file: TFile, oldPath: string) {
        const externalLink = this.findExternalLinkByProxyNote(file);
        if (externalLink) {
            externalLink.title = file.basename;
            this.externalLinkService.editExternalLink(externalLink);
        }
        new Notice(`Proxy note renamed from ${oldPath} to ${file.path}`);
    }

    handleChangedProxyNote(file: TFile) {
        const externalLink = this.findExternalLinkByProxyNote(file);
        if (externalLink) {
            externalLink.lastModified = Date.now();
            this.externalLinkService.editExternalLink(externalLink);
        }
        new Notice(`Proxy note changed: ${file.path}`);
    }

    private findExternalLinkByProxyNote(file: TFile): ExternalLink | undefined {
        const links = this.externalLinkService.getAllExternalLinks();
        return links.find((link: ExternalLink) => this.generateFileName(link.title) === file.name);
    }

    private generateFileName(title: string): string {
        return `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    }

    private generateProxyNoteContent(externalLink: string, metadata: any): string {
        return `---
title: ${metadata.title}
external-link: ${externalLink}
tags: ${metadata.tags ? metadata.tags.join(', ') : ''}
---

# ${metadata.title}

[Open External Link](${externalLink})

## Metadata
- **Type**: ${metadata.type || 'Unknown'}
- **Created**: ${metadata.created || 'Unknown'}
- **Last Modified**: ${metadata.modified || 'Unknown'}
- **Size**: ${metadata.size || 'Unknown'}

## Summary
${metadata.summary || 'No summary available.'}

## Notes
${metadata.notes || 'No notes available.'}
`;
    }
}