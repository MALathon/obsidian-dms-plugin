import { ItemView, WorkspaceLeaf, ButtonComponent, TextComponent, DropdownComponent, Notice } from 'obsidian';
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

        this.createTopBar(containerEl);
        this.createDropZone(containerEl);
        this.createTable(containerEl);
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
        this.dropZone = containerEl.createEl('div', { text: 'Drop files or URLs here', cls: 'drop-zone' });
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
            (selectedCategory === 'all' || entry.category === selectedCategory) &&
            (selectedTag === 'all' || entry.tags.includes(selectedTag))
        );

        this.renderEntries(filteredEntries);
    }

    private entryMatchesSearch(entry: ExternalLink, searchTerm: string): boolean {
        return entry.title.toLowerCase().includes(searchTerm) ||
               entry.path.toLowerCase().includes(searchTerm) ||
               entry.summary.toLowerCase().includes(searchTerm) ||
               entry.category.toLowerCase().includes(searchTerm) ||
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
        const titleLink = titleCell.createEl('a', { text: entry.title });
        titleLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.plugin.externalLinkService.openExternalFile(entry.path);
        });
        
        row.createEl('td', { text: entry.summary });
        row.createEl('td', { text: entry.fileType });
        row.createEl('td', { text: entry.size ? `${entry.size} bytes` : '' });
        row.createEl('td', { text: new Date(entry.createdDate).toLocaleDateString() });
        row.createEl('td', { text: entry.category });
        row.createEl('td', { text: entry.tags.join(', ') });
        row.createEl('td', { text: entry.audience.join(', ') });

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

    private async editCategories() {
        // Implement category editing functionality
        // This should open a modal to edit categories
    }

    private async editTags() {
        // Implement tag editing functionality
        // This should open a modal to edit tags
    }

    private clearFilters() {
        this.searchInput.setValue('');
        this.categorySelect.setValue('all');
        this.tagSelect.setValue('all');
        this.updateTable();
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
        if (items) {
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
    }

    private async addFileEntry(file: File) {
        const filePath = file.name; // We'll use the file name as the path for proxy notes
        
        const entry: ExternalLink = {
            title: file.name,
            path: filePath,
            fileType: file.type || this.detectFileType(file.name),
            audience: [],
            summary: `File: ${file.name}`,
            category: '',
            tags: [],
            createdDate: file.lastModified,
            size: file.size,
            notes: ''
        };

        await this.plugin.externalLinkService.addExternalLink(entry);
        this.updateTable();
    }

    private detectFileType(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const mimeMap: {[key: string]: string} = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'txt': 'text/plain',
            'csv': 'text/csv',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'mp3': 'audio/mpeg',
            'mp4': 'video/mp4',
            // Add more mappings as needed
        };

        return extension ? (mimeMap[extension] || 'application/octet-stream') : 'application/octet-stream';
    }

    private async addUrlEntry(url: string) {
        const entry: ExternalLink = {
            title: new URL(url).hostname,
            path: url,
            fileType: 'text/uri-list',
            audience: [],
            summary: 'Dropped URL',
            category: 'URL',
            tags: ['web'],
            createdDate: Date.now(),
            size: 0,
            notes: ''
        };
        await this.plugin.externalLinkService.addExternalLink(entry);
        this.updateTable();
    }

    private async deleteEntry(entry: ExternalLink) {
        await this.plugin.externalLinkService.deleteExternalLink(entry);
        this.updateTable();
    }

    private copyPath(path: string) {
        navigator.clipboard.writeText(path);
        // Optionally, show a notification that the path was copied
    }
}