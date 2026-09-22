/* =============================================================
   LL Print 3D — panel de administración
   -------------------------------------------------------------
   Guarda los productos directamente en el repositorio de GitHub
   (data/productos.json + fotos en img/productos/) usando la API
   de GitHub. Cada guardado es UN solo commit con los datos y las
   fotos juntos, y GitHub Pages vuelve a publicar la página sola.
   La "clave de acceso" es un token de GitHub (fine-grained) con
   permiso Contents: Read and write sobre el repositorio.
   ============================================================= */
(() => {
  "use strict";

  const CFG = window.CONFIG || {};
  // Solo se puede cambiar desde config.js (útil para pruebas). Nunca desde la URL.
  const API = String(CFG.githubApi || "https://api.github.com").replace(/\/+$/, "");
  const DATA_PATH = "data/productos.json";
  const IMG_DIR = "img/productos";
  const MAX_PHOTOS = 8, MAX_SIDE = 1600, QUALITY = 0.85, MAX_INPUT_MB = 40;
  const KEYS = { token: "llp3d-admin-token", repo: "llp3d-admin-repo" };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "$" + Number(n).toLocaleString("es-AR");
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = v => JSON.parse(JSON.stringify(v));
  const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/, "") || "producto";
  const rand = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- almacenamiento (puede fallar en modo privado) ---------- */
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
  const LS = safe(() => window.localStorage, null);
  const SS = safe(() => window.sessionStorage, null);
  const getToken = () => safe(() => SS.getItem(KEYS.token), null) || safe(() => LS.getItem(KEYS.token), null) || "";
  const clearToken = () => { safe(() => LS.removeItem(KEYS.token)); safe(() => SS.removeItem(KEYS.token)); };
  const saveToken = (t, remember) => { clearToken(); safe(() => (remember ? LS : SS).setItem(KEYS.token, t)); };

  /* ---------- estado ---------- */
  let TOKEN = "";
  let repo = { owner: "", name: "", branch: "" };
  let products = [];          // última versión conocida (la del repositorio)
  let order = null;           // orden pendiente de guardar (lista de ids) o null
  let query = "";
  let editing = null;         // { id, photos: [...], dirty }
  let repoEdited = false;
  const previews = new Map(); // ruta de foto recién subida -> URL local (hasta que GitHub Pages la publique)

  /* ---------- UI básica ---------- */
  let toastT;
  function toast(msg, ms = 3200) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms);
  }
  function busy(text) { $("#busyText").textContent = text; $("#busy").hidden = false; }
  function idle() { $("#busy").hidden = true; }

  /* =============================================================
     API de GitHub
     ============================================================= */
  class GhError extends Error {
    constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
  }

  async function gh(path, { method = "GET", body } = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        method,
        cache: "no-store",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": "Bearer " + TOKEN,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new GhError(0, "No hay conexión con GitHub. Revisá tu internet e intentá de nuevo.");
    }
    const text = await res.text();
    const data = text ? safe(() => JSON.parse(text), { message: text }) : null;
    if (!res.ok) {
      throw new GhError(res.status, (data && data.message) || res.statusText || "Error", {
        rateLimited: res.headers.get("x-ratelimit-remaining") === "0"
      });
    }
    return data;
  }

  function friendly(e) {
    if (!(e instanceof GhError)) return (e && e.message) || "Ocurrió un error inesperado.";
    const m = e.message || "";
    if (e.status === 0) return m;
    if (e.status === 401) return "La clave de acceso no es válida o ya venció. Generá una nueva en GitHub y volvé a entrar.";
    if (e.rateLimited) return "GitHub limitó las solicitudes por un rato. Esperá unos minutos y probá de nuevo.";
    if (e.status === 403) return "La clave no tiene permiso para modificar el repositorio. En GitHub, editá la clave: en Repository access tiene que estar este repositorio y en Permissions → Contents, “Read and write”.";
    if (e.status === 404) return `No se encontró el repositorio “${repo.owner}/${repo.name}”${repo.branch ? ` (rama “${repo.branch}”)` : ""}, o la clave no tiene acceso a él. Revisá el usuario, el repositorio y que la clave incluya ese repositorio.`;
    if (e.status === 409 && /empty/i.test(m)) return "El repositorio está vacío: primero subí los archivos de la página a GitHub.";
    if (e.status === 413 || /too large/i.test(m)) return "El archivo es demasiado grande para GitHub.";
    return `GitHub respondió: “${m}” (código ${e.status}).`;
  }

  const R = () => `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
  const encPath = p => String(p).split("/").map(encodeURIComponent).join("/");
  const b64ToText = b64 => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), c => c.charCodeAt(0)));
  const blobToB64 = blob => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error || new Error("No se pudo leer la foto."));
    r.readAsDataURL(blob);
  });
  const isOwnImage = src => typeof src === "string" && src.startsWith(IMG_DIR + "/") && !src.includes("..");
  const rawUrl = path => `https://raw.githubusercontent.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/${encPath(repo.branch)}/${encPath(path)}`;

  /* ---------- productos: formato ---------- */
  function normalize(p) {
    const { imagen, ...rest } = p || {};
    const imgs = Array.isArray(p && p.imagenes) ? p.imagenes : (imagen ? [imagen] : []);
    return {
      ...rest,
      id: String((p && p.id) || slug(p && p.nombre)),
      nombre: String((p && p.nombre) || "").trim(),
      categoria: String((p && p.categoria) || "").trim(),
      precio: Math.max(0, Math.round(Number(p && p.precio) || 0)),
      descripcion: String((p && p.descripcion) || "").trim(),
      medidas: String((p && p.medidas) || "").trim(),
      material: String((p && p.material) || "").trim(),
      estado: p && p.estado === "pedido" ? "pedido" : "stock",
      destacado: !!(p && p.destacado),
      visible: !(p && p.visible === false),
      imagenes: imgs.filter(x => typeof x === "string" && x.trim()).map(x => x.trim())
    };
  }
  function parseProducts(text) {
    if (!text.trim()) return [];
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`El archivo ${DATA_PATH} tiene un error de formato (JSON inválido). Corregilo en GitHub o restaurá una versión anterior.`); }
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.productos) ? data.productos : []);
    const seen = new Set();
    return list.filter(p => p && typeof p === "object").map(normalize).map(p => {
      let id = p.id, n = 2;
      while (seen.has(id)) id = `${p.id}-${n++}`;
      seen.add(id);
      return { ...p, id };
    });
  }
  const uniqueId = (base, list) => { let id = base, n = 2; while (list.some(p => p.id === id)) id = `${base}-${n++}`; return id; };

  /* ---------- leer la última versión del repositorio ---------- */
  async function readSnapshot() {
    const ref = await gh(`${R()}/git/ref/heads/${encPath(repo.branch)}`);
    const headSha = ref.object.sha;
    const commit = await gh(`${R()}/git/commits/${headSha}`);
    let list = [];
    try {
      const f = await gh(`${R()}/contents/${encPath(DATA_PATH)}?ref=${headSha}`);
      let content = f.content;
      if (!content && f.sha && f.size > 0) content = (await gh(`${R()}/git/blobs/${f.sha}`)).content; // archivos > 1 MB
      list = parseProducts(content ? b64ToText(content) : "");
    } catch (e) {
      if (!(e instanceof GhError && e.status === 404)) throw e; // si no existe, se crea en el primer guardado
    }
    return { headSha, treeSha: commit.tree.sha, list };
  }

  async function listImages(sha) {
    try {
      const items = await gh(`${R()}/contents/${encPath(IMG_DIR)}?ref=${sha}`);
      return new Set((Array.isArray(items) ? items : []).filter(i => i.type === "file").map(i => i.path));
    } catch (e) {
      if (e instanceof GhError && e.status === 404) return new Set();
      throw e;
    }
  }

  /* ---------- guardar = un commit atómico ---------- */
  // mutate(lista) recibe la versión MÁS RECIENTE del repositorio y devuelve la nueva lista.
  // Si otra persona/dispositivo guardó en el medio, se vuelve a aplicar sobre lo nuevo.
  async function commit(message, mutate, newFiles = []) {
    const blobs = [];
    for (let i = 0; i < newFiles.length; i++) {
      busy(newFiles.length > 1 ? `Subiendo fotos (${i + 1} de ${newFiles.length})…` : "Subiendo foto…");
      const b = await gh(`${R()}/git/blobs`, { method: "POST", body: { content: await blobToB64(newFiles[i].blob), encoding: "base64" } });
      blobs.push({ path: newFiles[i].path, mode: "100644", type: "blob", sha: b.sha });
    }
    for (let attempt = 1; ; attempt++) {
      busy("Publicando cambios…");
      const snap = await readSnapshot();
      const after = mutate(clone(snap.list)).map(normalize);
      const used = new Set(after.flatMap(p => p.imagenes));
      const orphans = [...new Set(snap.list.flatMap(p => p.imagenes))].filter(src => isOwnImage(src) && !used.has(src));
      const existing = orphans.length ? await listImages(snap.headSha) : new Set();
      const tree = [
        { path: DATA_PATH, mode: "100644", type: "blob", content: JSON.stringify(after, null, 2) + "\n" },
        ...blobs,
        ...orphans.filter(p => existing.has(p)).map(path => ({ path, mode: "100644", type: "blob", sha: null }))
      ];
      const newTree = await gh(`${R()}/git/trees`, { method: "POST", body: { base_tree: snap.treeSha, tree } });
      const c = await gh(`${R()}/git/commits`, { method: "POST", body: { message, tree: newTree.sha, parents: [snap.headSha] } });
      try {
        await gh(`${R()}/git/refs/heads/${encPath(repo.branch)}`, { method: "PATCH", body: { sha: c.sha, force: false } });
        products = after;
        return after;
      } catch (e) {
        // 422 = alguien guardó justo antes que nosotros: reintentar sobre la versión nueva
        if (e instanceof GhError && e.status === 422 && attempt < 4) { await sleep(600 * attempt); continue; }
        throw e;
      }
    }
  }

  /* ---------- seguimiento de la publicación en GitHub Pages ---------- */
  let watchT, watchId = 0;
  function watchPublish(expected) {
    const el = $("#publishState"), id = ++watchId, want = JSON.stringify(expected), start = Date.now();
    el.hidden = false; el.classList.remove("done");
    el.textContent = "Guardado en GitHub. Publicando en la página (suele tardar 1–2 minutos)…";
    clearTimeout(watchT);
    const tick = async () => {
      if (id !== watchId) return;
      try {
        const r = await fetch(`${DATA_PATH}?t=${Date.now()}`, { cache: "no-store" });
        if (r.ok && JSON.stringify(await r.json()) === want) {
          if (id !== watchId) return;
          el.classList.add("done"); el.textContent = "✓ Los cambios ya están visibles en la página.";
          return;
        }
      } catch { /* todavía no */ }
      if (id !== watchId) return;
      if (Date.now() - start > 6 * 60e3) {
        el.classList.add("done");
        el.textContent = "Cambios guardados. Si todavía no los ves en la página, recargala en unos minutos.";
        return;
      }
      watchT = setTimeout(tick, 8000);
    };
    watchT = setTimeout(tick, 6000);
  }

  /* =============================================================
     LOGIN
     ============================================================= */
  function detectFromLocation() {
    const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!m) return {};
    const first = location.pathname.split("/").filter(Boolean)[0] || "";
    return { owner: m[1], name: first && !/\.html?$/i.test(first) ? decodeURIComponent(first) : `${m[1]}.github.io` };
  }
  function initialRepo() {
    const saved = safe(() => JSON.parse(LS.getItem(KEYS.repo) || "null"), null) || {};
    const cfg = CFG.github || {}, det = detectFromLocation();
    return {
      owner: String(saved.owner || cfg.usuario || det.owner || "").trim(),
      name: String(saved.name || cfg.repositorio || det.name || "").trim(),
      branch: String(saved.branch || cfg.rama || "").trim()
    };
  }
  function fillRepoFields(r) {
    $("#repoOwner").value = r.owner; $("#repoName").value = r.name; $("#repoBranch").value = r.branch;
    updateRepoLabel();
  }
  function readRepoFields() {
    const clean = v => v.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
    let owner = clean($("#repoOwner").value), name = clean($("#repoName").value);
    if (!name && owner.includes("/")) [owner, name] = owner.split("/");   // pegaron "usuario/repositorio"
    if (name.includes("/")) name = name.split("/").pop();
    return { owner, name, branch: $("#repoBranch").value.trim() };
  }
  function updateRepoLabel() {
    const r = readRepoFields();
    $("#repoLabel").textContent = r.owner && r.name ? `${r.owner}/${r.name}${r.branch ? ` · ${r.branch}` : ""}` : "sin configurar";
  }
  function loginError(msg) { const el = $("#loginError"); el.textContent = msg; el.hidden = !msg; }

  async function login(token, remember, { silent = false } = {}) {
    loginError("");
    repo = readRepoFields();
    if (!repo.owner || !repo.name) {
      $("#repoBox").open = true;
      if (!silent) loginError("Completá tu usuario de GitHub y el nombre del repositorio.");
      return;
    }
    TOKEN = token;
    busy("Conectando con GitHub…");
    try {
      const info = await gh(R());
      repo.owner = info.owner && info.owner.login || repo.owner;
      repo.name = info.name || repo.name;
      if (!repo.branch) repo.branch = info.default_branch || "main";
      if (info.permissions && info.permissions.push === false) {
        throw new Error("Tu cuenta de GitHub no tiene permiso para modificar este repositorio.");
      }
      const snap = await readSnapshot();
      products = snap.list;
      saveToken(token, remember);
      if (repoEdited) safe(() => LS.setItem(KEYS.repo, JSON.stringify(readRepoFields())));
      const user = await gh("/user").catch(() => null);
      $("#who").innerHTML = user ? `${user.avatar_url ? `<img src="${esc(user.avatar_url)}" alt="" referrerpolicy="no-referrer">` : ""}<span>${esc(user.login)}</span>` : "";
      $("#tokenInput").value = "";
      $("#loginView").hidden = true; $("#appView").hidden = false;
      order = null; render();
    } catch (e) {
      TOKEN = "";
      if (e instanceof GhError && e.status === 401) clearToken();
      loginError(friendly(e));
      $("#loginView").hidden = false; $("#appView").hidden = true;
    } finally { idle(); }
  }

  function logout() {
    if (editing && editing.dirty && !confirm("Tenés cambios sin guardar. ¿Salir igual?")) return;
    closeEditor(true);
    clearToken(); TOKEN = ""; products = []; order = null;
    $("#appView").hidden = true; $("#loginView").hidden = false; $("#who").innerHTML = "";
    $("#publishState").hidden = true; clearTimeout(watchT); watchId++;
    toast("Sesión cerrada");
  }

  /* =============================================================
     LISTA DE PRODUCTOS
     ============================================================= */
  function thumbSrc(path) {
    if (previews.has(path)) return { src: previews.get(path), raw: "" };
    if (/^(https?:|data:|blob:)/i.test(path)) return { src: path, raw: "" };
    return { src: path, raw: rawUrl(path) };
  }
  function imgHTML(path, alt = "") {
    const t = thumbSrc(path);
    return `<img src="${esc(t.src)}"${t.raw ? ` data-raw="${esc(t.raw)}"` : ""} alt="${esc(alt)}" loading="lazy">`;
  }
  // si la foto todavía no está publicada en la página, se muestra la del repositorio
  document.addEventListener("error", e => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.dataset.raw) { const raw = img.dataset.raw; delete img.dataset.raw; img.src = raw; }
  }, true);

  function viewList() {
    if (!order) return products;
    const pos = new Map(order.map((id, i) => [id, i]));
    return products.slice().sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : -1) - (pos.has(b.id) ? pos.get(b.id) : -1));
  }

  function render() {
    const all = viewList();
    const q = query.toLowerCase();
    const list = q ? all.filter(p => [p.nombre, p.categoria, p.descripcion, p.material].join(" ").toLowerCase().includes(q)) : all;
    const hiddenCount = products.filter(p => !p.visible).length;
    $("#count").textContent = `· ${products.length}${hiddenCount ? ` (${hiddenCount} oculto${hiddenCount > 1 ? "s" : ""})` : ""}`;
    $("#catList").innerHTML = [...new Set(products.map(p => p.categoria).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join("");
    $("#orderBar").hidden = !order;

    if (!products.length) {
      $("#plist").innerHTML = `<div class="empty-state">Todavía no hay productos.<br>Tocá <b>+ Nuevo producto</b> para cargar el primero.</div>`;
      return;
    }
    if (!list.length) { $("#plist").innerHTML = `<div class="empty-state">No hay productos que coincidan con “${esc(query)}”.</div>`; return; }

    $("#plist").innerHTML = list.map((p, i) => `
      <article class="prow${p.visible ? "" : " hidden-item"}" data-id="${esc(p.id)}" style="animation-delay:${Math.min(i, 12) * 30}ms">
        <div class="move">${q ? "" : `
          <button data-move="-1" ${i ? "" : "disabled"} aria-label="Subir">▲</button>
          <button data-move="1" ${i < list.length - 1 ? "" : "disabled"} aria-label="Bajar">▼</button>`}
        </div>
        <div class="pthumb">${p.imagenes.length ? imgHTML(p.imagenes[0], p.nombre) : "3D"}</div>
        <div class="pinfo">
          <h3>${esc(p.nombre)}</h3>
          <p>
            <span>${esc(p.categoria || "Sin categoría")}</span>
            <span>${p.precio > 0 ? money(p.precio) : "Consultar"}</span>
            <span>${p.estado === "stock" ? "En stock" : "A pedido"}</span>
            <span>${p.imagenes.length} foto${p.imagenes.length === 1 ? "" : "s"}</span>
            ${p.destacado ? `<span class="tag hot">★ Destacado</span>` : ""}
            ${p.visible ? "" : `<span class="tag off">Oculto</span>`}
          </p>
        </div>
        <div class="pactions">
          <button data-act="toggle">${p.visible ? "Ocultar" : "Mostrar"}</button>
          <button data-act="edit">Editar</button>
          <button data-act="delete" class="del">Borrar</button>
        </div>
      </article>`).join("");
  }

  async function run(label, fn, okMsg) {
    try {
      const after = await fn();
      order = null; render();
      toast(okMsg);
      watchPublish(after);
      return true;
    } catch (e) {
      console.error(label, e);
      if (e instanceof GhError && e.status === 401) { alert(friendly(e)); logout(); return false; }
      alert(friendly(e));
      return false;
    } finally { idle(); }
  }

  $("#plist").addEventListener("click", async e => {
    const btn = e.target.closest("button"); if (!btn) return;
    const row = btn.closest(".prow"); const id = row && row.dataset.id;
    const p = products.find(x => x.id === id); if (!p) return;

    if (btn.dataset.move) {
      const ids = viewList().map(x => x.id), i = ids.indexOf(id), j = i + Number(btn.dataset.move);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      order = ids; render();
      return;
    }
    if (order) { toast("Primero guardá o descartá el nuevo orden."); return; }
    const act = btn.dataset.act;
    if (act === "edit") openEditor(p);
    if (act === "toggle") {
      const target = !p.visible;
      await run("toggle", () => commit(`${target ? "Mostrar" : "Ocultar"} producto: ${p.nombre}`,
        list => list.map(x => x.id === id ? { ...x, visible: target } : x)),
        target ? `“${p.nombre}” vuelve a verse en la página` : `“${p.nombre}” quedó oculto`);
    }
    if (act === "delete") {
      if (!confirm(`¿Borrar “${p.nombre}”?\n\nSe quita de la página y se borran sus fotos. (Si solo querés sacarlo un tiempo, usá “Ocultar”.)`)) return;
      await run("delete", () => commit(`Borrar producto: ${p.nombre}`, list => list.filter(x => x.id !== id)), `“${p.nombre}” fue borrado`);
    }
  });

  $("#orderSave").onclick = () => {
    const ids = order.slice();
    run("order", () => commit("Reordenar productos", list => {
      const pos = new Map(ids.map((id, i) => [id, i]));
      return list.slice().sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : -1) - (pos.has(b.id) ? pos.get(b.id) : -1));
    }), "Orden guardado ✓");
  };
  $("#orderCancel").onclick = () => { order = null; render(); };
  $("#search").addEventListener("input", e => { query = e.target.value.trim(); render(); });
  $("#newBtn").onclick = () => { if (order) return toast("Primero guardá o descartá el nuevo orden."); openEditor(null); };
  $("#reloadBtn").onclick = async () => {
    if (order && !confirm("Se descarta el orden sin guardar. ¿Seguir?")) return;
    busy("Leyendo productos…");
    try { products = (await readSnapshot()).list; order = null; render(); toast("Lista actualizada"); }
    catch (e) { alert(friendly(e)); if (e instanceof GhError && e.status === 401) logout(); }
    finally { idle(); }
  };
  $("#logoutBtn").onclick = logout;

  /* =============================================================
     EDITOR DE PRODUCTO
     ============================================================= */
  const form = $("#editForm");

  function openEditor(p) {
    form.reset();
    $$(".invalid", form).forEach(el => el.classList.remove("invalid"));
    editing = { id: p ? p.id : null, dirty: false, photos: [] };
    $("#editorTitle").textContent = p ? "Editar producto" : "Nuevo producto";
    if (p) {
      ["nombre", "categoria", "precio", "descripcion", "medidas", "material", "estado"].forEach(k => { form.elements[k].value = p[k] ?? ""; });
      form.elements.destacado.checked = !!p.destacado;
      form.elements.visible.checked = p.visible !== false;
      editing.photos = p.imagenes.map(src => ({ src, isNew: false }));
    }
    renderPhotos();
    $("#editor").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => form.elements.nombre.focus(), 50);
  }

  function closeEditor(force) {
    if (!editing) { $("#editor").hidden = true; return; }
    if (!force && editing.dirty && !confirm("Tenés cambios sin guardar. ¿Descartarlos?")) return;
    editing.photos.filter(ph => ph.isNew && !ph.kept).forEach(ph => URL.revokeObjectURL(ph.url));
    editing = null;
    $("#editor").hidden = true;
    document.body.style.overflow = "";
  }

  function renderPhotos() {
    const ph = editing.photos, n = ph.length;
    $("#photos").innerHTML = ph.map((x, i) => {
      const img = x.isNew ? `<img src="${esc(x.url)}" alt="">` : imgHTML(x.src);
      return `<div class="photo">
        ${img}
        ${x.isNew ? `<span class="new">Nueva</span>` : ""}
        <div class="photo-actions">
          <button type="button" data-ph-move="-1" data-i="${i}" ${i ? "" : "disabled"} aria-label="Mover antes">←</button>
          <button type="button" class="rm" data-ph-rm="${i}" aria-label="Quitar foto">✕</button>
          <button type="button" data-ph-move="1" data-i="${i}" ${i < n - 1 ? "" : "disabled"} aria-label="Mover después">→</button>
        </div>
      </div>`;
    }).join("");
    $("#photoDrop").hidden = n >= MAX_PHOTOS;
  }

  $("#photos").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !editing) return;
    const ph = editing.photos;
    if (b.dataset.phRm !== undefined) {
      const [gone] = ph.splice(Number(b.dataset.phRm), 1);
      if (gone && gone.isNew) URL.revokeObjectURL(gone.url);
    } else if (b.dataset.phMove) {
      const i = Number(b.dataset.i), j = i + Number(b.dataset.phMove);
      if (j >= 0 && j < ph.length) [ph[i], ph[j]] = [ph[j], ph[i]];
    }
    editing.dirty = true; renderPhotos();
  });

  // optimiza la foto: máx. 1600 px, WebP (o JPG si el navegador no soporta WebP)
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo abrir “${file.name}”. Probá con una foto JPG o PNG.`)); };
      img.src = url;
    });
  }
  const toBlob = (canvas, type, q) => new Promise(r => canvas.toBlob(r, type, q));
  async function optimize(file) {
    if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new Error(`“${file.name}” pesa más de ${MAX_INPUT_MB} MB.`);
    const img = await loadImage(file);
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error(`“${file.name}” no parece una imagen válida.`);
    const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w0 * k)); canvas.height = Math.max(1, Math.round(h0 * k));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let blob = await toBlob(canvas, "image/webp", QUALITY), ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      const c2 = document.createElement("canvas"); c2.width = canvas.width; c2.height = canvas.height;
      const x2 = c2.getContext("2d"); x2.fillStyle = "#07122a"; x2.fillRect(0, 0, c2.width, c2.height); x2.drawImage(canvas, 0, 0);
      blob = await toBlob(c2, "image/jpeg", QUALITY); ext = "jpg";
    }
    if (!blob) throw new Error(`No se pudo procesar “${file.name}”.`);
    return { blob, ext, url: URL.createObjectURL(blob) };
  }

  async function addPhotos(files) {
    if (!editing) return;
    const list = [...files];
    const room = MAX_PHOTOS - editing.photos.length;
    if (list.length > room) toast(`Máximo ${MAX_PHOTOS} fotos por producto: se agregan solo ${Math.max(room, 0)}.`);
    const errors = [];
    for (let i = 0; i < Math.min(list.length, room); i++) {
      busy(`Preparando foto ${i + 1} de ${Math.min(list.length, room)}…`);
      try { const o = await optimize(list[i]); if (editing) editing.photos.push({ isNew: true, ...o }); }
      catch (e) { errors.push(e.message); }
    }
    idle();
    if (!editing) return;
    editing.dirty = true; renderPhotos();
    if (errors.length) alert(errors.join("\n"));
  }

  const photoInput = $("#photoInput"), drop = $("#photoDrop");
  photoInput.addEventListener("change", () => { const f = photoInput.files; if (f && f.length) addPhotos(f).finally(() => { photoInput.value = ""; }); });
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("drag"); }));
  drop.addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files.length) addPhotos(e.dataTransfer.files); });

  form.addEventListener("input", e => {
    if (editing) editing.dirty = true;
    if (e.target.classList.contains("invalid") && e.target.value.trim()) e.target.classList.remove("invalid");
  });
  form.addEventListener("change", () => { if (editing) editing.dirty = true; });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!editing) return;
    let ok = true;
    ["nombre", "categoria"].forEach(k => { const el = form.elements[k]; const bad = !el.value.trim(); el.classList.toggle("invalid", bad); if (bad) ok = false; });
    if (!ok) { toast("Completá nombre y categoría"); $(".invalid", form).focus(); return; }

    const f = form.elements;
    const data = {
      nombre: f.nombre.value, categoria: f.categoria.value, precio: f.precio.value,
      descripcion: f.descripcion.value, medidas: f.medidas.value, material: f.material.value,
      estado: f.estado.value, destacado: f.destacado.checked, visible: f.visible.checked
    };
    const isNew = !editing.id;
    const base = slug(data.nombre);
    const newFiles = [], imagenes = [];
    editing.photos.forEach(ph => {
      if (ph.isNew) {
        ph.path = ph.path || `${IMG_DIR}/${base.slice(0, 40)}-${rand()}.${ph.ext}`;
        newFiles.push({ path: ph.path, blob: ph.blob });
        imagenes.push(ph.path);
      } else imagenes.push(ph.src);
    });
    const id = editing.id || uniqueId(base, products);
    const nombre = data.nombre.trim();

    busy("Guardando…");
    const saved = await run("save", () => commit(`${isNew ? "Nuevo producto" : "Editar producto"}: ${nombre}`, list => {
      const i = list.findIndex(p => p.id === id);
      if (isNew) {
        const pid = i >= 0 ? uniqueId(id, list) : id;     // si justo se creó otro con el mismo id
        return [normalize({ ...data, id: pid, imagenes }), ...list];
      }
      if (i >= 0) { list[i] = normalize({ ...list[i], ...data, id, imagenes }); return list; }
      return [normalize({ ...data, id, imagenes }), ...list]; // lo habían borrado desde otro lado: se vuelve a crear
    }, newFiles), isNew ? `“${nombre}” agregado ✓` : "Cambios guardados ✓");

    if (saved && editing) {
      editing.photos.forEach(ph => { if (ph.isNew) { previews.set(ph.path, ph.url); ph.kept = true; } });
      closeEditor(true);
    }
  });

  $("#editorClose").onclick = () => closeEditor(false);
  $("#editorCancel").onclick = () => closeEditor(false);
  $("#editor").addEventListener("mousedown", e => { if (e.target.id === "editor") closeEditor(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && editing && $("#busy").hidden) closeEditor(false); });
  addEventListener("beforeunload", e => { if ((editing && editing.dirty) || order) { e.preventDefault(); e.returnValue = ""; } });

  /* =============================================================
     INICIO
     ============================================================= */
  fillRepoFields(initialRepo());
  ["repoOwner", "repoName", "repoBranch"].forEach(id => $("#" + id).addEventListener("input", () => { repoEdited = true; updateRepoLabel(); }));
  if (!readRepoFields().owner || !readRepoFields().name) $("#repoBox").open = true;

  $("#passToggle").onclick = () => {
    const i = $("#tokenInput"), show = i.type === "password";
    i.type = show ? "text" : "password"; $("#passToggle").textContent = show ? "Ocultar" : "Ver";
  };
  $("#loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const t = $("#tokenInput").value.trim();
    if (!t) { loginError("Pegá tu clave de acceso de GitHub."); $("#tokenInput").focus(); return; }
    if (/\s/.test(t)) { loginError("La clave no puede tener espacios. Copiala de nuevo desde GitHub."); return; }
    login(t, $("#remember").checked);
  });

  const saved = getToken();
  if (saved) login(saved, !!safe(() => LS.getItem(KEYS.token), null), { silent: true });
})();
