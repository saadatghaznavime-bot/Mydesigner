(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const art = $('#artboard'), modal = $('#modal'), contextMenu = $('#canvasContextMenu'), storageKey = 'my-designer-projects-v1', activeKey = 'my-designer-active-project-v1';
  let projectId = 'project-default', active = null, saveTimer, toastTimer, zoom = 100, toolMode = 'move', selectedShape = 'rectangle', history = [], historyIndex = -1, dragLayer = null;
  const shapeLabels = { rectangle: 'Rectangle', rounded: 'Rounded rectangle', circle: 'Circle', ellipse: 'Ellipse', triangle: 'Triangle', star: 'Star', diamond: 'Diamond', hexagon: 'Hexagon', arrow: 'Arrow', heart: 'Heart', plus: 'Plus' };
  const shapeClips = {
    triangle: 'polygon(50% 0%, 100% 100%, 0% 100%)',
    star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%)',
    diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
    arrow: 'polygon(0% 30%, 62% 30%, 62% 5%, 100% 50%, 62% 95%, 62% 70%, 0% 70%)',
    heart: 'polygon(50% 94%, 7% 50%, 1% 35%, 5% 19%, 17% 8%, 31% 8%, 42% 16%, 50% 29%, 58% 16%, 69% 8%, 83% 8%, 95% 19%, 99% 35%, 93% 50%)',
    plus: 'polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)'
  };
  const shapeSizes = { rectangle: [110, 78], rounded: [110, 78], circle: [88, 88], ellipse: [110, 68], triangle: [100, 88], star: [96, 96], diamond: [88, 88], hexagon: [100, 86], arrow: [116, 70], heart: [92, 88], plus: [84, 84] };
  const adjustment = { brightness: 0, contrast: 0, highlights: 0, shadows: 0 };
  const templates = {
    'Instagram Post': { size: '1080 × 1350 px', ratio: '4 / 5' },
    'Facebook Post': { size: '1200 × 1500 px', ratio: '4 / 5' },
    'LinkedIn Post': { size: '1200 × 627 px', ratio: '1.91 / 1' }
  };
  const toast = text => { $('#toast').textContent = text; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2600); };
  const name = () => $('#projectName').childNodes[0]?.textContent.trim() || 'My design';
  function readProjects() { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; } }
  function refreshProjectPicker() { const picker = $('#projectPicker'); if (!picker) return; const projects = readProjects(), selected = projectId; picker.replaceChildren(new Option('⌄', '')); Object.entries(projects).forEach(([id, p]) => picker.add(new Option(p.name || 'My project', id))); picker.value = selected; }
  const targetFor = layer => layer?.dataset.target ? (document.getElementById(layer.dataset.target) || $('.' + CSS.escape(layer.dataset.target), art)) : null;
  const layers = () => $$('.layer');
  function layerCount() { $('#layerCount').textContent = layers().length; }
  function save() {
    const cleanArt = art.cloneNode(true); cleanArt.querySelectorAll('.resize-handle,.selection').forEach(x => x.remove()); cleanArt.querySelectorAll('.selected-object').forEach(x => x.classList.remove('selected-object'));
    cleanArt.querySelectorAll('.headline,.poster-sub,.poster-cta,.poster-brand,.user-text').forEach(x => x.removeAttribute('contenteditable'));
    const state = { name: name(), format: $('#projectName .crumb')?.textContent.replace(/^\/\s*/, '') || 'Instagram Post', html: cleanArt.innerHTML, style: art.getAttribute('style') || '', layers: $('#layers').innerHTML, prompts: $$('.prompt-text').map(x => x.value), brand: $$('.brand-fields .field').map(x => x.value), references: $$('.upload-row img.thumb').map(img => ({ section: img.dataset.section || '', dataUrl: img.src })), adjustment: { ...adjustment } };
    try { const projects = readProjects(); projects[projectId] = state; localStorage.setItem(storageKey, JSON.stringify(projects)); localStorage.setItem(activeKey, projectId); refreshProjectPicker(); $('.status').innerHTML = '<span class="dot"></span> All changes saved'; }
    catch { $('.status').textContent = 'Storage full · export your work'; }
  }
  function historyState() { const clean = art.cloneNode(true); clean.querySelectorAll('.resize-handle,.selection').forEach(x => x.remove()); clean.querySelectorAll('.selected-object').forEach(x => x.classList.remove('selected-object')); clean.querySelectorAll('.headline,.poster-sub,.poster-cta,.poster-brand,.user-text').forEach(x => x.removeAttribute('contenteditable')); return JSON.stringify({ html: clean.innerHTML, style: art.getAttribute('style') || '', layers: $('#layers').innerHTML, prompts: $$('.prompt-text').map(x => x.value), brand: $$('.brand-fields .field').map(x => x.value), references: $$('.upload-row img.thumb').map(img => ({ section: img.dataset.section || '', dataUrl: img.src })), adjustment: { ...adjustment } }); }
  function updateHistoryButtons() { $('#undoBtn').disabled = historyIndex <= 0; $('#redoBtn').disabled = historyIndex >= history.length - 1; }
  function recordHistory() { const current = historyState(); if (history[historyIndex] === current) return; history = history.slice(0, historyIndex + 1); history.push(current); if (history.length > 40) history.shift(); historyIndex = history.length - 1; updateHistoryButtons(); renderHistoryPanel(); }
  function restoreHistory(index) { if (index < 0 || index >= history.length) return; historyIndex = index; const s = JSON.parse(history[index]); active = null; art.innerHTML = s.html; art.querySelectorAll('.headline,.poster-sub,.poster-cta,.poster-brand,.user-text').forEach(x => x.removeAttribute('contenteditable')); if (s.style) art.setAttribute('style', s.style); $('#layers').innerHTML = s.layers; $$('.prompt-text').forEach((x, i) => x.value = s.prompts[i] || ''); $$('.brand-fields .field').forEach((x, i) => x.value = s.brand[i] || ''); restoreReferences(s.references || []); Object.assign(adjustment, s.adjustment || {}); $$('.adjust').forEach(x => { x.value = adjustment[x.dataset.filter] || 0; $('#' + x.dataset.filter + 'Val').textContent = x.value > 0 ? '+' + x.value : x.value; }); adjustCanvas(); fitArtboard(); art.querySelectorAll(':scope > *').forEach((el, i) => { el.dataset.canvasObject = 'true'; el.dataset.objectId ||= el.id || el.classList[0] || `object-${i}`; }); bindLayerActions(); layerCount(); updateHistoryButtons(); renderHistoryPanel(); save(); }
  function queueSave() { $('.status').innerHTML = '<span class="dot" style="background:#e6a23c"></span> Saving…'; clearTimeout(saveTimer); saveTimer = setTimeout(() => { save(); recordHistory(); }, 400); }
  function bindLayerActions() {
    layers().forEach(layer => {
      layer.onclick = e => {
        const obj = targetFor(layer);
        if (e.target.classList.contains('eye')) { obj?.classList.toggle('hidden'); e.target.style.opacity = obj?.classList.contains('hidden') ? '.35' : '1'; queueSave(); return; }
        if (obj) select(obj);
      };
      layer.ondblclick = e => {
        e.stopPropagation(); const label = $('.layer-name', layer); if (!label || $('.layer-rename', layer)) return;
        const input = document.createElement('input'); input.className = 'layer-rename'; input.value = label.textContent; input.setAttribute('aria-label', 'Layer name'); label.replaceWith(input); input.focus(); input.select();
        const finish = commit => { if (!input.isConnected) return; const next = input.value.trim(); const replacement = document.createElement('div'); replacement.className = 'layer-name'; replacement.textContent = commit && next ? next.slice(0, 48) : label.textContent; input.replaceWith(replacement); if (commit && next) queueSave(); };
        input.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); finish(true); } if (ev.key === 'Escape') finish(false); }; input.onblur = () => finish(true);
      };
      layer.draggable = true;
      layer.ondragstart = () => { layer.classList.add('dragging'); dragLayer = layer; };
      layer.ondragend = () => { layer.classList.remove('dragging'); dragLayer = null; };
      layer.ondragover = e => e.preventDefault();
      layer.ondrop = e => {
        e.preventDefault(); const dragged = dragLayer; if (!dragged || dragged === layer) return;
        const rect = layer.getBoundingClientRect(), before = e.clientX < rect.left + rect.width / 2;
        $('#layers').insertBefore(dragged, before ? layer : layer.nextSibling);
        const moving = targetFor(dragged), anchor = targetFor(layer);
        if (moving && anchor) art.insertBefore(moving, before ? anchor : anchor.nextSibling);
        updateCanvasStacking(); queueSave();
      };
    });
  }
  function select(el) {
    if (!el) return;
    $$('.selected-object', art).forEach(x => x.classList.remove('selected-object'));
    $$('.resize-handle', art).forEach(x => x.remove());
    el.classList.add('selected-object'); el.dataset.objectId ||= el.classList[0]; active = el;
    const handle = document.createElement('span'); handle.className = 'resize-handle'; handle.title = 'Drag to resize'; el.appendChild(handle);
    layers().forEach(x => x.classList.toggle('active', targetFor(x) === el));
  }
  function updateCanvasStacking() {
    layers().forEach((layer, index) => {
      const el = targetFor(layer); if (!el) return;
      if (el.classList.contains('art-bg')) el.style.zIndex = '-1';
      else if (el.classList.contains('ai-generated-bg')) el.style.zIndex = '0';
      else el.style.zIndex = String(layers().length - index + 1);
    });
  }
  function addLayerCard(el, label, type, shouldSelect = true) {
    el.id ||= 'canvas-object-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const layer = document.createElement('div'); layer.className = 'layer'; layer.dataset.target = el.id;
    layer.innerHTML = '<div class="layer-thumb" style="background:linear-gradient(140deg,#e8e5f4,#cbc3e9)"></div><div class="layer-info"><div class="layer-name"></div><div class="layer-type"></div></div><span class="eye">◉</span>';
    $('.layer-name', layer).textContent = label; $('.layer-type', layer).textContent = type; $('#layers').prepend(layer); bindLayerActions(); layerCount(); updateCanvasStacking(); if (shouldSelect) select(el); queueSave();
  }
  function addText(x, y) {
    const el = document.createElement('div'); el.className = 'user-text'; el.dataset.canvasObject = 'true'; el.contentEditable = 'true'; el.spellcheck = false; el.textContent = 'Double-click to edit';
    el.style.cssText = `position:absolute;left:${Math.max(0, Number.isFinite(x) ? x : 45)}px;top:${Math.max(0, Number.isFinite(y) ? y : 235)}px;z-index:5;color:#30362e;font:700 28px/1.15 Inter,Arial,sans-serif;max-width:75%;min-width:80px;cursor:move`;
    el.oninput = queueSave; art.appendChild(el); addLayerCard(el, 'New text', 'Text · Editable'); el.focus(); toast('Text layer added');
  }
  function createShapeElement(type, x = 0, y = 0, width = 110, height = 78) {
    const el = document.createElement('div'); el.className = 'user-shape'; el.dataset.canvasObject = 'true'; el.dataset.shape = type;
    el.style.cssText = `position:absolute;left:${Math.max(0,x)}px;top:${Math.max(0,y)}px;width:${Math.max(8,width)}px;height:${Math.max(8,height)}px;z-index:4;cursor:move;background:#f4510b;border-radius:${type === 'rounded' ? '18px' : (type === 'circle' || type === 'ellipse') ? '50%' : '0'};box-shadow:0 8px 22px rgba(0,0,0,.2)`;
    if (shapeClips[type]) { el.style.clipPath = shapeClips[type]; el.style.boxShadow = 'none'; el.style.filter = 'drop-shadow(0 6px 7px rgba(0,0,0,.22))'; }
    return el;
  }
  function addShape(x, y, width, height, type = selectedShape) {
    const size = shapeSizes[type] || shapeSizes.rectangle;
    const el = createShapeElement(type, Number.isFinite(x) ? x : 65, Number.isFinite(y) ? y : 180, width || size[0], height || size[1]);
    art.appendChild(el); addLayerCard(el, shapeLabels[type] || 'Shape', 'Shape · Editable vector');
  }
  function addImage(data, label, x, y) {
    const left = Number.isFinite(x) ? x : Math.max(0, (art.clientWidth - 190) / 2), top = Number.isFinite(y) ? y : Math.max(0, (art.clientHeight - 190) / 2);
    const el = document.createElement('div'); el.className = 'user-image'; el.dataset.canvasObject = 'true'; el.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:190px;height:190px;z-index:2;cursor:move`;
    const img = document.createElement('img'); img.src = data; img.alt = label; img.draggable = false; img.style.cssText = 'width:100%;height:100%;object-fit:contain'; el.appendChild(img); art.appendChild(el); addLayerCard(el, label, 'Image · Editable layer');
  }
  function setProjectTitle(title, format) { const node = $('#projectName'), crumb = document.createElement('span'); crumb.className = 'crumb'; crumb.textContent = '/ ' + format; node.replaceChildren(document.createTextNode(title + ' '), crumb); }
  function imageData(file, max = 1200) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => { if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) { resolve(reader.result); return; } const img = new Image(); img.onerror = reject; img.onload = () => { const ratio = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio); const ctx = c.getContext('2d'); if (file.type === 'image/png' || file.type === 'image/webp') { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/png')); } else { ctx.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', .82)); } }; img.src = reader.result; }; reader.readAsDataURL(file); });
  }
  function adjustCanvas() {
    const brightness = 100 + adjustment.brightness + adjustment.highlights * .18 + adjustment.shadows * .1;
    const contrast = 100 + adjustment.contrast + adjustment.highlights * .1;
    art.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  }
  async function generate() {
    const button = $('#generate'), prior = button.innerHTML; button.disabled = true; button.innerHTML = '<span class="spark">✦</span> Creating artwork…';
    const cards = $$('.prompt-card'), sections = { design: cards[0]?.querySelector('textarea')?.value || '', typography: cards[1]?.querySelector('textarea')?.value || '', copy: cards[2]?.querySelector('textarea')?.value || '', brand: $$('.brand-fields .field').map(x => x.value).filter(Boolean).join(' · ') };
    const references = $$('.upload-row img.thumb').map(img => ({ section: img.dataset.section || '', dataUrl: img.src })).slice(0, 6);
    const formatName = $('#projectName .crumb')?.textContent.replace(/^\/\s*/, '') || 'Instagram Post'; const format = templates[formatName] || templates['Instagram Post'];
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sections, format: formatName, size: format.size, references }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'AI generation failed');
      const previous = $('.ai-generated-bg', art); if (previous) { layers().find(x => targetFor(x) === previous)?.remove(); previous.remove(); }
      const sourceBackground = $('.art-bg', art); if (sourceBackground) sourceBackground.style.background = 'transparent'; sourceBackground.style.visibility = 'hidden';
      const bg = document.createElement('div'); bg.className = 'ai-generated-bg'; bg.dataset.canvasObject = 'true'; bg.style.cssText = 'position:absolute;inset:0;z-index:0';
      const img = document.createElement('img'); img.src = data.image; img.alt = 'AI generated artwork'; img.style.cssText = 'width:100%;height:100%;object-fit:cover'; bg.appendChild(img); art.insertBefore(bg, art.firstChild);
      const lines = String(sections.copy).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      if (lines[0]) $('#headline').textContent = lines[0]; if (lines[1]) $('.poster-sub', art).textContent = lines[1]; if (lines[2]) $('.poster-cta', art).textContent = lines[2];
      const brandName = $$('.brand-fields .field')[2]?.value.trim(); if (brandName) $('.poster-brand', art).textContent = brandName;
      if (/sans/i.test(sections.typography)) $('#headline').style.fontFamily = 'Inter, Arial, sans-serif'; else if (/serif/i.test(sections.typography)) $('#headline').style.fontFamily = 'Georgia, serif';
      $$('.poster-copy,.poster-cta,.poster-brand', art).forEach(x => x.style.zIndex = '3'); addLayerCard(bg, data.demo ? 'Demo artwork' : 'AI artwork', 'Generated image · Editable layer'); toast(data.demo ? 'Demo artwork generated · no API key needed' : 'AI artwork added as its own layer');
    } catch (err) { toast(err.message); }
    finally { button.innerHTML = prior; button.disabled = false; queueSave(); }
  }
  function exportDesign(kind = 'png') {
    const clone = art.cloneNode(true); clone.querySelectorAll('.resize-handle,.selection,.brush-preview').forEach(x => x.remove()); clone.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable')); clone.classList.remove('selected-object'); clone.style.transform = 'none'; clone.querySelectorAll('img').forEach(image => { const src = image.getAttribute('src') || ''; if (src.startsWith('/assets/')) image.src = new URL(src, location.href).href; });
    const width = art.clientWidth, height = art.clientHeight, dimensions = ($('#sizeLabel').textContent.match(/[\d,]+/g) || []).map(x => Number(x.replaceAll(',', ''))), outWidth = dimensions[0] || Math.round(width * 2), outHeight = dimensions[1] || Math.round(height * 2),
      css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n'),
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${clone.outerHTML}</div></foreignObject></svg>`;
    const safeName = (name() || 'my-designer').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'my-designer';
    const download = (file, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };
    if (kind === 'svg') { download(`${safeName}.svg`, new Blob([svg], { type: 'image/svg+xml' })); toast('SVG downloaded'); return; }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = outWidth; c.height = outHeight; const ctx = c.getContext('2d'); if (kind === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, outWidth, outHeight); } ctx.drawImage(img, 0, 0, outWidth, outHeight); c.toBlob(blob => { if (blob) { const ext = kind === 'jpeg' ? 'jpg' : 'png'; download(`${safeName}.${ext}`, blob); toast(`${ext.toUpperCase()} downloaded`); } else toast('Export failed. Try SVG.'); URL.revokeObjectURL(url); }, kind === 'jpeg' ? 'image/jpeg' : 'image/png', .94); };
    img.onerror = () => { URL.revokeObjectURL(url); toast('PNG export failed; try SVG export.'); }; img.src = url;
  }
  function addReferencePreview(row, dataUrl, section) {
    const item = document.createElement('span'); item.className = 'reference-item';
    const thumb = document.createElement('img'); thumb.className = 'thumb'; thumb.src = dataUrl; thumb.alt = `${section || 'Design'} reference`; thumb.dataset.section = section || '';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-reference'; remove.textContent = '×'; remove.title = 'Remove reference';
    remove.onclick = () => { item.remove(); queueSave(); };
    item.append(thumb, remove); row.insertBefore(item, row.querySelector('.upload-chip')); return item;
  }
  function restoreReferences(references = []) {
    $$('.reference-item').forEach(item => item.remove());
    references.forEach(ref => { const card = $$('.prompt-card').find(x => $('.card-name', x)?.textContent === ref.section); const row = card && $('.upload-row', card); if (row && ref.dataUrl) addReferencePreview(row, ref.dataUrl, ref.section); });
  }
  function loadSaved() {
    try { const projects = readProjects(), id = localStorage.getItem(activeKey) || Object.keys(projects)[0], s = projects[id]; if (!s) return; if (id === 'project-default' && !s.html.includes('pinpitch-campaign-v2')) { projectId = id; return; } projectId = id; art.innerHTML = s.html; art.querySelectorAll('.headline,.poster-sub,.poster-cta,.poster-brand,.user-text').forEach(x => x.removeAttribute('contenteditable')); if (s.style) art.setAttribute('style', s.style); $('#layers').innerHTML = s.layers || ''; setProjectTitle(s.name, s.format); const t = templates[s.format] || templates['Instagram Post']; $('#sizeLabel').textContent = t.size; $('.canvas-meta strong').textContent = t.size; art.style.aspectRatio = t.ratio; $$('.prompt-text').forEach((x, i) => x.value = s.prompts?.[i] ?? x.value); $$('.brand-fields .field').forEach((x, i) => x.value = s.brand?.[i] ?? x.value); Object.assign(adjustment, s.adjustment || {}); $$('.adjust').forEach(x => { x.value = adjustment[x.dataset.filter] || 0; $('#' + x.dataset.filter + 'Val').textContent = x.value > 0 ? '+' + x.value : x.value; }); restoreReferences(s.references || []); adjustCanvas(); } catch { localStorage.removeItem(storageKey); }
  }
  function fitArtboard() {
    const stage = $('.canvas-stage'); if (!stage) return;
    const parts = (art.style.aspectRatio || '4 / 5').split('/').map(x => parseFloat(x.trim()));
    const ratio = parts[0] && parts[1] ? parts[0] / parts[1] : .8;
    const width = Math.max(100, Math.min(430, stage.clientWidth - 30, (stage.clientHeight - 30) * ratio));
    art.style.width = `${width}px`; art.style.height = `${width / ratio}px`; applyZoom();
  }
  function applyZoom() { const scale = zoom / 100, content = $('#canvasZoomContent'), width = parseFloat(art.style.width) || art.clientWidth, height = parseFloat(art.style.height) || art.clientHeight; art.style.transform = `scale(${scale})`; content.style.width = `${width * scale}px`; content.style.height = `${height * scale}px`; $('#zoom').textContent = `${zoom}%`; }
  function setZoom(value) { zoom = Math.max(25, Math.min(300, value)); applyZoom(); }
  function createProject() {
    save(); const format = $('.format.selected'), title = $('#newName').value || 'Untitled project';
    projectId = 'project-' + Date.now();
    setProjectTitle(title, format.dataset.format); $('#sizeLabel').textContent = format.dataset.size; $('.canvas-meta strong').textContent = format.dataset.size; art.style.aspectRatio = format.dataset.ratio; art.innerHTML = '<div class="art-bg" data-canvas-object="true"></div>'; $('#layers').innerHTML = ''; const bg = $('.art-bg', art); addLayerCard(bg, 'Background', 'Base layer', false); $$('.prompt-text').forEach(x => x.value = ''); $$('.brand-fields .field').forEach(x => x.value = ''); $$('.reference-item').forEach(x => x.remove()); Object.keys(adjustment).forEach(k => adjustment[k] = 0); $$('.adjust').forEach(x => { x.value = 0; $('#' + x.dataset.filter + 'Val').textContent = '0'; }); active = null; adjustCanvas(); fitArtboard(); layerCount(); modal.classList.add('hidden'); $('#newName').value = 'Untitled social post'; history = []; historyIndex = -1; queueSave(); toast('New editable canvas created');
  }
  function selectTool(button) {
    const modeOf = item => { const label = (item.title || item.textContent).toLowerCase(); return label.includes('type') || label.includes('text') ? 'text' : label.includes('shape') ? 'shape' : label.includes('brush') ? 'brush' : label.includes('crop') ? 'crop' : label.includes('select') ? 'select' : 'move'; };
    toolMode = modeOf(button); $$('.tool,.tooltile').forEach(x => { const selected = modeOf(x) === toolMode; x.classList.toggle('active', selected && x.classList.contains('tool')); x.classList.toggle('selected', selected && x.classList.contains('tooltile')); }); $('#shapePicker').classList.toggle('hidden', toolMode !== 'shape');
    const messages = { text: 'Click on the canvas to add text', shape: 'Drag on the canvas to draw a shape', brush: 'Draw on the canvas to add an editable stroke', crop: 'Select an image, then drag to reframe it', select: 'Click a layer to select it', move: 'Move tool selected' }; toast(messages[toolMode]);
  }
  function normalize(el) { const a = art.getBoundingClientRect(), r = el.getBoundingClientRect(), scale = a.width / parseFloat(getComputedStyle(art).width); el.style.left = `${(r.left - a.left) / scale}px`; el.style.top = `${(r.top - a.top) / scale}px`; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; el.style.width = `${r.width / scale}px`; el.style.height = `${r.height / scale}px`; }
  function canvasPoint(e) { const rect = art.getBoundingClientRect(), scale = rect.width / (parseFloat(getComputedStyle(art).width) || rect.width); return { x: Math.max(0, Math.min(art.clientWidth, (e.clientX - rect.left) / scale)), y: Math.max(0, Math.min(art.clientHeight, (e.clientY - rect.top) / scale)), scale }; }
  function startTransform(el, e, resize) {
    normalize(el); const point = canvasPoint(e), scale = point.scale;
    const start = { x: e.clientX, y: e.clientY, left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0, width: parseFloat(el.style.width) || 18, height: parseFloat(el.style.height) || 18 };
    const move = ev => { const dx = (ev.clientX - start.x) / scale, dy = (ev.clientY - start.y) / scale; if (resize) { el.style.width = `${Math.max(18, start.width + dx)}px`; el.style.height = `${Math.max(18, start.height + dy)}px`; } else { el.style.left = `${Math.max(0, Math.min(art.clientWidth - 18, start.left + dx))}px`; el.style.top = `${Math.max(0, Math.min(art.clientHeight - 18, start.top + dy))}px`; } };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); queueSave(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); window.addEventListener('pointercancel', end, { once: true });
  }
  function addBrush(points) {
    if (points.length < 2) return;
    const pad = 8, minX = Math.max(0, Math.min(...points.map(p => p.x)) - pad), minY = Math.max(0, Math.min(...points.map(p => p.y)) - pad), maxX = Math.min(art.clientWidth, Math.max(...points.map(p => p.x)) + pad), maxY = Math.min(art.clientHeight, Math.max(...points.map(p => p.y)) + pad), width = Math.max(16, maxX - minX), height = Math.max(16, maxY - minY);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('user-brush'); svg.dataset.canvasObject = 'true'; svg.style.cssText = `position:absolute;left:${minX}px;top:${minY}px;width:${width}px;height:${height}px;overflow:visible;z-index:7;cursor:move`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'} ${(p.x - minX).toFixed(1)} ${(p.y - minY).toFixed(1)}`).join(' ')); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#f4510b'); path.setAttribute('stroke-width', '5'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(path); art.appendChild(svg); addLayerCard(svg, 'Brush stroke', 'Vector · Editable');
  }
  function startCropPan(el, e) {
    const img = $('img', el); if (!img) return;
    img.style.objectFit = 'cover'; img.style.objectPosition ||= '50% 50%';
    const width = el.clientWidth, height = el.clientHeight, scale = canvasPoint(e).scale, naturalW = img.naturalWidth || width, naturalH = img.naturalHeight || height, fit = Math.max(width / naturalW, height / naturalH), extraX = Math.max(0, naturalW * fit - width), extraY = Math.max(0, naturalH * fit - height), [startX, startY] = img.style.objectPosition.split(' ').map(v => parseFloat(v) || 50);
    const move = ev => { const dx = (ev.clientX - e.clientX) / scale, dy = (ev.clientY - e.clientY) / scale; img.style.objectPosition = `${Math.max(0, Math.min(100, startX - (extraX ? dx / extraX * 100 : 0)))}% ${Math.max(0, Math.min(100, startY - (extraY ? dy / extraY * 100 : 0)))}%`; };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); queueSave(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); window.addEventListener('pointercancel', end, { once: true });
  }
  art.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    contextMenu.classList.add('hidden');
    if (toolMode === 'shape') {
      e.preventDefault(); const start = canvasPoint(e), size = shapeSizes[selectedShape] || shapeSizes.rectangle, shape = createShapeElement(selectedShape, start.x, start.y, 8, 8); art.appendChild(shape); let moved = false;
      const move = ev => {
        const point = canvasPoint(ev); let dx = point.x - start.x, dy = point.y - start.y;
        if (ev.shiftKey || selectedShape === 'circle') { const side = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * side; dy = Math.sign(dy || 1) * side; }
        const endX = start.x + dx, endY = start.y + dy; moved ||= Math.hypot(dx, dy) > 4;
        shape.style.left = `${Math.min(start.x, endX)}px`; shape.style.top = `${Math.min(start.y, endY)}px`; shape.style.width = `${Math.max(8, Math.abs(dx))}px`; shape.style.height = `${Math.max(8, Math.abs(dy))}px`;
      };
      const end = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
        if (!moved) { shape.style.left = `${Math.max(0, start.x - size[0] / 2)}px`; shape.style.top = `${Math.max(0, start.y - size[1] / 2)}px`; shape.style.width = `${size[0]}px`; shape.style.height = `${size[1]}px`; }
        addLayerCard(shape, shapeLabels[selectedShape] || 'Shape', 'Shape · Editable vector');
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); window.addEventListener('pointercancel', end, { once: true }); return;
    }
    if (toolMode === 'text') { const existingText = e.target.closest('.headline,.poster-sub,.poster-cta,.poster-brand,.user-text'); if (existingText) { e.preventDefault(); existingText.contentEditable = 'true'; existingText.focus(); select(existingText.closest('[data-canvas-object]')); return; } e.preventDefault(); const p = canvasPoint(e); addText(p.x, p.y); return; }
    if (toolMode === 'brush') {
      e.preventDefault(); const points = [canvasPoint(e)]; let preview = $('svg.brush-preview', art); if (!preview) { preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); preview.classList.add('brush-preview'); preview.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible'; preview.setAttribute('viewBox', `0 0 ${art.clientWidth} ${art.clientHeight}`); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#f4510b'); p.setAttribute('stroke-width', '5'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); preview.appendChild(p); art.appendChild(preview); }
      const path = $('path', preview), redraw = () => path.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')), move = ev => { points.push(canvasPoint(ev)); redraw(); };
      const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); preview.remove(); addBrush(points); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true }); return;
    }
    const el = e.target.closest('[data-canvas-object]'); if (!el) return; const resizing = !!e.target.closest('.resize-handle'); select(el);
    if (toolMode === 'select') return;
    if (toolMode === 'crop') { if (!el.classList.contains('user-image')) { toast('Choose a placed image layer to crop'); return; } e.preventDefault(); if (resizing) startTransform(el, e, true); else startCropPan(el, e); return; }
    if (e.target.isContentEditable && !resizing) return;
    e.preventDefault(); startTransform(el, e, resizing);
  });
  art.addEventListener('contextmenu', e => {
    let target = e.target.closest('[data-canvas-object]');
    if (!target || target.classList.contains('art-bg')) target = active?.isConnected && !active.classList.contains('art-bg') ? active : null;
    if (!target) { contextMenu.classList.add('hidden'); return; }
    e.preventDefault(); select(target); contextMenu.classList.remove('hidden');
    const rect = contextMenu.getBoundingClientRect(), left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, e.clientX)), top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, e.clientY));
    contextMenu.style.left = `${left}px`; contextMenu.style.top = `${top}px`;
  });
  contextMenu.addEventListener('click', e => {
    const alignButton = e.target.closest('[data-align]');
    if (alignButton) {
      const el = active; if (!el || !el.isConnected || el.classList.contains('art-bg')) { toast('Select an object layer to align'); return; }
      normalize(el); const width = parseFloat(el.style.width) || el.offsetWidth, height = parseFloat(el.style.height) || el.offsetHeight, pos = alignButton.dataset.align;
      if (pos === 'left') el.style.left = '0px'; if (pos === 'hcenter') el.style.left = `${Math.max(0, (art.clientWidth - width) / 2)}px`; if (pos === 'right') el.style.left = `${Math.max(0, art.clientWidth - width)}px`;
      if (pos === 'top') el.style.top = '0px'; if (pos === 'vcenter') el.style.top = `${Math.max(0, (art.clientHeight - height) / 2)}px`; if (pos === 'bottom') el.style.top = `${Math.max(0, art.clientHeight - height)}px`;
      contextMenu.classList.add('hidden'); queueSave(); toast('Object aligned to canvas');
    }
    if (e.target.closest('#contextDelete')) { contextMenu.classList.add('hidden'); deleteSelectedLayer(); }
  });
  art.addEventListener('dblclick', e => { const text = e.target.closest('.headline,.poster-sub,.poster-cta,.poster-brand,.user-text'); if (!text) return; text.contentEditable = 'true'; text.focus(); });
  art.addEventListener('focusout', e => { if (e.target.matches('.headline,.poster-sub,.poster-cta,.poster-brand,.user-text')) { e.target.contentEditable = 'false'; queueSave(); } });
  art.addEventListener('input', e => { if (e.target.isContentEditable) { const object = e.target.closest('[data-canvas-object]'), layer = layers().find(x => targetFor(x) === object); if (layer && !object.classList.contains('poster-copy')) $('.layer-name', layer).textContent = e.target.textContent.slice(0, 28) || 'Text layer'; queueSave(); } });
  $('#newProject').onclick = () => modal.classList.remove('hidden'); $('#closeModal').onclick = $('#cancelModal').onclick = () => modal.classList.add('hidden');
  $('#modal').onclick = e => { if (e.target === $('#modal')) modal.classList.add('hidden'); };
  $$('.prompt-card .card-top .iconbtn').forEach(button => button.onclick = () => { const card = button.closest('.prompt-card'), collapsed = !card.classList.contains('collapsed'); card.classList.toggle('collapsed', collapsed); [...card.children].filter(child => !child.classList.contains('card-top')).forEach(child => child.classList.toggle('hidden', collapsed)); button.textContent = collapsed ? '⌄' : '⌃'; button.title = collapsed ? 'Expand section' : 'Collapse section'; });
  $$('.format').forEach(b => b.onclick = () => { $$('.format').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); }); $('#createProject').onclick = createProject;
  $('#generate').onclick = generate; bindLayerActions();
  $('#projectPicker').onchange = e => { if (!e.target.value || e.target.value === projectId) return; save(); localStorage.setItem(activeKey, e.target.value); history = []; historyIndex = -1; loadSaved(); bindLayerActions(); layerCount(); fitArtboard(); recordHistory(); toast('Saved project opened'); };
  $$('#iosNav button').forEach(button => button.onclick = () => { $$('#iosNav button').forEach(x => x.classList.remove('active')); button.classList.add('active'); if (button.dataset.nav === 'references') { $('.right-panel').scrollTo({ top: 0, behavior: 'smooth' }); } else if (button.dataset.nav === 'brand') { const card = $$('.prompt-card').find(x => $('.card-name', x)?.textContent.includes('Brand')); card?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else { $('.canvas-stage').scrollIntoView({ block: 'center', behavior: 'smooth' }); } });
  $$('.tool,.tooltile').forEach(b => b.onclick = () => selectTool(b)); $('#addLayer').onclick = addText;
  $$('.shape-option').forEach(button => button.onclick = () => { selectedShape = button.dataset.shape; $$('.shape-option').forEach(x => x.classList.toggle('active', x === button)); toast(`${shapeLabels[selectedShape]} selected · drag on canvas to draw`); });
  $('#addCanvasImage').onclick = () => $('#canvasImageInput').click();
  function deleteSelectedLayer() {
    const layer = layers().find(x => targetFor(x) === active) || $('.layer.active', $('#layers')), el = active?.isConnected ? active : targetFor(layer);
    if (!el) { toast('Select a layer first'); return; } if (el.classList.contains('art-bg')) { toast('The canvas background layer stays in the project'); return; }
    layer?.remove(); el.remove(); active = null; layerCount(); updateCanvasStacking(); queueSave();
  }
  $('#deleteLayer').onclick = deleteSelectedLayer;
  $('#moveLayerUp').onclick = () => {
    const layer = layers().find(x => targetFor(x) === active) || $('.layer.active', $('#layers')), above = layer?.previousElementSibling, el = targetFor(layer);
    if (!layer || !above || !el) { toast('This layer is already at the top'); return; }
    $('#layers').insertBefore(layer, above); art.insertBefore(el, targetFor(above)); updateCanvasStacking(); queueSave();
  };
  $$('.adjust').forEach(input => input.oninput = () => { adjustment[input.dataset.filter] = +input.value; $('#' + input.dataset.filter + 'Val').textContent = input.value > 0 ? '+' + input.value : input.value; adjustCanvas(); queueSave(); });
  $('#resetAdjust').onclick = () => { $$('.adjust').forEach(x => x.value = 0); Object.keys(adjustment).forEach(k => { adjustment[k] = 0; $('#' + k + 'Val').textContent = '0'; }); adjustCanvas(); queueSave(); };
  $$('.prompt-text').forEach(textarea => textarea.addEventListener('input', queueSave));
  $$('.brand-fields .field').forEach((input, i) => input.addEventListener('input', () => { if (i === 2 && input.value.trim()) $('.poster-brand', art).textContent = input.value.trim(); queueSave(); }));
  const supportedImage = file => file.type.startsWith('image/') || /\.svg$/i.test(file.name);
  async function importFiles(files, row) {
    const card = row.closest('.prompt-card'), section = $('.card-name', card)?.textContent || '', isBrand = section.includes('Brand');
    try { for (const file of [...files]) { if (!supportedImage(file)) continue; const data = await imageData(file); addReferencePreview(row, data, section); if (isBrand) addImage(data, file.name); } queueSave(); toast('Image added'); }
    catch { toast('Could not load that image. Try PNG, JPG, or SVG.'); }
  }
  async function importCanvasFiles(files, position = null) {
    const images = [...files].filter(supportedImage); if (!images.length) { toast('Choose PNG, JPEG, or SVG images'); return; }
    try { for (const [index, file] of images.entries()) { const data = await imageData(file); const x = position ? Math.max(0, position.x + index * 18) : undefined, y = position ? Math.max(0, position.y + index * 18) : undefined; addImage(data, file.name || `Image ${index + 1}`, x, y); } toast(`${images.length} image${images.length === 1 ? '' : 's'} added to canvas`); }
    catch { toast('Could not load that image. Try PNG, JPEG, or SVG.'); }
  }
  $$('input[type=file]').filter(input => input.id !== 'canvasImageInput').forEach(input => input.onchange = () => { if (input.files.length) importFiles(input.files, input.closest('.upload-row')); input.value = ''; });
  $('#canvasImageInput').onchange = () => { if ($('#canvasImageInput').files.length) importCanvasFiles($('#canvasImageInput').files); $('#canvasImageInput').value = ''; };
  const stage = $('.canvas-stage');
  stage.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); stage.classList.add('image-drop-ready'); } });
  stage.addEventListener('dragleave', e => { if (!stage.contains(e.relatedTarget)) stage.classList.remove('image-drop-ready'); });
  stage.addEventListener('drop', e => { if ([...e.dataTransfer.files].length) { e.preventDefault(); stage.classList.remove('image-drop-ready'); const point = e.target.closest('#artboard') ? canvasPoint(e) : null; importCanvasFiles(e.dataTransfer.files, point ? { x: point.x - 95, y: point.y - 95 } : null); } });
  $$('.upload-row').forEach(row => {
    row.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); row.classList.add('drag-over'); } });
    row.addEventListener('dragleave', e => { if (!row.contains(e.relatedTarget)) row.classList.remove('drag-over'); });
    row.addEventListener('drop', e => { if ([...e.dataTransfer.files].length) { e.preventDefault(); row.classList.remove('drag-over'); importFiles(e.dataTransfer.files, row); } });
  });
  $('#exportBtn').onclick = () => { const menu = $('#exportMenu'); menu.classList.toggle('hidden'); $('#exportBtn').setAttribute('aria-expanded', String(!menu.classList.contains('hidden'))); };
  $$('[data-export]').forEach(button => button.onclick = () => { $('#exportMenu').classList.add('hidden'); $('#exportBtn').setAttribute('aria-expanded', 'false'); exportDesign(button.dataset.export); });
  document.addEventListener('click', e => { if (!e.target.closest('.export-wrap')) { $('#exportMenu').classList.add('hidden'); $('#exportBtn').setAttribute('aria-expanded', 'false'); } if (!e.target.closest('#canvasContextMenu')) contextMenu.classList.add('hidden'); });
  $('#quickPng').onclick = () => exportDesign('png'); $('#quickZoom').onclick = () => setZoom(100);
  $('#zoomIn').onclick = () => setZoom(zoom + 10); $('#zoomOut').onclick = () => setZoom(zoom - 10); $('#zoomFit').onclick = () => setZoom(100);
  $('.canvas-stage').addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? 10 : -10)); } }, { passive: false });
  $('#addColor').onclick = () => { const input = document.createElement('input'); input.type = 'color'; input.oninput = () => { if (!active) return; if (active.classList.contains('user-shape')) active.style.backgroundColor = input.value; else if (active.classList.contains('user-brush')) $('path', active).setAttribute('stroke', input.value); else if (active.classList.contains('user-image')) $('img', active).style.filter = `drop-shadow(0 0 0 ${input.value})`; else active.style.color = input.value; }; input.onchange = queueSave; input.click(); };
  $$('.left-heading .iconbtn').forEach(button => button.onclick = () => toast('Shortcuts: Ctrl/⌘ + Z undo · Ctrl/⌘ + scroll zoom · Delete removes the selected layer'));
  $$('.subhead .iconbtn').filter(button => button.title.includes('More color')).forEach(button => button.onclick = () => $('#addColor').click());
  function renderAssetPanel() {
    const panel = $('#dockAssets'); panel.replaceChildren(); const assets = $$('.upload-row img.thumb');
    if (!assets.length) { const empty = document.createElement('span'); empty.className = 'upload-hint'; empty.textContent = 'Uploaded references and logos will appear here.'; panel.append(empty); return; }
    assets.forEach((asset, i) => { const button = document.createElement('button'); button.className = 'asset-card'; button.type = 'button'; const img = document.createElement('img'); img.src = asset.src; img.alt = asset.alt; const label = document.createElement('span'); label.textContent = `${asset.dataset.section || 'Reference'} · ${i + 1}`; button.append(img, label); button.onclick = () => addImage(asset.src, asset.alt || `Asset ${i + 1}`); panel.append(button); });
  }
  function renderHistoryPanel() {
    const panel = $('#dockHistory'); if (!panel) return; panel.replaceChildren();
    history.forEach((state, i) => { const item = document.createElement('button'); item.className = 'history-card'; item.type = 'button'; item.textContent = i === historyIndex ? `Current · ${i + 1}` : `Version ${i + 1}`; item.title = 'Restore this saved edit'; item.onclick = () => restoreHistory(i); panel.append(item); });
  }
  $$('.dock-tab').forEach(tab => tab.onclick = () => {
    $$('.dock-tab').forEach(x => x.classList.remove('active')); tab.classList.add('active'); const view = tab.textContent.trim().toLowerCase();
    $('#layers').classList.toggle('hidden', view !== 'layers'); $('#dockAssets').classList.toggle('hidden', view !== 'assets'); $('#dockHistory').classList.toggle('hidden', view !== 'history');
    $('.dock-title').textContent = view === 'layers' ? 'Layers' : view === 'assets' ? 'Assets' : 'History';
    if (view === 'assets') renderAssetPanel(); if (view === 'history') renderHistoryPanel();
  });
  $('#undoBtn').onclick = () => restoreHistory(historyIndex - 1); $('#redoBtn').onclick = () => restoreHistory(historyIndex + 1);
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); toast('Project saved'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.isContentEditable && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); restoreHistory(historyIndex + (e.shiftKey ? 1 : -1)); }
    if ((e.ctrlKey || e.metaKey) && ['+', '='].includes(e.key)) { e.preventDefault(); setZoom(zoom + 10); }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(zoom - 10); }
    if (e.key === '0' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { setZoom(100); }
    if (e.key === 'Escape') { $('#exportMenu').classList.add('hidden'); modal.classList.add('hidden'); contextMenu.classList.add('hidden'); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && active && !e.target.isContentEditable && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); deleteSelectedLayer(); }
  });
  window.addEventListener('beforeunload', save);
  loadSaved(); art.querySelectorAll(':scope > *').forEach((el, i) => { el.dataset.canvasObject = 'true'; el.dataset.objectId ||= el.id || el.classList[0] || `object-${i}`; }); bindLayerActions(); layerCount(); fitArtboard(); new ResizeObserver(fitArtboard).observe($('.canvas-stage')); recordHistory(); save(); refreshProjectPicker();
  fetch('/api/status').then(r => r.json()).then(s => { const keyName = s.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'; $('.ai-badge').textContent = s.demoMode ? '✦ DEMO MODE' : s.aiConfigured ? '✦ AI READY' : '✦ ADD API KEY'; $('.ai-badge').title = s.demoMode ? 'Local demo generator is active. Set AI_PROVIDER=gemini or openai to connect an image model.' : s.aiConfigured ? `${s.provider} image generation is configured` : `Set ${keyName} in .env to enable generation`; }).catch(() => { $('.ai-badge').textContent = '✦ START SERVER'; });
})();
