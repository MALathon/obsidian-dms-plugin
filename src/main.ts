import { Plugin, WorkspaceLeaf, MarkdownView, Notice, PluginSettingTab, App } from 'obsidian';
import { DMSPluginSettings, ExternalLink } from './types';
import { DMSView } from './DMSView';
import { ExternalLinkService } from './ExternalLinkService';
import { DEFAULT_SETTINGS } from './constants';
import { AddExternalLinkModal } from './AddExternalLinkModal';
import { DMSSettingTab } from './DMSSettingTab';

export default class DMSPlugin extends Plugin {
    settings: DMSPluginSettings;
    externalLinkService: ExternalLinkService;
    dmsView: DMSView | null = null;

    async onload() {
        await this.loadSettings();
        this.externalLinkService = new ExternalLinkService(this, this.settings);

        this.addRibbonIcon('folder', 'DMS', () => this.activateView());
        this.addCommand({
            id: 'open-dms-view',
            name: 'Open DMS View',
            callback: () => this.activateView(),
        });

        this.registerView('dms-view', (leaf: WorkspaceLeaf) => new DMSView(leaf, this));

        this.registerMarkdownPostProcessor((el, ctx) => this.postprocessor(el, ctx));
        this.addSettingTab(new DMSSettingTab(this.app, this));

        await this.externalLinkService.loadExternalLinks();
        await this.ensureProxyNotesFolderExists();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        this.app.workspace.detachLeavesOfType('dms-view');
        await this.app.workspace.getRightLeaf(false).setViewState({
            type: 'dms-view',
            active: true,
        });
        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType('dms-view')[0]
        );
    }

    postprocessor(el: HTMLElement, ctx: any) {
        // Implementation here
    }

    async ensureProxyNotesFolderExists() {
        const folderPath = this.settings.proxyNotesFolder;
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    updateDMSView() {
        if (this.dmsView) {
            this.dmsView.updateTable();
        }
    }
}