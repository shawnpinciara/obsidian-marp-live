import { Notice, Plugin, TFile, PluginSettingTab, Setting, MarkdownView } from "obsidian";
import { MarpServer } from "./server";
import { buildViewer } from "./viewer";
import { renderDeck } from "./marp";

interface MarpPresentaSettings {
  port: number;
  theme: string;
  allowHtml: boolean;
  autoOpen: boolean;
}

const DEFAULT_SETTINGS: MarpPresentaSettings = {
  port: 3773,
  theme: "default",
  allowHtml: true,
  autoOpen: true,
};

export default class MarpPresentaPlugin extends Plugin {
  settings: MarpPresentaSettings = { ...DEFAULT_SETTINGS };
  private server = new MarpServer();
  private presentingFile: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async onload() {
    await this.loadSettings();

    // Tasto "Presenta" nella toolbar di sinistra: NON mostra slide in Obsidian,
    // apre il local server nel browser esterno a pieno schermo.
    this.addRibbonIcon("presentation", "Presenta con Marp", () => {
      void this.presentActiveNote();
    });

    this.addCommand({
      id: "presenta-nota-corrente",
      name: "Presenta la nota corrente con Marp",
      checkCallback: (checking) => {
        const f = this.getActiveMarkdownFile();
        if (!f) return false;
        if (!checking) void this.presentActiveNote();
        return true;
      },
    });
    this.addCommand({
      id: "ferma-presentazione",
      name: "Ferma il server di presentazione",
      checkCallback: (checking) => {
        if (!this.server.isRunning()) return false;
        if (!checking) this.stopPresenting();
        return true;
      },
    });
    this.addCommand({
      id: "apri-nel-browser",
      name: "Apri la presentazione nel browser",
      checkCallback: (checking) => {
        if (!this.server.isRunning()) return false;
        if (!checking) window.open(this.server.url(), "_blank");
        return true;
      },
    });
    this.addCommand({
      id: "esporta-html",
      name: "Esporta la nota corrente in HTML (Marp standalone)",
      checkCallback: (checking) => {
        const f = this.getActiveMarkdownFile();
        if (!f) return false;
        if (!checking) void this.exportHtml(f);
        return true;
      },
    });
    this.addCommand({
      id: "esporta-pdf-stampa",
      name: "Esporta in PDF (apre vista stampa nel browser)",
      checkCallback: (checking) => {
        if (!this.getActiveMarkdownFile()) return false;
        if (!checking) void this.openPrintView();
        return true;
      },
    });
    this.addCommand({
      id: "copia-url",
      name: "Copia URL della presentazione",
      checkCallback: (checking) => {
        if (!this.server.isRunning()) return false;
        if (!checking) {
          void navigator.clipboard.writeText(this.server.url()).then(
            () => new Notice("URL presentazione copiato"),
            () => new Notice("Impossibile copiare URL"),
          );
        }
        return true;
      },
    });

    this.addSettingTab(new MarpSettingTab(this));

    // Live reload: quando il md cambia in Obsidian -> aggiorna il server.
    this.registerEvent(
      this.app.vault.on("modify", (f) => {
        if (f instanceof TFile && f.path === this.presentingFile && f.extension === "md") {
          this.scheduleUpdate(f);
        }
      }),
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        const f = info.file;
        if (f && f.path === this.presentingFile) {
          const md = editor.getValue();
          this.scheduleUpdateFromText(md);
        }
      }),
    );
    this.register(() => this.server.stop());
  }

  onunload() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.server.stop();
  }

  // ---------- core ----------

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const f = view?.file;
    return f && f.extension === "md" ? f : null;
  }

  private async presentActiveNote(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) {
      new Notice("Apri prima una nota Markdown da presentare");
      return;
    }
    const md = await this.app.vault.read(file);
    this.presentingFile = file.path;
    this.server.setRenderOpts({ theme: this.settings.theme, html: this.settings.allowHtml });
    const url = this.server.start(this.settings.port, md, {
      theme: this.settings.theme,
      html: this.settings.allowHtml,
    });
    new Notice(`Presentazione live: ${url}\nModifica il md, le slide si aggiornano.`);
    if (this.settings.autoOpen) window.open(url, "_blank");
  }

  private stopPresenting() {
    this.server.stop();
    this.presentingFile = null;
    new Notice("Server presentazione fermato");
  }

  private scheduleUpdate(file: TFile) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.app.vault.read(file).then((md) => this.server.update(md));
    }, 350);
  }

  private scheduleUpdateFromText(md: string) {
    if (!this.server.isRunning()) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.server.update(md), 350);
  }

  private async exportHtml(file: TFile): Promise<void> {
    const md = await this.app.vault.read(file);
    const r = renderDeck(md, { theme: this.settings.theme, html: this.settings.allowHtml });
    const page = buildViewer({ html: r.html, css: r.css, title: r.title, slideCount: r.slideCount, live: false });
    const outPath = file.path.replace(/\.md$/i, ".slides.html");
    const existing = this.app.vault.getAbstractFileByPath(outPath);
    if (existing instanceof TFile) await this.app.vault.modify(existing, page);
    else await this.app.vault.create(outPath, page);
    new Notice(`Esportato: ${outPath} (${r.slideCount} slide)`);
  }

  private async openPrintView(): Promise<void> {
    // La stampa PDF passa dal browser: apriamo il viewer con ?print e window.print().
    // Se il server non è attivo, lo avviamo senza auto-duplicare tab.
    if (!this.server.isRunning()) await this.presentActiveNote();
    else {
      const file = this.getActiveMarkdownFile();
      if (file) {
        const md = await this.app.vault.read(file);
        this.server.update(md);
      }
    }
    if (this.server.isRunning()) window.open(this.server.url() + "?print", "_blank");
  }

  // ---------- settings ----------

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) ?? {}) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class MarpSettingTab extends PluginSettingTab {
  plugin: MarpPresentaPlugin;
  constructor(plugin: MarpPresentaPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Marp Presenta" });
    containerEl.createEl("p", {
      text: "Il tasto Presenta apre un local server nel browser: una slide alla volta a pieno schermo, frecce/tasti sotto, live reload mentre modifichi il Markdown.",
    });

    new Setting(containerEl)
      .setName("Porta del local server")
      .setDesc("Se occupata, il plugin prova le 20 successive.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.port)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (Number.isFinite(n) && n > 0 && n < 65535) {
            this.plugin.settings.port = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName("Tema Marp")
      .setDesc("Temi built-in di @marp-team/marp-core. Usa front-matter `theme:` nella nota per override per-nota.")
      .addDropdown((d) =>
        d
          .addOptions({ default: "default", gaia: "gaia", uncover: "uncover" })
          .setValue(this.plugin.settings.theme)
          .onChange(async (v) => {
            this.plugin.settings.theme = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Permetti HTML nel Markdown")
      .setDesc("Passa html:true a Marp. Disattiva se vuoi slide solo-Markdown.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.allowHtml).onChange(async (v) => {
          this.plugin.settings.allowHtml = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Apri il browser automaticamente")
      .setDesc("Quando premi Presenta, apre subito l'URL nel browser predefinito.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoOpen).onChange(async (v) => {
          this.plugin.settings.autoOpen = v;
          await this.plugin.saveSettings();
        }),
      );
  }
}
