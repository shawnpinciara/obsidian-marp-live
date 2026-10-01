import * as http from "http";
import { buildViewer } from "./viewer";
import { renderDeck, RenderOptions } from "./marp";

export interface DeckSnapshot {
  html: string;
  css: string;
  title: string;
  slideCount: number;
}

// Mini local server: serve il viewer + SSE per live reload.
// Niente dipendenze: solo node:http (disponibile nell'Electron di Obsidian).
export class MarpServer {
  private server: http.Server | null = null;
  private clients = new Set<http.ServerResponse>();
  private snapshot: DeckSnapshot = { html: "", css: "", title: "", slideCount: 0 };
  private renderOpts: RenderOptions = {};
  port = 0;

  isRunning(): boolean {
    return this.server !== null;
  }

  url(): string {
    return `http://127.0.0.1:${this.port}/`;
  }

  start(port: number, markdown: string, opts: RenderOptions): string {
    this.renderOpts = { ...opts };
    this.update(markdown);
    if (this.server) {
      // Già attivo: aggiorna solo il contenuto
      this.broadcast();
      return this.url();
    }
    this.port = port;
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/__events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        res.write(": connected\n\n");
        this.clients.add(res);
        req.on("close", () => this.clients.delete(res));
        return;
      }
      if (url.pathname === "/__deck") {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(this.snapshot));
        return;
      }
      // Pagina principale: viewer fullscreen una-slide-alla-volta
      const page = buildViewer({ ...this.snapshot, live: true });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
    });
    this.server.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EADDRINUSE" && this.port < port + 20) {
        // Porta occupata: prova la successiva
        this.port += 1;
        this.server?.listen(this.port, "127.0.0.1");
      }
    });
    this.server.listen(this.port, "127.0.0.1");
    return this.url();
  }

  update(markdown: string): DeckSnapshot {
    try {
      const r = renderDeck(markdown, this.renderOpts);
      this.snapshot = { html: r.html, css: r.css, title: r.title, slideCount: r.slideCount };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.snapshot = {
        html: `<section><h1>Errore Marp</h1><pre>${msg.replace(/</g, "&lt;")}</pre></section>`,
        css: this.snapshot.css,
        title: "Errore",
        slideCount: 1,
      };
    }
    this.broadcast();
    return this.snapshot;
  }

  setRenderOpts(opts: RenderOptions) {
    this.renderOpts = { ...opts };
  }

  stop() {
    try {
      for (const c of this.clients) {
        try {
          c.end();
        } catch {
          /* noop */
        }
      }
      this.clients.clear();
      this.server?.close();
    } finally {
      this.server = null;
    }
  }

  private broadcast() {
    for (const c of [...this.clients]) {
      try {
        c.write(`data: update\n\n`);
      } catch {
        this.clients.delete(c);
      }
    }
  }
}
