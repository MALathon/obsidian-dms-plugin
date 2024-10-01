import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, Modal, TextComponent, FuzzySuggestModal, TFolder, FileSystemAdapter } from 'obsidian';
import { exec } from 'child_process';

declare function require(module: string): any;

interface DMSPluginSettings {
    defaultFolder: string;
    externalLinksFile: string;
}

interface ExternalLink {
    path: string;
    metadata: { [key: string]: string };
    tags: string[];
}

const DEFAULT_SETTINGS: DMSPluginSettings = {
    defaultFolder: 'DMS',
    externalLinksFile: 'external_links.json'
}

export default class DMSPlugin extends Plugin {
    settings: DMSPluginSettings;
    externalLinks: ExternalLink[] = [];

    async onload() {
        await this.loadSettings();
        await this.loadExternalLinks();

        // Initialize external links file if it doesn't exist
        await this.initializeExternalLinksFile();

        // Add ribbon icon
        this.addRibbonIcon('link', 'DMS Menu', () => {
            new DMSMenuModal(this.app, this).open();
        });

        // Add commands
        this.addCommand({
            id: 'create-dms-note',
            name: 'Create new DMS note',
            callback: () => this.createNewNote()
        });

        this.addCommand({
            id: 'add-external-link',
            name: 'Add External Link',
            callback: () => this.addExternalLink()
        });

        this.addCommand({
            id: 'search-dms',
            name: 'Search DMS (notes and external links)',
            callback: () => this.searchDMS()
        });

        // Add settings tab
        this.addSettingTab(new DMSSettingTab(this.app, this));
    }

    onunload() {
        this.saveExternalLinks().catch(console.error);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async loadExternalLinks() {
        const file = this.app.vault.getAbstractFileByPath(this.settings.externalLinksFile);
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            this.externalLinks = JSON.parse(content);
        }
    }

    async saveExternalLinks() {
        const content = JSON.stringify(this.externalLinks, null, 2);
        await this.app.vault.adapter.write(this.settings.externalLinksFile, content);
    }

    async initializeExternalLinksFile() {
        const adapter = this.app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            const filePath = `${this.settings.defaultFolder}/${this.settings.externalLinksFile}`;
            const exists = await adapter.exists(filePath);
            if (!exists) {
                await adapter.write(filePath, '[]');
            }
        }
    }

    async createNewNote() {
        const date = new Date();
        const fileName = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}-untitled.md`;
        const filePath = `${this.settings.defaultFolder}/${fileName}`;
        
        await this.app.vault.create(filePath, '');
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            const leaf = this.app.workspace.activeLeaf;
            if (leaf) {
                await leaf.openFile(file);
            } else {
                new Notice('Unable to open the new note.');
            }
        }
    }

    addExternalLink() {
        new AddExternalLinkModal(this.app, async (path, metadata, tags) => {
            try {
                const newLink: ExternalLink = {
                    path: path,
                    metadata: JSON.parse(metadata),
                    tags: tags.split(',').map(tag => tag.trim())
                };
                this.externalLinks.push(newLink);
                await this.saveExternalLinks();
                new Notice('External link added successfully');
            } catch (error) {
                console.error('Failed to add external link:', error);
                new Notice('Failed to add external link. Please check your input.');
            }
        }).open();
    }

    searchDMS(query?: string) {
        if (query) {
            // If a query is provided, perform the search
            return this.performSearch(query);
        } else {
            // If no query is provided, open the search modal
            new SearchDMSModal(this.app, this).open();
        }
    }

    async performSearch(query: string) {
        const notes = this.app.vault.getMarkdownFiles().filter(file => 
            file.path.startsWith(this.settings.defaultFolder) &&
            (file.basename.toLowerCase().includes(query.toLowerCase()) || this.noteContainsQuery(file, query))
        );
        const externalLinks = this.externalLinks.filter(link => 
            link.path.toLowerCase().includes(query.toLowerCase()) ||
            Object.values(link.metadata).some(value => value.toLowerCase().includes(query.toLowerCase())) ||
            link.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
        return [...notes, ...externalLinks];
    }

    openExternalFile(path: string) {
        exec(`open "${path}"`, (error) => {
            if (error) {
                console.error('Failed to open file:', error);
                new Notice('Failed to open file');
            }
        });
    }

    getAllTags(): string[] {
        const tags = new Set<string>();
        this.externalLinks.forEach(link => link.tags.forEach(tag => tags.add(tag)));
        return Array.from(tags);
    }

    // Add edit functionality for external links
    editExternalLink(index: number) {
        const link = this.externalLinks[index];
        new AddExternalLinkModal(this.app, async (path, metadata, tags) => {
            try {
                this.externalLinks[index] = {
                    path: path,
                    metadata: JSON.parse(metadata),
                    tags: tags.split(',').map(tag => tag.trim())
                };
                await this.saveExternalLinks();
                new Notice('External link updated successfully');
            } catch (error) {
                console.error('Failed to update external link:', error);
                new Notice('Failed to update external link. Please check your input.');
            }
        }, link).open();
    }

    // Add delete functionality for external links
    async deleteExternalLink(index: number) {
        this.externalLinks.splice(index, 1);
        await this.saveExternalLinks();
        new Notice('External link deleted successfully');
    }

    async noteContainsQuery(file: TFile, query: string): Promise<boolean> {
        const content = await this.app.vault.cachedRead(file);
        return content.toLowerCase().includes(query.toLowerCase());
    }
}

class DMSMenuModal extends FuzzySuggestModal<string> {
    plugin: DMSPlugin;

    constructor(app: App, plugin: DMSPlugin) {
        super(app);
        this.plugin = plugin;
    }

    getItems(): string[] {
        return ['Create new note', 'Add external link', 'Search DMS', 'List all notes'];
    }

    getItemText(item: string): string {
        return item;
    }

    onChooseItem(item: string, evt: MouseEvent | KeyboardEvent) {
        if (item === 'Create new note') {
            this.plugin.createNewNote();
        } else if (item === 'Add external link') {
            this.plugin.addExternalLink();
        } else if (item === 'Search DMS') {
            this.plugin.searchDMS();
        } else if (item === 'List all notes') {
            new ListNotesModal(this.app, this.plugin).open();
        }
    }
}

class AddExternalLinkModal extends Modal {
    path: string;
    metadata: string;
    tags: string;
    onSubmit: (path: string, metadata: string, tags: string) => void;

    constructor(app: App, onSubmit: (path: string, metadata: string, tags: string) => void, existingLink?: ExternalLink) {
        super(app);
        this.onSubmit = onSubmit;
        if (existingLink) {
            this.path = existingLink.path;
            this.metadata = JSON.stringify(existingLink.metadata);
            this.tags = existingLink.tags.join(', ');
        }
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h1", { text: "Add External Link" });

        new TextComponent(contentEl)
            .setPlaceholder("Enter the path to the external file")
            .onChange((value) => {
                this.path = value;
            });

        new TextComponent(contentEl)
            .setPlaceholder("Enter metadata (as JSON)")
            .onChange((value) => {
                this.metadata = value;
            });

        new TextComponent(contentEl)
            .setPlaceholder("Enter tags (comma-separated)")
            .onChange((value) => {
                this.tags = value;
            });

        contentEl.createEl("button", { text: "Add" }).addEventListener("click", () => {
            this.close();
            this.onSubmit(this.path, this.metadata, this.tags);
        });

        // Pre-fill fields if editing an existing link
        if (this.path) {
            (contentEl.querySelector('input[placeholder="Enter the path to the external file"]') as HTMLInputElement).value = this.path;
        }
        if (this.metadata) {
            (contentEl.querySelector('input[placeholder="Enter metadata (as JSON)"]') as HTMLInputElement).value = this.metadata;
        }
        if (this.tags) {
            (contentEl.querySelector('input[placeholder="Enter tags (comma-separated)"]') as HTMLInputElement).value = this.tags;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class SearchDMSModal extends FuzzySuggestModal<TFile | ExternalLink> {
    plugin: DMSPlugin;
    searchResults: (TFile | ExternalLink)[] = [];

    constructor(app: App, plugin: DMSPlugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder("Type to start searching...");
        
        // Perform initial search
        this.updateSearchResults();

        // Update search results when input changes
        this.inputEl.addEventListener("input", () => {
            this.updateSearchResults();
        });
    }

    async updateSearchResults() {
        const query = this.inputEl.value;
        this.searchResults = await this.plugin.performSearch(query);
        // Manually trigger a re-render
        this.resultContainerEl.empty();
        this.searchResults.forEach((item) => {
            this.addItem(item);
        });
    }

    getItems(): (TFile | ExternalLink)[] {
        return this.searchResults;
    }

    getItemText(item: TFile | ExternalLink): string {
        if (item instanceof TFile) {
            return `Note: ${item.basename}`;
        } else {
            return `External: ${item.path}`;
        }
    }

    onChooseItem(item: TFile | ExternalLink, evt: MouseEvent | KeyboardEvent) {
        if (item instanceof TFile) {
            const leaf = this.app.workspace.activeLeaf;
            if (leaf) {
                leaf.openFile(item);
            } else {
                new Notice('Unable to open the file.');
            }
        } else {
            this.plugin.openExternalFile(item.path);
        }
    }

    addItem(item: TFile | ExternalLink) {
        const itemDiv = this.resultContainerEl.createDiv("suggestion-item");
        itemDiv.setText(this.getItemText(item));
        itemDiv.addEventListener("click", (event: MouseEvent) => {
            this.onChooseItem(item, event);
            this.close();
        });
    }
}

class ListNotesModal extends FuzzySuggestModal<TFile> {
    plugin: DMSPlugin;

    constructor(app: App, plugin: DMSPlugin) {
        super(app);
        this.plugin = plugin;
    }

    getItems(): TFile[] {
        return this.app.vault.getFiles().filter(file => file.path.startsWith(this.plugin.settings.defaultFolder));
    }

    getItemText(item: TFile): string {
        return item.basename;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent) {
        const leaf = this.app.workspace.activeLeaf;
        if (leaf) {
            leaf.openFile(item);
        } else {
            new Notice('Unable to open the file.');
        }
    }
}

class DMSSettingTab extends PluginSettingTab {
    plugin: DMSPlugin;

    constructor(app: App, plugin: DMSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'DMS Plugin Settings'});

        new Setting(containerEl)
            .setName('Default folder')
            .setDesc('The folder where new DMS notes will be created')
            .addText(text => text
                .setPlaceholder('Enter folder name')
                .setValue(this.plugin.settings.defaultFolder)
                .onChange(async (value) => {
                    this.plugin.settings.defaultFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('External links file')
            .setDesc('The file where external links will be stored')
            .addText(text => text
                .setPlaceholder('Enter file name')
                .setValue(this.plugin.settings.externalLinksFile)
                .onChange(async (value) => {
                    this.plugin.settings.externalLinksFile = value;
                    await this.plugin.saveSettings();
                }));
    }
}