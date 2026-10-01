import { Marp } from "@marp-team/marp-core";

export interface RenderOptions {
  theme?: string;
  html?: boolean;
  customCss?: string;
}

export interface RenderResult {
  html: string;
  css: string;
  slideCount: number;
  title: string;
}

const BUILTIN_THEMES = new Set(["default", "gaia", "uncover"]);

export function normalizeMarkdown(src: string, theme: string): string {
  // Se la nota non ha front-matter Marp, iniettiamo le direttive minime.
  // Marp divide le slide con --- quindi NON tocchiamo il corpo.
  const hasFrontMatter = /^---\s*\n[\s\S]*?\n---\s*(\n|$)/.test(src);
  if (hasFrontMatter) return src;
  const t = BUILTIN_THEMES.has(theme) ? theme : "default";
  return `---\nmarp: true\ntheme: ${t}\npaginate: true\n---\n\n${src}\n`;
}

export function renderDeck(src: string, opts: RenderOptions): RenderResult {
  const marp = new Marp({
    html: opts.html ?? true,
    emoji: { shortcode: true, unicode: true } as never,
  });

  if (opts.customCss && opts.customCss.trim()) {
    try {
      marp.themeSet.add(opts.customCss);
      // L'ultimo tema aggiunto diventa usabile via direttiva; forziamo come default
      // se il markdown non specifica un theme.
      const m = /@theme\s+([A-Za-z0-9-_]+)/.exec(opts.customCss);
      if (m) {
        const t = m[1];
        if (!/^---/.test(src)) src = `---\nmarp: true\ntheme: ${t}\n---\n\n${src}\n`;
      }
    } catch {
      // CSS custom non valido: ignora, usa built-in
    }
  }

  const md = normalizeMarkdown(src, opts.theme ?? "default");
  const { html, css, comments } = marp.render(md);
  const slideCount = (html.match(/<svg[^>]*data-marpit-svg/g) || []).length || 1;
  const title = extractTitle(src);
  return { html, css, slideCount, title, comments } as RenderResult;
}

function extractTitle(src: string): string {
  const fm = /^---\s*\n([\s\S]*?)\n---/.exec(src);
  if (fm) {
    const t = /^title:\s*(.+)$/m.exec(fm[1]);
    if (t) return t[1].trim().replace(/^["']|["']$/g, "");
  }
  const h1 = /^#\s+(.+)$/m.exec(src);
  return (h1 ? h1[1] : "Presentazione").trim().slice(0, 120);
}
