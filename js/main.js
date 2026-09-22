/* =============================================================
   LL Print 3D — lógica del sitio
   ============================================================= */
(() => {
  const CFG = window.CONFIG || {};
  let PRODUCTS = [];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => "$" + Number(n).toLocaleString("es-AR");
  const waLink = text => `https://wa.me/${CFG.whatsapp}${text ? "?text=" + encodeURIComponent(text) : ""}`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- contacto / links ---------- */
  const greet = `¡Hola ${CFG.marca || "LL Print 3D"}! Quería hacer una consulta.`;
  $("#waBtn").href = waLink(greet);
  $("#waFloat").href = waLink(greet);
  $("#phoneLink").href = waLink(greet);
  $("#phoneLink").target = "_blank";
  $("#phoneText").textContent = CFG.telefonoVisible;
  $("#callBtn").href = "tel:+" + CFG.whatsapp;
  $("#year").textContent = new Date().getFullYear();
  if (CFG.instagram) { const ig = $("#igLink"); ig.href = "https://instagram.com/" + CFG.instagram; ig.hidden = false; }

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- placeholder 3D cuando no hay foto ---------- */
  const SHAPES = [
    // cubo
    `<svg viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fd4ff"/><stop offset="1" stop-color="#2f7bff"/></linearGradient></defs><path d="M50 8 88 29v42L50 92 12 71V29z" fill="#123a8a"/><path d="M50 8 88 29 50 50 12 29z" fill="url(#g1)"/><path d="M50 50v42L12 71V29z" fill="#1d55c9"/><path d="M50 8 88 29v42L50 92 12 71V29zM50 50 88 29M50 50 12 29M50 50v42" fill="none" stroke="#9fe6ff" stroke-width="1.2" opacity=".7"/></svg>`,
    // esfera facetada
    `<svg viewBox="0 0 100 100"><defs><radialGradient id="g2" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7fe3ff"/><stop offset=".5" stop-color="#2f7bff"/><stop offset="1" stop-color="#0c2a6b"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#g2)"/><g fill="none" stroke="#9fe6ff" stroke-width="1" opacity=".55"><ellipse cx="50" cy="50" rx="40" ry="14"/><ellipse cx="50" cy="50" rx="14" ry="40"/><ellipse cx="50" cy="50" rx="30" ry="40"/><path d="M10 50h80"/></g></svg>`,
    // pirámide
    `<svg viewBox="0 0 100 100"><path d="M50 8 90 82 50 94z" fill="#1d55c9"/><path d="M50 8 10 82 50 94z" fill="#3fa5ff"/><path d="M50 8 90 82 50 94 10 82z" fill="none" stroke="#9fe6ff" stroke-width="1.2" opacity=".7"/><path d="M22 60h56M31 43h38M40 26h20" stroke="#9fe6ff" stroke-width=".8" opacity=".4"/></svg>`,
    // toroide
    `<svg viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a5cff"/><stop offset="1" stop-color="#3fd4ff"/></linearGradient></defs><ellipse cx="50" cy="52" rx="42" ry="26" fill="url(#g4)"/><ellipse cx="50" cy="48" rx="17" ry="8" fill="#081636"/><g fill="none" stroke="#dff6ff" stroke-width=".9" opacity=".45"><ellipse cx="50" cy="52" rx="32" ry="18"/><ellipse cx="50" cy="52" rx="24" ry="13"/></g></svg>`
  ];
  const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const placeholder = p => `<div class="ph"><div class="ph-shape">${SHAPES[hash(p.id || p.nombre) % SHAPES.length]}</div></div>`;
  // compatibilidad: "imagen" (texto) o "imagenes" (lista, la primera es la portada)
  const images = p => (Array.isArray(p.imagenes) ? p.imagenes : [p.imagen]).filter(x => typeof x === "string" && x.trim());
  const imgTag = (src, alt, lazy = true) =>
    `<img src="${esc(src)}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} onerror="this.outerHTML=this.parentNode.dataset.ph||''">`;
  const media = p => images(p).length ? imgTag(images(p)[0], p.nombre) : placeholder(p);

  /* ---------- catálogo ---------- */
  const grid = $("#productGrid");
  let activeCat = "Todos", query = "";

  function renderFilters() {
    const cats = ["Todos", ...new Set(PRODUCTS.map(p => p.categoria).filter(Boolean))];
    $("#filters").innerHTML = cats.map((c, i) => `<button class="chip${i ? "" : " active"}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  }
  $("#filters").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    $$(".chip").forEach(c => c.classList.toggle("active", c === b));
    activeCat = b.dataset.cat; renderProducts();
  });
  $("#searchInput").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); renderProducts(); });

  function priceHTML(p) { return p.precio > 0 ? `<span class="price">${money(p.precio)}</span>` : `<span class="price ask">Consultar</span>`; }
  function badgesHTML(p) {
    return `<div class="badges">${p.destacado ? `<span class="badge hot">★ Destacado</span>` : ""}${p.estado === "stock" ? `<span class="badge stock">En stock</span>` : `<span class="badge pedido">A pedido</span>`}</div>`;
  }

  function renderProducts() {
    const list = PRODUCTS
      .filter(p => activeCat === "Todos" || p.categoria === activeCat)
      .filter(p => !query || [p.nombre, p.descripcion, p.categoria, p.material].join(" ").toLowerCase().includes(query))
      .sort((a, b) => (b.destacado === true) - (a.destacado === true));

    grid.innerHTML = list.map((p, i) => `
      <article class="card" data-id="${esc(p.id)}" style="--d:${i % 4}">
        <div class="card-media" data-ph='${placeholder(p).replace(/'/g, "&#39;")}'>${badgesHTML(p)}${media(p)}</div>
        <div class="card-body">
          <span class="card-cat">${esc(p.categoria)}</span>
          <h3>${esc(p.nombre)}</h3>
          <p>${esc(p.descripcion)}</p>
          <div class="card-meta">${p.medidas ? `<span>↔ ${esc(p.medidas)}</span>` : ""}${p.material ? `<span>◆ ${esc(p.material)}</span>` : ""}</div>
          <div class="card-foot">
            ${priceHTML(p)}
            <button class="add-btn" data-add="${esc(p.id)}">+ Agregar</button>
          </div>
        </div>
      </article>`).join("");
    $("#emptyMsg").hidden = list.length > 0;
    $$(".card", grid).forEach(el => revealObserver.observe(el));
  }

  // tilt 3D + brillo que sigue al mouse
  grid.addEventListener("pointermove", e => {
    const card = e.target.closest(".card"); if (!card || e.pointerType !== "mouse") return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--mx", x * 100 + "%"); card.style.setProperty("--my", y * 100 + "%");
    if (card.classList.contains("in")) card.style.transform = `perspective(900px) rotateY(${(x - .5) * 8}deg) rotateX(${(.5 - y) * 8}deg) translateY(-4px)`;
  });
  grid.addEventListener("pointerout", e => {
    const card = e.target.closest(".card");
    if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
  });
  grid.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { addToCart(add.dataset.add); add.classList.add("added"); add.textContent = "✓ Agregado"; setTimeout(() => { add.classList.remove("added"); add.textContent = "+ Agregar"; }, 1400); return; }
    const m = e.target.closest(".card-media"); if (m) openModal(m.closest(".card").dataset.id);
  });

  /* ---------- modal ---------- */
  const modal = $("#modal");
  function openModal(id) {
    const p = PRODUCTS.find(x => x.id === id); if (!p) return;
    const imgs = images(p), mm = $("#modalMedia");
    mm.dataset.ph = placeholder(p);
    mm.innerHTML = badgesHTML(p) + (imgs.length ? imgTag(imgs[0], p.nombre, false) : placeholder(p)) +
      (imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) =>
        `<button class="thumb${i ? "" : " active"}" data-src="${esc(src)}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : "");
    $("#modalInfo").innerHTML = `
      <span class="card-cat">${esc(p.categoria)}</span>
      <h3>${esc(p.nombre)}</h3>
      <p>${esc(p.descripcion)}</p>
      <div class="specs">
        ${p.medidas ? `<div><span>Medidas</span><b>${esc(p.medidas)}</b></div>` : ""}
        ${p.material ? `<div><span>Material</span><b>${esc(p.material)}</b></div>` : ""}
        <div><span>Disponibilidad</span><b>${p.estado === "stock" ? "En stock" : "Se imprime a pedido"}</b></div>
      </div>
      ${priceHTML(p)}
      <button class="btn btn-primary" data-modal-add="${esc(p.id)}">Agregar al pedido</button>
      <a class="btn btn-ghost" target="_blank" rel="noopener" href="${waLink(`¡Hola! Me interesa "${p.nombre}". ¿Me pasan más info?`)}">Consultar por WhatsApp</a>`;
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  }
  const closeModal = () => { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); };
  $("#modalClose").onclick = closeModal;
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
    const th = e.target.closest(".thumb");
    if (th) {
      const main = $("#modalMedia > img");
      if (main) main.src = th.dataset.src;
      $$(".thumb", modal).forEach(t => t.classList.toggle("active", t === th));
    }
    const b = e.target.closest("[data-modal-add]"); if (b) { addToCart(b.dataset.modalAdd); closeModal(); }
  });

  /* ---------- carrito ---------- */
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("llp3d-cart")) || {}; } catch { return {}; } },
    set(v) { try { localStorage.setItem("llp3d-cart", JSON.stringify(v)); } catch {} }
  };
  let cart = store.get();
  const byId = id => PRODUCTS.find(p => p.id === id);

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1; saveCart();
    const c = $("#cartCount"); c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
    toast(`Agregaste "${byId(id)?.nombre}" al pedido`);
  }
  function saveCart() { store.set(cart); renderCart(); }
  function renderCart() {
    Object.keys(cart).forEach(id => { if (!byId(id) || cart[id] < 1) delete cart[id]; });
    const ids = Object.keys(cart);
    const count = ids.reduce((s, id) => s + cart[id], 0);
    const c = $("#cartCount"); c.textContent = count; c.classList.toggle("show", count > 0);
    const total = ids.reduce((s, id) => s + (byId(id).precio || 0) * cart[id], 0);
    const hasAsk = ids.some(id => !(byId(id).precio > 0));
    $("#cartTotal").textContent = money(total) + (hasAsk ? " + a consultar" : "");
    $("#checkoutBtn").disabled = !ids.length;
    $("#cartItems").innerHTML = ids.length ? ids.map(id => {
      const p = byId(id);
      return `<div class="cart-item">
        <div><h4>${esc(p.nombre)}</h4><span class="ci-price">${p.precio > 0 ? money(p.precio) + " c/u" : "Precio a consultar"}</span></div>
        <div class="qty"><button data-q="-1" data-id="${esc(id)}">−</button><b>${cart[id]}</b><button data-q="1" data-id="${esc(id)}">+</button></div>
        <span></span><button class="ci-remove" data-rm="${esc(id)}">Quitar</button>
      </div>`;
    }).join("") : `<div class="cart-empty">Tu pedido está vacío.<br>Agregá modelos del catálogo.</div>`;
  }
  $("#cartItems").addEventListener("click", e => {
    const q = e.target.closest("[data-q]"), rm = e.target.closest("[data-rm]");
    if (q) { cart[q.dataset.id] += +q.dataset.q; saveCart(); }
    if (rm) { delete cart[rm.dataset.rm]; saveCart(); }
  });
  const openDrawer = () => document.body.classList.add("drawer-open");
  const closeDrawer = () => document.body.classList.remove("drawer-open");
  $("#cartBtn").onclick = openDrawer;
  $("#drawerClose").onclick = closeDrawer;
  $("#drawerBackdrop").onclick = closeDrawer;
  $("#checkoutBtn").onclick = () => {
    const ids = Object.keys(cart); if (!ids.length) return;
    const lines = ids.map(id => { const p = byId(id); return `• ${cart[id]} x ${p.nombre}${p.precio > 0 ? ` (${money(p.precio * cart[id])})` : " (a consultar)"}`; });
    const total = ids.reduce((s, id) => s + (byId(id).precio || 0) * cart[id], 0);
    const msg = `¡Hola LL Print 3D! Quiero hacer este pedido:\n\n${lines.join("\n")}\n\nTotal estimado: ${money(total)}\n\n¿Me confirman disponibilidad, colores y envío?`;
    window.open(waLink(msg), "_blank", "noopener");
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeDrawer(); } });

  /* ---------- formulario personalizado ---------- */
  const form = $("#customForm"), fileInput = $("#fileInput"), dz = $("#dropzone");
  if (CFG.emailPedidos) {
    form.action = "https://formsubmit.co/" + CFG.emailPedidos;
    form.insertAdjacentHTML("beforeend",
      `<input type="hidden" name="_subject" value="Nuevo pedido personalizado - LL Print 3D"><input type="hidden" name="_captcha" value="false"><input type="hidden" name="_template" value="table">`);
    $(".form-note", form).innerHTML = "Tu pedido nos llega por email con la imagen y además se abre WhatsApp para seguir la charla.";
  }
  function showFile(file) {
    if (!file) return resetFile();
    if (!file.type.startsWith("image/")) { toast("El archivo tiene que ser una imagen"); return resetFile(); }
    if (file.size > 5 * 1024 * 1024) { toast("La imagen supera los 5 MB"); return resetFile(); }
    $("#dzImg").src = URL.createObjectURL(file);
    $("#dzEmpty").hidden = true; $("#dzPreview").hidden = false;
    fileInput.style.pointerEvents = "none";
  }
  function resetFile() {
    fileInput.value = ""; $("#dzEmpty").hidden = false; $("#dzPreview").hidden = true; fileInput.style.pointerEvents = "";
  }
  fileInput.addEventListener("change", () => showFile(fileInput.files[0]));
  $("#dzRemove").addEventListener("click", e => { e.preventDefault(); resetFile(); });
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", e => {
    const f = e.dataTransfer.files[0]; if (!f) return;
    const dt = new DataTransfer(); dt.items.add(f); fileInput.files = dt.files; showFile(f);
  });

  form.addEventListener("submit", e => {
    let ok = true;
    $$("[required]", form).forEach(el => { const bad = !el.value.trim(); el.classList.toggle("invalid", bad); if (bad) ok = false; });
    if (!ok) { e.preventDefault(); toast("Completá los campos marcados con *"); $(".invalid", form).focus(); return; }

    const d = Object.fromEntries(new FormData(form));
    const dims = [d.ancho && `ancho ${d.ancho}`, d.alto && `alto ${d.alto}`, d.profundidad && `prof. ${d.profundidad}`].filter(Boolean).join(" · ");
    const hasImg = fileInput.files.length > 0;
    const msg = [
      "¡Hola LL Print 3D! Quiero hacer un *pedido personalizado*:",
      "",
      `*Nombre:* ${d.nombre}`,
      `*Teléfono:* ${d.telefono}`,
      d.email ? `*Email:* ${d.email}` : null,
      `*Tipo:* ${d.tipo}`,
      dims ? `*Medidas (cm):* ${dims}` : null,
      d.color ? `*Color/material:* ${d.color}` : null,
      `*Cantidad:* ${d.cantidad || 1}`,
      d.fecha ? `*Lo necesito para:* ${d.fecha.split("-").reverse().join("/")}` : null,
      "",
      `*Detalles:* ${d.detalles}`,
      "",
      hasImg ? "📎 Les adjunto la imagen de referencia a continuación." : null
    ].filter(l => typeof l === "string").join("\n").trim();

    // Si hay email configurado, el form se envía normalmente (con la imagen) al iframe oculto.
    if (!CFG.emailPedidos) e.preventDefault();
    window.open(waLink(msg), "_blank", "noopener");
    toast(hasImg ? "¡Listo! Adjuntá la imagen en el chat de WhatsApp 📎" : "¡Pedido armado! Te esperamos en WhatsApp");
    if (CFG.emailPedidos) setTimeout(() => { form.reset(); resetFile(); }, 400);
  });
  form.addEventListener("input", e => { if (e.target.classList.contains("invalid") && e.target.value.trim()) e.target.classList.remove("invalid"); });

  /* ---------- animaciones de scroll ---------- */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); } });
  }, { threshold: .15, rootMargin: "0px 0px -40px 0px" });
  $$("[data-delay]").forEach(el => el.style.setProperty("--d", el.dataset.delay));
  $$(".reveal, .reveal-up, .reveal-left, .reveal-right").forEach(el => revealObserver.observe(el));

  const nav = $("#nav"), progress = $("#scrollProgress"), lineFill = $("#stepLineFill"), steps = $(".steps");
  const sections = $$("section[id]"), links = $$(".nav-links a");
  let ticking = false;
  function onScroll() {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
    nav.classList.toggle("scrolled", y > 30);
    const r = steps.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (innerHeight * .7 - r.top) / r.height));
    lineFill.style.transform = `scaleY(${t})`;
    let current = "";
    sections.forEach(s => { if (s.getBoundingClientRect().top < innerHeight * .4) current = s.id; });
    links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + current));
    $(".marquee-track").style.translate = `${-y * .15}px 0`;
    ticking = false;
  }
  addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();

  const glow = $("#bgGlow");
  addEventListener("pointermove", e => { glow.style.transform = `translate(${e.clientX - 350}px, ${e.clientY - 350}px)`; }, { passive: true });

  // menú mobile
  $("#burger").onclick = () => { $("#burger").classList.toggle("open"); $("#navLinks").classList.toggle("open"); };
  links.forEach(a => a.addEventListener("click", () => { $("#burger").classList.remove("open"); $("#navLinks").classList.remove("open"); }));

  // contador de modelos
  function countUp() {
    const stat = $("#statProductos"), target = PRODUCTS.length;
    if (!target) { stat.textContent = "0"; return; }
    let n = 0; const iv = setInterval(() => { stat.textContent = ++n >= target ? target + "+" : n; if (n >= target) clearInterval(iv); }, 1400 / target);
  }

  /* ---------- carga del catálogo (data/productos.json) ---------- */
  grid.innerHTML = `<p class="empty">Cargando catálogo…</p>`;
  fetch("data/productos.json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(list => {
      PRODUCTS = (Array.isArray(list) ? list : []).filter(p => p && p.id && p.nombre && p.visible !== false);
      renderFilters(); renderProducts(); renderCart(); countUp();
    })
    .catch(err => {
      console.error("No se pudo cargar data/productos.json", err);
      grid.innerHTML = `<p class="empty">No pudimos cargar el catálogo. Probá recargar la página o <a href="${waLink("¡Hola! Quería ver el catálogo de productos.")}" target="_blank" rel="noopener">escribinos por WhatsApp</a>.</p>`;
      $("#statProductos").textContent = "—";
    });

  /* ---------- escena 3D del hero ---------- */
  function initHero() {
    const canvas = $("#heroCanvas");
    if (!window.THREE || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
    camera.position.set(0, 0, 12);

    const group = new THREE.Group(); scene.add(group);
    const geo = new THREE.TorusKnotGeometry(1.6, .5, 220, 32, 2, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1f5bd8, metalness: .55, roughness: .25, emissive: 0x071a4a });
    const knot = new THREE.Mesh(geo, mat); group.add(knot);
    // "capas" de impresión: anillos horizontales que envuelven la pieza
    const layers = new THREE.Group();
    for (let i = -14; i <= 14; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, .006, 4, 90),
        new THREE.MeshBasicMaterial({ color: 0x3fd4ff, transparent: true, opacity: .12 + (i % 3 === 0 ? .12 : 0) }));
      ring.rotation.x = Math.PI / 2; ring.position.y = i * .17; layers.add(ring);
    }
    group.add(layers);
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3fd4ff, wireframe: true, transparent: true, opacity: .06 }));
    wire.scale.setScalar(1.02); group.add(wire);

    // partículas
    const pts = new THREE.BufferGeometry(), N = 600, pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - .5) * 22;
    pts.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(pts, new THREE.PointsMaterial({ color: 0x6fb8ff, size: .03, transparent: true, opacity: .7 }));
    scene.add(stars);

    scene.add(new THREE.AmbientLight(0x3355aa, .6));
    const l1 = new THREE.PointLight(0x3fd4ff, 2.2, 30); l1.position.set(5, 4, 6); scene.add(l1);
    const l2 = new THREE.PointLight(0x6a5cff, 2, 30); l2.position.set(-6, -3, 4); scene.add(l2);

    // "cabezal" que sube y baja escaneando
    const scan = new THREE.Mesh(new THREE.TorusGeometry(2.7, .02, 6, 120), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: .8 }));
    scan.rotation.x = Math.PI / 2; group.add(scan);

    let mx = 0, my = 0, visible = true;
    addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      group.position.x = w > 900 ? 3.4 : 0; group.position.y = w > 900 ? 0 : 1.2;
      group.scale.setScalar(w > 900 ? 1 : .75);
    }
    addEventListener("resize", resize); resize();

    const clock = new THREE.Clock();
    (function loop() {
      requestAnimationFrame(loop);
      if (!visible) return;
      const t = clock.getElapsedTime();
      knot.rotation.x = t * .15; knot.rotation.y = t * .22; wire.rotation.copy(knot.rotation);
      layers.rotation.y = t * .05;
      scan.position.y = Math.sin(t * .8) * 2.3;
      group.rotation.y += (mx * .6 - group.rotation.y) * .04;
      group.rotation.x += (my * .4 - group.rotation.x) * .04;
      const sy = scrollY / innerHeight;
      camera.position.z = 12 + sy * 3; group.position.y = (canvas.clientWidth > 900 ? 0 : 1.2) + sy * 1.5;
      stars.rotation.y = t * .02;
      renderer.render(scene, camera);
    })();
  }
  if (window.THREE) initHero(); else addEventListener("load", initHero);
})();
