import { Modal, Setting, TextComponent, TextAreaComponent, ButtonComponent, MomentFormatComponent, moment } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink } from './types';

export class AddExternalLinkModal extends Modal {
    plugin: DMSPlugin;
    link: ExternalLink;
    isEditing: boolean;

    constructor(plugin: DMSPlugin, existingLink?: ExternalLink) {
        super(plugin.app);
        this.plugin = plugin;
        this.isEditing = !!existingLink;
        this.link = existingLink || {
            title: '',
            path: '',
            categories: [],
            audience: [],
            tags: [],
            notes: '',
            summary: '',
            fileType: '',
            size: 0,
            createdDate: Date.now()
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('dms-modal');

        contentEl.createEl('h2', { text: this.isEditing ? 'Edit Entry' : 'Add New Entry' });

        this.createPathSetting(contentEl);
        this.createTitleSetting(contentEl);
        this.createFileTypeSetting(contentEl);
        this.createAudienceSetting(contentEl);
        this.createSummarySetting(contentEl);
        this.createCategoriesSetting(contentEl);
        this.createTagsSetting(contentEl);
        this.createDateSetting(contentEl);
        this.createSizeSetting(contentEl);
        this.createNotesSetting(contentEl);

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(this.isEditing ? 'Save' : 'Add')
                .setCta()
                .onClick(() => this.saveEntry()));
    }

    private createPathSetting(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Path')
            .setDesc('URL or file path')
            .addText(text => text
                .setPlaceholder('Enter path or URL')
                .setValue(this.link.path)
                .onChange(value => this.link.path = value))
            .addButton(btn => btn
                .setButtonText('Browse')
                .onClick(() => this.browseFile()));
    }

    private createTitleSetting(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Title')
            .addText(text => text
                .setPlaceholder('Enter title')
                .setValue(this.link.title)
                .onChange(value => this.link.title = value));
    }

    private createFileTypeSetting(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('File Type')
            .addText(text => text
                .setValue(this.link.fileType)
                .onChange(value => this.link.fileType = value));
    }

    private createAudienceSetting(contentEl: HTMLElement) {
        this.createMultiSelectSetting(contentEl, 'Audience', this.link.audience, ['Internal', 'External', 'Confidential', 'Public']);
    }

    private createSummarySetting(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Summary')
            .addTextArea(text => text
                .setValue(this.link.summary)
                .onChange(value => this.link.summary = value));
    }

    private createCategoriesSetting(contentEl: HTMLElement) {
        this.createMultiSelectSetting(contentEl, 'Categories', this.link.categories, this.plugin.externalLinkService.getCategories());
    }

    private createTagsSetting(contentEl: HTMLElement) {
        this.createMultiSelectSetting(contentEl, 'Tags', this.link.tags, this.plugin.externalLinkService.getTags());
    }

    private createDateSetting(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Created Date')
            .addMomentFormat(component => component
                .setDefaultFormat('YYYY-MM-DD')
                .setValue(this.link.createdDate ? window.moment(this.link.createdDate).format('YYYY-MM-DD') : '')
                .onChange(value => {
                    const momentDate = window.moment(value, 'YYYY-MM-DD', true);
                    this.link.createdDate = momentDate.isValid() ? momentDate.valueOf() : Date.now();
                }));
    }

    private createSizeSetting(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Size (bytes)')
            .addText(text => text
                .setValue(this.link.size.toString())
                .onChange(value => this.link.size = parseInt(value) || 0));
    }

    private createNotesSetting(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Notes')
            .addTextArea(text => text
                .setValue(this.link.notes)
                .onChange(value => this.link.notes = value));
    }

    private createMultiSelectSetting(contentEl: HTMLElement, name: string, selectedItems: string[], allItems: string[]) {
        const setting = new Setting(contentEl).setName(name);
        const input = new TextComponent(setting.controlEl);
        const suggestions = setting.controlEl.createDiv('suggestions');
        const selected = setting.controlEl.createDiv('selected-items');

        input.onChange(value => {
            suggestions.empty();
            const matchingItems = allItems.filter(item => item.toLowerCase().includes(value.toLowerCase()));
            matchingItems.forEach(item => {
                const suggestionEl = suggestions.createDiv('suggestion-item');
                suggestionEl.setText(item);
                suggestionEl.onClickEvent(() => {
                    if (!selectedItems.includes(item)) {
                        selectedItems.push(item);
                        updateSelectedItems();
                    }
                    input.setValue('');
                    suggestions.empty();
                });
            });
        });

        const updateSelectedItems = () => {
            selected.empty();
            selectedItems.forEach(item => {
                const itemEl = selected.createEl('span', { cls: 'selected-item', text: item });
                const removeBtn = itemEl.createEl('span', { cls: 'remove', text: '×' });
                removeBtn.onClickEvent(() => {
                    selectedItems.remove(item);
                    updateSelectedItems();
                });
            });
        };

        updateSelectedItems();
    }

    private async browseFile() {
        // Use the showOpenDialog method from Electron's remote module
        const { remote } = require('electron');
        const result = await remote.dialog.showOpenDialog({
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const file = await this.plugin.app.vault.adapter.stat(filePath);
            if (file) {
                const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
                const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.') || fileName;
                const fileExtension = fileName.split('.').pop() || '';

                this.link.path = filePath;
                this.link.title = fileNameWithoutExtension;
                this.link.fileType = fileExtension || 'unknown';
                this.link.size = file.size;
                this.link.createdDate = file.ctime;
                this.updateModalContent();
            }
        }
    }

    private async saveEntry() {
        if (this.isEditing) {
            await this.plugin.externalLinkService.editExternalLink(this.link, this.link);
        } else {
            await this.plugin.externalLinkService.addExternalLink(this.link);
        }
        this.close();
    }

    updateModalContent() {
        this.onOpen();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}