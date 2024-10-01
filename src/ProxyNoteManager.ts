import { App, TFile, Notice } from 'obsidian';

export class ProxyNoteManager {
    private app: App;
    private proxyNotesPath: string;

    constructor(app: App, proxyNotesPath: string) {
        this.app = app;
        this.proxyNotesPath = proxyNotesPath;
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
        // Implement logic to handle when a proxy note is deleted
        // For example, you might want to remove it from an index or notify the user
        new Notice(`Proxy note deleted: ${file.path}`);
    }

    handleRenamedProxyNote(file: TFile, oldPath: string) {
        // Implement logic to handle when a proxy note is renamed
        // For example, you might want to update an index or check if the new name is valid
        new Notice(`Proxy note renamed from ${oldPath} to ${file.path}`);
    }

    handleChangedProxyNote(file: TFile) {
        // Implement logic to handle when a proxy note's content changes
        // For example, you might want to update metadata or check for consistency
        new Notice(`Proxy note changed: ${file.path}`);
    }

    private generateFileName(title: string): string {
        // Implement logic to generate a valid file name from the title
        return `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    }

    private generateProxyNoteContent(externalLink: string, metadata: any): string {
        // Implement logic to generate the content of the proxy note
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