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
            callback: () => this.activateDMSView(),
        });

        this.addRibbonIcon('folder', 'Open DMS View', () => this.activateDMSView());

        this.addSettingTab(new DMSSettingTab(this.app, this));

        this.registerView('dms-view', (leaf) => new DMSView(leaf, this));

        if (this.app.workspace.layoutReady) {
            this.initializeDMSView();
        } else {
            this.app.workspace.onLayoutReady(() => this.initializeDMSView());
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async initializeDMSView() {
        await this.ensureProxyNotesFolderExists();
        if (this.app.workspace.getLeavesOfType('dms-view').length === 0) {
            await this.activateDMSView();
        }
    }

    private async activateDMSView() {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType('dms-view')[0];

        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: 'dms-view', active: true });
        }

        workspace.revealLeaf(leaf);
        if (leaf.view instanceof DMSView) {
            this.dmsView = leaf.view;
        }
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

    async addNewCategory(category: string) {
        await this.externalLinkService.addNewCategory(category);
        this.updateDMSView();
    }
}