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

        this.addCommand({
            id: 'open-dms-view',
            name: 'Open DMS View',
            callback: () => this.activateView(),
        });

        this.registerView('dms-view', (leaf: WorkspaceLeaf) => {
            this.dmsView = new DMSView(leaf, this);
            return this.dmsView;
        });

        this.registerMarkdownPostProcessor((el, ctx) => this.postprocessor(el, ctx));
        this.addSettingTab(new DMSSettingTab(this.app, this));

        await this.externalLinkService.loadExternalLinks();
        await this.ensureProxyNotesFolderExists();

        // Activate the view on plugin load
        this.activateView();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType('dms-view')[0];
        
        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: 'dms-view', active: true });
        }
        
        workspace.revealLeaf(leaf);
        if (this.dmsView) {
            this.dmsView.updateTable();
        }
    }

    postprocessor(el: HTMLElement, ctx: any) {
        // Implementation here
        // This method can be used to process markdown content and add custom behavior
        // For example, you could look for specific patterns and replace them with interactive elements
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

    async addNewTag(tag: string) {
        await this.externalLinkService.addNewTag(tag);
        this.updateDMSView();
    }
}