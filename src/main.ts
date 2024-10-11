import { Plugin, TFile, Notice, App } from 'obsidian';
import { DMSSettingsTab } from './DMSSettingsTab';
import { DMSView } from './DMSView';
import { ProxyNoteManager } from './ProxyNoteManager';
import { ExternalLinkService } from './ExternalLinkService';
import { DMSSettings, ExternalLink } from './types';
import { AddExternalLinkModal } from './AddExternalLinkModal';
import { BuildInfo } from './buildInfo';
import buildInfo from './buildInfo.json';

// Add this type declaration
declare module "obsidian" {
    interface App {
        setting: {
            open: () => void;
            openTabById: (tabId: string) => void;
        }
    }
}

const DEFAULT_SETTINGS: DMSSettings = {
    proxyNotesPath: '',
    audiences: [],
    categories: [],
    tags: []
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

        this.externalLinkService = new ExternalLinkService(this, this.settings);
        this.proxyNoteManager = new ProxyNoteManager(this.app, this.settings.proxyNotesPath, this.externalLinkService);
        await this.externalLinkService.loadExternalLinks(); // Load external links on plugin load

        this.addSettingTab(new DMSSettingsTab(this.app, this));

        this.registerView('dms-view', (leaf) => {
            this.dmsView = new DMSView(leaf, this);
            return this.dmsView;
        });

        const buildNumber = (buildInfo as BuildInfo).buildNumber;
        this.addRibbonIcon('folder', `Open DMS View (Build ${buildNumber})`, () => {
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

        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file && this.isProxyNote(file)) {
                    this.openExternalLinkFromProxyNote(file);
                }
            })
        );

        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            const target = evt.target as HTMLElement;
            if (target.tagName === 'A' && target.hasClass('internal-link')) {
                const href = target.getAttribute('href');
                if (href) {
                    const file = this.app.metadataCache.getFirstLinkpathDest(href, '');
                    if (file && this.isProxyNote(file)) {
                        evt.preventDefault();
                        this.openExternalLinkFromProxyNote(file);
                    }
                }
            }
        });
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

    isProxyNote(file: TFile): boolean {
        return file.path.startsWith(this.settings.proxyNotesPath);
    }

    async openExternalLinkFromProxyNote(file: TFile) {
        const content = await this.app.vault.read(file);
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter && frontmatter.external_path) {
            this.externalLinkService.openExternalFile(frontmatter.external_path);
        }
    }

    async saveData(data: any): Promise<void> {
        await super.saveData(data);
        console.log('Data saved:', data);
    }

    async addNewTag(tag: string) {
        if (!this.settings.tags.includes(tag)) {
            this.settings.tags.push(tag);
            await this.saveSettings();
        }
    }

    async addNewCategory(category: string) {
        if (!this.settings.categories.includes(category)) {
            this.settings.categories.push(category);
            await this.saveSettings();
        }
    }

    async addNewAudience(audience: string) {
        if (!this.settings.audiences.includes(audience)) {
            this.settings.audiences.push(audience);
            await this.saveSettings();
        }
    }

    openSettings(): void {
        // Open the settings tab
        this.app.setting.open();
        
        // Focus on our plugin's tab
        this.app.setting.openTabById('dms-plugin');
    }
}