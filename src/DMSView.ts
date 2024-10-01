import { ItemView, WorkspaceLeaf, ButtonComponent, TextComponent, DropdownComponent, Notice, moment, MomentFormatComponent } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink } from './types';
import { AddExternalLinkModal } from './AddExternalLinkModal';

export class DMSView extends ItemView {
    plugin: DMSPlugin;
    searchInput: TextComponent;
    tableView: HTMLElement;
    dropZone: HTMLElement;
    categorySelect: DropdownComponent;
    tagSelect: DropdownComponent;

    constructor(leaf: WorkspaceLeaf, plugin: DMSPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'dms-view';
    }

    getDisplayText(): string {
        return 'DMS View';
    }

    async onOpen() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('style', {
            text: `
                .dms-view-container { padding: 20px; }
                .dms-top-bar { display: flex; gap: 10px; margin-bottom: 20px; }
                .dms-table { width: 100%; border-collapse: collapse; }
                .dms-table th, .dms-table td { padding: 10px; border: 1px solid var(--background-modifier-border); }
                .dms-table th { background-color: var(--background-secondary); }
                .dms-drop-zone { border: 2px dashed var(--background-modifier-border); padding: 20px; text-align: center; margin-bottom: 20px; }
                .dms-pill { background-color: var(--interactive-accent); color: var(--text-on-accent); padding: 2px 8px; border-radius: 12px; font-size: 12px; margin: 2px; display: inline-block; }
            `
        });

        const container = containerEl.createDiv('dms-view-container');
        this.createTopBar(container);
        this.createDropZone(container);
        this.createTable(container);
    }

    private createTopBar(containerEl: HTMLElement) {
        const topBar = containerEl.createEl('div', { cls: 'dms-top-bar' });

        new ButtonComponent(topBar)
            .setButtonText('Add Entry')
            .onClick(() => new AddExternalLinkModal(this.plugin).open());

        new ButtonComponent(topBar)
            .setButtonText('Edit Categories')
            .onClick(() => this.editCategories());

        new ButtonComponent(topBar)
            .setButtonText('Edit Tags')
            .onClick(() => this.editTags());

        this.searchInput = new TextComponent(topBar)
            .setPlaceholder('Search entries...')
            .onChange(() => this.updateTable());

        this.categorySelect = new DropdownComponent(topBar)
            .addOption('all', 'All Categories')
            .onChange(() => this.updateTable());

        this.tagSelect = new DropdownComponent(topBar)
            .addOption('all', 'All Tags')
            .onChange(() => this.updateTable());

        new ButtonComponent(topBar)
            .setButtonText('Clear Filters')
            .onClick(() => this.clearFilters());
    }

    private createDropZone(containerEl: HTMLElement) {
        this.dropZone = containerEl.createEl('div', { text: 'Drop files or URLs here', cls: 'dms-drop-zone' });
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
    }

    private createTable(containerEl: HTMLElement) {
        this.tableView = containerEl.createEl('table', { cls: 'dms-table' });
        this.updateTable();
    }

    updateTable() {
        const searchTerm = this.searchInput.getValue().toLowerCase();
        const selectedCategory = this.categorySelect.getValue();
        const selectedTag = this.tagSelect.getValue();

        const filteredEntries = this.plugin.externalLinkService.getAllExternalLinks().filter(entry => 
            (searchTerm === '' || this.entryMatchesSearch(entry, searchTerm)) &&
            (selectedCategory === 'all' || entry.categories.includes(selectedCategory)) &&
            (selectedTag === 'all' || entry.tags.includes(selectedTag))
        );

        this.renderEntries(filteredEntries);
    }

    private entryMatchesSearch(entry: ExternalLink, searchTerm: string): boolean {
        return entry.title.toLowerCase().includes(searchTerm) ||
               entry.path.toLowerCase().includes(searchTerm) ||
               entry.summary.toLowerCase().includes(searchTerm) ||
               entry.categories.some(cat => cat.toLowerCase().includes(searchTerm)) ||
               entry.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
               entry.audience.some(aud => aud.toLowerCase().includes(searchTerm));
    }

    private renderEntries(entries: ExternalLink[]) {
        this.tableView.empty();
        const header = this.tableView.createEl('thead').createEl('tr');
        ['Title', 'Summary', 'File Type', 'Size', 'Created Date', 'Categories', 'Tags', 'Audience', 'Actions'].forEach(text => {
            header.createEl('th', { text });
        });

        const tbody = this.tableView.createEl('tbody');
        entries.forEach(entry => this.renderEntry(tbody, entry));
    }

    private renderEntry(tbody: HTMLElement, entry: ExternalLink) {
        const row = tbody.createEl('tr');
        
        const titleCell = row.createEl('td');
        const titleLink = titleCell.createEl('a', { text: entry.title, href: entry.path });
        titleLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.plugin.externalLinkService.openExternalFile(entry.path);
        });

        row.createEl('td', { text: entry.summary });
        row.createEl('td', { text: entry.fileType });
        row.createEl('td', { text: `${entry.size} bytes` });
        row.createEl('td', { text: moment(entry.createdDate).format('YYYY-MM-DD') });

        const categoriesCell = row.createEl('td');
        entry.categories.forEach(cat => categoriesCell.createEl('span', { text: cat, cls: 'dms-pill' }));

        const tagsCell = row.createEl('td');
        entry.tags.forEach(tag => tagsCell.createEl('span', { text: tag, cls: 'dms-pill' }));

        const audienceCell = row.createEl('td');
        entry.audience.forEach(aud => audienceCell.createEl('span', { text: aud, cls: 'dms-pill' }));

        const actionsCell = row.createEl('td');
        new ButtonComponent(actionsCell)
            .setButtonText('Edit')
            .onClick(() => new AddExternalLinkModal(this.plugin, entry).open());
        new ButtonComponent(actionsCell)
            .setButtonText('Delete')
            .onClick(() => this.deleteEntry(entry));
        new ButtonComponent(actionsCell)
            .setButtonText('Copy Path')
            .onClick(() => this.copyPath(entry.path));
    }

    private async deleteEntry(entry: ExternalLink) {
        await this.plugin.externalLinkService.deleteExternalLink(entry);
        this.updateTable();
    }

    private copyPath(path: string) {
        navigator.clipboard.writeText(path);
        new Notice('File path copied to clipboard!');
    }

    private clearFilters() {
        this.searchInput.setValue('');
        this.categorySelect.setValue('all');
        this.tagSelect.setValue('all');
        this.updateTable();
    }

    private editCategories() {
        // Implement category editing logic
    }

    private editTags() {
        // Implement tag editing logic
    }

    private handleDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dropZone.addClass('drag-over');
    }

    private handleDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dropZone.removeClass('drag-over');
    }

    private async handleDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.dropZone.removeClass('drag-over');

        const items = event.dataTransfer?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    await this.addFileEntry(file);
                }
            } else if (item.kind === 'string' && item.type === 'text/uri-list') {
                item.getAsString(async (url) => {
                    await this.addUrlEntry(url);
                });
            }
        }
    }

    private async addFileEntry(file: File) {
        const entry: ExternalLink = {
            title: file.name,
            path: file.webkitRelativePath || file.name,
            fileType: file.type || 'unknown',
            audience: [],
            summary: `File: ${file.name}`,
            categories: [],
            tags: [],
            createdDate: file.lastModified,
            size: file.size,
            notes: ''
        };
        await this.plugin.externalLinkService.addExternalLink(entry);
        this.updateTable();
    }

    private async addUrlEntry(url: string) {
        const entry: ExternalLink = {
            title: new URL(url).hostname,
            path: url,
            fileType: 'text/uri-list',
            audience: [],
            summary: 'Dropped URL',
            categories: ['URL'],
            tags: ['web'],
            createdDate: Date.now(),
            size: 0,
            notes: ''
        };
        await this.plugin.externalLinkService.addExternalLink(entry);
        this.updateTable();
    }
}