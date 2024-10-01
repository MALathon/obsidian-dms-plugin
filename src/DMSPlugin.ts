import { Plugin } from 'obsidian';
import { DMSSettings } from './types'; // Changed DMSPluginSettings to DMSSettings
import { DMSView } from './DMSView';
import { ExternalLinkService } from './ExternalLinkService';
import { DEFAULT_SETTINGS } from './constants';

export default class DMSPlugin extends Plugin {
    settings: DMSSettings; // Changed DMSPluginSettings to DMSSettings
    externalLinkService: ExternalLinkService;
    dmsView: DMSView | null = null;

    async onload() {
        // ... (rest of the implementation)
    }

    // ... (other methods)

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