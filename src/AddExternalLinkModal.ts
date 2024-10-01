import { Modal, Setting } from 'obsidian';
import DMSPlugin from './main';
import { ExternalLink } from './types';

export class AddExternalLinkModal extends Modal {
    plugin: DMSPlugin;
    linkIndex: number | null;
    link: ExternalLink;

    constructor(plugin: DMSPlugin, linkIndex: number | null = null) {
        super(plugin.app);
        this.plugin = plugin;
        this.linkIndex = linkIndex;
        this.link = linkIndex !== null
            ? { ...this.plugin.externalLinkService.getExternalLink(linkIndex) }
            : { title: '', path: '', category: '', audience: [], tags: [], notes: '' };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: this.linkIndex !== null ? "Edit External Link" : "Add External Link" });

        new Setting(contentEl)
            .setName('Title')
            .addText(text => text
                .setValue(this.link.title)
                .onChange(async (value) => {
                    this.link.title = value;
                }));

        new Setting(contentEl)
            .setName('Path')
            .addText(text => text
                .setValue(this.link.path)
                .onChange(async (value) => {
                    this.link.path = value;
                }));

        new Setting(contentEl)
            .setName('Category')
            .addText(text => text
                .setValue(this.link.category)
                .onChange(async (value) => {
                    this.link.category = value;
                }));

        new Setting(contentEl)
            .setName('Audience')
            .addText(text => text
                .setValue(this.link.audience.join(', '))
                .onChange(async (value) => {
                    this.link.audience = value.split(',').map(item => item.trim());
                }));

        new Setting(contentEl)
            .setName('Tags')
            .addText(text => text
                .setValue(this.link.tags.join(', '))
                .onChange(async (value) => {
                    this.link.tags = value.split(',').map(item => item.trim());
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
                        this.plugin.externalLinkService.editExternalLink(this.linkIndex, this.link);
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
        this.plugin.updateDMSView();
    }
}