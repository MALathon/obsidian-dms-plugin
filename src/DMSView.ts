import { ItemView, WorkspaceLeaf, Notice, Modal, Setting, App } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink } from './types';
import { BuildInfo } from './buildInfo';
import buildInfo from './buildInfo.json';
import moment from 'moment';

export class DMSView extends ItemView {
    plugin: DMSPlugin;
    contentEl: HTMLElement;
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
        this.createHeader();
        this.createControls();
        this.createTable();
        this.updateView();
        await this.createBuildInfo();

        this.addEventListeners();
    }

    private createHeader() {
        const headerEl = this.containerEl.createEl('div', { cls: 'dms-header' });
        headerEl.createEl('h2', { text: 'Document Management System' });
        const settingsIcon = headerEl.createEl('span', { cls: 'dms-settings-icon', text: '⚙️' });
        settingsIcon.addEventListener('click', () => {
            this.plugin.openSettings();
        });
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
        const links = this.plugin.externalLinkService.getAllExternalLinks();
        const filteredLinks = this.filterLinks(links);
        const sortedLinks = this.sortLinks(filteredLinks);
        const tableContent = this.generateTableContent(sortedLinks);
        
        if (this.tableElement.innerHTML !== tableContent) {
            this.tableElement.innerHTML = tableContent;
        }
        
        this.updateActiveFilters();
    }

    private generateTableContent(entries: ExternalLink[]): string {
        let content = '<thead><tr>';
        ['Title', 'Summary', 'File Type', 'Size', 'Created Date', 'Categories', 'Tags', 'Audience', 'Actions'].forEach(header => {
            content += `<th>${header}</th>`;
        });
        content += '</tr></thead><tbody>';

        entries.forEach(entry => {
            content += `
                <tr>
                    <td><a href="#" class="dms-external-link" data-path="${entry.path}">${entry.title}</a></td>
                    <td>${entry.summary}</td>
                    <td>${entry.fileType}</td>
                    <td>${this.formatFileSize(entry.size)}</td>
                    <td>${moment(entry.createdDate).format('YYYY-MM-DD')}</td>
                    <td>${this.createPillsHTML(entry.categories, 'category', entry)}</td>
                    <td>${this.createPillsHTML(entry.tags, 'tag', entry)}</td>
                    <td>${this.createPillsHTML(entry.audience, 'audience', entry)}</td>
                    <td>${this.createActionButtonsHTML(entry)}</td>
                </tr>
            `;
        });

        content += '</tbody>';
        return content;
    }

    private filterLinks(links: ExternalLink[]): ExternalLink[] {
        const searchTerm = this.searchInput.value.toLowerCase();
        const selectedCategory = this.categorySelect.value;
        const selectedTag = this.tagSelect.value;

        return links.filter(link => {
            const matchesSearch = link.title.toLowerCase().includes(searchTerm) ||
                                 link.summary.toLowerCase().includes(searchTerm) ||
                                 link.notes.toLowerCase().includes(searchTerm);
            const matchesCategory = !selectedCategory || link.categories.includes(selectedCategory);
            const matchesTag = !selectedTag || link.tags.includes(selectedTag);

            return matchesSearch && matchesCategory && matchesTag;
        });
    }

    private sortLinks(links: ExternalLink[]): ExternalLink[] {
        return links.sort((a, b) => b.createdDate - a.createdDate);
    }

    private createPillsHTML(items: string[], type: 'category' | 'tag' | 'audience', entry: ExternalLink): string {
        return items.map(item => `
            <span class="dms-pill dms-${type}-pill">
                ${item}
                <span class="dms-pill-remove" data-type="${type}" data-item="${item}" data-entry-path="${entry.path}">×</span>
            </span>
        `).join('');
    }

    private createActionButtonsHTML(entry: ExternalLink): string {
        return `
            <button class="dms-action-btn edit-btn" data-path="${entry.path}">Edit</button>
            <button class="dms-action-btn delete-btn" data-path="${entry.path}">Delete</button>
            <button class="dms-action-btn copy-path-btn" data-path="${entry.path}">Copy Path</button>
        `;
    }

    private renderEntries(entries: ExternalLink[]) {
        const tbody = this.tableElement.querySelector('tbody');
        if (!tbody) return;

        tbody.empty();

        entries.forEach(entry => {
            const row = tbody.createEl('tr');
            const titleCell = row.createEl('td');
            const titleLink = titleCell.createEl('a', { 
                text: entry.title,
                cls: 'dms-external-link',
                attr: { href: entry.path }
            });
            titleLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.plugin.externalLinkService.openExternalFile(entry.path);
            });

            row.createEl('td', { text: entry.summary });
            row.createEl('td', { text: entry.fileType });
            row.createEl('td', { text: this.formatFileSize(entry.size) });
            row.createEl('td', { text: moment(entry.createdDate).format('YYYY-MM-DD') });
            
            const categoriesCell = row.createEl('td');
            this.createPills(categoriesCell, entry.categories, 'category', entry);

            const tagsCell = row.createEl('td');
            this.createPills(tagsCell, entry.tags, 'tag', entry);

            const audienceCell = row.createEl('td');
            this.createPills(audienceCell, entry.audience, 'audience', entry);

            const actionsCell = row.createEl('td');
            this.createActionButtons(actionsCell, entry);
        });
    }

    private createPills(container: HTMLElement, items: string[], type: 'category' | 'tag' | 'audience', entry: ExternalLink) {
        items.forEach(item => {
            const pill = container.createEl('span', { 
                text: item, 
                cls: `dms-pill dms-${type}-pill` 
            });
            const removeBtn = pill.createEl('span', { 
                text: '×', 
                cls: 'dms-pill-remove' 
            });
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeItem(type, item, entry);
            });
        });
    }

    private removeItem(type: 'category' | 'tag' | 'audience', item: string, entry: ExternalLink) {
        const arrayName = type === 'audience' ? 'audience' : `${type}s`;
        const array = entry[arrayName as keyof ExternalLink] as string[];
        if (Array.isArray(array)) {
            (entry[arrayName as keyof ExternalLink] as string[]) = array.filter((i: string) => i !== item);
            this.plugin.externalLinkService.editExternalLink(entry);
            this.updateView();
        }
    }

    private createActionButtons(container: HTMLElement, entry: ExternalLink) {
        const editBtn = container.createEl('button', { text: 'Edit', cls: 'dms-action-btn' });
        editBtn.addEventListener('click', () => this.plugin.addOrEditEntry(entry));

        const deleteBtn = container.createEl('button', { text: 'Delete', cls: 'dms-action-btn' });
        deleteBtn.addEventListener('click', () => this.deleteEntry(entry));

        const copyPathBtn = container.createEl('button', { text: 'Copy Path', cls: 'dms-action-btn' });
        copyPathBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(entry.path);
            new Notice('File path copied to clipboard!');
        });
    }

    private deleteEntry(entry: ExternalLink) {
        const confirmationModal = new ConfirmationModal(
            this.app,
            'Delete Entry',
            `Are you sure you want to delete "${entry.title}"?
            This action cannot be undone.`,
            async (confirmed: boolean) => {
                if (confirmed) {
                    await this.plugin.externalLinkService.deleteExternalLink(entry);
                    this.updateView();
                    new Notice('Entry deleted successfully');
                }
            }
        );
        confirmationModal.open();
    }

    private formatFileSize(size: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return `${size.toFixed(2)} ${units[i]}`;
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
        const links = this.plugin.externalLinkService.getAllExternalLinks();
        // Sort links by most recently added/modified
        links.sort((a, b) => b.createdDate - a.createdDate);
        
        // Rebuild the table with the updated links
        this.renderEntries(links);
    }

    clearFilters() {
        // Clear any filter inputs or reset filter state
        // This will depend on how you've implemented filtering
    }

    // Remove the buildTable method as it's redundant with renderEntries
    private async createBuildInfo() {
        const buildInfoEl = this.containerEl.createEl('div', { cls: 'dms-build-info' });
        
        try {
            const manifest = await this.plugin.app.vault.adapter.read('.obsidian/plugins/dms-plugin/manifest.json');
            const manifestData = JSON.parse(manifest);
            const version = manifestData.version;
            const buildNumber = version.split('.')[3] || 'Unknown';
            buildInfoEl.setText(`Build: ${buildNumber}`);
        } catch (error) {
            console.error('Failed to fetch build number:', error);
            buildInfoEl.setText('Build: Unknown');
        }
    }

    private addEventListeners() {
        this.tableElement.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            if (target.classList.contains('dms-external-link')) {
                e.preventDefault();
                const path = target.getAttribute('data-path');
                if (path) this.plugin.externalLinkService.openExternalFile(path);
            }

            if (target.classList.contains('dms-pill-remove')) {
                const type = target.getAttribute('data-type') as 'category' | 'tag' | 'audience';
                const item = target.getAttribute('data-item');
                const entryPath = target.getAttribute('data-entry-path');
                if (type && item && entryPath) {
                    const entry = this.plugin.externalLinkService.getExternalLinkByPath(entryPath);
                    if (entry) this.removeItem(type, item, entry);
                }
            }

            if (target.classList.contains('edit-btn')) {
                const path = target.getAttribute('data-path');
                if (path) {
                    const entry = this.plugin.externalLinkService.getExternalLinkByPath(path);
                    if (entry) this.plugin.addOrEditEntry(entry);
                }
            }

            if (target.classList.contains('delete-btn')) {
                const path = target.getAttribute('data-path');
                if (path) {
                    const entry = this.plugin.externalLinkService.getExternalLinkByPath(path);
                    if (entry) this.deleteEntry(entry);
                }
            }

            if (target.classList.contains('copy-path-btn')) {
                const path = target.getAttribute('data-path');
                if (path) {
                    navigator.clipboard.writeText(path);
                    new Notice('File path copied to clipboard!');
                }
            }
        });
    }
}

class ConfirmationModal extends Modal {
    onSubmit: (confirmed: boolean) => void;
    message: string;

    constructor(app: App, title: string, message: string, onSubmit: (confirmed: boolean) => void) {
        super(app);
        this.titleEl.setText(title);
        this.message = message;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('p', { text: this.message });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                    this.onSubmit(false);
                }))
            .addButton(btn => btn
                .setButtonText('Confirm')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(true);
                }));
    }
}