// ============================================================================
// autumn // LIGHTWEIGHT NATIVE INTERACTIVE SVG CHART ENGINE
// Zero external dependencies (replaces ~200 KB Chart.js CDN)
// Supports:
//   - Cumulative Stepped Trajectory Charts (Baseline dashed + Quota + Actual)
//   - 30-Day Daily Output Bars + 7-Day EMA Trendline Overlay
//   - Responsive ResizeObserver redraw + Pointer/Touch crosshair tooltip
// ============================================================================

(function () {
  const CHART_REGISTRY = new Map();
  let sharedTooltipEl = null;

  function ensureTooltipEl() {
    if (sharedTooltipEl && document.body.contains(sharedTooltipEl)) return sharedTooltipEl;
    const tip = document.createElement('div');
    tip.id = 'autumn-svg-chart-tooltip';
    tip.style.cssText =
      'position:fixed;z-index:90;pointer-events:none;display:none;' +
      'background:var(--bg-panel, #f9fdfb);color:var(--text-main, #0c1f17);' +
      'border:1px solid var(--border-strong, #87b39b);padding:6px 8px;' +
      'font-family:"Inter",sans-serif;font-size:11px;line-height:1.4;' +
      'font-variant-numeric:tabular-nums;box-shadow:0 4px 12px rgba(12,31,23,0.14);' +
      'max-width:240px;white-space:nowrap;';
    document.body.appendChild(tip);
    sharedTooltipEl = tip;
    return tip;
  }

  function hideTooltip() {
    if (sharedTooltipEl) sharedTooltipEl.style.display = 'none';
  }

  function showTooltip(clientX, clientY, html) {
    const tip = ensureTooltipEl();
    tip.innerHTML = html;
    tip.style.display = 'block';
    const rect = tip.getBoundingClientRect();
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    let left = clientX + 12;
    let top = clientY - rect.height - 10;
    if (left + rect.width > vw - 8) left = Math.max(8, clientX - rect.width - 12);
    if (top < 8) top = Math.min(vh - rect.height - 8, clientY + 14);
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function niceTicks(maxVal, targetCount) {
    const safeMax = Math.max(1, Number(maxVal) || 1);
    const roughStep = safeMax / Math.max(2, (targetCount || 5) - 1);
    const pow10 = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const frac = roughStep / pow10;
    let niceFrac = 1;
    if (frac <= 1) niceFrac = 1;
    else if (frac <= 2) niceFrac = 2;
    else if (frac <= 2.5) niceFrac = 2.5;
    else if (frac <= 5) niceFrac = 5;
    else niceFrac = 10;
    const step = niceFrac * pow10;
    const top = Math.ceil(safeMax / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step * 0.001; v += step) {
      ticks.push(Number(v.toFixed(6)));
    }
    return { top: Math.max(top, step), ticks };
  }

  function fmtTick(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 10000) return Math.round(v / 1000) + 'k';
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (Math.abs(v - Math.round(v)) < 0.01) return String(Math.round(v));
    return v.toFixed(1);
  }

  function resolveHostContainer(id) {
    let el = document.getElementById(id);
    if (!el) return null;
    if (el.tagName && el.tagName.toLowerCase() === 'canvas') {
      const div = document.createElement('div');
      div.id = id;
      div.className = 'w-full h-full relative select-none';
      div.setAttribute('role', 'img');
      if (el.getAttribute('aria-label')) div.setAttribute('aria-label', el.getAttribute('aria-label'));
      el.parentNode.replaceChild(div, el);
      el = div;
    }
    return el;
  }

  function observeContainerResize(el, drawFn) {
    if (!el) return;
    const prev = CHART_REGISTRY.get(el.id);
    if (prev && prev.observer) {
      try { prev.observer.disconnect(); } catch (e) {}
    }
    let rafId = 0;
    let lastW = el.clientWidth || 0;
    let observer = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => {
        const curW = el.clientWidth || 0;
        if (!curW || Math.abs(curW - lastW) < 2) return;
        lastW = curW;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const entry = CHART_REGISTRY.get(el.id);
          if (entry && entry.lastConfig) entry.draw(entry.lastConfig);
        });
      });
      observer.observe(el);
    }
    CHART_REGISTRY.set(el.id, { observer, draw: drawFn, lastConfig: null });
  }

  function buildSteppedPath(coords, stepped) {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)}`;
    let d = `M${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      if (stepped) {
        d += ` L${cur[0].toFixed(1)},${prev[1].toFixed(1)} L${cur[0].toFixed(1)},${cur[1].toFixed(1)}`;
      } else {
        d += ` L${cur[0].toFixed(1)},${cur[1].toFixed(1)}`;
      }
    }
    return d;
  }

  function wireCrosshair(svg, plot, count, getXAt, onHoverIndex) {
    const vline = svg.querySelector('.chart-hover-line');
    const hitLayer = svg.querySelector('.chart-hit-layer');
    if (!hitLayer || count <= 0) return;

    const handleMove = (clientX, clientY) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const svgX = ((clientX - rect.left) / rect.width) * plot.totalW;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < count; i++) {
        const d = Math.abs(getXAt(i) - svgX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const snapX = getXAt(bestIdx);
      if (vline) {
        vline.setAttribute('x1', snapX.toFixed(1));
        vline.setAttribute('x2', snapX.toFixed(1));
        vline.style.opacity = '1';
      }
      onHoverIndex(bestIdx, clientX, clientY, snapX);
    };

    hitLayer.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    hitLayer.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    hitLayer.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    hitLayer.addEventListener('mouseleave', () => {
      if (vline) vline.style.opacity = '0';
      hideTooltip();
    });
    hitLayer.addEventListener('touchend', () => {
      setTimeout(() => {
        if (vline) vline.style.opacity = '0';
        hideTooltip();
      }, 1400);
    }, { passive: true });
  }

  function renderCumulativeChart(containerId, config) {
    const el = resolveHostContainer(containerId);
    if (!el) return null;

    if (!CHART_REGISTRY.has(containerId)) {
      observeContainerResize(el, (cfg) => renderCumulativeChart(containerId, cfg));
    }
    const entry = CHART_REGISTRY.get(containerId);
    if (entry) entry.lastConfig = config;

    const labels = Array.isArray(config.labels) ? config.labels : [];
    const datasets = Array.isArray(config.datasets) ? config.datasets : [];
    const fmtVal = typeof config.formatValue === 'function' ? config.formatValue : (v) => String(v);

    if (labels.length === 0) {
      el.innerHTML =
        '<div class="w-full h-full flex items-center justify-center text-[11px] text-[#56735f] border border-dashed border-[#c5ded0]">' +
        'No trajectory data logged yet.</div>';
      return { resize: () => {}, update: () => {} };
    }

    const totalW = Math.max(260, el.clientWidth || 520);
    const totalH = Math.max(150, el.clientHeight || 220);
    const legendH = 22;
    const svgH = Math.max(115, totalH - legendH);
    const padL = 40;
    const padR = 10;
    const padT = 8;
    const padB = 22;
    const plotW = Math.max(80, totalW - padL - padR);
    const plotH = Math.max(50, svgH - padT - padB);

    let maxVal = 1;
    datasets.forEach((ds) => {
      (ds.data || []).forEach((v) => {
        const n = Number(v) || 0;
        if (n > maxVal) maxVal = n;
      });
    });

    const { top, ticks } = niceTicks(maxVal, 5);
    const xAt = (i) => (labels.length === 1 ? padL + plotW / 2 : padL + (i / (labels.length - 1)) * plotW);
    const yAt = (v) => padT + plotH - (Math.max(0, Number(v) || 0) / top) * plotH;

    const legendHtml =
      '<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#436152] pb-1 px-0.5 leading-none">' +
      datasets
        .map((ds) => {
          const dashStyle = ds.dash ? `border-top:2px dashed ${ds.color};` : `background:${ds.color};`;
          return (
            '<span class="inline-flex items-center gap-1.5">' +
            `<span style="display:inline-block;width:12px;height:${ds.dash ? '0' : '2.5px'};${dashStyle}"></span>` +
            `<span>${esc(ds.label)}</span>` +
            '</span>'
          );
        })
        .join('') +
      '</div>';

    const gridSvg = ticks
      .map((t) => {
        const y = yAt(t).toFixed(1);
        return (
          `<line x1="${padL}" y1="${y}" x2="${totalW - padR}" y2="${y}" stroke="var(--border-main, #d5e6dc)" stroke-width="1" />` +
          `<text x="${padL - 5}" y="${Number(y) + 3}" text-anchor="end" fill="var(--text-muted, #436152)" font-size="9.5" font-family="Inter,sans-serif">${esc(fmtTick(t))}</text>`
        );
      })
      .join('');

    const maxXLabels = totalW < 420 ? 5 : 8;
    const xStep = Math.max(1, Math.ceil(labels.length / maxXLabels));
    const xTicksSvg = labels
      .map((lbl, idx) => {
        if (idx % xStep !== 0 && idx !== labels.length - 1) return '';
        if (idx !== labels.length - 1 && labels.length - 1 - idx < xStep * 0.45) return '';
        const x = xAt(idx).toFixed(1);
        return `<text x="${x}" y="${svgH - 5}" text-anchor="middle" fill="var(--text-muted, #436152)" font-size="9.5" font-family="Inter,sans-serif">${esc(lbl)}</text>`;
      })
      .join('');

    const gradId = `${containerId}-area-grad`;
    const seriesSvg = datasets
      .map((ds) => {
        const pts = (ds.data || []).map((v, i) => [xAt(i), yAt(v)]);
        const lineD = buildSteppedPath(pts, Boolean(ds.stepped));
        let fillMarkup = '';
        if (ds.fill && pts.length > 0) {
          const baseY = (padT + plotH).toFixed(1);
          const firstX = pts[0][0].toFixed(1);
          const lastX = pts[pts.length - 1][0].toFixed(1);
          const areaD = `${lineD} L${lastX},${baseY} L${firstX},${baseY} Z`;
          fillMarkup = `<path d="${areaD}" fill="url(#${gradId})" stroke="none" />`;
        }
        const dashAttr = ds.dash ? ` stroke-dasharray="${ds.dash}"` : '';
        return (
          fillMarkup +
          `<path d="${lineD}" fill="none" stroke="${ds.color}" stroke-width="${ds.width || 2}"${dashAttr} stroke-linejoin="miter" />`
        );
      })
      .join('');

    const dotsSvg = datasets
      .map(
        (ds, dIdx) =>
          `<circle class="chart-hover-dot-${dIdx}" cx="0" cy="0" r="3" fill="${ds.color}" stroke="var(--bg-panel, #fff)" stroke-width="1.2" style="opacity:0;pointer-events:none" />`
      )
      .join('');

    el.innerHTML =
      legendHtml +
      `<svg width="100%" height="${svgH}" viewBox="0 0 ${totalW} ${svgH}" class="block overflow-visible">` +
      `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#10b981" stop-opacity="0.20" />` +
      `<stop offset="100%" stop-color="#10b981" stop-opacity="0.01" />` +
      `</linearGradient></defs>` +
      gridSvg +
      xTicksSvg +
      seriesSvg +
      `<line class="chart-hover-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="var(--border-strong, #87b39b)" stroke-width="1" stroke-dasharray="2,2" style="opacity:0;pointer-events:none" />` +
      dotsSvg +
      `<rect class="chart-hit-layer" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent" style="cursor:crosshair" />` +
      `</svg>`;

    const svg = el.querySelector('svg');
    if (svg) {
      wireCrosshair(svg, { totalW }, labels.length, xAt, (idx, clientX, clientY, snapX) => {
        datasets.forEach((ds, dIdx) => {
          const dot = svg.querySelector(`.chart-hover-dot-${dIdx}`);
          if (!dot) return;
          const val = (ds.data || [])[idx] || 0;
          dot.setAttribute('cx', snapX.toFixed(1));
          dot.setAttribute('cy', yAt(val).toFixed(1));
          dot.style.opacity = '1';
        });
        const rowsHtml = datasets
          .map((ds) => {
            const val = (ds.data || [])[idx] || 0;
            return `<div class="flex items-center justify-between gap-3"><span style="color:${ds.color}">■ ${esc(ds.shortLabel || ds.label)}</span><span>${esc(fmtVal(val))}</span></div>`;
          })
          .join('');
        showTooltip(clientX, clientY, `<div style="border-bottom:1px solid var(--border-main,#c5ded0);margin-bottom:3px;padding-bottom:2px;color:var(--text-muted,#436152)">${esc(labels[idx])}</div>${rowsHtml}`);
      });
      svg.addEventListener('mouseleave', () => {
        datasets.forEach((_, dIdx) => {
          const dot = svg.querySelector(`.chart-hover-dot-${dIdx}`);
          if (dot) dot.style.opacity = '0';
        });
      });
    }

    return {
      resize: () => renderCumulativeChart(containerId, config),
      update: (nextCfg) => renderCumulativeChart(containerId, nextCfg || config)
    };
  }

  function renderEmaBarLineChart(containerId, config) {
    const el = resolveHostContainer(containerId);
    if (!el) return null;

    if (!CHART_REGISTRY.has(containerId)) {
      observeContainerResize(el, (cfg) => renderEmaBarLineChart(containerId, cfg));
    }
    const entry = CHART_REGISTRY.get(containerId);
    if (entry) entry.lastConfig = config;

    const labels = Array.isArray(config.labels) ? config.labels : [];
    const rawValues = Array.isArray(config.rawValues) ? config.rawValues : [];
    const emaValues = Array.isArray(config.emaValues) ? config.emaValues : [];
    const barLabel = config.barLabel || 'Daily';
    const emaLabel = config.emaLabel || '7-Day EMA';
    const emaColor = config.emaColor || '#f59e0b';
    const fmtVal = typeof config.formatValue === 'function' ? config.formatValue : (v) => String(v);

    if (labels.length === 0) {
      el.innerHTML =
        '<div class="w-full h-full flex items-center justify-center text-[11px] text-[#56735f] border border-dashed border-[#c5ded0]">' +
        'No 30D metrics logged yet.</div>';
      return { resize: () => {}, update: () => {} };
    }

    const totalW = Math.max(260, el.clientWidth || 520);
    const totalH = Math.max(150, el.clientHeight || 220);
    const legendH = 22;
    const svgH = Math.max(115, totalH - legendH);
    const padL = 40;
    const padR = 10;
    const padT = 8;
    const padB = 22;
    const plotW = Math.max(80, totalW - padL - padR);
    const plotH = Math.max(50, svgH - padT - padB);

    let maxVal = 1;
    for (let i = 0; i < labels.length; i++) {
      const r = Number(rawValues[i]) || 0;
      const e = Number(emaValues[i]) || 0;
      if (r > maxVal) maxVal = r;
      if (e > maxVal) maxVal = e;
    }

    const { top, ticks } = niceTicks(maxVal, 5);
    const slotW = plotW / labels.length;
    const barW = Math.max(2, Math.min(20, slotW * 0.68));
    const xAt = (i) => padL + (i + 0.5) * slotW;
    const yAt = (v) => padT + plotH - (Math.max(0, Number(v) || 0) / top) * plotH;

    const legendHtml =
      '<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#436152] pb-1 px-0.5 leading-none">' +
      `<span class="inline-flex items-center gap-1.5"><span style="display:inline-block;width:12px;height:2.5px;background:${emaColor};"></span><span>${esc(emaLabel)}</span></span>` +
      `<span class="inline-flex items-center gap-1.5"><span style="display:inline-block;width:10px;height:8px;background:rgba(16,185,129,0.45);border:1px solid #059669;"></span><span>${esc(barLabel)}</span></span>` +
      '</div>';

    const gridSvg = ticks
      .map((t) => {
        const y = yAt(t).toFixed(1);
        return (
          `<line x1="${padL}" y1="${y}" x2="${totalW - padR}" y2="${y}" stroke="var(--border-main, #d5e6dc)" stroke-width="1" />` +
          `<text x="${padL - 5}" y="${Number(y) + 3}" text-anchor="end" fill="var(--text-muted, #436152)" font-size="9.5" font-family="Inter,sans-serif">${esc(fmtTick(t))}</text>`
        );
      })
      .join('');

    const maxXLabels = totalW < 420 ? 5 : 8;
    const xStep = Math.max(1, Math.ceil(labels.length / maxXLabels));
    const xTicksSvg = labels
      .map((lbl, idx) => {
        if (idx % xStep !== 0 && idx !== labels.length - 1) return '';
        if (idx !== labels.length - 1 && labels.length - 1 - idx < xStep * 0.45) return '';
        return `<text x="${xAt(idx).toFixed(1)}" y="${svgH - 5}" text-anchor="middle" fill="var(--text-muted, #436152)" font-size="9" font-family="Inter,sans-serif">${esc(lbl)}</text>`;
      })
      .join('');

    const barsSvg = labels
      .map((_, i) => {
        const val = Math.max(0, Number(rawValues[i]) || 0);
        const y = yAt(val);
        const h = Math.max(0, padT + plotH - y);
        const x = xAt(i) - barW / 2;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="rgba(16, 185, 129, 0.45)" stroke="#059669" stroke-width="1" />`;
      })
      .join('');

    const emaCoords = emaValues.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');

    el.innerHTML =
      legendHtml +
      `<svg width="100%" height="${svgH}" viewBox="0 0 ${totalW} ${svgH}" class="block overflow-visible">` +
      gridSvg +
      xTicksSvg +
      barsSvg +
      `<polyline fill="none" stroke="${emaColor}" stroke-width="2.2" points="${emaCoords}" />` +
      `<line class="chart-hover-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="var(--border-strong, #87b39b)" stroke-width="1" stroke-dasharray="2,2" style="opacity:0;pointer-events:none" />` +
      `<circle class="chart-hover-ema-dot" cx="0" cy="0" r="3.2" fill="${emaColor}" stroke="var(--bg-panel, #fff)" stroke-width="1.2" style="opacity:0;pointer-events:none" />` +
      `<rect class="chart-hit-layer" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent" style="cursor:crosshair" />` +
      `</svg>`;

    const svg = el.querySelector('svg');
    if (svg) {
      wireCrosshair(svg, { totalW }, labels.length, xAt, (idx, clientX, clientY, snapX) => {
        const rawV = Number(rawValues[idx]) || 0;
        const emaV = Number(emaValues[idx]) || 0;
        const dot = svg.querySelector('.chart-hover-ema-dot');
        if (dot) {
          dot.setAttribute('cx', snapX.toFixed(1));
          dot.setAttribute('cy', yAt(emaV).toFixed(1));
          dot.style.opacity = '1';
        }
        showTooltip(
          clientX,
          clientY,
          `<div style="border-bottom:1px solid var(--border-main,#c5ded0);margin-bottom:3px;padding-bottom:2px;color:var(--text-muted,#436152)">${esc(labels[idx])}</div>` +
          `<div class="flex items-center justify-between gap-3"><span style="color:#059669">■ ${esc(barLabel)}</span><span>${esc(fmtVal(rawV))}</span></div>` +
          `<div class="flex items-center justify-between gap-3"><span style="color:${emaColor}">■ ${esc(emaLabel)}</span><span>${esc(fmtVal(emaV))}</span></div>`
        );
      });
      svg.addEventListener('mouseleave', () => {
        const dot = svg.querySelector('.chart-hover-ema-dot');
        if (dot) dot.style.opacity = '0';
      });
    }

    return {
      resize: () => renderEmaBarLineChart(containerId, config),
      update: (nextCfg) => renderEmaBarLineChart(containerId, nextCfg || config)
    };
  }

  window.AutumnCharts = {
    renderCumulativeChart,
    renderEmaBarLineChart,
    hideTooltip
  };
})();
