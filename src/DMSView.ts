import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink } from './types';

export class DMSView extends ItemView {
    plugin: DMSPlugin;
    contentEl: HTMLElement; // Change this to contentEl to match ItemView
    private tableElement: HTMLTableElement;
    private searchInput: HTMLInputElement;
    private categorySelect: HTMLSelectElement;
    private tagSelect: HTMLSelectElement;

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
        this.containerEl = this.contentEl.createDiv({ cls: 'dms-view-container' });
        this.createControls();
        this.createTable();
        this.updateView();
    }

    private createControls() {
        const controlsDiv = this.containerEl.createDiv({ cls: 'controls-container' });

        // Add Entry button
        const addEntryBtn = controlsDiv.createEl('button', { text: 'Add Entry', cls: 'control-button' });
        addEntryBtn.addEventListener('click', () => this.plugin.addOrEditEntry());

        // Search input
        this.searchInput = controlsDiv.createEl('input', { type: 'text', placeholder: 'Search entries...', cls: 'search-input' });
        this.searchInput.addEventListener('input', () => this.updateView());

        // Category filter
        this.categorySelect = controlsDiv.createEl('select', { cls: 'filter-select' });
        this.updateCategorySelect();
        this.categorySelect.addEventListener('change', () => this.updateView());

        // Tag filter
        this.tagSelect = controlsDiv.createEl('select', { cls: 'filter-select' });
        this.updateTagSelect();
        this.tagSelect.addEventListener('change', () => this.updateView());

        // Clear filters button
        const clearFiltersBtn = controlsDiv.createEl('button', { text: 'Clear Filters', cls: 'control-button' });
        clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
    }

    private createTable() {
        this.tableElement = this.containerEl.createEl('table', { cls: 'dms-table' });
        const header = this.tableElement.createEl('thead').createEl('tr');
        ['Title', 'Summary', 'File Type', 'Size', 'Created Date', 'Categories', 'Tags', 'Audience', 'Actions'].forEach(text => {
            header.createEl('th', { text });
        });
        this.tableElement.createEl('tbody');
    }

    updateView() {
        const filteredEntries = this.getFilteredEntries();
        this.renderEntries(filteredEntries);
        this.updateActiveFilters();
    }

    private getFilteredEntries(): ExternalLink[] {
        let entries = this.plugin.externalLinkService.getAllExternalLinks();
        const searchQuery = this.searchInput.value.toLowerCase();
        const selectedCategory = this.categorySelect.value;
        const selectedTag = this.tagSelect.value;

        return entries.filter(entry => 
            (searchQuery === '' || 
             entry.title.toLowerCase().includes(searchQuery) ||
             entry.summary.toLowerCase().includes(searchQuery)) &&
            (selectedCategory === '' || entry.categories.includes(selectedCategory)) &&
            (selectedTag === '' || entry.tags.includes(selectedTag))
        );
    }

    private renderEntries(entries: ExternalLink[]) {
        const tbody = this.tableElement.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (entries.length === 0) {
            const row = tbody.createEl('tr');
            row.createEl('td', { attr: { colspan: '9' }, text: 'No entries found.' });
            return;
        }

        entries.forEach(entry => {
            const row = tbody.createEl('tr');
            row.dataset.entryDate = entry.createdDate.toString();

            // Title with link
            const titleCell = row.createEl('td');
            const linkElement = titleCell.createEl('a', { text: entry.title, attr: { href: entry.path } });
            linkElement.addEventListener('click', (event) => {
                event.preventDefault();
                this.plugin.externalLinkService.openExternalFile(entry.path);
            });

            // Other columns
            row.createEl('td', { text: entry.summary });
            row.createEl('td', { text: entry.fileType });
            row.createEl('td', { text: entry.size ? `${entry.size} bytes` : '' });
            row.createEl('td', { text: new Date(entry.createdDate).toLocaleDateString() });

            // Categories, Tags, and Audience pills
            this.createPills(row.createEl('td'), entry.categories);
            this.createPills(row.createEl('td'), entry.tags);
            this.createPills(row.createEl('td'), entry.audience);

            // Actions
            const actionsCell = row.createEl('td');
            const editBtn = actionsCell.createEl('button', { text: 'Edit' });
            editBtn.addEventListener('click', () => this.plugin.addOrEditEntry(entry));

            const deleteBtn = actionsCell.createEl('button', { text: 'Delete' });
            deleteBtn.addEventListener('click', () => this.deleteEntry(entry));

            const copyPathBtn = actionsCell.createEl('button', { text: 'Copy Path' });
            copyPathBtn.addEventListener('click', () => this.copyPath(entry.path));
        });
    }

    private createPills(container: HTMLElement, items: string[]) {
        if (items && items.length > 0) {
            items.forEach(item => {
                container.createEl('span', { text: item, cls: 'pill' });
            });
        } else {
            container.setText('None');
        }
    }

    private deleteEntry(entry: ExternalLink) {
        this.plugin.externalLinkService.deleteExternalLink(entry);
        this.updateView();
        new Notice(`Deleted entry: ${entry.title}`);
    }

    private copyPath(path: string) {
        navigator.clipboard.writeText(path);
        new Notice('File path copied to clipboard!');
    }

    private updateCategorySelect() {
        this.categorySelect.innerHTML = '<option value="">All Categories</option>';
        const categories = this.plugin.externalLinkService.getCategories();
        categories.forEach(cat => {
            this.categorySelect.add(new Option(cat, cat));
        });
    }

    private updateTagSelect() {
        this.tagSelect.innerHTML = '<option value="">All Tags</option>';
        const tags = this.plugin.externalLinkService.getTags();
        tags.forEach(tag => {
            this.tagSelect.add(new Option(tag, tag));
        });
    }

    private clearAllFilters() {
        this.searchInput.value = '';
        this.categorySelect.value = '';
        this.tagSelect.value = '';
        this.updateView();
    }

    private updateActiveFilters() {
        const activeFiltersDiv = this.containerEl.querySelector('.active-filters-container') || this.containerEl.createDiv({ cls: 'active-filters-container' });
        activeFiltersDiv.innerHTML = '';

        const addActiveFilter = (type: string, value: string, removeCallback: () => void) => {
            const filterEl = activeFiltersDiv.createEl('div', { cls: 'active-filter', text: `${type}: ${value}` });
            const removeBtn = filterEl.createEl('span', { cls: 'remove', text: '×' });
            removeBtn.addEventListener('click', removeCallback);
        };

        if (this.searchInput.value) {
            addActiveFilter('Search', this.searchInput.value, () => {
                this.searchInput.value = '';
                this.updateView();
            });
        }

        if (this.categorySelect.value) {
            addActiveFilter('Category', this.categorySelect.value, () => {
                this.categorySelect.value = '';
                this.updateView();
            });
        }

        if (this.tagSelect.value) {
            addActiveFilter('Tag', this.tagSelect.value, () => {
                this.tagSelect.value = '';
                this.updateView();
            });
        }
    }

    updateTable() {
        // Clear any existing filters
        this.clearFilters();
        
        const links = this.plugin.externalLinkService.getAllExternalLinks();
        // Sort links by most recently added/modified
        links.sort((a, b) => b.createdDate - a.createdDate);
        
        // Rebuild the table with the updated links
        this.buildTable(links);
    }

    clearFilters() {
        // Clear any filter inputs or reset filter state
        // This will depend on how you've implemented filtering
    }

    buildTable(links: ExternalLink[]) {
        const tableBody = this.tableElement.querySelector('tbody');
        if (!tableBody) return;

        tableBody.empty();

        links.forEach(link => {
            const row = tableBody.createEl('tr');
            row.createEl('td').createEl('a', {
                text: link.title,
                href: link.path,
                cls: 'dms-external-link',
                attr: {
                    'data-path': link.path
                }
            }).addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                this.plugin.externalLinkService.openExternalFile(link.path);
            });
            // ... other columns ...
        });
    }

    // ... rest of the class ...
}