#!/usr/bin/env python3
"""Generate a standalone, offline HTML reader/editor for the 888 user testing manual.

Reads the markdown, splits it on headings, and embeds it in a single HTML file with
a sidebar, rendered markdown by default, click-to-edit per section, autosave to
localStorage, and an export that reassembles clean markdown.

No network dependency: the markdown renderer is inline, so the file works offline.

Usage:  python3 docs/hexos/build-editor.py
"""

import json
import pathlib
import re
import datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "888-user-testing-manual.md"
OUT = ROOT / "docs" / "hexos" / "888-manual-editor.html"
SNAPSHOT = ROOT / "docs" / "hexos" / "888-user-testing-manual.md"

raw = SRC.read_text(encoding="utf-8")
SNAPSHOT.write_text(raw, encoding="utf-8")

lines = raw.split("\n")
sections = []
current = {"level": 0, "title": "Preamble", "body": []}
heading_re = re.compile(r"^(#{1,4})\s+(.*)$")

for line in lines:
    m = heading_re.match(line)
    if m:
        if current["body"] or current["level"]:
            sections.append(current)
        current = {"level": len(m.group(1)), "title": m.group(2).strip(), "body": []}
    else:
        current["body"].append(line)
sections.append(current)

if sections and sections[0]["level"] == 0 and not "".join(sections[0]["body"]).strip():
    sections.pop(0)

payload = [
    {"id": f"s{i}", "level": s["level"], "title": s["title"],
     "body": "\n".join(s["body"]).strip("\n")}
    for i, s in enumerate(sections)
]

meta = {
    "source": "docs/888-user-testing-manual.md",
    "generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    "lines": len(lines),
    "sections": len(payload),
}

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>888 Manual</title>
<style>
  :root {
    --bg:#0f1115; --panel:#161922; --panel2:#1c2029; --line:#272c38;
    --text:#e6e8ee; --muted:#939aab; --accent:#d6763a; --accent2:#4a9d7f;
    --warn:#c9a227; --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);
       font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  header{position:sticky;top:0;z-index:20;background:var(--panel);
         border-bottom:1px solid var(--line);padding:12px 20px;
         display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  header h1{font-size:15px;margin:0;font-weight:600}
  .meta{color:var(--muted);font-size:12px;font-family:var(--mono)}
  .spacer{flex:1}
  button{background:var(--panel2);color:var(--text);border:1px solid var(--line);
         padding:7px 13px;border-radius:6px;font-size:13px;cursor:pointer}
  button:hover{border-color:var(--accent)}
  button.primary{background:var(--accent);border-color:var(--accent);color:#12141a;font-weight:600}
  button.ghost{background:transparent}
  button.on{border-color:var(--accent);color:var(--accent)}
  #status{font-size:12px;color:var(--muted);font-family:var(--mono);min-width:110px}
  #status.dirty{color:var(--warn)} #status.saved{color:var(--accent2)}
  .wrap{display:flex;align-items:flex-start}
  nav{width:300px;flex:none;position:sticky;top:57px;height:calc(100vh - 57px);
      overflow-y:auto;border-right:1px solid var(--line);background:var(--panel);padding:14px 0 40px}
  nav input{width:calc(100% - 24px);margin:0 12px 10px;padding:7px 9px;font-size:13px;
            background:var(--bg);border:1px solid var(--line);border-radius:6px;color:var(--text)}
  nav a{display:block;padding:4px 12px 4px 0;color:var(--muted);text-decoration:none;
        font-size:13px;border-left:2px solid transparent}
  nav a:hover{color:var(--text);background:var(--panel2)}
  nav a.lv1{padding-left:12px;color:var(--text);font-weight:600;margin-top:10px}
  nav a.lv2{padding-left:24px} nav a.lv3{padding-left:38px;font-size:12px}
  nav a.lv4{padding-left:52px;font-size:12px;opacity:.8}
  nav a.edited{border-left-color:var(--warn)}
  main{flex:1;padding:24px 32px 240px;max-width:1040px}
  section{margin-bottom:22px;border:1px solid var(--line);border-radius:8px;
          background:var(--panel);overflow:hidden}
  section.edited{border-color:var(--warn)}
  .shead{display:flex;align-items:center;gap:10px;padding:9px 14px;
         background:var(--panel2);border-bottom:1px solid var(--line)}
  .shead .h{font-family:var(--mono);font-size:11px;color:var(--accent);flex:none}
  .shead .t{font-weight:600;font-size:14px;flex:1}
  .shead .badge{font-size:10px;font-family:var(--mono);color:var(--warn);
                border:1px solid var(--warn);padding:1px 6px;border-radius:10px;display:none}
  section.edited .badge{display:inline}
  .shead .edit{font-size:11px;padding:3px 9px;opacity:0}
  section:hover .shead .edit{opacity:1}
  .view{padding:2px 16px 12px}
  .view:empty{display:none}
  .view p{margin:.6em 0}
  .view ul,.view ol{margin:.6em 0;padding-left:1.4em}
  .view li{margin:.25em 0}
  .view strong{color:#fff}
  .view em{color:var(--muted)}
  .view code{font-family:var(--mono);font-size:12.5px;background:#12151c;
             border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:var(--accent)}
  .view pre{background:#12151c;border:1px solid var(--line);border-radius:6px;
            padding:11px 13px;overflow-x:auto}
  .view pre code{border:0;background:none;padding:0;color:var(--text)}
  .view a{color:var(--accent2)}
  .view blockquote{margin:.6em 0;padding:.1em 0 .1em 14px;border-left:3px solid var(--line);color:var(--muted)}
  .view hr{border:0;border-top:1px solid var(--line);margin:1.2em 0}
  .view table{border-collapse:collapse;width:100%;margin:.8em 0;font-size:13.5px}
  .view th,.view td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
  .view th{background:var(--panel2);font-weight:600}
  .view tr:nth-child(even) td{background:#14171f}
  textarea{width:100%;border:0;background:#12151c;color:var(--text);
           font-family:var(--mono);font-size:13px;line-height:1.65;padding:12px 14px;
           resize:vertical;outline:none;display:block;min-height:44px}
  .hidden{display:none}
  dialog{background:var(--panel);color:var(--text);border:1px solid var(--line);
         border-radius:10px;padding:0;width:min(900px,92vw)}
  dialog header{position:static;border-radius:10px 10px 0 0}
  dialog textarea{min-height:60vh;font-size:12px}
  .hint{color:var(--muted);font-size:12px;padding:0 20px 16px}
</style>
</head>
<body>
<header>
  <h1>888 Manual</h1>
  <span class="meta" id="meta"></span>
  <span class="spacer"></span>
  <span id="status">loaded</span>
  <button class="ghost" id="btnMode">Edit all</button>
  <button class="ghost" id="btnReset">Revert all</button>
  <button class="ghost" id="btnPreview">View markdown</button>
  <button class="primary" id="btnExport">Export .md</button>
</header>
<div class="wrap">
  <nav>
    <input id="filter" placeholder="Filter sections…" autocomplete="off">
    <div id="toc"></div>
  </nav>
  <main id="main"></main>
</div>

<dialog id="dlg">
  <header><h1>Assembled markdown</h1><span class="spacer"></span>
    <button class="ghost" id="btnCopy">Copy</button>
    <button class="ghost" id="btnClose">Close</button></header>
  <textarea id="preview" readonly></textarea>
  <p class="hint">Exactly what "Export .md" downloads. Paste over
     <code>docs/888-user-testing-manual.md</code> or hand it back in chat.</p>
</dialog>

<script>
const SECTIONS = __PAYLOAD__;
const META = __META__;
const KEY = "888-manual-edits-v1";
let edits = {}, editAll = false;
try { edits = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch(e) { edits = {}; }

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

/* ---------- minimal markdown renderer (offline, no deps) ---------- */
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (m,c) => "<code>"+c+"</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}
function splitRow(line) {
  return line.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
}
function mdToHtml(src) {
  const L = src.split("\n"), out = [];
  let i = 0;
  while (i < L.length) {
    const line = L[i];

    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]);
      i++;
      out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // table: header row + separator
    if (/^\s*\|/.test(line) && i + 1 < L.length && /^\s*\|?[\s:-]*-[\s|:-]*$/.test(L[i+1])) {
      const head = splitRow(line); i += 2;
      const rows = [];
      while (i < L.length && /^\s*\|/.test(L[i])) rows.push(splitRow(L[i++]));
      out.push("<table><thead><tr>" + head.map(c => "<th>"+inline(c)+"</th>").join("") +
        "</tr></thead><tbody>" +
        rows.map(r => "<tr>" + r.map(c => "<td>"+inline(c)+"</td>").join("") + "</tr>").join("") +
        "</tbody></table>");
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < L.length && /^\s*>/.test(L[i])) buf.push(L[i++].replace(/^\s*>\s?/, ""));
      out.push("<blockquote>" + mdToHtml(buf.join("\n")) + "</blockquote>");
      continue;
    }
    if (/^\s*([-*+])\s+/.test(line)) {
      const buf = [];
      while (i < L.length && /^\s*([-*+])\s+/.test(L[i]))
        buf.push(L[i++].replace(/^\s*[-*+]\s+/, ""));
      out.push("<ul>" + buf.map(t => "<li>"+inline(t)+"</li>").join("") + "</ul>");
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < L.length && /^\s*\d+\.\s+/.test(L[i]))
        buf.push(L[i++].replace(/^\s*\d+\.\s+/, ""));
      out.push("<ol>" + buf.map(t => "<li>"+inline(t)+"</li>").join("") + "</ol>");
      continue;
    }
    const para = [];
    while (i < L.length && L[i].trim() && !/^\s*[-*+]\s+/.test(L[i]) &&
           !/^\s*\d+\.\s+/.test(L[i]) && !/^\s*\|/.test(L[i]) &&
           !/^\s*>/.test(L[i]) && !/^```/.test(L[i])) para.push(L[i++]);
    if (para.length) out.push("<p>" + inline(para.join("\n")) + "</p>");
  }
  return out.join("\n");
}

/* ---------- state ---------- */
$("meta").textContent = META.sections + " sections · " + META.lines +
  " lines · " + META.source + " @ " + META.generated;
const bodyOf = (s) => (s.id in edits) ? edits[s.id] : s.body;
const isEdited = (s) => (s.id in edits) && edits[s.id] !== s.body;
const hashes = (n) => "#".repeat(n);

function assemble() {
  const out = [];
  for (const s of SECTIONS) {
    if (s.level > 0) out.push(hashes(s.level) + " " + s.title);
    const b = bodyOf(s);
    if (b.trim()) { out.push(""); out.push(b); }
    out.push("");
  }
  return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trimStart() + "\n";
}
function setStatus(t, c) { const e = $("status"); e.textContent = t; e.className = c || ""; }
function persist() {
  localStorage.setItem(KEY, JSON.stringify(edits));
  const n = SECTIONS.filter(isEdited).length;
  setStatus(n ? n + " section" + (n>1?"s":"") + " edited" : "no changes", n ? "dirty" : "saved");
}

function render() {
  const main = $("main"), toc = $("toc");
  main.innerHTML = ""; toc.innerHTML = "";
  for (const s of SECTIONS) {
    const a = document.createElement("a");
    a.href = "#" + s.id;
    a.className = "lv" + (s.level || 1) + (isEdited(s) ? " edited" : "");
    a.textContent = s.title; toc.appendChild(a);

    const sec = document.createElement("section");
    sec.id = s.id;
    if (isEdited(s)) sec.classList.add("edited");

    const head = document.createElement("div");
    head.className = "shead";
    head.innerHTML = '<span class="h">' + (s.level ? hashes(s.level) : "—") + '</span>' +
      '<span class="t"></span><span class="badge">edited</span>' +
      '<button class="edit ghost">Edit</button>';
    head.querySelector(".t").textContent = s.title;
    sec.appendChild(head);

    const view = document.createElement("div");
    view.className = "view";
    view.innerHTML = mdToHtml(bodyOf(s));
    sec.appendChild(view);

    const ta = document.createElement("textarea");
    ta.value = bodyOf(s); ta.spellcheck = false;
    ta.rows = Math.min(40, Math.max(2, ta.value.split("\n").length + 1));
    ta.className = "hidden";
    sec.appendChild(ta);

    const toEdit = () => { view.classList.add("hidden"); ta.classList.remove("hidden");
                           ta.focus(); head.querySelector(".edit").textContent = "Done"; };
    const toView = () => { view.innerHTML = mdToHtml(ta.value); view.classList.remove("hidden");
                           ta.classList.add("hidden"); head.querySelector(".edit").textContent = "Edit"; };

    head.querySelector(".edit").addEventListener("click", () =>
      ta.classList.contains("hidden") ? toEdit() : toView());
    view.addEventListener("dblclick", toEdit);
    ta.addEventListener("keydown", (e) => { if (e.key === "Escape") toView(); });
    ta.addEventListener("input", () => {
      edits[s.id] = ta.value;
      if (ta.value === s.body) delete edits[s.id];
      sec.classList.toggle("edited", isEdited(s));
      a.classList.toggle("edited", isEdited(s));
      persist();
    });
    sec._toEdit = toEdit; sec._toView = toView;
    main.appendChild(sec);
  }
  if (editAll) main.querySelectorAll("section").forEach(x => x._toEdit());
  persist();
}

$("btnMode").addEventListener("click", () => {
  editAll = !editAll;
  $("btnMode").textContent = editAll ? "Read all" : "Edit all";
  $("btnMode").classList.toggle("on", editAll);
  document.querySelectorAll("main section").forEach(x => editAll ? x._toEdit() : x._toView());
});
$("filter").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  for (const a of $("toc").children)
    a.style.display = a.textContent.toLowerCase().includes(q) ? "" : "none";
});
$("btnExport").addEventListener("click", () => {
  const blob = new Blob([assemble()], {type:"text/markdown"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "888-user-testing-manual.md"; a.click();
  URL.revokeObjectURL(a.href);
});
$("btnPreview").addEventListener("click", () => { $("preview").value = assemble(); $("dlg").showModal(); });
$("btnClose").addEventListener("click", () => $("dlg").close());
$("btnCopy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(assemble());
  $("btnCopy").textContent = "Copied";
  setTimeout(() => $("btnCopy").textContent = "Copy", 1200);
});
$("btnReset").addEventListener("click", () => {
  if (!confirm("Discard all edits and restore the committed text?")) return;
  edits = {}; localStorage.removeItem(KEY); render();
});

render();
</script>
</body>
</html>
"""

html = (HTML
        .replace("__PAYLOAD__", json.dumps(payload, ensure_ascii=False))
        .replace("__META__", json.dumps(meta, ensure_ascii=False)))

OUT.write_text(html, encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}  ({len(html):,} bytes)")
print(f"{meta['sections']} sections from {meta['lines']} lines")
