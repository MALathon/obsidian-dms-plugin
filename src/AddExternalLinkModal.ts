import { Modal, Setting, TextComponent, TextAreaComponent, ButtonComponent, moment } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink } from './types';
import { TFile } from 'obsidian';
import { App } from 'obsidian';

export class AddExternalLinkModal extends Modal {
    plugin: DMSPlugin;
    link: ExternalLink;
    isEditing: boolean;
    private dropZone: HTMLElement;

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

        this.createDropZone(contentEl);
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

    private createDropZone(contentEl: HTMLElement) {
        this.dropZone = contentEl.createEl('div', { cls: 'dms-dropzone', text: 'Drop files here or click to select' });
        this.dropZone.addEventListener('click', () => this.browseFile());
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.addClass('dms-dropzone-active');
        });
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.removeClass('dms-dropzone-active');
        });
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.removeClass('dms-dropzone-active');
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                this.handleDroppedFile(e.dataTransfer.files[0]);
            }
        });
    }

    private async handleDroppedFile(file: File) {
        await this.populateFileData(file);
    }

    private async browseFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async () => {
            if (input.files && input.files.length > 0) {
                await this.populateFileData(input.files[0]);
            }
        };
        input.click();
    }

    private async populateFileData(file: File) {
        const tempLink: ExternalLink = {
            path: file.name,
            title: file.name.split('.').slice(0, -1).join('.'),
            fileType: file.name.split('.').pop() || '',
            size: file.size,
            createdDate: file.lastModified,
            categories: [],
            audience: [],
            tags: [],
            notes: '',
            summary: ''
        };

        // Show prefilled data and ask for confirmation
        new ConfirmationModal(this.app, "Confirm File Details", this.generateConfirmationContent(tempLink), (confirmed) => {
            if (confirmed) {
                Object.assign(this.link, tempLink);
                this.updateModalContent();
            }
        }).open();
    }

    private generateConfirmationContent(link: ExternalLink): DocumentFragment {
        const content = document.createDocumentFragment();
        content.createEl('p', {text: 'Please confirm the details of the file:'});
        content.createEl('p', {text: `Title: ${link.title}`});
        content.createEl('p', {text: `Path: ${link.path}`});
        content.createEl('p', {text: `File Type: ${link.fileType}`});
        content.createEl('p', {text: `Size: ${link.size} bytes`});
        content.createEl('p', {text: `Created Date: ${new Date(link.createdDate).toLocaleString()}`});
        return content;
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
                .setValue(this.link.createdDate ? moment(this.link.createdDate).format('YYYY-MM-DD') : '')
                .onChange(value => {
                    const momentDate = moment(value, 'YYYY-MM-DD', true);
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

    private async saveEntry() {
        if (this.isEditing) {
            await this.plugin.externalLinkService.editExternalLink(this.link);
        } else {
            await this.plugin.externalLinkService.addExternalLink(this.link);
        }
        this.close();
        this.plugin.updateDMSView();
    }

    private updateModalContent() {
        const titleInput = this.contentEl.querySelector('#title') as HTMLInputElement;
        const fileTypeInput = this.contentEl.querySelector('#fileType') as HTMLInputElement;
        const sizeInput = this.contentEl.querySelector('#size') as HTMLInputElement;
        const createdDateInput = this.contentEl.querySelector('#createdDate') as HTMLInputElement;

        if (titleInput) titleInput.value = this.link.title;
        if (fileTypeInput) fileTypeInput.value = this.link.fileType;
        if (sizeInput) sizeInput.value = this.link.size.toString();
        if (createdDateInput) createdDateInput.value = moment(this.link.createdDate).format('YYYY-MM-DD');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class ConfirmationModal extends Modal {
    private title: string;
    private content: DocumentFragment;
    private onConfirm: (confirmed: boolean) => void;

    constructor(app: App, title: string, content: DocumentFragment, onConfirm: (confirmed: boolean) => void) {
        super(app);
        this.title = title;
        this.content = content;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.title });
        contentEl.appendChild(this.content);
        
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Confirm')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onConfirm(true);
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                    this.onConfirm(false);
                }));
    }
}