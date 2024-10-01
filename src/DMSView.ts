import { ItemView, WorkspaceLeaf } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink } from './types';
import { AddExternalLinkModal } from './AddExternalLinkModal';

export class DMSView extends ItemView {
    plugin: DMSPlugin;
    searchInput: HTMLInputElement;
    tableView: HTMLDivElement;

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

        containerEl.createEl('h2', { text: 'External Resources' });

        this.searchInput = containerEl.createEl('input', {
            type: 'text',
            placeholder: 'Search external links...'
        });
        this.searchInput.addEventListener('input', () => this.updateTable());

        this.tableView = containerEl.createEl('div');
        this.updateTable();
    }

    async onClose() {
        // Clean up if necessary
    }

    updateTable() {
        const links = this.plugin.externalLinkService.getAllExternalLinks();
        const searchTerm = this.searchInput.value.toLowerCase();

        this.tableView.empty();
        const table = this.tableView.createEl('table', { cls: 'dms-table' });
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        ['Title', 'Category', 'Tags', 'Actions'].forEach(header => {
            headerRow.createEl('th', { text: header });
        });

        const tbody = table.createEl('tbody');
        links.forEach((link, index) => {
            if (searchTerm && !this.linkMatchesSearch(link, searchTerm)) return;

            const row = tbody.createEl('tr');
            row.createEl('td', { text: link.title });
            row.createEl('td', { text: link.category });
            row.createEl('td', { text: link.tags.join(', ') });

            const actionsCell = row.createEl('td');
            const openButton = actionsCell.createEl('button', { text: 'Open' });
            openButton.addEventListener('click', () => this.plugin.externalLinkService.openExternalFile(link.path));

            const editButton = actionsCell.createEl('button', { text: 'Edit' });
            editButton.addEventListener('click', () => {
                new AddExternalLinkModal(this.plugin, index).open();
            });
        });
    }

    private linkMatchesSearch(link: ExternalLink, searchTerm: string): boolean {
        return link.title.toLowerCase().includes(searchTerm) ||
               link.category.toLowerCase().includes(searchTerm) ||
               link.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm));
    }
}