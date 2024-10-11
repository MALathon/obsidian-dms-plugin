import { App, PluginSettingTab, Setting, Modal } from 'obsidian';
import DMSPlugin from './main';

export class DMSSettingsTab extends PluginSettingTab {
    plugin: DMSPlugin;

    constructor(app: App, plugin: DMSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'DMS Settings' });

        new Setting(containerEl)
            .setName('Proxy Notes Location')
            .setDesc('Specify the location for proxy notes. Leave empty to use the vault root.')
            .addText(text => text
                .setPlaceholder('/ or root')
                .setValue(this.plugin.settings.proxyNotesPath)
                .onChange(async (value) => {
                    this.plugin.settings.proxyNotesPath = value;
                    await this.plugin.saveSettings();
                    this.plugin.proxyNoteManager.updateProxyNotesPath(value)
                }));

        this.addSettingSection('Audiences', this.plugin.settings.audiences);
        this.addSettingSection('Categories', this.plugin.settings.categories);
        this.addSettingSection('Tags', this.plugin.settings.tags);
    }

    addSettingSection(name: string, items: string[]) {
        new Setting(this.containerEl)
            .setName(name)
            .setDesc(`Manage ${name.toLowerCase()}`)
            .addButton(btn => btn
                .setButtonText(`Manage ${name}`)
                .onClick(() => {
                    new ManageItemsModal(this.app, name, items, (updatedItems) => {
                        (this.plugin.settings as any)[name.toLowerCase()] = updatedItems;
                        this.plugin.saveSettings();
                    }).open();
                }));
    }
}

class ManageItemsModal extends Modal {
    items: string[];
    onSave: (items: string[]) => void;

    constructor(app: App, name: string, items: string[], onSave: (items: string[]) => void) {
        super(app);
        this.items = [...items];
        this.onSave = onSave;
    }

    onOpen() {
        // Implement the UI for managing items (add, edit, delete)
    }

    onClose() {
        this.onSave(this.items);
    }
}