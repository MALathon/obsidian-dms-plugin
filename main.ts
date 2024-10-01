import { Plugin, WorkspaceLeaf, MarkdownView, Notice } from 'obsidian';
import { DMSPluginSettings, ExternalLink } from './types';
import { DMSView } from './DMSView';
import { ExternalLinkService } from './ExternalLinkService';
import { DEFAULT_SETTINGS } from './constants';

export default class DMSPlugin extends Plugin {
    settings: DMSPluginSettings;
    externalLinkService: ExternalLinkService;
    dmsView: DMSView | null = null;

    async onload() {
        await this.loadSettings();
        this.externalLinkService = new ExternalLinkService(this.app, this.settings);

        this.addRibbonIcon('folder', 'DMS', () => this.activateView());
        this.addCommand({
            id: 'open-dms-view',
            name: 'Open DMS View',
            callback: () => this.activateView(),
        });

        this.registerView('dms-view', (leaf) => {
            this.dmsView = new DMSView(leaf, this);
            return this.dmsView;
        });

        this.registerMarkdownPostProcessor((el, ctx) => this.postprocessor(el, ctx));
        this.addSettingTab(new DMSSettingTab(this.app, this));

        await this.externalLinkService.loadExternalLinks();
        await this.ensureProxyNotesFolderExists();
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType('dms-view');
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

    async ensureProxyNotesFolderExists() {
        const folderPath = this.settings.proxyNotesFolder;
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    postprocessor(el: HTMLElement, ctx: any) {
        el.querySelectorAll('a.internal-link').forEach((link: HTMLAnchorElement) => {
            const href = link.getAttribute('href');
            if (href) {
                const externalLink = this.externalLinkService.findExternalLinkByTitle(href.replace(/^\[\[|\]\]$/g, ''));
                if (externalLink) {
                    link.addClass('dms-external-link');
                    link.setAttribute('data-href', externalLink.path);
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.externalLinkService.openExternalFile(externalLink.path);
                    });
                }
            }
        });
    }

    updateDMSView() {
        if (this.dmsView) {
            this.dmsView.updateTable();
        }
    }

    getAllTags(): string[] {
        const allTags = new Set<string>();
        this.externalLinkService.getAllExternalLinks().forEach(link => link.tags.forEach(tag => allTags.add(tag)));
        this.app.vault.getFiles().forEach(file => {
            const fileTags = this.app.metadataCache.getFileCache(file)?.tags || [];
            fileTags.forEach(tagCache => allTags.add(tagCache.tag.slice(1)));
        });
        return Array.from(allTags);
    }

    async addNewTag(tag: string) {
        await this.externalLinkService.addNewTag(tag);
        this.updateDMSView();
    }
}