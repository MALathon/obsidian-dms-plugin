import { App, Plugin, PluginSettingTab, Setting, Notice, WorkspaceLeaf, ItemView, MarkdownView, TFile, Modal, FuzzySuggestModal } from 'obsidian';
import { exec } from 'child_process';
import * as YAML from 'yaml';

interface DMSPluginSettings {
    categories: string[];
    audiences: string[];
    defaultFolder: string;
}

interface ExternalLink {
    path: string;
    title: string;
    category: string;
    audience: string[];
    tags: string[];
    notes: string;
    dateAdded: string;
    dateModified: string;
}

const DEFAULT_SETTINGS: DMSPluginSettings = {
    categories: ['Work', 'Personal', 'Research', 'Other'],
    audiences: ['Self', 'Team', 'Client', 'Public'],
    defaultFolder: 'DMS'
}

export default class DMSPlugin extends Plugin {
    settings: DMSPluginSettings;
    externalLinks: ExternalLink[] = [];
    dmsView: DMSView | null = null;

    async onload() {
        await this.loadSettings();
        await this.loadExternalLinks();

        this.registerView('dms-view', (leaf) => {
            this.dmsView = new DMSView(leaf, this);
            return this.dmsView;
        });

        this.addRibbonIcon('folder', 'Open DMS Panel', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-dms-panel',
            name: 'Open DMS Panel',
            callback: () => this.activateView()
        });

        this.addSettingTab(new DMSSettingTab(this.app, this));

        // Ensure the default folder exists
        await this.ensureDefaultFolderExists();
    }

    async ensureDefaultFolderExists() {
        const folderPath = this.settings.defaultFolder || 'DMS';
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: 'dms-view', active: true });
            if (this.dmsView) {
                this.dmsView.onOpen();
            }
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async loadExternalLinks() {
        const data = await this.loadData();
        this.externalLinks = data?.externalLinks || [];
    }

    async saveExternalLinks() {
        await this.saveData({ externalLinks: this.externalLinks });
        this.updateDMSView();
    }

    addExternalLink(link: ExternalLink) {
        this.externalLinks.push(link);
        this.saveExternalLinks();
    }

    editExternalLink(index: number, link: ExternalLink) {
        this.externalLinks[index] = link;
        this.saveExternalLinks();
    }

    deleteExternalLink(index: number) {
        this.externalLinks.splice(index, 1);
        this.saveExternalLinks();
    }

    updateDMSView() {
        if (this.dmsView) {
            this.dmsView.updateTable();
        }
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
        const allTags = new Set<string>();
        // Get tags from external links
        this.externalLinks.forEach(link => link.tags.forEach(tag => allTags.add(tag)));
        // Get tags from Obsidian vault
        this.app.vault.getFiles().forEach(file => {
            const fileTags = this.app.metadataCache.getFileCache(file)?.tags || [];
            fileTags.forEach(tagCache => allTags.add(tagCache.tag.slice(1)));
        });
        return Array.from(allTags);
    }

    async addNewTag(tag: string) {
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

                const parsedYaml = YAML.parse(yaml);
                if (!parsedYaml.tags) {
                    parsedYaml.tags = [];
                }

                if (!parsedYaml.tags.includes(tag)) {
                    parsedYaml.tags.push(tag);
                }

                const newFrontmatter = YAML.stringify(parsedYaml);
                const newContent = `---\n${newFrontmatter}---\n${body}`;

                await this.app.vault.modify(dummyFile, newContent);
            } catch (error) {
                console.error('Failed to add new tag:', error);
                new Notice('Failed to add new tag. Check the console for details.');
            }
        } else {
            console.error('Failed to create or access dms-tags.md file');
            new Notice('Failed to add new tag. Check the console for details.');
        }
    }

    searchExternalLinks(query: string): ExternalLink[] {
        return this.externalLinks.filter(link => 
            link.title.toLowerCase().includes(query.toLowerCase()) ||
            link.path.toLowerCase().includes(query.toLowerCase()) ||
            link.category.toLowerCase().includes(query.toLowerCase()) ||
            link.audience.some(a => a.toLowerCase().includes(query.toLowerCase())) ||
            link.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
            link.notes.toLowerCase().includes(query.toLowerCase())
        );
    }
}

class DMSView extends ItemView {
    plugin: DMSPlugin;
    tableView: HTMLElement;
    searchInput: HTMLInputElement;

    constructor(leaf: WorkspaceLeaf, plugin: DMSPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return "dms-view";
    }

    getDisplayText() {
        return "DMS";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        container.createEl("h4", { text: "DMS Panel" });

        this.searchInput = container.createEl("input", { type: "text", placeholder: "Search external links..." });
        this.searchInput.addEventListener("input", () => this.updateTable());

        const addButton = container.createEl("button", { text: "Add External Link" });
        addButton.addEventListener("click", () => new AddExternalLinkModal(this.plugin).open());

        this.tableView = container.createEl("div", { cls: "dms-table-view" });
        this.updateTable();
    }

    updateTable() {
        this.tableView.empty();
        const table = this.tableView.createEl("table", { cls: "dms-table" });
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        ["Title", "Category", "Audience", "Tags", "Actions"].forEach(header => {
            headerRow.createEl("th", { text: header });
        });

        const tbody = table.createEl("tbody");

        const links = this.searchInput.value 
            ? this.plugin.searchExternalLinks(this.searchInput.value)
            : this.plugin.externalLinks;

        links.forEach((link, index) => {
            const row = tbody.createEl("tr");
            row.createEl("td", { text: link.title });
            row.createEl("td", { text: link.category });
            row.createEl("td", { text: link.audience.join(", ") });
            row.createEl("td", { text: link.tags.join(", ") });
            const actionsCell = row.createEl("td");
            const openButton = actionsCell.createEl("button", { text: "Open" });
            openButton.addEventListener("click", () => this.plugin.openExternalFile(link.path));
            const editButton = actionsCell.createEl("button", { text: "Edit" });
            editButton.addEventListener("click", () => new AddExternalLinkModal(this.plugin, index).open());
            const deleteButton = actionsCell.createEl("button", { text: "Delete" });
            deleteButton.addEventListener("click", () => {
                this.plugin.deleteExternalLink(index);
                this.updateTable();
            });
        });
    }
}

class AddExternalLinkModal extends Modal {
    plugin: DMSPlugin;
    linkIndex: number | null;
    link: ExternalLink;

    constructor(plugin: DMSPlugin, linkIndex: number | null = null) {
        super(plugin.app);
        this.plugin = plugin;
        this.linkIndex = linkIndex;
        if (linkIndex !== null) {
            this.link = {...this.plugin.externalLinks[linkIndex]};
        } else {
            this.link = {
                path: '',
                title: '',
                category: '',
                audience: [],
                tags: [],
                notes: '',
                dateAdded: new Date().toISOString(),
                dateModified: new Date().toISOString()
            };
        }
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.addClass('dms-modal');

        contentEl.createEl('h2', {text: this.linkIndex !== null ? 'Edit External Link' : 'Add External Link'});

        new Setting(contentEl)
            .setName('File Path')
            .addText(text => text
                .setValue(this.link.path)
                .onChange(async (value) => {
                    this.link.path = value;
                }));

        new Setting(contentEl)
            .setName('Title')
            .addText(text => text
                .setValue(this.link.title)
                .onChange(async (value) => {
                    this.link.title = value;
                }));

        new Setting(contentEl)
            .setName('Category')
            .addDropdown(dropdown => dropdown
                .addOptions(Object.fromEntries(this.plugin.settings.categories.map(c => [c, c])))
                .setValue(this.link.category)
                .onChange(async (value) => {
                    this.link.category = value;
                }));

        new Setting(contentEl)
            .setName('Audience')
            .addDropdown(dropdown => dropdown
                .addOptions(Object.fromEntries(this.plugin.settings.audiences.map(a => [a, a])))
                .setValue(this.link.audience[0] || '')
                .onChange(async (value) => {
                    this.link.audience = [value];
                }));

        new Setting(contentEl)
            .setName('Tags')
            .addText(text => text
                .setValue(this.link.tags.join(', '))
                .onChange(async (value) => {
                    this.link.tags = value.split(',').map(tag => tag.trim());
                }));

        new Setting(contentEl)
            .setName('Notes')
            .addTextArea(textarea => textarea
                .setValue(this.link.notes)
                .onChange(async (value) => {
                    this.link.notes = value;
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(this.linkIndex !== null ? 'Save Changes' : 'Add Link')
                .setCta()
                .onClick(() => {
                    if (this.linkIndex !== null) {
                        this.plugin.editExternalLink(this.linkIndex, this.link);
                    } else {
                        this.plugin.addExternalLink(this.link);
                    }
                    this.close();
                }));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
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
            .setName('Categories')
            .setDesc('Comma-separated list of categories')
            .addText(text => text
                .setPlaceholder('Work, Personal, Research, Other')
                .setValue(this.plugin.settings.categories.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.categories = value.split(',').map(c => c.trim());
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Audiences')
            .setDesc('Comma-separated list of audiences')
            .addText(text => text
                .setPlaceholder('Self, Team, Client, Public')
                .setValue(this.plugin.settings.audiences.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.audiences = value.split(',').map(a => a.trim());
                    await this.plugin.saveSettings();
                }));
    }
}