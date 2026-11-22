/* ===== Export PDF des bilans =====
   Construit un PDF à partir de la page affichée : en-tête avec logo, chiffres clés, graphiques et tableaux.
   Bibliothèques : jsPDF + jsPDF-AutoTable (public/js/vendor). */
const PDF = (() => {
  // Le PDF utilise la police Helvetica (Latin-1) : on remplace les caractères qu'elle ne connaît pas
  const clean = (s) => String(s == null ? '' : s)
    .replace(/[\u00a0\u202f\u2009\u2007]/g, ' ').replace(/\u2212/g, '-').replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/\u2192/g, '->')
    .replace(/[\u2713\u2714]/g, 'OK').replace(/[^\x00-\xff]/g, '').replace(/[ \t]+/g, ' ').trim();

  let logo = null;
  async function chargerLogo() {
    if (logo) return logo;
    const src = (document.querySelector('.sidebar .brand img') || document.querySelector('img[alt="Logo"]') || {}).src || '/img/logo.jpg';
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const c = document.createElement('canvas'); c.width = 240; c.height = Math.round((240 * img.height) / img.width) || 240;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      logo = { data: c.toDataURL('image/jpeg', 0.92), ratio: c.height / c.width };
    } catch { logo = { data: null, ratio: 1 }; }
    return logo;
  }

  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && !el.closest('details:not([open]), .modal-bg, .hidden');
  const titreDe = (el) => {
    const card = el.closest('.card, .tabs-panel');
    const t = card && card.querySelector('.card-title');
    if (t && !t.contains(el)) return clean(t.cloneNode(true).textContent.replace(/(Statistiques|Tout l'historique|Imprimante de cet appareil)\s*\u203a/g, ''));
    let p = el.previousElementSibling;
    while (p) { if (p.matches('.section-h, .page-title, .card-title')) return clean(p.textContent); p = p.previousElementSibling; }
    return '';
  };

  // Période / informations lues dans les champs de la page
  function contexte(root) {
    const champs = [];
    const val = (sel) => { const i = root.querySelector(sel); return i && i.value ? i.value : null; };
    const du = val('[name=du]') || val('#i-di'), au = val('[name=au]') || val('#i-au');
    const fr = (d) => d.split('-').reverse().join('/');
    if (du && au) champs.push(du === au ? `Journée du ${fr(du)}` : `Période du ${fr(du)} au ${fr(au)}`);
    else {
      const d = val('#k-date') || val('#v-date');
      if (d) champs.push(`Date : ${fr(d)}`);
    }
    const sel = root.querySelector('#ib-sel');
    if (sel && sel.selectedOptions[0]) champs.push('Inventaire : ' + clean(sel.selectedOptions[0].textContent));
    const tri = root.querySelector('.presets button.on[data-k]');
    if (tri) champs.push('Classement : ' + clean(tri.textContent));
    return champs.join('  ·  ');
  }

  /** Génère et télécharge le PDF de la page courante */
  async function page({ titre, nomFichier } = {}) {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("Le module PDF n'est pas chargé. Rechargez la page.");
    const root = document.querySelector('#view') || document.querySelector('.content') || document.body;
    const { jsPDF } = window.jspdf;
    // Paysage si un tableau a beaucoup de colonnes
    const tables = [...root.querySelectorAll('table.tbl')].filter(visible);
    const maxCols = tables.reduce((m, t) => Math.max(m, (t.tHead && t.tHead.rows[0] ? t.tHead.rows[0].cells.length : 0)), 0);
    const doc = new jsPDF({ orientation: maxCols > 7 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
    const resto = document.body.classList.contains('espace-resto');
    const COUL = resto ? [21, 87, 160] : [46, 125, 50];
    const APP = typeof App !== 'undefined' ? App : null;
    const nom = clean((APP && (resto ? APP.nomResto : APP.nom)) || (resto ? 'RESTO DU FORESTIER' : 'LE REPOS DU FORESTIER'));
    const lg = await chargerLogo();
    titre = clean(titre || (document.querySelector('#page-title') || {}).textContent || 'Bilan');
    const ctx = contexte(root);

    // ---- En-tête ----
    let y = M;
    if (lg.data) doc.addImage(lg.data, 'JPEG', M, y, 22, 22 * lg.ratio);
    const tx = lg.data ? M + 27 : M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...COUL); doc.text(nom, tx, y + 7);
    doc.setFontSize(12.5); doc.setTextColor(30, 30, 30); doc.text(titre.toUpperCase(), tx, y + 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90);
    if (ctx) doc.text(clean(ctx), tx, y + 20, { maxWidth: W - tx - M });
    y += Math.max(24, 22 * lg.ratio) + 2;
    doc.setDrawColor(...COUL); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 6;

    const place = (h) => { if (y + h > H - 14) { doc.addPage(); y = M + 4; } };
    const sousTitre = (t) => { if (!t) return; place(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...COUL); doc.text(t, M, y); y += 5; };

    // ---- Blocs dans l'ordre de la page ----
    const blocs = [...root.querySelectorAll('.kpis, .stats, .best, .a-verser, .k-hier, .kv, .repartition .field, canvas, table.tbl, .notice, .ecart')].filter(visible)
      .filter((el) => !(el.parentElement && el.parentElement.closest('table')) && !(el.matches('.kv') && el.closest('.kpis, .stats')));
    const vus = new Set();
    for (const el of blocs) {
      if ([...vus].some((v) => v.contains(el))) continue;
      vus.add(el);
      if (el.matches('.kpis, .stats')) {
        const items = [...el.querySelectorAll('.kpi, .stat')].filter(visible).map((k) => {
          const small = k.querySelector('small'), b = k.querySelector('b'), sp = k.querySelector('span:not(.badge)');
          return [clean(small && small.textContent), clean(b && b.textContent), clean(sp && sp !== b && !small.contains(sp) ? sp.textContent : '')];
        }).filter((x) => x[0] || x[1]);
        if (!items.length) continue;
        const per = Math.min(4, items.length), cw = (W - 2 * M - (per - 1) * 3) / per, ch = 17;
        for (let i = 0; i < items.length; i += per) {
          place(ch + 3);
          items.slice(i, i + per).forEach(([l, v, s], j) => {
            const x = M + j * (cw + 3);
            doc.setFillColor(246, 248, 246); doc.setDrawColor(220, 226, 220); doc.roundedRect(x, y, cw, ch, 2, 2, 'FD');
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 110, 110); doc.text(l.toUpperCase(), x + 3, y + 5, { maxWidth: cw - 6 });
            doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(25, 25, 25); doc.text(v, x + 3, y + 11.5, { maxWidth: cw - 6 });
            if (s) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.text(s, x + 3, y + 15.3, { maxWidth: cw - 6 }); }
          });
          y += ch + 3;
        }
        y += 2;
      } else if (el.matches('.best, .k-hier, .a-verser, .notice, .ecart')) {
        const t = clean(el.innerText.replace(/\n+/g, ' · '));
        if (!t) continue;
        place(10); doc.setFont('helvetica', el.matches('.notice') ? 'normal' : 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
        const lignes = doc.splitTextToSize(t, W - 2 * M);
        doc.text(lignes, M, y + 4); y += lignes.length * 4.6 + 3;
      } else if (el.matches('.kv, .repartition .field')) {
        const sp = el.querySelector('span, label'), v = el.querySelector('.val, b, input');
        const l = clean(sp && sp.textContent).replace(/^[+\-]\s*/, ''), val = clean(v ? (v.value !== undefined && v.tagName === 'INPUT' ? v.value : v.textContent) : '');
        if (!l) continue;
        place(7); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.text(l, M, y + 4);
        doc.setFont('helvetica', 'bold'); doc.text(val, W - M, y + 4, { align: 'right' }); y += 6.5;
      } else if (el.tagName === 'CANVAS') {
        if (!el.width || !el.height) continue;
        const ratio = el.height / el.width; const w = Math.min(W - 2 * M, 180); const h = Math.min(w * ratio, 95);
        place(h + 12); sousTitre(titreDe(el));
        // fond blanc sous le graphique
        const c = document.createElement('canvas'); c.width = el.width; c.height = el.height;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(el, 0, 0);
        doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', M, y, (h / ratio) > W - 2 * M ? W - 2 * M : h / ratio, h);
        y += h + 6;
      } else if (el.matches('table.tbl')) {
        if (!el.tBodies[0] || !el.tBodies[0].rows.length) continue;
        place(24); sousTitre(titreDe(el));
        // Toutes les colonnes ayant un titre (même celles masquées sur petit écran)
        const keep = [...(el.tHead ? el.tHead.rows[0].cells : [])].map((c) => clean(c.textContent) !== '');
        const cellTxt = (td) => {
          const inp = td.querySelector('input, select, textarea');
          if (inp) return clean(inp.tagName === 'SELECT' ? (inp.selectedOptions[0] || {}).textContent : inp.type === 'checkbox' ? (inp.checked ? 'Oui' : 'Non') : inp.value);
          return clean(td.innerText);
        };
        const ligne = (tr) => [...tr.cells].filter((c, i) => keep[i] !== false).map(cellTxt);
        const head = el.tHead ? [ligne(el.tHead.rows[0])] : [];
        const body = [...el.tBodies[0].rows].filter((tr) => !tr.querySelector('td.empty')).map(ligne);
        const foot = el.tFoot && el.tFoot.rows[0] ? [ligne(el.tFoot.rows[0])] : [];
        const alignR = [...(el.tHead ? el.tHead.rows[0].cells : [])].filter((c, i) => keep[i] !== false).map((c) => c.classList.contains('r'));
        doc.autoTable({
          head, body, foot, startY: y, margin: { left: M, right: M, bottom: 14 }, theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, lineColor: [225, 230, 225], lineWidth: 0.1, textColor: [30, 30, 30], overflow: 'linebreak' },
          headStyles: { fillColor: COUL, textColor: 255, fontStyle: 'bold', halign: 'left' },
          footStyles: { fillColor: [236, 241, 236], textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 248] },
          didParseCell: (d) => { if (alignR[d.column.index]) d.cell.styles.halign = 'right'; },
        });
        y = doc.lastAutoTable.finalY + 7;
      }
    }

    // ---- Pied de page ----
    const n = doc.internal.getNumberOfPages();
    const now = new Date();
    const gen = `Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toTimeString().slice(0, 5)}${APP && APP.user ? ' par ' + clean(APP.user.nom) : ''}`;
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 130, 130);
      doc.text(clean(`${nom} - ${titre}`), M, H - 7); doc.text(clean(gen), W / 2, H - 7, { align: 'center' }); doc.text(`Page ${i} / ${n}`, W - M, H - 7, { align: 'right' });
    }
    const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const per = (() => { const du = (root.querySelector('[name=du]') || root.querySelector('#i-di') || {}).value, au = (root.querySelector('[name=au]') || root.querySelector('#i-au') || {}).value;
      const d = (root.querySelector('#k-date') || {}).value; return du && au ? (du === au ? du : `${du}_au_${au}`) : d || now.toISOString().slice(0, 10); })();
    const fichier = (nomFichier || `${resto ? 'resto-' : ''}${slug(titre)}_${per}`) + '.pdf';
    // Dans une page Claude (démo), le téléchargement passe par la capacité « downloads »
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads').catch(() => null);
      if (dl) {
        try { await dl.save({ filename: fichier, data: doc.output('blob') }); return fichier; }
        catch (e) { if (e && e.code === 'declined') throw new Error('Téléchargement annulé.'); }
      }
    }
    doc.save(fichier);
    return fichier;
  }

  return { page, clean };
})();
