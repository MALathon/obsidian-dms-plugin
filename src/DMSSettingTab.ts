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

        containerEl.createEl('h2', { text: 'Document Management System Settings' });

        new Setting(containerEl)
            .setName('Proxy Notes Location')
            .setDesc('Specify the location for proxy notes. Leave empty to use the vault root.')
            .addText(text => text
                .setPlaceholder('/ or root')
                .setValue(this.plugin.settings.proxyNotesPath)
                .onChange(async (value) => {
                    this.plugin.settings.proxyNotesPath = value;
                    await this.plugin.saveSettings();
                    this.plugin.proxyNoteManager.updateProxyNotesPath(value);
                }));
    }
}