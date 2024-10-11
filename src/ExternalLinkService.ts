import { App, Notice, TFile, TAbstractFile } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink, DMSSettings } from './types';
import { sanitizeFilePath, getErrorMessage } from './utils';
import { parse, stringify } from 'yaml';
import moment from 'moment';

interface ExternalLinksData {
    version: number;
    lastModified: number;
    links: ExternalLink[];
}

export class ExternalLinkService {
    plugin: DMSPlugin;
    app: App;
    settings: DMSSettings;
    private externalLinksFile: string;
    private data: ExternalLinksData;
    private isUpdating: boolean = false;

    constructor(plugin: DMSPlugin, settings: DMSSettings) {
        this.plugin = plugin;
        this.app = plugin.app;
        this.settings = settings;
        this.externalLinksFile = 'dms-external-links.json';
        this.data = { version: 0, lastModified: 0, links: [] };

        this.initializeFileWatcher();
    }

    private initializeFileWatcher() {
        const debounceTime = 1000; // 1 second
        let timeoutId: NodeJS.Timeout | null = null;

        this.app.vault.on('modify', (file: TAbstractFile) => {
            if (file instanceof TFile && file.path.startsWith(this.settings.proxyNotesPath)) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                timeoutId = setTimeout(() => {
                    this.handleProxyNoteChange(file as TFile);
                    timeoutId = null;
                }, debounceTime);
            }
        });
    }

    private async handleProxyNoteChange(file: TFile) {
        if (this.isUpdating) return;
        this.isUpdating = true;
        try {
            const content = await this.app.vault.read(file);
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (frontmatter && frontmatter.external_path) {
                const updatedLink = this.data.links.find(link => link.path === frontmatter.external_path);
                if (updatedLink) {
                    // Update the link with new information from the proxy note
                    updatedLink.title = file.basename;
                    updatedLink.categories = frontmatter.categories || [];
                    updatedLink.audience = frontmatter.audience || [];
                    updatedLink.tags = frontmatter.tags || [];
                    updatedLink.lastModified = file.stat.mtime;

                    // Extract summary and notes from the content
                    const contentWithoutFrontmatter = content.replace(/---[\s\S]*?---/, '').trim();
                    const [summary, ...notesArray] = contentWithoutFrontmatter.split('\n\n');
                    updatedLink.summary = summary.trim();
                    updatedLink.notes = notesArray.join('\n\n').trim().replace(/\[Open External File\].*$/, '').trim();

                    await this.saveExternalLinks(false);  // Pass false to prevent version increment
                    this.plugin.updateDMSView();
                }
            }
        } catch (error) {
            console.error('Failed to handle proxy note change:', getErrorMessage(error));
        } finally {
            this.isUpdating = false;
        }
    }

    async loadExternalLinks(isAutoReload = false): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(this.externalLinksFile);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                const loadedData: ExternalLinksData = JSON.parse(content);

                if (!isAutoReload) {
                    // Only update if the loaded data is newer
                    if (loadedData.version > this.data.version) {
                        this.data = loadedData;
                    } else if (loadedData.version === this.data.version && loadedData.lastModified > this.data.lastModified) {
                        // Merge the data if versions are the same but loaded data is newer
                        this.mergeExternalLinks(loadedData.links);
                    }
                } else {
                    // For auto-reload, always update to prevent loops
                    this.data = loadedData;
                }
            }
        } catch (error) {
            console.error('Failed to load external links:', getErrorMessage(error));
            new Notice('Failed to load external links. Check the console for details.');
        }
    }

    private mergeExternalLinks(loadedLinks: ExternalLink[]): void {
        const mergedLinks = [...this.data.links];
        loadedLinks.forEach(loadedLink => {
            const existingIndex = mergedLinks.findIndex(link => link.path === loadedLink.path);
            if (existingIndex !== -1) {
                // Update existing link if loaded one is newer
                if (loadedLink.lastModified && mergedLinks[existingIndex].lastModified && 
                    loadedLink.lastModified > (mergedLinks[existingIndex].lastModified ?? 0)) {
                    mergedLinks[existingIndex] = loadedLink;
                }
            } else {
                // Add new link
                mergedLinks.push(loadedLink);
            }
        });
        this.data.links = mergedLinks;
    }

    async saveExternalLinks(incrementVersion: boolean = true): Promise<void> {
        try {
            if (incrementVersion) {
                this.data.version++;
            }
            this.data.lastModified = Date.now();
            const content = JSON.stringify(this.data, null, 2);
            await this.app.vault.adapter.write(this.externalLinksFile, content);
        } catch (error) {
            console.error('Failed to save external links:', getErrorMessage(error));
            new Notice('Failed to save external links. Check the console for details.');
        }
    }

    async verifyDataFile(): Promise<void> {
        const data = await this.plugin.loadData();
        console.log('Current data file contents:', data);
    }

    getAllExternalLinks(): ExternalLink[] {
        return this.data.links;
    }

    getExternalLink(index: number): ExternalLink {
        return this.data.links[index];
    }

    async addExternalLink(link: ExternalLink): Promise<void> {
        try {
            // Add the link to the data
            this.data.links.push(link);
            await this.saveExternalLinks();
            
            // Create the proxy note
            await this.createProxyNote(link);
            
            // Update the view
            this.plugin.updateDMSView();
        } catch (error) {
            console.error('Failed to add external link:', error);
            new Notice(`Failed to add external link: ${error.message}`);
            // Remove the link from the data if proxy note creation failed
            this.data.links = this.data.links.filter(l => l.path !== link.path);
            await this.saveExternalLinks();
        }
    }

    async editExternalLink(updatedLink: ExternalLink): Promise<void> {
        const index = this.data.links.findIndex((link: ExternalLink) => link.path === updatedLink.path);
        if (index !== -1) {
            const oldLink = this.data.links[index];
            updatedLink.lastModified = Date.now();
            this.data.links[index] = updatedLink;
            await this.saveExternalLinks();
            
            // If the title has changed, we need to update the proxy note
            if (oldLink.title !== updatedLink.title) {
                await this.deleteProxyNote(oldLink);
            }
            await this.updateProxyNote(updatedLink);
        }
    }

    async deleteExternalLink(link: ExternalLink): Promise<void> {
        const index = this.data.links.findIndex(l => l.path === link.path);
        if (index !== -1) {
            // Remove the link from the data
            this.data.links.splice(index, 1);
            await this.saveExternalLinks();

            // Delete the corresponding proxy note
            const processedTitle = this.processTitle(link.title);
            const fileName = `${processedTitle}.md`;
            const proxyNotePath = `${this.settings.proxyNotesPath}/${fileName}`;

            try {
                if (await this.app.vault.adapter.exists(proxyNotePath)) {
                    await this.app.vault.adapter.remove(proxyNotePath);
                    console.log(`Deleted proxy note: ${proxyNotePath}`);
                } else {
                    console.log(`Proxy note not found: ${proxyNotePath}`);
                }
            } catch (error) {
                console.error('Failed to delete proxy note:', error);
                new Notice(`Failed to delete proxy note: ${error.message}`);
            }

            this.plugin.updateDMSView();
        }
    }

    async createProxyNote(link: ExternalLink): Promise<void> {
        const processedTitle = this.processTitle(link.title);
        const fileName = `${processedTitle}.md`;
        const filePath = `${this.settings.proxyNotesPath}/${fileName}`;

        try {
            await this.ensureDirectoryExists(this.settings.proxyNotesPath);
            
            const content = this.generateProxyNoteContent(link);
            
            // Create or update the file
            await this.app.vault.adapter.write(filePath, content);
            console.log(`Created/Updated proxy note: ${filePath}`);
        } catch (error) {
            console.error('Failed to create/update proxy note:', error);
            new Notice(`Failed to create/update proxy note: ${error.message}`);
            throw error;
        }
    }

    async updateProxyNote(link: ExternalLink): Promise<void> {
        const processedTitle = this.processTitle(link.title);
        const fileName = `${processedTitle}.md`;
        const filePath = `${this.settings.proxyNotesPath}/${fileName}`;

        try {
            await this.ensureDirectoryExists(this.settings.proxyNotesPath);
            
            const content = this.generateProxyNoteContent(link);
            
            // Update the file
            await this.app.vault.adapter.write(filePath, content);
            console.log(`Updated proxy note: ${filePath}`);
        } catch (error) {
            console.error('Failed to update proxy note:', error);
            new Notice(`Failed to update proxy note: ${error.message}`);
        }
    }

    private generateProxyNoteContent(link: ExternalLink): string {
        const frontmatter = {
            external_path: link.path,
            categories: link.categories,
            audience: link.audience,
            tags: link.tags,
            created_date: moment(link.createdDate).format('YYYY-MM-DD'),
            file_type: link.fileType,
            file_size: link.size
        };

        return `---
${stringify(frontmatter)}
---

${link.summary}

${link.notes}

[Open External File](${link.path})`;
    }

    async deleteProxyNote(link: ExternalLink): Promise<void> {
        const decodedTitle = this.decodeFileName(link.title);
        const fileName = sanitizeFilePath(`${decodedTitle}.md`);
        const filePath = `${this.settings.proxyNotesPath}/${fileName}`;

        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.delete(file);
                console.log(`Deleted proxy note: ${filePath}`);
            } else {
                console.log(`Proxy note not found: ${filePath}`);
            }
        } catch (error) {
            console.error('Failed to delete proxy note:', getErrorMessage(error));
            new Notice('Failed to delete proxy note. Check the console for details.');
        }
    }

    private decodeFileName(fileName: string): string {
        // Decode URL-encoded characters
        let decoded = decodeURIComponent(fileName);
        
        // Replace underscores with spaces (common in URL-friendly file names)
        decoded = decoded.replace(/_/g, ' ');
        
        // Remove file extension if present
        decoded = decoded.replace(/\.[^/.]+$/, "");
        
        // Capitalize first letter of each word
        decoded = decoded.replace(/\b\w/g, l => l.toUpperCase());
        
        return decoded;
    }

    getCategories(): string[] {
        return Array.from(new Set(this.data.links.flatMap((link: ExternalLink) => link.categories)));
    }

    getTags(): string[] {
        return Array.from(new Set(this.data.links.flatMap((link: ExternalLink) => link.tags)));
    }

    async addNewTag(tag: string): Promise<void> {
        for (const link of this.data.links) {
            if (!link.tags.includes(tag)) {
                link.tags.push(tag);
                await this.updateProxyNote(link);
            }
        }
        await this.saveExternalLinks();
    }

    async addNewCategory(category: string): Promise<void> {
        for (const link of this.data.links) {
            if (!link.categories.includes(category)) {
                link.categories.push(category);
                await this.updateProxyNote(link);
            }
        }
        await this.saveExternalLinks();
    }

    async openExternalFile(path: string): Promise<void> {
        const link = this.data.links.find((l: ExternalLink) => l.path === path);
        if (link) {
            if (link.path.startsWith('http://') || link.path.startsWith('https://')) {
                // For web URLs
                window.open(link.path, '_blank');
            } else {
                // For local file paths
                const sanitizedPath = this.sanitizeFilePath(link.path);
                const encodedPath = encodeURI(`file://${sanitizedPath}`);
                window.open(encodedPath);
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
            path = `/${path}`; // Add a leading slash for non-Windows paths
        }
        return path;
    }

    getAllObsidianTags(): string[] {
        const allTags = new Set<string>();
        this.app.vault.getMarkdownFiles().forEach(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache && cache.tags) {
                cache.tags.forEach(tag => allTags.add(tag.tag));
            }
        });
        return Array.from(allTags);
    }

    private processTitle(title: string): string {
        // Decode URL-encoded characters
        let processed = decodeURIComponent(title);
        
        // Replace spaces and invalid characters with underscores
        processed = processed.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Remove any leading or trailing underscores
        processed = processed.replace(/^_+|_+$/g, '');
        
        // Ensure the title is not empty
        if (processed.length === 0) {
            processed = 'Untitled';
        }
        
        return processed;
    }

    getExternalLinkByPath(path: string): ExternalLink | undefined {
        return this.data.links.find(link => link.path === path);
    }

    private async ensureDirectoryExists(path: string): Promise<void> {
        const dirs = path.split('/').filter(p => p.length);
        let currentPath = '';
        for (const dir of dirs) {
            currentPath += dir + '/';
            if (!(await this.app.vault.adapter.exists(currentPath))) {
                try {
                    await this.app.vault.createFolder(currentPath);
                    console.log(`Created directory: ${currentPath}`);
                } catch (error) {
                    console.error(`Failed to create directory ${currentPath}:`, error);
                    throw error;
                }
            }
        }
    }

    private async clearFileCache(filePath: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            // Trigger a file change event to update the metadata cache
            this.app.vault.trigger('modify', file);
        }
    }
}