import { Modal, Setting, TextComponent, TextAreaComponent } from 'obsidian';
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
            category: '',
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
        contentEl.createEl("h2", { text: this.isEditing ? "Edit External Link" : "Add External Link" });

        new Setting(contentEl)
            .setName('Title')
            .addText(text => text
                .setValue(this.link.title)
                .onChange(value => this.link.title = value));

        new Setting(contentEl)
            .setName('Path')
            .addText(text => text
                .setValue(this.link.path)
                .onChange(value => this.link.path = value));

        new Setting(contentEl)
            .setName('Category')
            .addText(text => text
                .setValue(this.link.category)
                .onChange(value => this.link.category = value));

        new Setting(contentEl)
            .setName('Audience')
            .addText(text => text
                .setValue(this.link.audience.join(', '))
                .onChange(value => this.link.audience = value.split(',').map(item => item.trim())));

        new Setting(contentEl)
            .setName('Tags')
            .addText(text => text
                .setValue(this.link.tags.join(', '))
                .onChange(value => this.link.tags = value.split(',').map(item => item.trim())));

        new Setting(contentEl)
            .setName('Summary')
            .addTextArea(textarea => textarea
                .setValue(this.link.summary)
                .onChange(value => this.link.summary = value));

        new Setting(contentEl)
            .setName('Notes')
            .addTextArea(textarea => textarea
                .setValue(this.link.notes)
                .onChange(value => this.link.notes = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(this.isEditing ? 'Save Changes' : 'Add Link')
                .setCta()
                .onClick(() => {
                    if (this.isEditing) {
                        this.plugin.externalLinkService.editExternalLink(this.link, this.link);
                    } else {
                        this.plugin.externalLinkService.addExternalLink(this.link);
                    }
                    this.close();
                    this.plugin.updateDMSView();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}