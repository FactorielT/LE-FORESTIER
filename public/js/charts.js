/* Graphiques (Chart.js) : style homogène pour toute l'application */
const Charts = (() => {
  // Palette catégorielle (ordre fixe, validée daltonisme) + couleur de marque pour une série unique
  const C = { brand: '#2e7d32', s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', s5: '#e87ba4', s6: '#008300', s7: '#6250d6', s8: '#e34948' };
  const SERIES = [C.s1, C.s2, C.s3, C.s4, C.s5, C.s6, C.s7, C.s8];
  const INK = '#4b5a4e', MUTED = '#7c8a7f', GRID = '#edf1ed';

  const short = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    if (a >= 1e3) return (v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k';
    return String(v);
  };
  const money = (v) => Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');

  if (window.Chart) {
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = INK;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1f2b21';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
  }

  function reset(canvas) { const c = window.Chart && Chart.getChart(canvas); if (c) c.destroy(); }

  const tooltipMoney = (unit = '') => ({ callbacks: { label: (ctx) => { const v = ctx.chart.options.indexAxis === 'y' ? ctx.parsed.x : ctx.parsed.y; return v === null || v === undefined ? ` ${ctx.dataset.label}: non saisie` : ` ${ctx.dataset.label || ctx.label}: ${money(v)}${unit}`; } } });

  function axes(horizontal, stacked) {
    const val = { beginAtZero: true, stacked, grid: { color: GRID, drawTicks: false }, border: { display: false }, ticks: { color: MUTED, padding: 6, callback: (v) => short(v) } };
    const cat = { stacked, grid: { display: false }, border: { color: '#cfd8cf' }, ticks: { color: MUTED, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 } };
    return horizontal ? { x: val, y: { ...cat, ticks: { color: INK, autoSkip: false } } } : { x: cat, y: val };
  }

  /** series: [{label, data, color, type:'bar'|'line'}] */
  function combo(canvas, labels, series, { stacked = false, horizontal = false, unit = ' F' } = {}) {
    reset(canvas);
    if (!window.Chart) return null;
    const datasets = series.map((s, i) => {
      const color = s.color || SERIES[i];
      if (s.type === 'line') {
        return { type: 'line', label: s.label, data: s.data, borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0.3, pointRadius: labels.length > 20 ? 0 : 3,
          pointHoverRadius: 5, pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 2, fill: false, order: 0 };
      }
      return { type: 'bar', label: s.label, data: s.data, backgroundColor: color, hoverBackgroundColor: color, borderRadius: 4, borderSkipped: 'start',
        maxBarThickness: horizontal ? 22 : 30, categoryPercentage: 0.75, barPercentage: 0.9, borderColor: '#fff', borderWidth: stacked ? { top: 2 } : 0, order: 1 };
    });
    return new Chart(canvas, {
      data: { labels, datasets },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        interaction: { mode: 'index', intersect: false },
        scales: axes(horizontal, stacked),
        plugins: { legend: { display: series.length > 1, position: 'bottom', labels: { sort: (a, b) => a.datasetIndex - b.datasetIndex } }, tooltip: tooltipMoney(unit) },
        spanGaps: false,
      },
    });
  }

  function donut(canvas, labels, data, colors, { unit = ' F' } = {}) {
    reset(canvas);
    if (!window.Chart) return null;
    const total = data.reduce((a, b) => a + b, 0);
    return new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors || SERIES, borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }] },
      options: {
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${money(ctx.parsed)}${unit} (${total ? Math.round((ctx.parsed / total) * 100) : 0} %)` } },
        },
      },
    });
  }

  // Petit tableau de données sous un graphique (accessibilité)
  function dataTable(cols, rows) {
    return `<details class="chart-data"><summary>Voir les données</summary><div class="tbl-wrap auto" style="margin-top:8px"><table class="tbl">
      <thead><tr>${cols.map((c) => `<th class="${c.r ? 'r' : ''}">${c.t}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.r ? 'r' : ''}">${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }

  return { C, SERIES, combo, donut, dataTable, short, reset };
})();
