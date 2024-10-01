import { Plugin, TFile, Notice } from 'obsidian';
import { DMSSettingTab } from './DMSSettingTab';
import { DMSView } from './DMSView';
import { ProxyNoteManager } from './ProxyNoteManager';
import { ExternalLinkService } from './ExternalLinkService';
import { DMSSettings, ExternalLink } from './types';
import { AddExternalLinkModal } from './AddExternalLinkModal';

const DEFAULT_SETTINGS: DMSSettings = {
    proxyNotesPath: ''
}

export default class DMSPlugin extends Plugin {
    settings: DMSSettings;
    proxyNoteManager: ProxyNoteManager;
    externalLinkService: ExternalLinkService;
    dmsView: DMSView;

    async onload() {
        await this.loadSettings();

        // Ensure the proxy notes folder exists
        await this.ensureProxyNotesFolder();

        this.proxyNoteManager = new ProxyNoteManager(this.app, this.settings.proxyNotesPath);
        this.externalLinkService = new ExternalLinkService(this, this.settings);

        this.addSettingTab(new DMSSettingTab(this.app, this));

        this.registerView('dms-view', (leaf) => {
            this.dmsView = new DMSView(leaf, this);
            return this.dmsView;
        });

        this.addRibbonIcon('folder', 'Open DMS View', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-dms-view',
            name: 'Open DMS View',
            callback: () => {
                this.activateView();
            }
        });

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && this.proxyNoteManager.isProxyNote(file)) {
                    this.proxyNoteManager.handleDeletedProxyNote(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                if (file instanceof TFile && this.proxyNoteManager.isProxyNote(file)) {
                    this.proxyNoteManager.handleRenamedProxyNote(file, oldPath);
                }
            })
        );

        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                if (file instanceof TFile && this.proxyNoteManager.isProxyNote(file)) {
                    this.proxyNoteManager.handleChangedProxyNote(file);
                }
            })
        );
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

    async ensureProxyNotesFolder() {
        const folderPath = this.settings.proxyNotesPath || '/';
        if (folderPath === '/') {
            // If the path is root, we don't need to create anything
            return;
        }

        try {
            const folderExists = await this.app.vault.adapter.exists(folderPath);
            if (!folderExists) {
                await this.app.vault.createFolder(folderPath);
                new Notice(`Created proxy notes folder: ${folderPath}`);
            }
        } catch (error) {
            console.error('Failed to create proxy notes folder:', error);
            new Notice('Failed to create proxy notes folder. Check the console for details.');
        }
    }

    addOrEditEntry(existingLink?: ExternalLink) {
        new AddExternalLinkModal(this, existingLink).open();
    }

    updateDMSView() {
        if (this.dmsView) {
            this.dmsView.updateTable();
        }
    }
}