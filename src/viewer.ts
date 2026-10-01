// Template HTML del viewer: una slide alla volta, pieno schermo,
// frecce/tasti sotto, live reload via SSE. Nessuna dipendenza esterna.

export interface ViewerData {
  html: string; // slide già renderizzate da Marp (div.marpit > svg...)
  css: string; // CSS di Marp
  title: string;
  slideCount: number;
  live: boolean; // false = export statico offline
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildViewer(d: ViewerData): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<style id="marp-css">${d.css}</style>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; background: #111; color: #eee; font-family: system-ui, sans-serif; overflow: hidden; }
#print-hint { display: none; }
/* Area slide */
#stage { position: fixed; inset: 0 0 64px 0; display: flex; align-items: center; justify-content: center; background: #111; }
#deck { width: min(100vw - 32px, calc((100vh - 96px) * 16 / 9)); }
#deck .marpit > svg { display: none; width: 100%; height: auto; border-radius: 8px; box-shadow: 0 8px 60px rgba(0,0,0,.6); background: white; }
#deck .marpit > svg.active { display: block; }
/* Fallback se Marp rende senza svg (vecchi temi): mostra una section alla volta */
#deck .marpit > section { display: none; }
#deck .marpit > section.active { display: block; }
/* Barra sotto */
#bar { position: fixed; left: 0; right: 0; bottom: 0; height: 64px; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: #1a1a1a; border-top: 1px solid #333; }
#bar button { background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 8px; font-size: 18px; padding: 8px 14px; cursor: pointer; }
#bar button:hover { background: #3a3a3a; }
#counter { margin-left: auto; margin-right: 8px; font-variant-numeric: tabular-nums; opacity: .9; }
#progress { position: fixed; top: 0; left: 0; height: 4px; background: #7c5cff; width: 0; }
/* Stampa/PDF: mostra tutte le slide in colonna */
@media print {
  body { overflow: visible; background: white; }
  #bar, #progress { display: none !important; }
  #stage { position: static; display: block; }
  #deck { width: auto; }
  #deck .marpit > svg, #deck .marpit > section { display: block !important; break-inside: avoid; margin: 0 0 16px 0; box-shadow: none; border: 1px solid #ccc; }
}
body.print-all #stage { position: static; display: block; padding: 16px; }
body.print-all #deck { width: auto; max-width: 960px; margin: 0 auto; }
body.print-all .marpit > svg, body.print-all .marpit > section { display: block !important; margin-bottom: 16px; }
</style>
</head>
<body>
<div id="progress"></div>
<div id="stage"><div id="deck"><div class="marpit" id="slides">${d.html}</div></div></div>
<div id="bar">
  <button id="prev" title="Precedente (←)">◀</button>
  <button id="next" title="Successiva (→)">▶</button>
  <span id="counter">1 / ${d.slideCount}</span>
  <button id="fs" title="Pieno schermo (f)">⛶</button>
  <button id="print" title="Stampa / Salva PDF">⎙</button>
</div>
<script>
(function () {
  var idx = 0;
  try { idx = parseInt(sessionStorage.getItem("marp-idx") || "0", 10) || 0; } catch (e) {}
  var deck = document.getElementById("slides");
  function slides() {
    var svgs = deck.querySelectorAll(":scope > svg");
    if (svgs.length) return svgs;
    return deck.querySelectorAll(":scope > section, :scope > div > svg, :scope svg");
  }
  function show(n) {
    var s = slides();
    if (!s.length) return;
    idx = Math.max(0, Math.min(s.length - 1, n));
    for (var i = 0; i < s.length; i++) s[i].classList.toggle("active", i === idx);
    document.getElementById("counter").textContent = (idx + 1) + " / " + s.length;
    document.getElementById("progress").style.width = ((idx + 1) / s.length * 100) + "%";
    try { sessionStorage.setItem("marp-idx", String(idx)); } catch (e) {}
  }
  document.getElementById("prev").onclick = function () { show(idx - 1); };
  document.getElementById("next").onclick = function () { show(idx + 1); };
  document.getElementById("fs").onclick = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  };
  document.getElementById("print").onclick = function () { window.print(); };
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "ArrowDown") { e.preventDefault(); show(idx + 1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "ArrowUp") { e.preventDefault(); show(idx - 1); }
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(slides().length - 1);
    else if (e.key === "f" || e.key === "F11") { e.preventDefault(); document.getElementById("fs").click(); }
  });
  // Swipe touch
  var tx = null;
  document.getElementById("stage").addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
  document.getElementById("stage").addEventListener("touchend", function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx;
    if (dx < -40) show(idx + 1); else if (dx > 40) show(idx - 1);
    tx = null;
  }, { passive: true });
  // Click ai lati: avanza/indietreggia (ma non sui bottoni)
  document.getElementById("stage").addEventListener("click", function (e) {
    if (window.innerWidth < 700) return;
    var x = e.clientX / window.innerWidth;
    if (x > 0.7) show(idx + 1); else if (x < 0.3) show(idx - 1);
  });
  if (new URLSearchParams(location.search).has("print")) document.body.classList.add("print-all");
  show(idx);
${d.live ? `
  // Live reload: quando il md cambia in Obsidian, il server manda "update".
  // Ricarichiamo solo le slide via /__deck mantenendo l'indice corrente.
  try {
    var es = new EventSource("/__events");
    es.onmessage = function (ev) {
      if (ev.data !== "update") return;
      fetch("/__deck", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        document.getElementById("marp-css").textContent = j.css;
        deck.innerHTML = j.html;
        document.title = j.title || document.title;
        show(idx);
      }).catch(function () { location.reload(); });
    };
  } catch (e) {}
` : ``}
})();
</script>
</body>
</html>`;
}
