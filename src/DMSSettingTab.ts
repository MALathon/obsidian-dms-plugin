import { App, PluginSettingTab, Setting } from 'obsidian';
import DMSPlugin from './main';

export class DMSSettingTab extends PluginSettingTab {
    plugin: DMSPlugin;

    constructor(app: App, plugin: DMSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'DMS Settings' });

        new Setting(containerEl)
            .setName('Proxy Notes Folder')
            .setDesc('Folder where proxy notes will be stored')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.proxyNotesFolder)
                .onChange(async (value) => {
                    this.plugin.settings.proxyNotesFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Folder')
            .setDesc('Default folder for new external links')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.defaultFolder)
                .onChange(async (value) => {
                    this.plugin.settings.defaultFolder = value;
                    await this.plugin.saveSettings();
                }));

        // Add more settings as needed
    }
}