/* ===== Imprimante des tickets (restaurant) =====
   Réglage propre à chaque appareil (téléphone, tablette, PC), gardé dans le navigateur.
   Modes :
   - systeme   : impression du navigateur (imprimante USB / WiFi installée sur l'appareil, service d'impression Android)
   - bluetooth : imprimante thermique Bluetooth (BLE) en direct, depuis Chrome / Edge (Android, Windows, Mac)
   - rawbt     : application Android « RawBT » (imprimantes Bluetooth classiques et WiFi / réseau IP)
*/
const Imprimante = (() => {
  const KEY = 'resto-imprimante';
  const DEF = { mode: 'systeme', largeur: 58, auto: false, copies: 1, accents: true, coupe: true, logo: true, appareil: '' };
  let cfg = { ...DEF };
  try { cfg = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  const get = () => ({ ...cfg });
  const set = (c) => { cfg = { ...cfg, ...c }; try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };

  const btDispo = () => !!(navigator.bluetooth && window.isSecureContext);
  const estAndroid = () => /android/i.test(navigator.userAgent);

  // ---------- Construction du ticket ESC/POS ----------
  // Page de code PC850 (accents français) ; sinon les accents sont retirés
  const CP850 = { 'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c,
    'Ä': 0x8e, 'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'û': 0x96, 'ù': 0x97, 'Ö': 0x99, 'Ü': 0x9a, 'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5,
    'À': 0xb7, 'Â': 0xb6, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, 'Î': 0xd7, 'Ï': 0xd8, 'Ô': 0xe2, 'Ù': 0xeb, 'Û': 0xea, '°': 0xf8, '€': 0xd5 };
  const sansAccent = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019]/g, "'").replace(/[\u00ab\u00bb\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-');
  function encode(txt) {
    const out = [];
    for (const ch of String(txt).replace(/[\u2018\u2019]/g, "'").replace(/[\u00ab\u00bb\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/[\u00a0\u202f]/g, ' ')) {
      const c = ch.charCodeAt(0);
      if (c < 128) out.push(c);
      else if (cfg.accents && CP850[ch] !== undefined) out.push(CP850[ch]);
      else for (const x of sansAccent(ch)) out.push(x.charCodeAt(0) < 128 ? x.charCodeAt(0) : 63);
    }
    return out;
  }
  const money = (v) => Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/[\u00a0\u202f]/g, ' ');
  const dfr = (d) => String(d || '').split('-').reverse().join('/');

  // ---------- Logo en image noir et blanc (commande GS v 0) ----------
  let logoCache = {};
  async function logoRaster(largeurPoints) {
    if (logoCache[largeurPoints] !== undefined) return logoCache[largeurPoints];
    try {
      const src = (document.querySelector('.sidebar .brand img') || {}).src || '/img/logo.jpg';
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const w = Math.floor(largeurPoints / 8) * 8, h = Math.max(8, Math.round((w * img.height) / img.width));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      const px = x.getImageData(0, 0, w, h).data;
      // Niveaux de gris + tramage Floyd-Steinberg
      const g = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      const bpr = w / 8, out = new Uint8Array(bpr * h);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const i = yy * w + xx, old = g[i], nv = old < 128 ? 0 : 255, err = old - nv;
        if (nv === 0) out[yy * bpr + (xx >> 3)] |= 0x80 >> (xx & 7);
        if (xx + 1 < w) g[i + 1] += (err * 7) / 16;
        if (yy + 1 < h) { if (xx > 0) g[i + w - 1] += (err * 3) / 16; g[i + w] += (err * 5) / 16; if (xx + 1 < w) g[i + w + 1] += err / 16; }
      }
      logoCache[largeurPoints] = [0x1d, 0x76, 0x30, 0x00, bpr & 0xff, bpr >> 8, h & 0xff, h >> 8, ...out];
    } catch { logoCache[largeurPoints] = null; }
    return logoCache[largeurPoints];
  }

  async function escpos(t, I) {
    const logo = cfg.logo ? await logoRaster(Number(cfg.largeur) === 80 ? 224 : 176) : null;
    const W = Number(cfg.largeur) === 80 ? 48 : 32;
    const b = [];
    const raw = (...x) => b.push(...x);
    const txt = (s) => b.push(...encode(s));
    const ln = (s = '') => { txt(s); raw(0x0a); };
    const align = (n) => raw(0x1b, 0x61, n); // 0 gauche, 1 centre, 2 droite
    const gras = () => raw(0x1b, 0x45, 1); // tout le ticket en gras (plus lisible)
    const taille = (dbl) => raw(0x1d, 0x21, dbl ? 0x11 : 0x00);
    const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n) : String(s));
    const lr = (g, d) => { g = String(g); d = String(d); const sp = W - g.length - d.length; return sp >= 1 ? g + ' '.repeat(sp) + d : cut(g, W - d.length - 1) + ' ' + d; };
    const sep = () => ln('-'.repeat(W));
    const wrap = (s, n) => { const mots = String(s).split(/\s+/); const lignes = []; let cur = ''; for (const m of mots) { if ((cur + ' ' + m).trim().length > n) { if (cur) lignes.push(cur); cur = m; } else cur = (cur + ' ' + m).trim(); } if (cur) lignes.push(cur); return lignes.length ? lignes : ['']; };

    raw(0x1b, 0x40); // initialisation
    raw(0x1b, 0x45, 1); // gras
    if (cfg.accents) raw(0x1b, 0x74, 0x02); // page de code PC850
    align(1);
    if (logo) { raw(...logo); raw(0x0a); }
    gras(true); taille(true); for (const l of wrap(I.nom || 'RESTO DU FORESTIER', Math.floor(W / 2))) ln(l); taille(false); gras(false);
    if (I.adresse) for (const l of wrap(I.adresse, W)) ln(l);
    if (I.telephone) ln('Tel : ' + I.telephone);
    align(0); sep();
    ln(lr('Recu N°', t.numero));
    ln(lr('Date', `${dfr(t.date)} ${String(t.heure || '').slice(0, 5)}`));
    ln(lr('Client', cut(t.client || 'Client comptoir', W - 8)));
    if (t.agent) ln(lr('Caissier', cut(t.agent, W - 10)));
    sep();
    for (const l of t.lignes || []) {
      if (l.parent_id) {
        ln(lr('  + ' + cut(l.nom, W - 14), l.total ? money(l.total) : 'inclus'));
      } else {
        const g = `${l.qte} x ${l.nom}`;
        const d = money(l.total);
        if (g.length + d.length + 1 <= W) ln(lr(g, d));
        else { for (const x of wrap(g, W)) ln(x); ln(lr(`   ${l.qte} x ${money(l.prix)}`, d)); }
      }
    }
    sep();
    gras(true); taille(true); align(0);
    const tot = 'TOTAL', mt = money(t.total) + ' F', w2 = Math.floor(W / 2);
    ln(tot + ' '.repeat(Math.max(1, w2 - tot.length - mt.length)) + mt);
    taille(false); gras(false);
    const MODES = { ESPECE: 'Espèces', WAVE: 'Wave', OM: 'Orange Money', MOMO: 'MoMo', FLOOZ: 'Flooz' };
    ln(lr('Paiement', MODES[t.mode] || t.mode || ''));
    if (t.mode === 'ESPECE') { ln(lr('Montant reçu', money(t.recu) + ' F')); ln(lr('Monnaie rendue', money(t.rendu) + ' F')); }
    if (t.annulee) { align(1); gras(true); ln('*** TICKET ANNULÉ ***'); gras(false); align(0); }
    sep();
    align(1); for (const l of wrap(I.message || 'Merci de votre visite !', W)) ln(l);
    align(0); raw(0x0a, 0x0a, 0x0a);
    if (cfg.coupe) raw(0x1d, 0x56, 0x42, 0x00); // coupe papier (ignorée si l'imprimante n'a pas de massicot)
    const un = new Uint8Array(b);
    const n = Math.max(1, Math.min(5, Number(cfg.copies) || 1));
    if (n === 1) return un;
    const all = new Uint8Array(un.length * n);
    for (let i = 0; i < n; i++) all.set(un, i * un.length);
    return all;
  }

  // ---------- Bluetooth (BLE) ----------
  const SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb', '0000ae30-0000-1000-8000-00805f9b34fb'];
  let bt = { device: null, car: null };

  async function trouverCaracteristique(server) {
    const services = await server.getPrimaryServices();
    for (const s of services) {
      let cars = [];
      try { cars = await s.getCharacteristics(); } catch { continue; }
      const c = cars.find((x) => x.properties.writeWithoutResponse || x.properties.write);
      if (c) return c;
    }
    throw new Error("Aucune voie d'écriture trouvée sur cette imprimante Bluetooth.");
  }
  async function connecter(device) {
    const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    bt = { device, car: await trouverCaracteristique(server) };
    set({ appareil: device.name || 'Imprimante Bluetooth' });
    device.addEventListener('gattserverdisconnected', () => { bt.car = null; }, { once: true });
    return device.name || 'Imprimante Bluetooth';
  }
  async function choisirBluetooth() {
    if (!btDispo()) throw new Error("Le Bluetooth direct n'est pas disponible sur ce navigateur. Utilisez Google Chrome (Android ou PC), ou le mode « Application RawBT ».");
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
    return connecter(device);
  }
  async function assurerBluetooth() {
    if (bt.car && bt.device && bt.device.gatt.connected) return;
    if (bt.device) { try { await connecter(bt.device); return; } catch {} }
    // Appareil déjà autorisé (Chrome récent) : reconnexion sans fenêtre de choix
    if (navigator.bluetooth && navigator.bluetooth.getDevices) {
      try {
        const devs = await navigator.bluetooth.getDevices();
        const d = devs.find((x) => x.name === cfg.appareil) || devs[0];
        if (d) { await connecter(d); return; }
      } catch {}
    }
    await choisirBluetooth();
  }
  async function envoyerBluetooth(data) {
    await assurerBluetooth();
    const sansReponse = !!bt.car.properties.writeWithoutResponse;
    const T = sansReponse ? 100 : 180;
    for (let i = 0; i < data.length; i += T) {
      const part = data.slice(i, i + T);
      if (sansReponse && bt.car.writeValueWithoutResponse) await bt.car.writeValueWithoutResponse(part);
      else if (bt.car.writeValueWithResponse) await bt.car.writeValueWithResponse(part);
      else await bt.car.writeValue(part);
      if (sansReponse) await new Promise((r) => setTimeout(r, 20));
    }
  }
  function deconnecter() { try { if (bt.device && bt.device.gatt.connected) bt.device.gatt.disconnect(); } catch {} bt = { device: null, car: null }; set({ appareil: '' }); }
  const connecte = () => !!(bt.car && bt.device && bt.device.gatt.connected);

  // ---------- RawBT (Android) ----------
  function envoyerRawBT(data) {
    let s = ''; for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
    const b64 = btoa(s);
    window.location.href = estAndroid() ? `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;` : `rawbt:base64,${b64}`;
  }

  // ---------- Impression du navigateur ----------
  function imprimerSysteme(html) {
    let z = document.getElementById('print-area');
    if (!z) { z = document.createElement('div'); z.id = 'print-area'; document.body.appendChild(z); }
    const n = Math.max(1, Math.min(5, Number(cfg.copies) || 1));
    z.innerHTML = Array.from({ length: n }, () => html).join('<div class="tk-page"></div>');
    let st = document.getElementById('print-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'print-page-style'; document.head.appendChild(st); }
    const mm = Number(cfg.largeur) === 80 ? 80 : 58;
    // Pas de taille de page imposée : on suit le papier du pilote (58 ou 80 mm) ; marges internes pour la zone non imprimable
    const marge = mm === 80 ? 4 : 3, fs = mm === 80 ? 11.5 : 9.5;
    st.textContent = `@media print {
      @page { margin: 0; }
      html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-width: 0 !important; }
      body.printing #print-area { width: 100%; max-width: ${mm}mm; margin: 0 auto !important; padding: 2mm ${marge}mm; box-sizing: border-box; }
      body.printing .ticket { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; border: 0 !important; box-sizing: border-box; font-size: ${fs}px !important; color: #000 !important; }
      body.printing .ticket, body.printing .ticket * { color: #000 !important; font-family: 'Arial Black', 'Arial Bold', Arial, Helvetica, sans-serif !important; font-weight: 900 !important; font-style: normal !important; letter-spacing: 0 !important; }
      body.printing .tk-t { table-layout: fixed; width: 100%; font-size: ${fs - 0.5}px !important; }
      body.printing .tk-t th, body.printing .tk-t td { padding: 1px 2px 1px 0 !important; overflow-wrap: anywhere; }
      body.printing .tk-t th:nth-child(1), body.printing .tk-t td:nth-child(1) { width: ${mm === 80 ? 11 : 13}%; }
      body.printing .tk-t th:nth-child(3), body.printing .tk-t td:nth-child(3) { width: ${mm === 80 ? 22 : 24}%; }
      body.printing .tk-t th:nth-child(4), body.printing .tk-t td:nth-child(4) { width: ${mm === 80 ? 24 : 27}%; padding-right: 0 !important; }
      body.printing .tk-t .r { white-space: nowrap; overflow-wrap: normal; }
      body.printing .tk-t th { white-space: nowrap; overflow-wrap: normal; overflow: hidden; }
      body.printing .tk-t td, body.printing .tk-t th, body.printing .tk-acc td { font-size: inherit !important; }
      body.printing .tk-row { gap: 4px; }
      body.printing .tk-row > :last-child { text-align: right; overflow-wrap: anywhere; }
      body.printing .tk-h b { font-size: ${fs + 3}px !important; }
      body.printing .tk-tot { font-size: ${fs + 3}px !important; }
      body.printing .tk-logo { width: ${mm === 80 ? 22 : 18}mm; height: auto; }
    }`;
    document.body.classList.add('printing');
    // On attend que le logo soit chargé avant d'ouvrir l'impression
    const imgs = [...z.querySelectorAll('img')].filter((i) => !i.complete);
    Promise.race([Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 3000))]).then(() => {
      setTimeout(() => { try { window.print(); } catch {} setTimeout(() => document.body.classList.remove('printing'), 500); }, 80);
    });
  }

  /** Imprime un ticket selon le réglage de l'appareil. t = ticket, I = infos du restaurant, html = rendu du reçu */
  async function imprimer(t, I, html) {
    if (cfg.mode === 'bluetooth') return envoyerBluetooth(await escpos(t, I));
    if (cfg.mode === 'rawbt') return envoyerRawBT(await escpos(t, I));
    return imprimerSysteme(html);
  }
  const TEST = { numero: 'TEST-0001', date: new Date().toISOString().slice(0, 10), heure: new Date().toTimeString().slice(0, 8), client: 'Client comptoir', agent: 'Test',
    lignes: [{ qte: 1, nom: 'Poisson braisé', prix: 2500, total: 2500 }, { parent_id: 1, nom: 'Attiéké', prix: 0, total: 0 }, { qte: 2, nom: 'Jus de bissap', prix: 500, total: 1000 }],
    total: 3500, mode: 'ESPECE', recu: 5000, rendu: 1500 };

  return { get, set, imprimer, escpos, choisirBluetooth, deconnecter, connecte, btDispo, estAndroid, TEST, imprimerSysteme };
})();
