import { Modal, Setting, TextComponent, DropdownComponent, ButtonComponent, App } from 'obsidian';
import moment from 'moment';
import DMSPlugin from './main';
import { ExternalLink } from './types';
import { TFile } from 'obsidian';

export class AddExternalLinkModal extends Modal {
    plugin: DMSPlugin;
    link: ExternalLink;
    isEditing: boolean;
    private dropZone: HTMLElement;
    private filePreview: HTMLElement;

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

        const formContainer = contentEl.createDiv('dms-form-container');
        this.createDropZone(formContainer);
        this.createFormFields(formContainer);

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(this.isEditing ? 'Save' : 'Add')
                .setCta()
                .onClick(() => this.saveEntry()));
    }

    private createDropZone(container: HTMLElement) {
        const dropZoneContainer = container.createDiv('dms-dropzone-container');
        this.dropZone = dropZoneContainer.createDiv('dms-dropzone');
        this.dropZone.setText('Drop files here or click to select');
        this.filePreview = dropZoneContainer.createDiv('dms-file-preview');

        this.dropZone.addEventListener('click', () => this.openFileSelector());
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
                this.handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    private openFileSelector() {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = () => {
            if (input.files && input.files.length > 0) {
                this.handleFile(input.files[0]);
            }
        };
        input.click();
    }

    private async handleFile(file: File) {
        const fullPath = await this.getFullPath(file);
        
        this.link.path = fullPath;
        this.link.title = file.name.split('.').slice(0, -1).join('.');
        this.link.fileType = file.name.split('.').pop() || '';
        this.link.size = file.size;
        this.link.createdDate = file.lastModified;

        this.updateFilePreview(file);
        this.updateModalContent();
    }

    private async getFullPath(file: File): Promise<string> {
        // If the File object has a path property, use it
        if ('path' in file && typeof file.path === 'string') {
            return file.path;
        }

        // Otherwise, try to get the path from the webkitRelativePath
        if ('webkitRelativePath' in file && typeof file.webkitRelativePath === 'string' && file.webkitRelativePath) {
            return file.webkitRelativePath;
        }

        // If all else fails, prompt the user for the full path
        return new Promise((resolve) => {
            const modal = new ConfirmationModal(
                this.app,
                'Enter Full Path',
                createFragment((frag) => {
                    frag.createEl('p', { text: 'Please enter the full path for the file:' });
                    const input = frag.createEl('input', { type: 'text', value: file.name });
                    frag.createEl('br');
                    frag.createEl('small', { text: 'Example: C:/Users/YourName/Documents/file.txt' });
                    return input;
                }),
                (confirmed, input) => {
                    if (confirmed && input) {
                        resolve(input.value);
                    } else {
                        resolve(file.name); // Fallback to just the file name if user cancels or input is null
                    }
                }
            );
            modal.open();
            const input = modal.contentEl.querySelector('input');
            if (input) input.focus();
        });
    }

    private updateFilePreview(file: File) {
        this.filePreview.empty();
        const iconEl = this.filePreview.createEl('span', { cls: 'dms-file-icon' });
        iconEl.setText(this.getFileIcon(file.name));
        this.filePreview.createEl('span', { text: file.name, cls: 'dms-file-name' });
        const removeBtn = this.filePreview.createEl('span', { text: '×', cls: 'dms-remove-file' });
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.resetFile();
        });
    }

    private getFileIcon(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        // Add more file type icons as needed
        const iconMap: {[key: string]: string} = {
            pdf: '📄',
            doc: '📝',
            docx: '📝',
            xls: '📊',
            xlsx: '📊',
            ppt: '📽️',
            pptx: '📽️',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🖼️',
            txt: '📄',
        };
        return iconMap[extension] || '📁';
    }

    private resetFile() {
        this.link.path = '';
        this.link.title = '';
        this.link.fileType = '';
        this.link.size = 0;
        this.link.createdDate = Date.now();
        this.filePreview.empty();
        this.updateModalContent();
    }

    private createFormFields(container: HTMLElement) {
        this.createTitleSetting(container);
        this.createPathSetting(container);
        this.createDateSetting(container);
        this.createFileSizeSetting(container);
        this.createFileTypeSetting(container);
        this.createMultiSelectSetting(container, 'Audience', this.link.audience, this.plugin.settings.audiences);
        this.createMultiSelectSetting(container, 'Categories', this.link.categories, this.plugin.settings.categories);
        this.createTagsSetting(container);
        this.createSummarySetting(container);
        this.createNotesSetting(container);
    }

    private createTitleSetting(container: HTMLElement) {
        new Setting(container)
            .setName('Title')
            .addText(text => text
                .setPlaceholder('Enter title')
                .setValue(this.link.title)
                .onChange(value => this.link.title = value)
                .inputEl.id = 'title');
    }

    private createPathSetting(container: HTMLElement) {
        new Setting(container)
            .setName('Path')
            .setDesc('File path or URL')
            .addText(text => text
                .setPlaceholder('Enter path or URL')
                .setValue(this.link.path)
                .onChange(value => this.link.path = value)
                .inputEl.id = 'path');
    }

    private createDateSetting(container: HTMLElement) {
        new Setting(container)
            .setName('Created Date')
            .addMomentFormat(component => component
                .setDefaultFormat('YYYY-MM-DD')
                .setValue(moment(this.link.createdDate).format('YYYY-MM-DD'))
                .onChange((value: string) => {
                    const momentDate = moment(value, 'YYYY-MM-DD', true);
                    this.link.createdDate = momentDate.isValid() ? momentDate.valueOf() : Date.now();
                })
                .inputEl.id = 'createdDate');
    }

    private createFileSizeSetting(container: HTMLElement) {
        new Setting(container)
            .setName('Size (bytes)')
            .addText(text => text
                .setPlaceholder('File size')
                .setValue(this.link.size.toString())
                .onChange(value => this.link.size = parseInt(value) || 0)
                .inputEl.id = 'size');
    }

    private createFileTypeSetting(container: HTMLElement) {
        new Setting(container)
            .setName('File Type')
            .addText(text => text
                .setPlaceholder('File type')
                .setValue(this.link.fileType)
                .onChange(value => this.link.fileType = value)
                .inputEl.id = 'fileType');
    }

    private createMultiSelectSetting(container: HTMLElement, name: string, selectedItems: string[], allItems: string[]) {
        const setting = new Setting(container)
            .setName(name)
            .setDesc(`Select or create new ${name.toLowerCase()}`);

        const inputEl = setting.controlEl.createEl('input', {
            type: 'text',
            cls: 'multi-select-input',
            placeholder: `Type to add or select ${name.toLowerCase()}...`
        });

        const dropdownEl = setting.controlEl.createEl('div', { cls: 'multi-select-dropdown' });
        const selectedItemsEl = setting.controlEl.createEl('div', { cls: 'selected-items' });

        const updateDropdown = () => {
            dropdownEl.empty();
            const inputValue = inputEl.value.toLowerCase();
            let matchingItems = allItems.filter(item => 
                item.toLowerCase().includes(inputValue) && !selectedItems.includes(item)
            );

            if (name === 'Tags') {
                // Fetch existing tags from the external link service
                const existingTags = Array.from(new Set(this.plugin.externalLinkService.getTags()));
                matchingItems = [...new Set([...matchingItems, ...existingTags])];
            }

            matchingItems.forEach(item => {
                const suggestionEl = dropdownEl.createEl('div', { 
                    text: item, 
                    cls: 'multi-select-option' 
                });
                suggestionEl.onClickEvent(() => {
                    selectedItems.push(item);
                    inputEl.value = '';
                    updateSelectedItems();
                    updateDropdown();
                });
            });

            if (inputValue && !matchingItems.includes(inputValue)) {
                const newItemEl = dropdownEl.createEl('div', { 
                    text: `Add "${inputValue}" as new ${name.toLowerCase()}`, 
                    cls: 'multi-select-option new-item' 
                });
                newItemEl.onClickEvent(() => {
                    selectedItems.push(inputValue);
                    if (name === 'Tags') {
                        this.plugin.addNewTag(inputValue);
                    } else if (name === 'Categories') {
                        this.plugin.addNewCategory(inputValue);
                    } else if (name === 'Audience') {
                        this.plugin.addNewAudience(inputValue);
                    }
                    inputEl.value = '';
                    updateSelectedItems();
                    updateDropdown();
                });
            }
        };

        const updateSelectedItems = () => {
            selectedItemsEl.empty();
            selectedItems.forEach(item => {
                const itemEl = selectedItemsEl.createEl('span', { 
                    text: item, 
                    cls: 'selected-item' 
                });
                const removeBtn = itemEl.createEl('span', { 
                    text: '×', 
                    cls: 'remove' 
                });
                removeBtn.onClickEvent(() => {
                    selectedItems.remove(item);
                    updateSelectedItems();
                    updateDropdown();
                });
            });
        };

        inputEl.addEventListener('input', updateDropdown);
        inputEl.addEventListener('focus', updateDropdown);
        inputEl.addEventListener('blur', () => {
            // Delay hiding the dropdown to allow for click events
            setTimeout(() => dropdownEl.empty(), 200);
        });

        updateSelectedItems();
    }

    private createTagsSetting(container: HTMLElement) {
        const allTags = [...new Set([
            ...this.plugin.settings.tags,
            ...this.plugin.externalLinkService.getAllObsidianTags()
        ])];

        new Setting(container)
            .setName('Tags')
            .addDropdown(dropdown => dropdown
                .addOptions(Object.fromEntries(allTags.map(tag => [tag, tag])))
                .setDisabled(false)
                .onChange(value => {
                    if (!this.link.tags.includes(value)) {
                        this.link.tags.push(value);
                        this.updateModalContent();
                    }
                })
            )
            .addButton(button => button
                .setButtonText('+')
                .onClick(() => {
                    const modal = new NewItemModal(this.plugin.app, 'Add New Tag', async (newTag: string) => {
                        if (newTag && !this.link.tags.includes(newTag)) {
                            this.link.tags.push(newTag);
                            await this.plugin.addNewTag(newTag);
                            this.updateModalContent();
                        }
                    });
                    modal.open();
                })
            );

        // Display current tags
        const tagContainer = container.createEl('div', { cls: 'tag-container' });
        this.link.tags.forEach(tag => {
            const tagEl = tagContainer.createEl('span', { text: tag, cls: 'tag' });
            const removeBtn = tagEl.createEl('span', { text: '×', cls: 'remove-tag' });
            removeBtn.addEventListener('click', () => {
                this.link.tags = this.link.tags.filter(t => t !== tag);
                this.updateModalContent();
            });
        });
    }

    private createSummarySetting(container: HTMLElement) {
        new Setting(container)
            .setName('Summary')
            .addTextArea(text => text
                .setPlaceholder('Enter summary')
                .setValue(this.link.summary)
                .onChange(value => this.link.summary = value)
                .inputEl.id = 'summary');
    }

    private createNotesSetting(container: HTMLElement) {
        new Setting(container)
            .setName('Notes')
            .addTextArea(text => text
                .setPlaceholder('Enter notes')
                .setValue(this.link.notes)
                .onChange(value => this.link.notes = value)
                .inputEl.id = 'notes');
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
        this.contentEl.querySelectorAll('input, textarea, select').forEach((el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
            const field = el.id as keyof ExternalLink;
            if (field in this.link) {
                if (Array.isArray(this.link[field])) {
                    if (el instanceof HTMLSelectElement) {
                        Array.from(el.options).forEach(option => {
                            option.selected = (this.link[field] as string[]).includes(option.value);
                        });
                    }
                } else if (field === 'createdDate') {
                    if (el instanceof HTMLInputElement) {
                        el.value = moment(this.link.createdDate).format('YYYY-MM-DD');
                    }
                } else {
                    el.value = this.link[field]?.toString() || '';
                }
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class ConfirmationModal extends Modal {
    private title: string;
    private content: DocumentFragment;
    private onConfirm: (confirmed: boolean, input: HTMLInputElement | null) => void;

    constructor(app: App, title: string, content: DocumentFragment, onConfirm: (confirmed: boolean, input: HTMLInputElement | null) => void) {
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
        
        const input = contentEl.querySelector('input');

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Confirm')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onConfirm(true, input as HTMLInputElement);
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                    this.onConfirm(false, null);
                }));
    }
}

class NewItemModal extends Modal {
    onSubmit: (result: string) => void;
    inputEl: HTMLInputElement;

    constructor(app: App, title: string, onSubmit: (result: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h1", { text: "Enter new item" });
        this.inputEl = contentEl.createEl("input", { type: "text" });
        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Submit")
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(this.inputEl.value);
                    }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}