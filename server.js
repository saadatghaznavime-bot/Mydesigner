const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const generationWindows = new Map();
const loginFailures = new Map();
function loginIdentity(req) {
  return req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}
function loginRateLimited(req) {
  const record = loginFailures.get(loginIdentity(req));
  if (!record) return false;
  if (Date.now() - record.startedAt > 10 * 60_000) { loginFailures.delete(loginIdentity(req)); return false; }
  return record.count >= 5;
}
function recordFailedLogin(req) {
  const key = loginIdentity(req), now = Date.now(), record = loginFailures.get(key);
  if (!record || now - record.startedAt > 10 * 60_000) loginFailures.set(key, { startedAt: now, count: 1 });
  else record.count++;
}
function generationAllowed(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now(), windowMs = 60_000, maxRequests = 24;
  const record = generationWindows.get(ip);
  if (!record || now - record.startedAt > windowMs) { generationWindows.set(ip, { startedAt: now, count: 1 }); return true; }
  if (record.count >= maxRequests) return false;
  record.count++; return true;
}
function json(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': 'same-origin' });
  res.end(JSON.stringify(data));
}
const sessionCookie = 'my_designer_preview';
const sessionLifetime = 7 * 24 * 60 * 60;
function privatePreviewRequired() { return process.env.PRIVATE_DEMO === 'true' || Boolean(process.env.DEMO_PASSWORD); }
function sessionSignature(timestamp) { return crypto.createHmac('sha256', process.env.DEMO_PASSWORD || '').update(timestamp).digest('hex'); }
function equalSecret(a, b) { const left = Buffer.from(String(a)); const right = Buffer.from(String(b)); return left.length === right.length && crypto.timingSafeEqual(left, right); }
function hasPreviewSession(req) {
  if (!privatePreviewRequired()) return true;
  if (!process.env.DEMO_PASSWORD) return false;
  const header = req.headers.cookie || '';
  const token = header.split(';').map(x => x.trim()).find(x => x.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  if (!token) return false;
  const [timestamp, signature] = token.split('.');
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= sessionLifetime && equalSecret(signature || '', sessionSignature(timestamp));
}
function readBody(req, limit = 18 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; if (Buffer.byteLength(body) > limit) { reject(new Error('Request is too large. Try smaller reference images.')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request.')); } });
    req.on('error', reject);
  });
}
function makeDemoArtwork(brief) {
  const direction = String(brief.sections?.design || '').toLowerCase();
  let colors = ['#17100d', '#472416', '#f4510b', '#f4a260'];
  if (/blue|ocean|cool|tech|digital/.test(direction)) colors = ['#0b1524', '#123d59', '#3a9ebf', '#c9e7ef'];
  else if (/pink|rose|beauty|soft|romantic/.test(direction)) colors = ['#211117', '#5a283a', '#e66d8c', '#f7c5c7'];
  else if (/green|natural|botanical|organic|earth/.test(direction)) colors = ['#101712', '#293b2b', '#7a9562', '#dbc89c'];
  const size = String(brief.size || '1080 × 1350 px');
  const wide = /linkedin/i.test(String(brief.format || ''));
  const width = wide ? 1536 : 1080, height = wide ? 800 : 1350;
  const esc = value => String(value || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
  const title = esc(String(brief.sections?.copy || '').split(/\r?\n/).find(Boolean) || 'A fresh idea starts here');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset=".58" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[0]}"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="${colors[2]}" stop-opacity=".72"/><stop offset="1" stop-color="${colors[2]}" stop-opacity="0"/></radialGradient>
      <linearGradient id="object" x1="0" x2="1"><stop stop-color="${colors[2]}"/><stop offset=".5" stop-color="${colors[3]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <ellipse cx="${wide ? 1160 : 840}" cy="${wide ? 340 : 470}" rx="${wide ? 390 : 410}" ry="${wide ? 360 : 410}" fill="url(#glow)" filter="url(#blur)"/>
    <circle cx="${wide ? 1240 : 870}" cy="${wide ? 300 : 400}" r="${wide ? 180 : 225}" fill="${colors[2]}" opacity=".28"/>
    <path d="M0 ${height*.77} C${width*.25} ${height*.64} ${width*.39} ${height*.93} ${width*.67} ${height*.73} S${width*.9} ${height*.65} ${width} ${height*.76} V${height} H0Z" fill="${colors[1]}" opacity=".68"/>
    <path d="M${width*.73} ${height*.83} C${width*.68} ${height*.64} ${width*.77} ${height*.48} ${width*.87} ${height*.36} M${width*.79} ${height*.62} C${width*.68} ${height*.59} ${width*.66} ${height*.51} ${width*.66} ${height*.46} C${width*.74} ${height*.48} ${width*.79} ${height*.53} ${width*.79} ${height*.62} M${width*.83} ${height*.49} C${width*.9} ${height*.45} ${width*.93} ${height*.39} ${width*.94} ${height*.33} C${width*.87} ${height*.34} ${width*.83} ${height*.41} ${width*.83} ${height*.49}" fill="none" stroke="${colors[3]}" stroke-width="9" stroke-linecap="round" opacity=".62"/>
    <path d="M${width*.59} ${height*.69} Q${width*.7} ${height*.63} ${width*.81} ${height*.69} L${width*.78} ${height*.88} Q${width*.7} ${height*.94} ${width*.62} ${height*.88}Z" fill="url(#object)" opacity=".8"/>
    <rect x="${width*.035}" y="${height*.035}" width="${width*.93}" height="${height*.93}" rx="30" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>
    <g fill="#fff" fill-opacity=".18"><circle cx="${width*.12}" cy="${height*.18}" r="3"/><circle cx="${width*.19}" cy="${height*.25}" r="2"/><circle cx="${width*.28}" cy="${height*.12}" r="2.5"/><circle cx="${width*.39}" cy="${height*.19}" r="2"/></g>
  </svg>`;
  return { image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, demo: true, title, size };
}

function designPrompt(brief) {
  const sections = brief.sections || {};
  return [
    'Create a polished social-media graphic background as one visual layer for a professional graphic designer.',
    'Do not draw any words, letters, logos, UI, borders, or mockup frames. Leave intentional negative space for separately editable typography.',
    `Canvas format: ${brief.format || 'Instagram Post'} (${brief.size || '1080 × 1350 px'}).`,
    `Visual direction: ${sections.design || ''}`,
    `Typography mood (informs the art direction only; do not render text): ${sections.typography || ''}`,
    `Exact copy to leave room for: ${sections.copy || ''}`,
    `Brand details: ${sections.brand || ''}`,
    'Create a high-quality, balanced composition with professional color, lighting, hierarchy, and generous safe margins. The copy and logo are placed as editable layers by the app.'
  ].join('\n\n');
}

function geminiReference(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/i);
  if (!match) return null;
  return { type: 'image', mime_type: `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}`, data: match[2] };
}

async function generateWithGemini(brief) {
  const landscape = /linkedin/i.test(String(brief.format || ''));
  const input = [{ type: 'text', text: designPrompt(brief) }];
  for (const ref of (brief.references || []).slice(0, 6)) {
    const image = geminiReference(ref.dataUrl);
    if (image) {
      if (ref.section) input.push({ type: 'text', text: `This is a reference for the ${ref.section} section.` });
      input.push(image);
    }
  }
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
      input,
      response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: landscape ? '16:9' : '4:5', image_size: '1K' }
    })
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error?.message || `Gemini returned ${response.status}.`, status: response.status };
  const outputImage = result.output_image;
  const imageBlock = (result.steps || []).flatMap(step => step.content || []).find(block => block.type === 'image' && block.data);
  const imageData = outputImage?.data || imageBlock?.data;
  const mimeType = outputImage?.mime_type || imageBlock?.mime_type || 'image/png';
  if (!imageData) return { error: 'Gemini returned no image. Please try again.', status: 502 };
  return { image: `data:${mimeType};base64,${imageData}`, provider: 'gemini' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const provider = String(process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'demo')).toLowerCase();
  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (!privatePreviewRequired()) return json(res, 200, { ok: true });
    if (!process.env.DEMO_PASSWORD) return json(res, 503, { error: 'Private preview access is not configured yet.' });
    if (loginRateLimited(req)) return json(res, 429, { error: 'Too many incorrect codes. Please wait 10 minutes before trying again.' });
    try {
      const body = await readBody(req, 16 * 1024);
      if (!equalSecret(body.password || '', process.env.DEMO_PASSWORD)) { recordFailedLogin(req); return json(res, 401, { error: 'That access code is not correct.' }); }
      loginFailures.delete(loginIdentity(req));
      const timestamp = String(Math.floor(Date.now() / 1000));
      const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': `${sessionCookie}=${timestamp}.${sessionSignature(timestamp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetime}${secure}` });
      return res.end(JSON.stringify({ ok: true }));
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  const authorized = hasPreviewSession(req);
  if (privatePreviewRequired() && !authorized && url.pathname !== '/api/login' && !url.pathname.startsWith('/assets/')) {
    if (url.pathname.startsWith('/api/')) return json(res, 401, { error: 'Enter the investor preview access code first.' });
    if (req.method === 'GET' || req.method === 'HEAD') {
      return fs.readFile(path.join(root, 'private-login.html'), (err, data) => {
        if (err) return json(res, 503, { error: 'Private preview page is unavailable.' });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(data);
      });
    }
    return json(res, 401, { error: 'Enter the investor preview access code first.' });
  }
  if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { aiConfigured: provider === 'demo' || (provider === 'openai' && Boolean(process.env.OPENAI_API_KEY)) || (provider === 'gemini' && Boolean(process.env.GEMINI_API_KEY)), provider, demoMode: provider === 'demo', privatePreview: privatePreviewRequired() });
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    if (!generationAllowed(req)) return json(res, 429, { error: 'Demo limit reached for this minute. Please try again shortly.' });
    try {
      const brief = await readBody(req);
      if (provider === 'demo') return json(res, 200, makeDemoArtwork(brief));
      if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) return json(res, 503, { error: 'AI_PROVIDER is set to gemini but GEMINI_API_KEY is missing from .env.' });
        const generated = await generateWithGemini(brief);
        if (generated.error) return json(res, generated.status, { error: generated.error });
        return json(res, 200, generated);
      }
      if (provider !== 'openai') return json(res, 500, { error: `Unknown AI_PROVIDER "${provider}". Use "demo", "gemini", or "openai".` });
      if (!process.env.OPENAI_API_KEY) return json(res, 503, { error: 'AI_PROVIDER is set to openai but OPENAI_API_KEY is missing from .env.' });
      const prompt = designPrompt(brief);
      const landscape = String(brief.format || '').toLowerCase().includes('linkedin');
      const content = [{ type: 'input_text', text: prompt }];
      for (const ref of (brief.references || []).slice(0, 6)) {
        if (typeof ref.dataUrl === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(ref.dataUrl)) content.push({ type: 'input_image', image_url: ref.dataUrl, detail: 'auto' });
      }
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_TEXT_MODEL || 'gpt-6.2-astra',
          input: [{ role: 'user', content }],
          tools: [{ type: 'image_generation', model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst', action: 'generate', size: landscape ? '1536x800' : '1024x1280', quality: 'medium', background: 'opaque' }]
        })
      });
      const result = await response.json();
      if (!response.ok) return json(res, response.status, { error: result.error?.message || `Image service returned ${response.status}.` });
      const image = (result.output || []).find(item => item.type === 'image_generation_call' && item.result)?.result;
      if (!image) return json(res, 502, { error: 'The AI returned no image. Please try again.' });
      return json(res, 200, { image: `data:image/png;base64,${image}` });
    } catch (error) {
      if (!res.headersSent) return json(res, 500, { error: error.message || 'Image generation failed.' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 404, { error: 'Not found.' });
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, 'index.html')) return json(res, 403, { error: 'Forbidden.' });
  fs.readFile(filePath, (err, data) => {
    if (err) return json(res, 404, { error: 'Not found.' });
    res.writeHead(200, { 'content-type': types[path.extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

server.listen(port, host, () => console.log(`My Designer is running at http://localhost:${port}`));
