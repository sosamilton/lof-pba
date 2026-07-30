grist.ready({ requiredAccess: "full", allowSelectBy: true });

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const renderInline = (s) => {
  const escaped = escapeHtml(s);
  const links = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const code = links.replace(/`([^`]+)`/g, "<code>$1</code>");
  const bold = code.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const italic = bold.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return italic;
};

const renderMarkdown = (md) => {
  const src = String(md ?? "").replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const out = [];
  let inCode = false;
  let codeLines = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine ?? "";

    if (line.trim().startsWith("```")) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLines = [];
      } else {
        inCode = false;
        out.push(`<pre>${escapeHtml(codeLines.join("\n"))}</pre>`);
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      closeList();
      out.push(`<h1>${renderInline(h1[1])}</h1>`);
      continue;
    }

    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      closeList();
      out.push(`<h2>${renderInline(h2[1])}</h2>`);
      continue;
    }

    const li = line.match(/^\s*-\s+(.+)$/);
    if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${renderInline(li[1])}</li>`);
      continue;
    }

    if (line.trim() === "") {
      closeList();
      continue;
    }

    closeList();
    out.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  if (inCode) out.push(`<pre>${escapeHtml(codeLines.join("\n"))}</pre>`);
  return out.join("");
};

const state = {
  tableId: null,
  records: [],
  selectedRowId: null
};

const listEl = document.getElementById("list");
const contentEl = document.getElementById("content");

const getTitle = (r) => r?.tabla_visible || r?.table_id || "Tabla";
const getSub = (r) => `${r?.modulo_visible || ""} · ${r?.table_id || ""}`.trim();

const renderList = () => {
  listEl.innerHTML = "";
  for (const r of state.records) {
    const div = document.createElement("div");
    div.className = "item" + (r.id === state.selectedRowId ? " selected" : "");
    div.addEventListener("click", async () => {
      state.selectedRowId = r.id;
      renderList();
      renderContent();
      try {
        await grist.setSelectedRows([r.id]);
      } catch (e) {}
    });

    const t = document.createElement("div");
    t.className = "item-title";
    t.textContent = getTitle(r);

    const s = document.createElement("div");
    s.className = "item-sub";
    s.textContent = getSub(r);

    div.appendChild(t);
    div.appendChild(s);
    listEl.appendChild(div);
  }
};

const renderContent = () => {
  const r = state.records.find((x) => x.id === state.selectedRowId);
  if (!r) {
    contentEl.innerHTML = `<p class="muted">Documentación<br/>Filas: ${state.records.length}</p>`;
    return;
  }
  contentEl.innerHTML = renderMarkdown(r.doc_md || "");
};

const tableDataToRecords = (data) => {
  if (!data || !Array.isArray(data.id)) return [];
  const colNames = Object.keys(data).filter((k) => k !== "id");
  const n = data.id.length;

  const recs = [];
  for (let i = 0; i < n; i += 1) {
    const r = { id: data.id[i] };
    for (const col of colNames) r[col] = data[col][i];
    recs.push(r);
  }
  return recs;
};

const resolveDocsTableId = async () => {
  const tables = await grist.docApi.listTables();
  const candidates = ["docs_tablas", "Docs_tablas", "DOCS_TABLAS"];
  for (const c of candidates) {
    const hit = tables.find((t) => String(t).toLowerCase() === String(c).toLowerCase());
    if (hit) return hit;
  }
  return tables.find((t) => String(t).toLowerCase().includes("docs_tablas")) || null;
};

const load = async () => {
  try {
    if (!state.tableId) state.tableId = await resolveDocsTableId();

    if (!state.tableId) {
      state.records = [];
      state.selectedRowId = null;
      renderList();
      contentEl.innerHTML = `<p class="muted">No encuentro la tabla docs_tablas en este documento.</p>`;
      return;
    }

    const data = await grist.docApi.fetchTable(state.tableId);
    const recs = tableDataToRecords(data);

    state.records = recs;
    if (!state.selectedRowId && recs.length > 0) state.selectedRowId = recs[0].id;

    renderList();
    renderContent();
  } catch (e) {
    state.records = [];
    state.selectedRowId = null;
    renderList();
    contentEl.innerHTML = `<p class="muted">Error cargando documentación: ${escapeHtml(e?.message || e)}</p>`;
  }
};

grist.on("message", (e) => {
  if (e?.tableId) state.tableId = e.tableId;
});

grist.onRecords((records) => {
  if (Array.isArray(records) && records.length > 0) {
    state.records = records.filter(Boolean);
    if (!state.selectedRowId && state.records.length > 0) state.selectedRowId = state.records[0].id;
    renderList();
    renderContent();
    return;
  }
  load();
});

grist.onRecord((record) => {
  if (record && record.id != null) {
    state.selectedRowId = record.id;
    renderList();
    renderContent();
  }
});

load();
