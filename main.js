'use strict';

var obsidian = require('obsidian');
var child_process = require('child_process');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const DEFAULT_SETTINGS = {
    defaultFolder: 'DMS',
    externalLinksFile: 'external_links.json'
};
class DMSPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.externalLinks = [];
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            yield this.loadExternalLinks();
            // Initialize external links file if it doesn't exist
            yield this.initializeExternalLinksFile();
            // Add ribbon icon
            this.addRibbonIcon('link', 'DMS Menu', () => {
                new DMSMenuModal(this.app, this).open();
            });
            // Add commands
            this.addCommand({
                id: 'create-dms-note',
                name: 'Create new DMS note',
                callback: () => this.createNewNote()
            });
            this.addCommand({
                id: 'add-external-link',
                name: 'Add External Link',
                callback: () => this.addExternalLink()
            });
            this.addCommand({
                id: 'search-dms',
                name: 'Search DMS (notes and external links)',
                callback: () => this.searchDMS()
            });
            // Add settings tab
            this.addSettingTab(new DMSSettingTab(this.app, this));
        });
    }
    onunload() {
        this.saveExternalLinks().catch(console.error);
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    loadExternalLinks() {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.app.vault.getAbstractFileByPath(this.settings.externalLinksFile);
            if (file instanceof obsidian.TFile) {
                const content = yield this.app.vault.read(file);
                this.externalLinks = JSON.parse(content);
            }
        });
    }
    saveExternalLinks() {
        return __awaiter(this, void 0, void 0, function* () {
            const content = JSON.stringify(this.externalLinks, null, 2);
            yield this.app.vault.adapter.write(this.settings.externalLinksFile, content);
        });
    }
    initializeExternalLinksFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const adapter = this.app.vault.adapter;
            if (adapter instanceof obsidian.FileSystemAdapter) {
                const filePath = `${this.settings.defaultFolder}/${this.settings.externalLinksFile}`;
                const exists = yield adapter.exists(filePath);
                if (!exists) {
                    yield adapter.write(filePath, '[]');
                }
            }
        });
    }
    createNewNote() {
        return __awaiter(this, void 0, void 0, function* () {
            const date = new Date();
            const fileName = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}-untitled.md`;
            const filePath = `${this.settings.defaultFolder}/${fileName}`;
            yield this.app.vault.create(filePath, '');
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof obsidian.TFile) {
                const leaf = this.app.workspace.activeLeaf;
                if (leaf) {
                    yield leaf.openFile(file);
                }
                else {
                    new obsidian.Notice('Unable to open the new note.');
                }
            }
        });
    }
    addExternalLink() {
        new AddExternalLinkModal(this.app, (path, metadata, tags) => __awaiter(this, void 0, void 0, function* () {
            try {
                const newLink = {
                    path: path,
                    metadata: JSON.parse(metadata),
                    tags: tags.split(',').map(tag => tag.trim())
                };
                this.externalLinks.push(newLink);
                yield this.saveExternalLinks();
                new obsidian.Notice('External link added successfully');
            }
            catch (error) {
                console.error('Failed to add external link:', error);
                new obsidian.Notice('Failed to add external link. Please check your input.');
            }
        })).open();
    }
    searchDMS(query) {
        if (query) {
            // If a query is provided, perform the search
            return this.performSearch(query);
        }
        else {
            // If no query is provided, open the search modal
            new SearchDMSModal(this.app, this).open();
        }
    }
    performSearch(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const notes = this.app.vault.getMarkdownFiles().filter(file => file.path.startsWith(this.settings.defaultFolder) &&
                (file.basename.toLowerCase().includes(query.toLowerCase()) || this.noteContainsQuery(file, query)));
            const externalLinks = this.externalLinks.filter(link => link.path.toLowerCase().includes(query.toLowerCase()) ||
                Object.values(link.metadata).some(value => value.toLowerCase().includes(query.toLowerCase())) ||
                link.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())));
            return [...notes, ...externalLinks];
        });
    }
    openExternalFile(path) {
        child_process.exec(`open "${path}"`, (error) => {
            if (error) {
                console.error('Failed to open file:', error);
                new obsidian.Notice('Failed to open file');
            }
        });
    }
    getAllTags() {
        const tags = new Set();
        this.externalLinks.forEach(link => link.tags.forEach(tag => tags.add(tag)));
        return Array.from(tags);
    }
    // Add edit functionality for external links
    editExternalLink(index) {
        const link = this.externalLinks[index];
        new AddExternalLinkModal(this.app, (path, metadata, tags) => __awaiter(this, void 0, void 0, function* () {
            try {
                this.externalLinks[index] = {
                    path: path,
                    metadata: JSON.parse(metadata),
                    tags: tags.split(',').map(tag => tag.trim())
                };
                yield this.saveExternalLinks();
                new obsidian.Notice('External link updated successfully');
            }
            catch (error) {
                console.error('Failed to update external link:', error);
                new obsidian.Notice('Failed to update external link. Please check your input.');
            }
        }), link).open();
    }
    // Add delete functionality for external links
    deleteExternalLink(index) {
        return __awaiter(this, void 0, void 0, function* () {
            this.externalLinks.splice(index, 1);
            yield this.saveExternalLinks();
            new obsidian.Notice('External link deleted successfully');
        });
    }
    noteContainsQuery(file, query) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield this.app.vault.cachedRead(file);
            return content.toLowerCase().includes(query.toLowerCase());
        });
    }
}
class DMSMenuModal extends obsidian.FuzzySuggestModal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    getItems() {
        return ['Create new note', 'Add external link', 'Search DMS', 'List all notes'];
    }
    getItemText(item) {
        return item;
    }
    onChooseItem(item, evt) {
        if (item === 'Create new note') {
            this.plugin.createNewNote();
        }
        else if (item === 'Add external link') {
            this.plugin.addExternalLink();
        }
        else if (item === 'Search DMS') {
            this.plugin.searchDMS();
        }
        else if (item === 'List all notes') {
            new ListNotesModal(this.app, this.plugin).open();
        }
    }
}
class AddExternalLinkModal extends obsidian.Modal {
    constructor(app, onSubmit, existingLink) {
        super(app);
        this.onSubmit = onSubmit;
        if (existingLink) {
            this.path = existingLink.path;
            this.metadata = JSON.stringify(existingLink.metadata);
            this.tags = existingLink.tags.join(', ');
        }
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h1", { text: "Add External Link" });
        new obsidian.TextComponent(contentEl)
            .setPlaceholder("Enter the path to the external file")
            .onChange((value) => {
            this.path = value;
        });
        new obsidian.TextComponent(contentEl)
            .setPlaceholder("Enter metadata (as JSON)")
            .onChange((value) => {
            this.metadata = value;
        });
        new obsidian.TextComponent(contentEl)
            .setPlaceholder("Enter tags (comma-separated)")
            .onChange((value) => {
            this.tags = value;
        });
        contentEl.createEl("button", { text: "Add" }).addEventListener("click", () => {
            this.close();
            this.onSubmit(this.path, this.metadata, this.tags);
        });
        // Pre-fill fields if editing an existing link
        if (this.path) {
            contentEl.querySelector('input[placeholder="Enter the path to the external file"]').value = this.path;
        }
        if (this.metadata) {
            contentEl.querySelector('input[placeholder="Enter metadata (as JSON)"]').value = this.metadata;
        }
        if (this.tags) {
            contentEl.querySelector('input[placeholder="Enter tags (comma-separated)"]').value = this.tags;
        }
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
class SearchDMSModal extends obsidian.FuzzySuggestModal {
    constructor(app, plugin) {
        super(app);
        this.searchResults = [];
        this.plugin = plugin;
        this.setPlaceholder("Type to start searching...");
        // Perform initial search
        this.updateSearchResults();
        // Update search results when input changes
        this.inputEl.addEventListener("input", () => {
            this.updateSearchResults();
        });
    }
    updateSearchResults() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = this.inputEl.value;
            this.searchResults = yield this.plugin.performSearch(query);
            // Manually trigger a re-render
            this.resultContainerEl.empty();
            this.searchResults.forEach((item) => {
                this.addItem(item);
            });
        });
    }
    getItems() {
        return this.searchResults;
    }
    getItemText(item) {
        if (item instanceof obsidian.TFile) {
            return `Note: ${item.basename}`;
        }
        else {
            return `External: ${item.path}`;
        }
    }
    onChooseItem(item, evt) {
        if (item instanceof obsidian.TFile) {
            const leaf = this.app.workspace.activeLeaf;
            if (leaf) {
                leaf.openFile(item);
            }
            else {
                new obsidian.Notice('Unable to open the file.');
            }
        }
        else {
            this.plugin.openExternalFile(item.path);
        }
    }
    addItem(item) {
        const itemDiv = this.resultContainerEl.createDiv("suggestion-item");
        itemDiv.setText(this.getItemText(item));
        itemDiv.addEventListener("click", (event) => {
            this.onChooseItem(item, event);
            this.close();
        });
    }
}
class ListNotesModal extends obsidian.FuzzySuggestModal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    getItems() {
        return this.app.vault.getFiles().filter(file => file.path.startsWith(this.plugin.settings.defaultFolder));
    }
    getItemText(item) {
        return item.basename;
    }
    onChooseItem(item, evt) {
        const leaf = this.app.workspace.activeLeaf;
        if (leaf) {
            leaf.openFile(item);
        }
        else {
            new obsidian.Notice('Unable to open the file.');
        }
    }
}
class DMSSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'DMS Plugin Settings' });
        new obsidian.Setting(containerEl)
            .setName('Default folder')
            .setDesc('The folder where new DMS notes will be created')
            .addText(text => text
            .setPlaceholder('Enter folder name')
            .setValue(this.plugin.settings.defaultFolder)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.defaultFolder = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('External links file')
            .setDesc('The file where external links will be stored')
            .addText(text => text
            .setPlaceholder('Enter file name')
            .setValue(this.plugin.settings.externalLinksFile)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.externalLinksFile = value;
            yield this.plugin.saveSettings();
        })));
    }
}

module.exports = DMSPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIm1haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlLCBTdXBwcmVzc2VkRXJyb3IsIFN5bWJvbCwgSXRlcmF0b3IgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXNEZWNvcmF0ZShjdG9yLCBkZXNjcmlwdG9ySW4sIGRlY29yYXRvcnMsIGNvbnRleHRJbiwgaW5pdGlhbGl6ZXJzLCBleHRyYUluaXRpYWxpemVycykge1xyXG4gICAgZnVuY3Rpb24gYWNjZXB0KGYpIHsgaWYgKGYgIT09IHZvaWQgMCAmJiB0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRnVuY3Rpb24gZXhwZWN0ZWRcIik7IHJldHVybiBmOyB9XHJcbiAgICB2YXIga2luZCA9IGNvbnRleHRJbi5raW5kLCBrZXkgPSBraW5kID09PSBcImdldHRlclwiID8gXCJnZXRcIiA6IGtpbmQgPT09IFwic2V0dGVyXCIgPyBcInNldFwiIDogXCJ2YWx1ZVwiO1xyXG4gICAgdmFyIHRhcmdldCA9ICFkZXNjcmlwdG9ySW4gJiYgY3RvciA/IGNvbnRleHRJbltcInN0YXRpY1wiXSA/IGN0b3IgOiBjdG9yLnByb3RvdHlwZSA6IG51bGw7XHJcbiAgICB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JJbiB8fCAodGFyZ2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGNvbnRleHRJbi5uYW1lKSA6IHt9KTtcclxuICAgIHZhciBfLCBkb25lID0gZmFsc2U7XHJcbiAgICBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4pIGNvbnRleHRbcF0gPSBwID09PSBcImFjY2Vzc1wiID8ge30gOiBjb250ZXh0SW5bcF07XHJcbiAgICAgICAgZm9yICh2YXIgcCBpbiBjb250ZXh0SW4uYWNjZXNzKSBjb250ZXh0LmFjY2Vzc1twXSA9IGNvbnRleHRJbi5hY2Nlc3NbcF07XHJcbiAgICAgICAgY29udGV4dC5hZGRJbml0aWFsaXplciA9IGZ1bmN0aW9uIChmKSB7IGlmIChkb25lKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGFkZCBpbml0aWFsaXplcnMgYWZ0ZXIgZGVjb3JhdGlvbiBoYXMgY29tcGxldGVkXCIpOyBleHRyYUluaXRpYWxpemVycy5wdXNoKGFjY2VwdChmIHx8IG51bGwpKTsgfTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gKDAsIGRlY29yYXRvcnNbaV0pKGtpbmQgPT09IFwiYWNjZXNzb3JcIiA/IHsgZ2V0OiBkZXNjcmlwdG9yLmdldCwgc2V0OiBkZXNjcmlwdG9yLnNldCB9IDogZGVzY3JpcHRvcltrZXldLCBjb250ZXh0KTtcclxuICAgICAgICBpZiAoa2luZCA9PT0gXCJhY2Nlc3NvclwiKSB7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IHZvaWQgMCkgY29udGludWU7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCAhPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZFwiKTtcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmdldCkpIGRlc2NyaXB0b3IuZ2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LnNldCkpIGRlc2NyaXB0b3Iuc2V0ID0gXztcclxuICAgICAgICAgICAgaWYgKF8gPSBhY2NlcHQocmVzdWx0LmluaXQpKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoXyA9IGFjY2VwdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgIGlmIChraW5kID09PSBcImZpZWxkXCIpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgICAgICBlbHNlIGRlc2NyaXB0b3Jba2V5XSA9IF87XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRhcmdldCkgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgY29udGV4dEluLm5hbWUsIGRlc2NyaXB0b3IpO1xyXG4gICAgZG9uZSA9IHRydWU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19ydW5Jbml0aWFsaXplcnModGhpc0FyZywgaW5pdGlhbGl6ZXJzLCB2YWx1ZSkge1xyXG4gICAgdmFyIHVzZVZhbHVlID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluaXRpYWxpemVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhbHVlID0gdXNlVmFsdWUgPyBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnLCB2YWx1ZSkgOiBpbml0aWFsaXplcnNbaV0uY2FsbCh0aGlzQXJnKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1c2VWYWx1ZSA/IHZhbHVlIDogdm9pZCAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcHJvcEtleSh4KSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHggPT09IFwic3ltYm9sXCIgPyB4IDogXCJcIi5jb25jYXQoeCk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zZXRGdW5jdGlvbk5hbWUoZiwgbmFtZSwgcHJlZml4KSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3ltYm9sXCIpIG5hbWUgPSBuYW1lLmRlc2NyaXB0aW9uID8gXCJbXCIuY29uY2F0KG5hbWUuZGVzY3JpcHRpb24sIFwiXVwiKSA6IFwiXCI7XHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGYsIFwibmFtZVwiLCB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgdmFsdWU6IHByZWZpeCA/IFwiXCIuY29uY2F0KHByZWZpeCwgXCIgXCIsIG5hbWUpIDogbmFtZSB9KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGcgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEl0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpO1xyXG4gICAgcmV0dXJuIGcubmV4dCA9IHZlcmIoMCksIGdbXCJ0aHJvd1wiXSA9IHZlcmIoMSksIGdbXCJyZXR1cm5cIl0gPSB2ZXJiKDIpLCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBBc3luY0l0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBBc3luY0l0ZXJhdG9yIDogT2JqZWN0KS5wcm90b3R5cGUpLCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIsIGF3YWl0UmV0dXJuKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gYXdhaXRSZXR1cm4oZikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGYsIHJlamVjdCk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpZiAoZ1tuXSkgeyBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyBpZiAoZikgaVtuXSA9IGYoaVtuXSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IGZhbHNlIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrIGluIG1vZCkgaWYgKGsgIT09IFwiZGVmYXVsdFwiICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtb2QsIGspKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGspO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRTZXQocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEluKHN0YXRlLCByZWNlaXZlcikge1xyXG4gICAgaWYgKHJlY2VpdmVyID09PSBudWxsIHx8ICh0eXBlb2YgcmVjZWl2ZXIgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHJlY2VpdmVyICE9PSBcImZ1bmN0aW9uXCIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSAnaW4nIG9wZXJhdG9yIG9uIG5vbi1vYmplY3RcIik7XHJcbiAgICByZXR1cm4gdHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciA9PT0gc3RhdGUgOiBzdGF0ZS5oYXMocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hZGREaXNwb3NhYmxlUmVzb3VyY2UoZW52LCB2YWx1ZSwgYXN5bmMpIHtcclxuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZSAhPT0gdm9pZCAwKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZC5cIik7XHJcbiAgICAgICAgdmFyIGRpc3Bvc2UsIGlubmVyO1xyXG4gICAgICAgIGlmIChhc3luYykge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5hc3luY0Rpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNEaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5hc3luY0Rpc3Bvc2VdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGlzcG9zZSA9PT0gdm9pZCAwKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmRpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuZGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuZGlzcG9zZV07XHJcbiAgICAgICAgICAgIGlmIChhc3luYykgaW5uZXIgPSBkaXNwb3NlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIGRpc3Bvc2UgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBub3QgZGlzcG9zYWJsZS5cIik7XHJcbiAgICAgICAgaWYgKGlubmVyKSBkaXNwb3NlID0gZnVuY3Rpb24oKSB7IHRyeSB7IGlubmVyLmNhbGwodGhpcyk7IH0gY2F0Y2ggKGUpIHsgcmV0dXJuIFByb21pc2UucmVqZWN0KGUpOyB9IH07XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyB2YWx1ZTogdmFsdWUsIGRpc3Bvc2U6IGRpc3Bvc2UsIGFzeW5jOiBhc3luYyB9KTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyBhc3luYzogdHJ1ZSB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB2YWx1ZTtcclxuXHJcbn1cclxuXHJcbnZhciBfU3VwcHJlc3NlZEVycm9yID0gdHlwZW9mIFN1cHByZXNzZWRFcnJvciA9PT0gXCJmdW5jdGlvblwiID8gU3VwcHJlc3NlZEVycm9yIDogZnVuY3Rpb24gKGVycm9yLCBzdXBwcmVzc2VkLCBtZXNzYWdlKSB7XHJcbiAgICB2YXIgZSA9IG5ldyBFcnJvcihtZXNzYWdlKTtcclxuICAgIHJldHVybiBlLm5hbWUgPSBcIlN1cHByZXNzZWRFcnJvclwiLCBlLmVycm9yID0gZXJyb3IsIGUuc3VwcHJlc3NlZCA9IHN1cHByZXNzZWQsIGU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kaXNwb3NlUmVzb3VyY2VzKGVudikge1xyXG4gICAgZnVuY3Rpb24gZmFpbChlKSB7XHJcbiAgICAgICAgZW52LmVycm9yID0gZW52Lmhhc0Vycm9yID8gbmV3IF9TdXBwcmVzc2VkRXJyb3IoZSwgZW52LmVycm9yLCBcIkFuIGVycm9yIHdhcyBzdXBwcmVzc2VkIGR1cmluZyBkaXNwb3NhbC5cIikgOiBlO1xyXG4gICAgICAgIGVudi5oYXNFcnJvciA9IHRydWU7XHJcbiAgICB9XHJcbiAgICB2YXIgciwgcyA9IDA7XHJcbiAgICBmdW5jdGlvbiBuZXh0KCkge1xyXG4gICAgICAgIHdoaWxlIChyID0gZW52LnN0YWNrLnBvcCgpKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXIuYXN5bmMgJiYgcyA9PT0gMSkgcmV0dXJuIHMgPSAwLCBlbnYuc3RhY2sucHVzaChyKSwgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihuZXh0KTtcclxuICAgICAgICAgICAgICAgIGlmIChyLmRpc3Bvc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gci5kaXNwb3NlLmNhbGwoci52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHIuYXN5bmMpIHJldHVybiBzIHw9IDIsIFByb21pc2UucmVzb2x2ZShyZXN1bHQpLnRoZW4obmV4dCwgZnVuY3Rpb24oZSkgeyBmYWlsKGUpOyByZXR1cm4gbmV4dCgpOyB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgcyB8PSAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICBmYWlsKGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzID09PSAxKSByZXR1cm4gZW52Lmhhc0Vycm9yID8gUHJvbWlzZS5yZWplY3QoZW52LmVycm9yKSA6IFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgIGlmIChlbnYuaGFzRXJyb3IpIHRocm93IGVudi5lcnJvcjtcclxuICAgIH1cclxuICAgIHJldHVybiBuZXh0KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fbWV0YWRhdGE6IF9fbWV0YWRhdGEsXHJcbiAgICBfX2F3YWl0ZXI6IF9fYXdhaXRlcixcclxuICAgIF9fZ2VuZXJhdG9yOiBfX2dlbmVyYXRvcixcclxuICAgIF9fY3JlYXRlQmluZGluZzogX19jcmVhdGVCaW5kaW5nLFxyXG4gICAgX19leHBvcnRTdGFyOiBfX2V4cG9ydFN0YXIsXHJcbiAgICBfX3ZhbHVlczogX192YWx1ZXMsXHJcbiAgICBfX3JlYWQ6IF9fcmVhZCxcclxuICAgIF9fc3ByZWFkOiBfX3NwcmVhZCxcclxuICAgIF9fc3ByZWFkQXJyYXlzOiBfX3NwcmVhZEFycmF5cyxcclxuICAgIF9fc3ByZWFkQXJyYXk6IF9fc3ByZWFkQXJyYXksXHJcbiAgICBfX2F3YWl0OiBfX2F3YWl0LFxyXG4gICAgX19hc3luY0dlbmVyYXRvcjogX19hc3luY0dlbmVyYXRvcixcclxuICAgIF9fYXN5bmNEZWxlZ2F0b3I6IF9fYXN5bmNEZWxlZ2F0b3IsXHJcbiAgICBfX2FzeW5jVmFsdWVzOiBfX2FzeW5jVmFsdWVzLFxyXG4gICAgX19tYWtlVGVtcGxhdGVPYmplY3Q6IF9fbWFrZVRlbXBsYXRlT2JqZWN0LFxyXG4gICAgX19pbXBvcnRTdGFyOiBfX2ltcG9ydFN0YXIsXHJcbiAgICBfX2ltcG9ydERlZmF1bHQ6IF9faW1wb3J0RGVmYXVsdCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRHZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEluOiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4sXHJcbiAgICBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZTogX19hZGREaXNwb3NhYmxlUmVzb3VyY2UsXHJcbiAgICBfX2Rpc3Bvc2VSZXNvdXJjZXM6IF9fZGlzcG9zZVJlc291cmNlcyxcclxufTtcclxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW4sIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIFRGaWxlLCBOb3RpY2UsIE1vZGFsLCBUZXh0Q29tcG9uZW50LCBGdXp6eVN1Z2dlc3RNb2RhbCwgVEZvbGRlciwgRmlsZVN5c3RlbUFkYXB0ZXIgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gcmVxdWlyZShtb2R1bGU6IHN0cmluZyk6IGFueTtcblxuaW50ZXJmYWNlIERNU1BsdWdpblNldHRpbmdzIHtcbiAgICBkZWZhdWx0Rm9sZGVyOiBzdHJpbmc7XG4gICAgZXh0ZXJuYWxMaW5rc0ZpbGU6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEV4dGVybmFsTGluayB7XG4gICAgcGF0aDogc3RyaW5nO1xuICAgIG1ldGFkYXRhOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuICAgIHRhZ3M6IHN0cmluZ1tdO1xufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBETVNQbHVnaW5TZXR0aW5ncyA9IHtcbiAgICBkZWZhdWx0Rm9sZGVyOiAnRE1TJyxcbiAgICBleHRlcm5hbExpbmtzRmlsZTogJ2V4dGVybmFsX2xpbmtzLmpzb24nXG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERNU1BsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gICAgc2V0dGluZ3M6IERNU1BsdWdpblNldHRpbmdzO1xuICAgIGV4dGVybmFsTGlua3M6IEV4dGVybmFsTGlua1tdID0gW107XG5cbiAgICBhc3luYyBvbmxvYWQoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgICAgIGF3YWl0IHRoaXMubG9hZEV4dGVybmFsTGlua3MoKTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIGV4dGVybmFsIGxpbmtzIGZpbGUgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVFeHRlcm5hbExpbmtzRmlsZSgpO1xuXG4gICAgICAgIC8vIEFkZCByaWJib24gaWNvblxuICAgICAgICB0aGlzLmFkZFJpYmJvbkljb24oJ2xpbmsnLCAnRE1TIE1lbnUnLCAoKSA9PiB7XG4gICAgICAgICAgICBuZXcgRE1TTWVudU1vZGFsKHRoaXMuYXBwLCB0aGlzKS5vcGVuKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBjb21tYW5kc1xuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgICAgICAgaWQ6ICdjcmVhdGUtZG1zLW5vdGUnLFxuICAgICAgICAgICAgbmFtZTogJ0NyZWF0ZSBuZXcgRE1TIG5vdGUnLFxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMuY3JlYXRlTmV3Tm90ZSgpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICAgICAgICBpZDogJ2FkZC1leHRlcm5hbC1saW5rJyxcbiAgICAgICAgICAgIG5hbWU6ICdBZGQgRXh0ZXJuYWwgTGluaycsXG4gICAgICAgICAgICBjYWxsYmFjazogKCkgPT4gdGhpcy5hZGRFeHRlcm5hbExpbmsoKVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgICAgICAgaWQ6ICdzZWFyY2gtZG1zJyxcbiAgICAgICAgICAgIG5hbWU6ICdTZWFyY2ggRE1TIChub3RlcyBhbmQgZXh0ZXJuYWwgbGlua3MpJyxcbiAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiB0aGlzLnNlYXJjaERNUygpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBzZXR0aW5ncyB0YWJcbiAgICAgICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBETVNTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgfVxuXG4gICAgb251bmxvYWQoKSB7XG4gICAgICAgIHRoaXMuc2F2ZUV4dGVybmFsTGlua3MoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICB9XG5cbiAgICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICAgIH1cblxuICAgIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgICB9XG5cbiAgICBhc3luYyBsb2FkRXh0ZXJuYWxMaW5rcygpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh0aGlzLnNldHRpbmdzLmV4dGVybmFsTGlua3NGaWxlKTtcbiAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgICAgICB0aGlzLmV4dGVybmFsTGlua3MgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc2F2ZUV4dGVybmFsTGlua3MoKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeSh0aGlzLmV4dGVybmFsTGlua3MsIG51bGwsIDIpO1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKHRoaXMuc2V0dGluZ3MuZXh0ZXJuYWxMaW5rc0ZpbGUsIGNvbnRlbnQpO1xuICAgIH1cblxuICAgIGFzeW5jIGluaXRpYWxpemVFeHRlcm5hbExpbmtzRmlsZSgpIHtcbiAgICAgICAgY29uc3QgYWRhcHRlciA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXI7XG4gICAgICAgIGlmIChhZGFwdGVyIGluc3RhbmNlb2YgRmlsZVN5c3RlbUFkYXB0ZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gYCR7dGhpcy5zZXR0aW5ncy5kZWZhdWx0Rm9sZGVyfS8ke3RoaXMuc2V0dGluZ3MuZXh0ZXJuYWxMaW5rc0ZpbGV9YDtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGZpbGVQYXRoKTtcbiAgICAgICAgICAgIGlmICghZXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgYWRhcHRlci53cml0ZShmaWxlUGF0aCwgJ1tdJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBjcmVhdGVOZXdOb3RlKCkge1xuICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoKTtcbiAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBgJHtkYXRlLmdldEZ1bGxZZWFyKCl9JHsoZGF0ZS5nZXRNb250aCgpKzEpLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgJzAnKX0ke2RhdGUuZ2V0RGF0ZSgpLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgJzAnKX0tJHtkYXRlLmdldEhvdXJzKCkudG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpfSR7ZGF0ZS5nZXRNaW51dGVzKCkudG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpfSR7ZGF0ZS5nZXRTZWNvbmRzKCkudG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpfS11bnRpdGxlZC5tZGA7XG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gYCR7dGhpcy5zZXR0aW5ncy5kZWZhdWx0Rm9sZGVyfS8ke2ZpbGVOYW1lfWA7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUoZmlsZVBhdGgsICcnKTtcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG4gICAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZjtcbiAgICAgICAgICAgIGlmIChsZWFmKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgbGVhZi5vcGVuRmlsZShmaWxlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnVW5hYmxlIHRvIG9wZW4gdGhlIG5ldyBub3RlLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkRXh0ZXJuYWxMaW5rKCkge1xuICAgICAgICBuZXcgQWRkRXh0ZXJuYWxMaW5rTW9kYWwodGhpcy5hcHAsIGFzeW5jIChwYXRoLCBtZXRhZGF0YSwgdGFncykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdMaW5rOiBFeHRlcm5hbExpbmsgPSB7XG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IHBhdGgsXG4gICAgICAgICAgICAgICAgICAgIG1ldGFkYXRhOiBKU09OLnBhcnNlKG1ldGFkYXRhKSxcbiAgICAgICAgICAgICAgICAgICAgdGFnczogdGFncy5zcGxpdCgnLCcpLm1hcCh0YWcgPT4gdGFnLnRyaW0oKSlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHRoaXMuZXh0ZXJuYWxMaW5rcy5wdXNoKG5ld0xpbmspO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZUV4dGVybmFsTGlua3MoKTtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdFeHRlcm5hbCBsaW5rIGFkZGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gYWRkIGV4dGVybmFsIGxpbms6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBhZGQgZXh0ZXJuYWwgbGluay4gUGxlYXNlIGNoZWNrIHlvdXIgaW5wdXQuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLm9wZW4oKTtcbiAgICB9XG5cbiAgICBzZWFyY2hETVMocXVlcnk/OiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICAvLyBJZiBhIHF1ZXJ5IGlzIHByb3ZpZGVkLCBwZXJmb3JtIHRoZSBzZWFyY2hcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBlcmZvcm1TZWFyY2gocXVlcnkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSWYgbm8gcXVlcnkgaXMgcHJvdmlkZWQsIG9wZW4gdGhlIHNlYXJjaCBtb2RhbFxuICAgICAgICAgICAgbmV3IFNlYXJjaERNU01vZGFsKHRoaXMuYXBwLCB0aGlzKS5vcGVuKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBwZXJmb3JtU2VhcmNoKHF1ZXJ5OiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgbm90ZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkuZmlsdGVyKGZpbGUgPT4gXG4gICAgICAgICAgICBmaWxlLnBhdGguc3RhcnRzV2l0aCh0aGlzLnNldHRpbmdzLmRlZmF1bHRGb2xkZXIpICYmXG4gICAgICAgICAgICAoZmlsZS5iYXNlbmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHF1ZXJ5LnRvTG93ZXJDYXNlKCkpIHx8IHRoaXMubm90ZUNvbnRhaW5zUXVlcnkoZmlsZSwgcXVlcnkpKVxuICAgICAgICApO1xuICAgICAgICBjb25zdCBleHRlcm5hbExpbmtzID0gdGhpcy5leHRlcm5hbExpbmtzLmZpbHRlcihsaW5rID0+IFxuICAgICAgICAgICAgbGluay5wYXRoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocXVlcnkudG9Mb3dlckNhc2UoKSkgfHxcbiAgICAgICAgICAgIE9iamVjdC52YWx1ZXMobGluay5tZXRhZGF0YSkuc29tZSh2YWx1ZSA9PiB2YWx1ZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHF1ZXJ5LnRvTG93ZXJDYXNlKCkpKSB8fFxuICAgICAgICAgICAgbGluay50YWdzLnNvbWUodGFnID0+IHRhZy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHF1ZXJ5LnRvTG93ZXJDYXNlKCkpKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gWy4uLm5vdGVzLCAuLi5leHRlcm5hbExpbmtzXTtcbiAgICB9XG5cbiAgICBvcGVuRXh0ZXJuYWxGaWxlKHBhdGg6IHN0cmluZykge1xuICAgICAgICBleGVjKGBvcGVuIFwiJHtwYXRofVwiYCwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gb3BlbiBmaWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdGYWlsZWQgdG8gb3BlbiBmaWxlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldEFsbFRhZ3MoKTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCB0YWdzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIHRoaXMuZXh0ZXJuYWxMaW5rcy5mb3JFYWNoKGxpbmsgPT4gbGluay50YWdzLmZvckVhY2godGFnID0+IHRhZ3MuYWRkKHRhZykpKTtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20odGFncyk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGVkaXQgZnVuY3Rpb25hbGl0eSBmb3IgZXh0ZXJuYWwgbGlua3NcbiAgICBlZGl0RXh0ZXJuYWxMaW5rKGluZGV4OiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgbGluayA9IHRoaXMuZXh0ZXJuYWxMaW5rc1tpbmRleF07XG4gICAgICAgIG5ldyBBZGRFeHRlcm5hbExpbmtNb2RhbCh0aGlzLmFwcCwgYXN5bmMgKHBhdGgsIG1ldGFkYXRhLCB0YWdzKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXh0ZXJuYWxMaW5rc1tpbmRleF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IHBhdGgsXG4gICAgICAgICAgICAgICAgICAgIG1ldGFkYXRhOiBKU09OLnBhcnNlKG1ldGFkYXRhKSxcbiAgICAgICAgICAgICAgICAgICAgdGFnczogdGFncy5zcGxpdCgnLCcpLm1hcCh0YWcgPT4gdGFnLnRyaW0oKSlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZUV4dGVybmFsTGlua3MoKTtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdFeHRlcm5hbCBsaW5rIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgZXh0ZXJuYWwgbGluazonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnRmFpbGVkIHRvIHVwZGF0ZSBleHRlcm5hbCBsaW5rLiBQbGVhc2UgY2hlY2sgeW91ciBpbnB1dC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgbGluaykub3BlbigpO1xuICAgIH1cblxuICAgIC8vIEFkZCBkZWxldGUgZnVuY3Rpb25hbGl0eSBmb3IgZXh0ZXJuYWwgbGlua3NcbiAgICBhc3luYyBkZWxldGVFeHRlcm5hbExpbmsoaW5kZXg6IG51bWJlcikge1xuICAgICAgICB0aGlzLmV4dGVybmFsTGlua3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRXh0ZXJuYWxMaW5rcygpO1xuICAgICAgICBuZXcgTm90aWNlKCdFeHRlcm5hbCBsaW5rIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgfVxuXG4gICAgYXN5bmMgbm90ZUNvbnRhaW5zUXVlcnkoZmlsZTogVEZpbGUsIHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XG4gICAgICAgIHJldHVybiBjb250ZW50LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocXVlcnkudG9Mb3dlckNhc2UoKSk7XG4gICAgfVxufVxuXG5jbGFzcyBETVNNZW51TW9kYWwgZXh0ZW5kcyBGdXp6eVN1Z2dlc3RNb2RhbDxzdHJpbmc+IHtcbiAgICBwbHVnaW46IERNU1BsdWdpbjtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IERNU1BsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB9XG5cbiAgICBnZXRJdGVtcygpOiBzdHJpbmdbXSB7XG4gICAgICAgIHJldHVybiBbJ0NyZWF0ZSBuZXcgbm90ZScsICdBZGQgZXh0ZXJuYWwgbGluaycsICdTZWFyY2ggRE1TJywgJ0xpc3QgYWxsIG5vdGVzJ107XG4gICAgfVxuXG4gICAgZ2V0SXRlbVRleHQoaXRlbTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuXG4gICAgb25DaG9vc2VJdGVtKGl0ZW06IHN0cmluZywgZXZ0OiBNb3VzZUV2ZW50IHwgS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICBpZiAoaXRlbSA9PT0gJ0NyZWF0ZSBuZXcgbm90ZScpIHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmNyZWF0ZU5ld05vdGUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtID09PSAnQWRkIGV4dGVybmFsIGxpbmsnKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hZGRFeHRlcm5hbExpbmsoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtID09PSAnU2VhcmNoIERNUycpIHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNlYXJjaERNUygpO1xuICAgICAgICB9IGVsc2UgaWYgKGl0ZW0gPT09ICdMaXN0IGFsbCBub3RlcycpIHtcbiAgICAgICAgICAgIG5ldyBMaXN0Tm90ZXNNb2RhbCh0aGlzLmFwcCwgdGhpcy5wbHVnaW4pLm9wZW4oKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgQWRkRXh0ZXJuYWxMaW5rTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gICAgcGF0aDogc3RyaW5nO1xuICAgIG1ldGFkYXRhOiBzdHJpbmc7XG4gICAgdGFnczogc3RyaW5nO1xuICAgIG9uU3VibWl0OiAocGF0aDogc3RyaW5nLCBtZXRhZGF0YTogc3RyaW5nLCB0YWdzOiBzdHJpbmcpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgb25TdWJtaXQ6IChwYXRoOiBzdHJpbmcsIG1ldGFkYXRhOiBzdHJpbmcsIHRhZ3M6IHN0cmluZykgPT4gdm9pZCwgZXhpc3RpbmdMaW5rPzogRXh0ZXJuYWxMaW5rKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG4gICAgICAgIHRoaXMub25TdWJtaXQgPSBvblN1Ym1pdDtcbiAgICAgICAgaWYgKGV4aXN0aW5nTGluaykge1xuICAgICAgICAgICAgdGhpcy5wYXRoID0gZXhpc3RpbmdMaW5rLnBhdGg7XG4gICAgICAgICAgICB0aGlzLm1ldGFkYXRhID0gSlNPTi5zdHJpbmdpZnkoZXhpc3RpbmdMaW5rLm1ldGFkYXRhKTtcbiAgICAgICAgICAgIHRoaXMudGFncyA9IGV4aXN0aW5nTGluay50YWdzLmpvaW4oJywgJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbk9wZW4oKSB7XG4gICAgICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXG4gICAgICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcImgxXCIsIHsgdGV4dDogXCJBZGQgRXh0ZXJuYWwgTGlua1wiIH0pO1xuXG4gICAgICAgIG5ldyBUZXh0Q29tcG9uZW50KGNvbnRlbnRFbClcbiAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkVudGVyIHRoZSBwYXRoIHRvIHRoZSBleHRlcm5hbCBmaWxlXCIpXG4gICAgICAgICAgICAub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXRoID0gdmFsdWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGV4dENvbXBvbmVudChjb250ZW50RWwpXG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJFbnRlciBtZXRhZGF0YSAoYXMgSlNPTilcIilcbiAgICAgICAgICAgIC5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm1ldGFkYXRhID0gdmFsdWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGV4dENvbXBvbmVudChjb250ZW50RWwpXG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJFbnRlciB0YWdzIChjb21tYS1zZXBhcmF0ZWQpXCIpXG4gICAgICAgICAgICAub25DaGFuZ2UoKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy50YWdzID0gdmFsdWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkFkZFwiIH0pLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLm9uU3VibWl0KHRoaXMucGF0aCwgdGhpcy5tZXRhZGF0YSwgdGhpcy50YWdzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUHJlLWZpbGwgZmllbGRzIGlmIGVkaXRpbmcgYW4gZXhpc3RpbmcgbGlua1xuICAgICAgICBpZiAodGhpcy5wYXRoKSB7XG4gICAgICAgICAgICAoY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W3BsYWNlaG9sZGVyPVwiRW50ZXIgdGhlIHBhdGggdG8gdGhlIGV4dGVybmFsIGZpbGVcIl0nKSBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSA9IHRoaXMucGF0aDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5tZXRhZGF0YSkge1xuICAgICAgICAgICAgKGNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtwbGFjZWhvbGRlcj1cIkVudGVyIG1ldGFkYXRhIChhcyBKU09OKVwiXScpIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlID0gdGhpcy5tZXRhZGF0YTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy50YWdzKSB7XG4gICAgICAgICAgICAoY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W3BsYWNlaG9sZGVyPVwiRW50ZXIgdGFncyAoY29tbWEtc2VwYXJhdGVkKVwiXScpIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlID0gdGhpcy50YWdzO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25DbG9zZSgpIHtcbiAgICAgICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIH1cbn1cblxuY2xhc3MgU2VhcmNoRE1TTW9kYWwgZXh0ZW5kcyBGdXp6eVN1Z2dlc3RNb2RhbDxURmlsZSB8IEV4dGVybmFsTGluaz4ge1xuICAgIHBsdWdpbjogRE1TUGx1Z2luO1xuICAgIHNlYXJjaFJlc3VsdHM6IChURmlsZSB8IEV4dGVybmFsTGluaylbXSA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogRE1TUGx1Z2luKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgICAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiVHlwZSB0byBzdGFydCBzZWFyY2hpbmcuLi5cIik7XG4gICAgICAgIFxuICAgICAgICAvLyBQZXJmb3JtIGluaXRpYWwgc2VhcmNoXG4gICAgICAgIHRoaXMudXBkYXRlU2VhcmNoUmVzdWx0cygpO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBzZWFyY2ggcmVzdWx0cyB3aGVuIGlucHV0IGNoYW5nZXNcbiAgICAgICAgdGhpcy5pbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNlYXJjaFJlc3VsdHMoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXN5bmMgdXBkYXRlU2VhcmNoUmVzdWx0cygpIHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLmlucHV0RWwudmFsdWU7XG4gICAgICAgIHRoaXMuc2VhcmNoUmVzdWx0cyA9IGF3YWl0IHRoaXMucGx1Z2luLnBlcmZvcm1TZWFyY2gocXVlcnkpO1xuICAgICAgICAvLyBNYW51YWxseSB0cmlnZ2VyIGEgcmUtcmVuZGVyXG4gICAgICAgIHRoaXMucmVzdWx0Q29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICAgICAgdGhpcy5zZWFyY2hSZXN1bHRzLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIHRoaXMuYWRkSXRlbShpdGVtKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0SXRlbXMoKTogKFRGaWxlIHwgRXh0ZXJuYWxMaW5rKVtdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VhcmNoUmVzdWx0cztcbiAgICB9XG5cbiAgICBnZXRJdGVtVGV4dChpdGVtOiBURmlsZSB8IEV4dGVybmFsTGluayk6IHN0cmluZyB7XG4gICAgICAgIGlmIChpdGVtIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgICAgIHJldHVybiBgTm90ZTogJHtpdGVtLmJhc2VuYW1lfWA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYEV4dGVybmFsOiAke2l0ZW0ucGF0aH1gO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25DaG9vc2VJdGVtKGl0ZW06IFRGaWxlIHwgRXh0ZXJuYWxMaW5rLCBldnQ6IE1vdXNlRXZlbnQgfCBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIGlmIChpdGVtIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZjtcbiAgICAgICAgICAgIGlmIChsZWFmKSB7XG4gICAgICAgICAgICAgICAgbGVhZi5vcGVuRmlsZShpdGVtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnVW5hYmxlIHRvIG9wZW4gdGhlIGZpbGUuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5vcGVuRXh0ZXJuYWxGaWxlKGl0ZW0ucGF0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRJdGVtKGl0ZW06IFRGaWxlIHwgRXh0ZXJuYWxMaW5rKSB7XG4gICAgICAgIGNvbnN0IGl0ZW1EaXYgPSB0aGlzLnJlc3VsdENvbnRhaW5lckVsLmNyZWF0ZURpdihcInN1Z2dlc3Rpb24taXRlbVwiKTtcbiAgICAgICAgaXRlbURpdi5zZXRUZXh0KHRoaXMuZ2V0SXRlbVRleHQoaXRlbSkpO1xuICAgICAgICBpdGVtRGl2LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMub25DaG9vc2VJdGVtKGl0ZW0sIGV2ZW50KTtcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5jbGFzcyBMaXN0Tm90ZXNNb2RhbCBleHRlbmRzIEZ1enp5U3VnZ2VzdE1vZGFsPFRGaWxlPiB7XG4gICAgcGx1Z2luOiBETVNQbHVnaW47XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBETVNQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgfVxuXG4gICAgZ2V0SXRlbXMoKTogVEZpbGVbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpLmZpbHRlcihmaWxlID0+IGZpbGUucGF0aC5zdGFydHNXaXRoKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZmF1bHRGb2xkZXIpKTtcbiAgICB9XG5cbiAgICBnZXRJdGVtVGV4dChpdGVtOiBURmlsZSk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBpdGVtLmJhc2VuYW1lO1xuICAgIH1cblxuICAgIG9uQ2hvb3NlSXRlbShpdGVtOiBURmlsZSwgZXZ0OiBNb3VzZUV2ZW50IHwgS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmFjdGl2ZUxlYWY7XG4gICAgICAgIGlmIChsZWFmKSB7XG4gICAgICAgICAgICBsZWFmLm9wZW5GaWxlKGl0ZW0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV3IE5vdGljZSgnVW5hYmxlIHRvIG9wZW4gdGhlIGZpbGUuJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIERNU1NldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgICBwbHVnaW46IERNU1BsdWdpbjtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IERNU1BsdWdpbikge1xuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIH1cblxuICAgIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHtjb250YWluZXJFbH0gPSB0aGlzO1xuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7dGV4dDogJ0RNUyBQbHVnaW4gU2V0dGluZ3MnfSk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZSgnRGVmYXVsdCBmb2xkZXInKVxuICAgICAgICAgICAgLnNldERlc2MoJ1RoZSBmb2xkZXIgd2hlcmUgbmV3IERNUyBub3RlcyB3aWxsIGJlIGNyZWF0ZWQnKVxuICAgICAgICAgICAgLmFkZFRleHQodGV4dCA9PiB0ZXh0XG4gICAgICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdFbnRlciBmb2xkZXIgbmFtZScpXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZmF1bHRGb2xkZXIpXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0Rm9sZGVyID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICAgIH0pKTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKCdFeHRlcm5hbCBsaW5rcyBmaWxlJylcbiAgICAgICAgICAgIC5zZXREZXNjKCdUaGUgZmlsZSB3aGVyZSBleHRlcm5hbCBsaW5rcyB3aWxsIGJlIHN0b3JlZCcpXG4gICAgICAgICAgICAuYWRkVGV4dCh0ZXh0ID0+IHRleHRcbiAgICAgICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0VudGVyIGZpbGUgbmFtZScpXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmV4dGVybmFsTGlua3NGaWxlKVxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZXh0ZXJuYWxMaW5rc0ZpbGUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgIH1cbn0iXSwibmFtZXMiOlsiUGx1Z2luIiwiVEZpbGUiLCJGaWxlU3lzdGVtQWRhcHRlciIsIk5vdGljZSIsImV4ZWMiLCJGdXp6eVN1Z2dlc3RNb2RhbCIsIk1vZGFsIiwiVGV4dENvbXBvbmVudCIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFvR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FB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
