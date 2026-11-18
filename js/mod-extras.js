// ============================================================================
// autumn // EXTRAS: EXPORTS, TERMINAL CLI, STAT CARD, BACKUP, REPORT & TOOLS
// ============================================================================

function extractCleanCellText(cellEl) {
  if (!cellEl) return '';
  const clone = cellEl.cloneNode(true);
  // Remove mobile-only duplicate spans when a desktop span is present
  clone.querySelectorAll('.sm\\:hidden').forEach(el => el.remove());
  return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
}

function exportHtmlTableData(tableId, filenameBase, format = 'csv') {
  const tableEl = document.getElementById(tableId);
  if (!tableEl) return showToast('EXPORT ERROR', 'Table element not found.', true);

  const headerCells = Array.from(tableEl.querySelectorAll('thead th'));
  const includeColIndices = [];
  const headers = [];

  headerCells.forEach((th, idx) => {
    if (th.getAttribute('data-no-export') === 'true' || th.textContent.trim() === 'ACT') return;
    includeColIndices.push(idx);
    headers.push(extractCleanCellText(th));
  });

  const bodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
  const dataRows = [];

  bodyRows.forEach(tr => {
    const tds = Array.from(tr.querySelectorAll('td'));
    // Skip empty-state colspan message rows
    if (tds.length === 1 && tds[0].hasAttribute('colspan')) return;
    if (tds.length === 0) return;
    const rowValues = includeColIndices.map(colIdx => extractCleanCellText(tds[colIdx]));
    dataRows.push(rowValues);
  });

  if (dataRows.length === 0) {
    return showToast('EMPTY TABLE', 'No recorded rows available to export yet.', true);
  }

  const dateStamp = getLocalDateString(new Date());
  const fullFilename = `${filenameBase}-${dateStamp}`;

  // Build Markdown format
  const buildMarkdown = () => {
    const mdHeader = `| ${headers.map(h => h.replace(/\|/g, '\\|')).join(' | ')} |`;
    const mdDivider = `| ${headers.map(() => '---').join(' | ')} |`;
    const mdBody = dataRows.map(r => `| ${r.map(c => String(c).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
    return `${mdHeader}\n${mdDivider}\n${mdBody}\n`;
  };

  if (format === 'copy') {
    const mdText = buildMarkdown();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mdText).then(() => {
        showToast('COPIED TO CLIPBOARD', `Copied ${dataRows.length} row(s) as Markdown table.`);
      });
    } else {
      showToast('CLIPBOARD NOTICE', 'Browser blocked clipboard access; use ↓ MD instead.', true);
    }
    return;
  }

  let outputContent = '';
  let mimeType = 'text/plain;charset=utf-8;';
  let ext = format;

  if (format === 'csv') {
    const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;
    outputContent = [
      headers.map(escapeCsv).join(','),
      ...dataRows.map(r => r.map(escapeCsv).join(','))
    ].join('\r\n');
    mimeType = 'text/csv;charset=utf-8;';
  } else if (format === 'tsv') {
    outputContent = [
      headers.join('\t'),
      ...dataRows.map(r => r.join('\t'))
    ].join('\r\n');
    mimeType = 'text/tab-separated-values;charset=utf-8;';
  } else if (format === 'md') {
    outputContent = buildMarkdown();
    mimeType = 'text/markdown;charset=utf-8;';
  } else if (format === 'json') {
    const jsonArr = dataRows.map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h || `col_${i + 1}`] = r[i]; });
      return obj;
    });
    outputContent = JSON.stringify(jsonArr, null, 2);
    mimeType = 'application/json;charset=utf-8;';
  }

  const blob = new Blob([outputContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fullFilename}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('EXPORT COMPLETE', `Downloaded ${fullFilename}.${ext} (${dataRows.length} rows).`);
}

// Helper: Trigger file download for any text/markdown/json/html/csv payload
function triggerFileDownload(content, filename, mimeType = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper: Convert rich HTML content from Daily Journal / General Notes into clean Markdown
function richHtmlToMarkdown(htmlStr) {
  if (!htmlStr) return '';
  let md = String(htmlStr)
    .replace(/<\s*(b|strong)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '**$2**')
    .replace(/<\s*(i|em)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '*$2*')
    .replace(/<\s*(s|strike|del)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '~~$2~~')
    .replace(/<\s*li\b[^>]*>([\s\S]*?)<\s*\/\s*li\s*>/gi, '- $1\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|ul|ol|h[1-6])>/gi, '\n');
  const tmp = document.createElement('div');
  tmp.innerHTML = md;
  return (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

// 1. Export Currently Open Daily Journal Entry
function exportCurrentJournalEntry(format = 'md') {
  const dateStr = selectedNoteDate || getLocalDateString(new Date());
  const title = document.getElementById('note-title-input')?.value.trim() || `Daily Journal (${dateStr})`;
  const mood = document.getElementById('note-mood-input')?.value || 'OPTIMAL';
  const rawHtml = document.getElementById('note-content-editor')?.innerHTML.trim() || '';
  const mdBody = richHtmlToMarkdown(rawHtml);
  const plainBody = htmlToPlainTerminalText(rawHtml);

  if (!rawHtml && !document.getElementById('note-title-input')?.value.trim()) {
    return showToast('EMPTY JOURNAL', `No content to export for ${dateStr}.`, true);
  }

  const mdDocument = `# ${title}\n- **Date:** ${dateStr}\n- **Status:** ${mood}\n\n---\n\n${mdBody}\n`;

  if (format === 'copy') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mdDocument).then(() => {
        showToast('JOURNAL COPIED', `Copied ${dateStr} journal entry as Markdown.`);
      });
    }
    return;
  }

  const baseName = `journal-${dateStr}`;
  if (format === 'md') {
    triggerFileDownload(mdDocument, `${baseName}.md`, 'text/markdown;charset=utf-8;');
  } else if (format === 'txt') {
    const txtDoc = `${title.toUpperCase()}\nDate: ${dateStr} | Status: ${mood}\n${'='.repeat(40)}\n\n${plainBody}\n`;
    triggerFileDownload(txtDoc, `${baseName}.txt`, 'text/plain;charset=utf-8;');
  } else if (format === 'html') {
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:2rem auto;line-height:1.6;"><h1>${escapeHtml(title)}</h1><p><strong>Date:</strong> ${escapeHtml(dateStr)} | <strong>Status:</strong> ${escapeHtml(mood)}</p><hr><div>${rawHtml}</div></body></html>`;
    triggerFileDownload(htmlDoc, `${baseName}.html`, 'text/html;charset=utf-8;');
  } else if (format === 'json') {
    const jsonDoc = JSON.stringify({ date: dateStr, title, mood, markdown: mdBody, html: rawHtml }, null, 2);
    triggerFileDownload(jsonDoc, `${baseName}.json`, 'application/json;charset=utf-8;');
  }
  showToast('JOURNAL EXPORTED', `Downloaded ${baseName}.${format}`);
}

// 2. Export All Recorded Daily Journal Entries
function exportAllJournalEntries(format = 'md') {
  if (!globalNotes || globalNotes.length === 0) {
    return showToast('NO JOURNAL LOGS', 'No archived daily journal entries to export yet.', true);
  }
  const stamp = getLocalDateString(new Date());
  const baseName = `all-daily-journals-${stamp}`;

  if (format === 'md') {
    const mdAll = globalNotes.map(n => {
      const t = n.title || 'Untitled Daily Log';
      const body = richHtmlToMarkdown(n.content || '');
      return `## ${n.date} — ${t} [${n.mood || 'OPTIMAL'}]\n\n${body}\n`;
    }).join('\n---\n\n');
    triggerFileDownload(`# Daily Journal Archive (${globalNotes.length} Entries)\n\n${mdAll}`, `${baseName}.md`, 'text/markdown;charset=utf-8;');
  } else if (format === 'txt') {
    const txtAll = globalNotes.map(n => {
      const t = n.title || 'Untitled Daily Log';
      const body = htmlToPlainTerminalText(n.content || '');
      return `[${n.date}] ${t} (${n.mood || 'OPTIMAL'})\n${'-'.repeat(40)}\n${body}\n`;
    }).join('\n========================================\n\n');
    triggerFileDownload(txtAll, `${baseName}.txt`, 'text/plain;charset=utf-8;');
  } else if (format === 'csv') {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Title', 'Status', 'Content'].map(esc).join(','),
      ...globalNotes.map(n => [n.date, n.title || '', n.mood || 'OPTIMAL', htmlToPlainTerminalText(n.content || '')].map(esc).join(','))
    ].join('\r\n');
    triggerFileDownload(rows, `${baseName}.csv`, 'text/csv;charset=utf-8;');
  } else if (format === 'json') {
    const payload = globalNotes.map(n => ({
      date: n.date,
      title: n.title || '',
      mood: n.mood || 'OPTIMAL',
      content_markdown: richHtmlToMarkdown(n.content || ''),
      content_html: n.content || '',
      updated_at: n.updated_at || null
    }));
    triggerFileDownload(JSON.stringify(payload, null, 2), `${baseName}.json`, 'application/json;charset=utf-8;');
  }
  showToast('ARCHIVE EXPORTED', `Downloaded ${globalNotes.length} journal entries as .${format}`);
}

// 3. Export Currently Open General Note
function exportCurrentGeneralNote(format = 'md') {
  const title = document.getElementById('gen-note-title-input')?.value.trim() || 'Untitled General Note';
  const category = document.getElementById('gen-note-category-input')?.value || 'GENERAL';
  const rawHtml = document.getElementById('gen-note-content-editor')?.innerHTML.trim() || '';
  const mdBody = richHtmlToMarkdown(rawHtml);
  const plainBody = htmlToPlainTerminalText(rawHtml);

  if (!rawHtml && !document.getElementById('gen-note-title-input')?.value.trim()) {
    return showToast('EMPTY NOTE', 'Select or write a general note before exporting.', true);
  }

  const safeSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general-note';
  const mdDocument = `# ${title}\n- **Category:** ${category}\n\n---\n\n${mdBody}\n`;

  if (format === 'copy') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mdDocument).then(() => {
        showToast('GENERAL NOTE COPIED', `Copied "${title}" as Markdown.`);
      });
    }
    return;
  }

  if (format === 'md') {
    triggerFileDownload(mdDocument, `${safeSlug}.md`, 'text/markdown;charset=utf-8;');
  } else if (format === 'txt') {
    const txtDoc = `${title.toUpperCase()}\nCategory: ${category}\n${'='.repeat(40)}\n\n${plainBody}\n`;
    triggerFileDownload(txtDoc, `${safeSlug}.txt`, 'text/plain;charset=utf-8;');
  } else if (format === 'html') {
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:2rem auto;line-height:1.6;"><h1>${escapeHtml(title)}</h1><p><strong>Category:</strong> ${escapeHtml(category)}</p><hr><div>${rawHtml}</div></body></html>`;
    triggerFileDownload(htmlDoc, `${safeSlug}.html`, 'text/html;charset=utf-8;');
  } else if (format === 'json') {
    const jsonDoc = JSON.stringify({ title, category, markdown: mdBody, html: rawHtml }, null, 2);
    triggerFileDownload(jsonDoc, `${safeSlug}.json`, 'application/json;charset=utf-8;');
  }
  showToast('NOTE EXPORTED', `Downloaded ${safeSlug}.${format}`);
}

// 4. Export All Saved General Notes
function exportAllGeneralNotes(format = 'md') {
  if (!globalGeneralNotes || globalGeneralNotes.length === 0) {
    return showToast('NO GENERAL NOTES', 'No saved general notes to export yet.', true);
  }
  const stamp = getLocalDateString(new Date());
  const baseName = `all-general-notes-${stamp}`;

  if (format === 'md') {
    const mdAll = globalGeneralNotes.map(n => {
      const t = n.title || 'Untitled General Note';
      const body = richHtmlToMarkdown(n.content || '');
      return `## ${t} [${n.category || 'GENERAL'}]\n\n${body}\n`;
    }).join('\n---\n\n');
    triggerFileDownload(`# General Notes Archive (${globalGeneralNotes.length} Notes)\n\n${mdAll}`, `${baseName}.md`, 'text/markdown;charset=utf-8;');
  } else if (format === 'txt') {
    const txtAll = globalGeneralNotes.map(n => {
      const t = n.title || 'Untitled General Note';
      const body = htmlToPlainTerminalText(n.content || '');
      return `${t} [${n.category || 'GENERAL'}]\n${'-'.repeat(40)}\n${body}\n`;
    }).join('\n========================================\n\n');
    triggerFileDownload(txtAll, `${baseName}.txt`, 'text/plain;charset=utf-8;');
  } else if (format === 'csv') {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Title', 'Category', 'Updated At', 'Content'].map(esc).join(','),
      ...globalGeneralNotes.map(n => [n.title || '', n.category || 'GENERAL', n.updated_at || '', htmlToPlainTerminalText(n.content || '')].map(esc).join(','))
    ].join('\r\n');
    triggerFileDownload(rows, `${baseName}.csv`, 'text/csv;charset=utf-8;');
  } else if (format === 'json') {
    const payload = globalGeneralNotes.map(n => ({
      id: n.id,
      title: n.title || '',
      category: n.category || 'GENERAL',
      content_markdown: richHtmlToMarkdown(n.content || ''),
      content_html: n.content || '',
      updated_at: n.updated_at || null
    }));
    triggerFileDownload(JSON.stringify(payload, null, 2), `${baseName}.json`, 'application/json;charset=utf-8;');
  }
  showToast('NOTES ARCHIVE EXPORTED', `Downloaded ${globalGeneralNotes.length} general notes as .${format}`);
}

// 5. Export Tasks Matrix (Subjects / Competitions / Other)
function exportTasksMatrixData(format = 'md') {
  if (!globalTaskColumns || globalTaskColumns.length === 0) {
    return showToast('EMPTY MATRIX', 'No task columns to export yet.', true);
  }
  const stamp = getLocalDateString(new Date());
  const baseName = `tasks-matrix-${stamp}`;

  // Flattens a column's tree into { task, depth } rows in board order, so every export
  // format can indent subtasks instead of flattening them into the parent's level.
  const flattenColumnTasks = (colId) => {
    const out = [];
    const walk = (list, depth, ancestry) => {
      list.forEach((task) => {
        if (ancestry.indexOf(task.id) !== -1) return;
        out.push({ task, depth });
        walk(getChildTasks(colId, task.id), depth + 1, ancestry.concat(task.id));
      });
    };
    walk(getRootTasks(colId), 0, []);
    return out;
  };

  const buildTasksMd = () => globalTaskColumns.map(col => {
    const rows = flattenColumnTasks(col.id);
    const lines = rows.length === 0
      ? '_No tasks_'
      : rows.map(({ task, depth }) => '  '.repeat(depth) + `- [${task.is_done ? 'x' : ' '}] ${task.title}`).join('\n');
    return `### ${col.title} [${col.category}]${col.is_done ? ' (COMPLETED)' : ''}\n${lines}\n`;
  }).join('\n');

  if (format === 'copy') {
    const md = `# Subject & Competition Task Matrix\n\n${buildTasksMd()}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(() => {
        showToast('TASKS COPIED', 'Copied Task Matrix as Markdown checklist.');
      });
    }
    return;
  }

  if (format === 'md') {
    triggerFileDownload(`# Subject & Competition Task Matrix\n\n${buildTasksMd()}`, `${baseName}.md`, 'text/markdown;charset=utf-8;');
  } else if (format === 'csv') {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvRows = [['Column', 'Category', 'Column Done', 'Task', 'Task Done', 'Parent', 'Depth'].map(esc).join(',')];
    globalTaskColumns.forEach(col => {
      const rows = flattenColumnTasks(col.id);
      if (rows.length === 0) {
        csvRows.push([col.title, col.category, col.is_done ? 'YES' : 'NO', '', '', '', ''].map(esc).join(','));
      } else {
        rows.forEach(({ task, depth }) => {
          const parentTask = getTaskParentId(task) ? getTaskById(getTaskParentId(task)) : null;
          csvRows.push([
            col.title, col.category, col.is_done ? 'YES' : 'NO', task.title,
            task.is_done ? 'YES' : 'NO', parentTask ? parentTask.title : '', String(depth)
          ].map(esc).join(','));
        });
      }
    });
    triggerFileDownload(csvRows.join('\r\n'), `${baseName}.csv`, 'text/csv;charset=utf-8;');
  } else if (format === 'json') {
    const nestForJson = (colId, parentId) => getChildTasks(colId, parentId).map(t => ({
      title: t.title,
      is_done: Boolean(t.is_done),
      subtasks: nestForJson(colId, t.id)
    }));
    const payload = globalTaskColumns.map(col => ({
      title: col.title,
      category: col.category,
      is_done: Boolean(col.is_done),
      tasks: nestForJson(col.id, '')
    }));
    triggerFileDownload(JSON.stringify(payload, null, 2), `${baseName}.json`, 'application/json;charset=utf-8;');
  }
  showToast('TASKS EXPORTED', `Downloaded ${baseName}.${format}`);
}

function getTodayTerminalNoteTitle() {
  const todayStr = getLocalDateString(new Date());
  return `TERMINAL SCRATCHPAD // ${todayStr}`;
}

function getTodayTerminalLocalCacheKey() {
  const todayStr = getLocalDateString(new Date());
  return `autumn_terminal_scratchpad_${todayStr}`;
}

function htmlToPlainTerminalText(htmlStr) {
  if (!htmlStr) return '';
  const temp = document.createElement('div');
  let normalized = String(htmlStr)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n');
  temp.innerHTML = normalized;
  return (temp.textContent || temp.innerText || '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function plainTerminalTextToHtml(plainStr) {
  if (!plainStr) return '';
  return escapeHtml(plainStr).replace(/\r?\n/g, '<br>');
}

function findTodayTerminalGeneralNote() {
  const expectedTitle = getTodayTerminalNoteTitle();
  return globalGeneralNotes.find(
    n => n.title === expectedTitle || (n.category === 'TERMINAL' && n.title === expectedTitle)
  );
}

function toggleTerminalDrawer(focusInput = false) {
  const bodyEl = document.getElementById('terminal-drawer-body');
  const chevronEl = document.getElementById('terminal-chevron');
  if (!bodyEl) return;

  isTerminalDrawerOpen = !isTerminalDrawerOpen;
  const drawerToggleEl = document.getElementById('terminal-toggle-btn');
  if (drawerToggleEl) drawerToggleEl.setAttribute('aria-expanded', isTerminalDrawerOpen ? 'true' : 'false');
  if (isTerminalDrawerOpen) {
    bodyEl.classList.remove('hidden');
    if (chevronEl) chevronEl.textContent = '▼';
    syncTerminalDrawerFromGeneralNotes();
    if (focusInput) {
      setTimeout(() => {
        const quickIn = document.getElementById('terminal-quick-input');
        if (quickIn) quickIn.focus();
      }, 50);
    }
  } else {
    bodyEl.classList.add('hidden');
    if (chevronEl) chevronEl.textContent = '▲';
  }
}

function updateTerminalWordCount() {
  const textarea = document.getElementById('terminal-scratchpad-textarea');
  const countEl = document.getElementById('terminal-word-count');
  if (!textarea || !countEl) return;
  const text = textarea.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  countEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
}

function updateTerminalAuthUI() {
  const todayStr = getLocalDateString(new Date());
  const datePill = document.getElementById('terminal-date-pill');
  const titleLabel = document.getElementById('terminal-note-title-label');
  const authHint = document.getElementById('terminal-auth-hint');
  const syncLabel = document.getElementById('terminal-sync-label');

  if (datePill) datePill.textContent = todayStr;
  if (titleLabel) titleLabel.textContent = getTodayTerminalNoteTitle();

  if (currentUser) {
    if (authHint) authHint.textContent = `Auto-saves to General Notes (${todayStr})`;
    if (syncLabel) syncLabel.textContent = 'AUTO-SYNC // READY';
    // If there was a local draft typed before signing in, sync it up
    const localDraft = localStorage.getItem(getTodayTerminalLocalCacheKey());
    const existingNote = findTodayTerminalGeneralNote();
    if (localDraft && !existingNote) {
      const textarea = document.getElementById('terminal-scratchpad-textarea');
      if (textarea && !textarea.value.trim()) {
        textarea.value = localDraft;
      }
      flushTerminalToGeneralNote(false);
    }
  } else {
    if (authHint) authHint.textContent = ' Guest mode: saved locally (Sign in to sync to DB)';
    if (syncLabel) syncLabel.textContent = 'LOCAL DRAFT';
  }
}

function syncTerminalDrawerFromGeneralNotes() {
  const textarea = document.getElementById('terminal-scratchpad-textarea');
  if (!textarea) return;

  updateTerminalAuthUI();
  const todayNote = findTodayTerminalGeneralNote();

  // Avoid overwriting while the user is actively typing in the textarea
  if (document.activeElement === textarea && pendingTerminalSave) return;

  if (todayNote) {
    textarea.value = htmlToPlainTerminalText(todayNote.content || '');
  } else {
    const localDraft = localStorage.getItem(getTodayTerminalLocalCacheKey());
    textarea.value = localDraft || '';
  }
  updateTerminalWordCount();
}

function setTerminalSyncStatus(stateText, colorHex = '#6ee7b7') {
  const syncLabel = document.getElementById('terminal-sync-label');
  if (syncLabel) {
    syncLabel.textContent = stateText;
    syncLabel.style.color = colorHex;
  }
  // BUGFIX: there are TWO status dots (header bar + drawer sub-header) and they used to
  // share one id, so only the first was ever updated. Both are driven now.
  document.querySelectorAll('#terminal-status-dot, #terminal-status-dot-drawer').forEach((dot) => {
    dot.style.backgroundColor = colorHex;
  });
}

function handleTerminalBufferInput() {
  updateTerminalWordCount();
  const textarea = document.getElementById('terminal-scratchpad-textarea');
  if (!textarea) return;

  // Always keep a local browser backup for today
  try {
    localStorage.setItem(getTodayTerminalLocalCacheKey(), textarea.value);
  } catch (e) {}

  pendingTerminalSave = true;
  setTerminalSyncStatus('TYPING...', '#fcd34d');

  if (terminalSaveTimeout) clearTimeout(terminalSaveTimeout);
  terminalSaveTimeout = setTimeout(() => {
    flushTerminalToGeneralNote(false);
  }, 750);
}

function handleTerminalQuickAppend(e) {
  e.preventDefault();
  const quickInput = document.getElementById('terminal-quick-input');
  const textarea = document.getElementById('terminal-scratchpad-textarea');
  if (!quickInput || !textarea) return;

  const thought = quickInput.value.trim();
  if (!thought) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const stampedLine = `[${hh}:${mm}] • ${thought}`;

  const currentVal = textarea.value.trimEnd();
  textarea.value = currentVal ? `${currentVal}\n${stampedLine}` : stampedLine;
  quickInput.value = '';

  // Scroll textarea to bottom so the newly appended line is visible
  textarea.scrollTop = textarea.scrollHeight;
  updateTerminalWordCount();

  try {
    localStorage.setItem(getTodayTerminalLocalCacheKey(), textarea.value);
  } catch (err) {}

  flushTerminalToGeneralNote(false);
}

function insertTerminalTimestamp() {
  const textarea = document.getElementById('terminal-scratchpad-textarea');
  if (!textarea) return;
  const now = new Date();
  const stamp = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}] `;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const prefix = start > 0 && textarea.value[start - 1] !== '\n' ? '\n' : '';
  textarea.value = textarea.value.slice(0, start) + prefix + stamp + textarea.value.slice(end);
  textarea.focus();
  const newCursor = start + prefix.length + stamp.length;
  textarea.setSelectionRange(newCursor, newCursor);
  handleTerminalBufferInput();
}

async function flushTerminalToGeneralNote(showManualToast = false) {
  if (terminalSaveTimeout) {
    clearTimeout(terminalSaveTimeout);
    terminalSaveTimeout = null;
  }

  const textarea = document.getElementById('terminal-scratchpad-textarea');
  if (!textarea) return;

  const plainText = textarea.value;
  const htmlContent = plainTerminalTextToHtml(plainText);
  const targetTitle = getTodayTerminalNoteTitle();

  try {
    localStorage.setItem(getTodayTerminalLocalCacheKey(), plainText);
  } catch (e) {}

  if (!currentUser) {
    pendingTerminalSave = false;
    setTerminalSyncStatus('SAVED LOCALLY', '#fcd34d');
    if (showManualToast) {
      showToast('LOCAL SCRATCHPAD SAVED', 'Sign in as autumn to sync today\'s terminal note to Supabase.');
    }
    return;
  }

  if (isSavingTerminalNote) {
    pendingTerminalSave = true;
    return;
  }

  isSavingTerminalNote = true;
  pendingTerminalSave = false;
  setTerminalSyncStatus('SYNCING...', '#38bdf8');

  try {
    let todayNote = findTodayTerminalGeneralNote();

    if (!todayNote) {
      // Double-check database in case it was created in another session
      const { data: existingRows } = await supabaseClient
        .from('general_notes')
        .select('*')
        .eq('title', targetTitle)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        todayNote = existingRows[0];
      }
    }

    if (todayNote && todayNote.id) {
      const { error } = await supabaseClient
        .from('general_notes')
        .update({
          title: targetTitle,
          category: 'TERMINAL',
          content: htmlContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', todayNote.id);

      if (error) throw error;
    } else if (plainText.trim().length > 0 || showManualToast) {
      const { data: created, error } = await supabaseClient
        .from('general_notes')
        .insert({
          title: targetTitle,
          category: 'TERMINAL',
          content: htmlContent,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (created) {
        globalGeneralNotes.unshift(created);
      }
    }

    const timeShort = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalSyncStatus(`SAVED ${timeShort}`, '#34d399');

    // Refresh General Notes list in Tab 05 without stealing cursor focus
    const { data: refreshed } = await supabaseClient
      .from('general_notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (refreshed) {
      globalGeneralNotes = refreshed;
      renderGeneralNotesArchive();
      const updatedTodayNote = findTodayTerminalGeneralNote();
      if (updatedTodayNote && selectedGeneralNoteId === updatedTodayNote.id) {
        const genEditor = document.getElementById('gen-note-content-editor');
        if (document.activeElement !== genEditor) {
          loadGeneralNoteIntoEditor(updatedTodayNote);
        }
      }
    }

    if (showManualToast) {
      showToast('TERMINAL NOTE SYNCED', `Saved to "${targetTitle}" in General Notes.`);
    }
  } catch (err) {
    console.warn('Terminal scratchpad sync error:', err.message);
    setTerminalSyncStatus('SYNC ERROR', '#f87171');
    if (showManualToast) {
      showToast('TERMINAL SYNC ERROR', err.message, true);
    }
  } finally {
    isSavingTerminalNote = false;
    if (pendingTerminalSave) {
      flushTerminalToGeneralNote(false);
    }
  }
}

async function openTodayTerminalInNotesTab() {
  await flushTerminalToGeneralNote(false);
  switchTab('notes');
  const todayNote = findTodayTerminalGeneralNote();
  if (todayNote) {
    selectGeneralNote(todayNote.id);
  } else {
    document.getElementById('gen-note-active-badge').textContent = 'TERMINAL';
    document.getElementById('gen-note-title-input').value = getTodayTerminalNoteTitle();
    document.getElementById('gen-note-category-input').value = 'TERMINAL';
    const textarea = document.getElementById('terminal-scratchpad-textarea');
    document.getElementById('gen-note-content-editor').innerHTML = plainTerminalTextToHtml(textarea ? textarea.value : '');
    updateGeneralNoteWordCount();
  }
  const genForm = document.getElementById('gen-note-editor-form');
  if (genForm) genForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let currentStatCardMode = 'telemetry'; // 'telemetry' | 'journal'

function setStatCardMode(mode) {
  currentStatCardMode = mode === 'journal' ? 'journal' : 'telemetry';
  const btnT = document.getElementById('stat-card-mode-telemetry');
  const btnJ = document.getElementById('stat-card-mode-journal');
  if (btnT) {
    if (currentStatCardMode === 'telemetry') btnT.classList.add('active-view');
    else btnT.classList.remove('active-view');
  }
  if (btnJ) {
    if (currentStatCardMode === 'journal') btnJ.classList.add('active-view');
    else btnJ.classList.remove('active-view');
  }
  renderStatCardPreview();
}

async function openStatCardModal(mode = 'telemetry') {
  if (window.__autumnLazy && typeof window.__autumnLazy.ensureModalsMounted === 'function') {
    await window.__autumnLazy.ensureModalsMounted();
  }
  const dateIn = document.getElementById('stat-card-date-input');
  if (dateIn) {
    dateIn.value = mode === 'journal'
      ? (selectedNoteDate || getWeekMondayDateString(new Date()))
      : getLocalDateString(new Date());
  }
  setStatCardMode(mode);
  openModal('stat-card-modal');
}

function getStatCardPalette() {
  const paletteMap = {
    'default': { bg: '#0c1f17', panel: '#112a20', border: '#10b981', text: '#ecfdf5', muted: '#6ee7b7', accent: '#34d399', sky: '#7dd3fc', pink: '#f9a8d4' },
    'amber-crt': { bg: '#120c04', panel: '#1f1407', border: '#ffb000', text: '#ffca4b', muted: '#d48800', accent: '#ffb000', sky: '#ffd27d', pink: '#ff9900' },
    'phosphor-green': { bg: '#041108', panel: '#091f10', border: '#33ff66', text: '#a3ffba', muted: '#1fc74b', accent: '#33ff66', sky: '#6ee7b7', pink: '#86efac' },
    'cyan-cold': { bg: '#041019', panel: '#091d2c', border: '#38bdf8', text: '#e0f2fe', muted: '#0ea5e9', accent: '#38bdf8', sky: '#7dd3fc', pink: '#c084fc' },
    'autumn-oled': { bg: '#000000', panel: '#0a0d0b', border: '#34d399', text: '#f1f5f9', muted: '#94a3b8', accent: '#10b981', sky: '#7dd3fc', pink: '#f9a8d4' }
  };
  return paletteMap[activeDisplayProfile] || paletteMap['default'];
}

function buildWeeklyJournalCardSvgString() {
  const pal = getStatCardPalette();
  const rawDate = document.getElementById('stat-card-date-input')?.value || selectedNoteDate || getLocalDateString(new Date());
  const weekMonday = getWeekMondayDateString(rawDate);
  const weekLabel = formatWeekSpanLabel(weekMonday);

  // Find saved weekly note OR use currently typed editor values if matching
  const savedNote = globalNotes.find(n => n.date === weekMonday);
  const titleText = (selectedNoteDate === weekMonday && document.getElementById('note-title-input')?.value.trim())
    ? document.getElementById('note-title-input').value.trim()
    : (savedNote?.title || `Weekly Operational Log (${weekMonday})`);
  const moodText = (selectedNoteDate === weekMonday && document.getElementById('note-mood-input')?.value)
    ? document.getElementById('note-mood-input').value
    : (savedNote?.mood || 'OPTIMAL');
  const rawHtml = (selectedNoteDate === weekMonday && document.getElementById('note-content-editor')?.innerHTML.trim())
    ? document.getElementById('note-content-editor').innerHTML.trim()
    : (savedNote?.content || 'No weekly reflection text recorded for this week yet.');
  const plainBody = htmlToPlainTerminalText(rawHtml);

  // Compute 7-day study & step totals for this week
  const monObj = new Date(weekMonday + 'T00:00:00');
  let wkStudy = 0, wkSteps = 0;
  const dayBars = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monObj);
    d.setDate(monObj.getDate() + i);
    const ds = getLocalDateString(d);
    const sR = globalStudyRows.find(r => r.date === ds);
    const stR = globalStepsRows.find(r => r.date === ds);
    const sh = sR ? sR.actual_hours : 0;
    const stp = stR ? stR.actual_steps : 0;
    wkStudy += sh;
    wkSteps += stp;
    dayBars.push({ label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], sh, stp });
  }

  // Word-wrap plainBody into up to 11 clean lines (~74 chars per line)
  const wrappedLines = [];
  plainBody.split(/\r?\n/).forEach(para => {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      if (wrappedLines.length > 0 && wrappedLines[wrappedLines.length - 1] !== '') wrappedLines.push('');
      return;
    }
    let line = '';
    words.forEach(w => {
      if ((line + ' ' + w).trim().length > 76) {
        wrappedLines.push(line.trim());
        line = w;
      } else {
        line = (line + ' ' + w).trim();
      }
    });
    if (line) wrappedLines.push(line);
  });
  const displayLines = wrappedLines.slice(0, 11);

  let punchHoles = '';
  for (let i = 0; i < 24; i++) {
    punchHoles += `<rect x="${28 + i * 28}" y="14" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
    punchHoles += `<rect x="${28 + i * 28}" y="532" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
  }

  const miniBarsSvg = dayBars.map((b, i) => {
    const bh = Math.min(48, Math.round((b.sh / 12) * 48));
    const bx = 508 + i * 24;
    const by = 148 - bh;
    return `
      <rect x="${bx}" y="${by}" width="16" height="${bh}" fill="${i % 2 === 0 ? pal.sky : pal.pink}" opacity="0.88"/>
      <text x="${bx + 8}" y="162" text-anchor="middle" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">${b.label}</text>
    `;
  }).join('');

  const linesSvg = displayLines.map((ln, idx) => `
    <text x="44" y="${238 + idx * 22}" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12">${escapeHtml(ln)}</text>
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 560" width="720" height="560">
    <rect width="720" height="560" fill="${pal.bg}"/>
    <rect x="10" y="8" width="700" height="544" fill="${pal.panel}" stroke="${pal.border}" stroke-width="2"/>
    ${punchHoles}

    <text x="30" y="52" fill="${pal.accent}" font-family="Inter, sans-serif" font-size="15" font-weight="400">AUTUMN // WEEKLY OPERATIONAL JOURNAL PUNCH CARD</text>
    <text x="690" y="52" text-anchor="end" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="12" font-weight="400">${escapeHtml(weekLabel)}</text>
    <line x1="28" y1="64" x2="692" y2="64" stroke="${pal.border}" stroke-width="1" stroke-dasharray="4 4"/>

    <!-- Top Summary & 7-Day Mini Bar Graph -->
    <rect x="28" y="76" width="456" height="96" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
    <text x="42" y="98" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10">WEEKLY HEADLINE // STATUS: ${escapeHtml(moodText)}</text>
    <text x="42" y="124" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="400">${escapeHtml(titleText.slice(0, 44))}</text>
    <text x="42" y="152" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="11">WEEKLY STUDY: ${escapeHtml(formatHours(wkStudy))}   |   WEEKLY STEPS: ${escapeHtml(formatSteps(wkSteps))}</text>

    <rect x="496" y="76" width="196" height="96" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
    <text x="508" y="94" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">7D STUDY OUTPUT (M–S)</text>
    ${miniBarsSvg}

    <!-- Journal Body Content Box -->
    <rect x="28" y="186" width="664" height="304" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
    <text x="44" y="210" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10" font-weight="400">WEEKLY REFLECTION &amp; FIELD LOG</text>
    <line x1="44" y1="218" x2="676" y2="218" stroke="${pal.border}" stroke-width="0.6" opacity="0.5"/>
    ${linesSvg}

    <!-- Footer -->
    <text x="30" y="514" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">OPERATOR: AUTUMN   |   KEY: ${escapeHtml(weekMonday)}   |   PROFILE: ${escapeHtml(activeDisplayProfile.toUpperCase())}</text>
  </svg>`;
}

function buildStatCardSvgString() {
  if (currentStatCardMode === 'journal') {
    return buildWeeklyJournalCardSvgString();
  }

  const pal = getStatCardPalette();
  const dateStr = document.getElementById('stat-card-date-input')?.value || getLocalDateString(new Date());
  const sRow = globalStudyRows.find(r => r.date === dateStr);
  const stRow = globalStepsRows.find(r => r.date === dateStr);

  const studyActual = sRow ? sRow.actual_hours : 0;
  const studyTarget = sRow ? sRow.computed_target : getStudyBaseGoalForDate(dateStr);
  const studyOver = sRow ? sRow.computed_overflow : (globalStudyRows.length > 0 ? globalStudyRows[globalStudyRows.length - 1].computed_overflow : 0);

  const stepsActual = stRow ? stRow.actual_steps : 0;
  const stepsTarget = stRow ? stRow.computed_target : getStepsBaseGoalForDate(dateStr);

  const monthlyInfo = computeMonthlyStudyWithBonus(globalStudyRows, new Date(dateStr + 'T00:00:00'));
  const yieldInfo = computeDailyOperationalYield(dateStr);
  const { availA, availAPlus } = getAvailableQuotaPasses();

  const studyVals = globalStudyRows.map(r => Number(r.actual_hours) || 0);
  const studySigma14 = calcStandardDeviation(studyVals.slice(-14));
  const sortedStudy = studyVals.slice().sort((a, b) => a - b);
  const p25 = calcPercentile(sortedStudy, 0.25);
  const p50 = calcPercentile(sortedStudy, 0.50);
  const p75 = calcPercentile(sortedStudy, 0.75);
  const dtiRatio = Math.max(0, studyOver) / 49.0;

  const recent14 = globalStudyRows.slice(-14);
  const recent14Hrs = recent14.map(r => r.actual_hours);
  const recent14Ema = calcEMA(recent14Hrs, 7);
  const latestEma = recent14Ema.length > 0 ? recent14Ema[recent14Ema.length - 1] : 0;

  const doneTasks = globalTaskItems.filter(t => t.is_done).length;
  const totalTasks = globalTaskItems.length;
  const inProgTasks = globalTaskItems.filter(t => !t.is_done && getTaskProgressState(t.id) === 'IN-PROGRESS').length;

  const fiveKRuns = globalRunningLogs
    .filter(r => r.category === '5k' && r.run_type !== 'REFERENCE')
    .sort((a, b) => parsePaceToSeconds(a.pace_str) - parsePaceToSeconds(b.pace_str));
  const best5k = fiveKRuns.length > 0 ? `${normalizePaceDisplay(fiveKRuns[0].pace_str)}/km` : '--:--/km';

  const studyPct = Math.min(100, Math.round((studyActual / Math.max(0.1, studyTarget)) * 100));
  const stepsPct = Math.min(100, Math.round((stepsActual / Math.max(1, stepsTarget)) * 100));

  let punchHoles = '';
  for (let i = 0; i < 24; i++) {
    punchHoles += `<rect x="${28 + i * 28}" y="14" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
    punchHoles += `<rect x="${28 + i * 28}" y="532" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
  }

  // Build 14-Day Mini Bar + EMA Sparkline SVG Graph
  let barsSvg = '';
  let emaPoints = [];
  recent14.forEach((r, idx) => {
    const bx = 44 + idx * 21;
    const bh = Math.min(54, Math.round((r.actual_hours / 12) * 54));
    const by = 408 - bh;
    barsSvg += `<rect x="${bx}" y="${by}" width="14" height="${bh}" fill="${idx % 2 === 0 ? pal.sky : pal.pink}" opacity="0.82"/>`;
    const ey = 408 - Math.min(54, Math.round(((recent14Ema[idx] || 0) / 12) * 54));
    emaPoints.push(`${bx + 7},${ey}`);
  });
  const emaPolyline = emaPoints.length > 1
    ? `<polyline fill="none" stroke="${pal.accent}" stroke-width="2.2" points="${emaPoints.join(' ')}"/>`
    : '';

  // Quartile Box-and-Whisker SVG coordinates (0h to 12h mapped to 280px width)
  const qLeft = 390 + Math.round((Math.min(12, p25) / 12) * 280);
  const qRight = 390 + Math.round((Math.min(12, p75) / 12) * 280);
  const qMed = 390 + Math.round((Math.min(12, p50) / 12) * 280);
  const qWidth = Math.max(6, qRight - qLeft);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 560" width="720" height="560">
    <rect width="720" height="560" fill="${pal.bg}"/>
    <rect x="10" y="8" width="700" height="544" fill="${pal.panel}" stroke="${pal.border}" stroke-width="2"/>
    ${punchHoles}

    <!-- Header -->
    <text x="30" y="52" fill="${pal.accent}" font-family="Inter, sans-serif" font-size="15" font-weight="400">AUTUMN // FLIGHT RECORDER TELEMETRY PUNCH CARD</text>
    <text x="690" y="52" text-anchor="end" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="12" font-weight="400">YIELD: ${yieldInfo.score}/100 [${yieldInfo.grade}] // ${escapeHtml(dateStr)}</text>
    <line x1="28" y1="64" x2="692" y2="64" stroke="${pal.border}" stroke-width="1" stroke-dasharray="4 4"/>

    <!-- Primary Study & Steps Readouts -->
    <rect x="28" y="76" width="322" height="114" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
    <text x="42" y="96" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10">01 // COGNITIVE STUDY OUTPUT</text>
    <text x="42" y="130" fill="${pal.text}" font-family="Inter, sans-serif" font-size="26" font-weight="400">${escapeHtml(formatHours(studyActual))} <tspan font-size="13" fill="${pal.muted}">/ ${escapeHtml(formatHours(studyTarget))}</tspan></text>
    <rect x="42" y="142" width="294" height="9" fill="${pal.panel}" stroke="${pal.border}" stroke-width="1"/>
    <rect x="42" y="142" width="${Math.round(2.94 * studyPct)}" height="9" fill="${pal.accent}"/>
    <text x="42" y="172" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">7D EMA: ${latestEma.toFixed(1)}h · 14D σ: ${studySigma14.toFixed(2)}h · DTI: ${dtiRatio.toFixed(2)}</text>

    <rect x="370" y="76" width="322" height="114" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
    <text x="384" y="96" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10">02 // KINETIC STEP OUTPUT</text>
    <text x="384" y="130" fill="${pal.text}" font-family="Inter, sans-serif" font-size="26" font-weight="400">${escapeHtml(formatSteps(stepsActual))} <tspan font-size="13" fill="${pal.muted}">/ ${escapeHtml(formatSteps(stepsTarget))}</tspan></text>
    <rect x="384" y="142" width="294" height="9" fill="${pal.panel}" stroke="${pal.border}" stroke-width="1"/>
    <rect x="384" y="142" width="${Math.round(2.94 * stepsPct)}" height="9" fill="${pal.sky}"/>
    <text x="384" y="172" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">QUOTA: ${stepsPct}% · 5K PR: ${escapeHtml(best5k)} · PASSES: ${availA.length}[A] ${availAPlus.length}[A+]</text>

    <!-- Secondary Telemetry Grid (3 Cells: Monthly Cycle + Bonus, Risk & DTI, Tasks & Habits) -->
    <rect x="28" y="204" width="212" height="84" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
    <text x="40" y="224" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">MONTHLY CYCLE (${escapeHtml(monthlyInfo.monthName)})</text>
    <text x="40" y="254" fill="${pal.text}" font-family="Inter, sans-serif" font-size="19" font-weight="400">${escapeHtml(formatHours(monthlyInfo.totalMonthlyHours))}</text>
    <text x="40" y="274" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10">includes +${escapeHtml(formatHours(monthlyInfo.bonusHours))} bonus</text>

    <rect x="254" y="204" width="212" height="84" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
    <text x="266" y="224" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">PORTFOLIO RISK &amp; MEDIAN</text>
    <text x="266" y="254" fill="${pal.text}" font-family="Inter, sans-serif" font-size="19" font-weight="400">P50: ${p50.toFixed(1)}h</text>
    <text x="266" y="274" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10">${dtiRatio < 0.15 ? 'SYS_HEALTH: OPTIMAL' : dtiRatio <= 0.35 ? 'ELEVATED RISK' : 'CRITICAL DEFICIT'}</text>

    <rect x="480" y="204" width="212" height="84" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
    <text x="492" y="224" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">TASK MATRIX &amp; EXECUTION</text>
    <text x="492" y="254" fill="${pal.text}" font-family="Inter, sans-serif" font-size="19" font-weight="400">${doneTasks}/${totalTasks} DONE</text>
    <text x="492" y="274" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">${inProgTasks} task(s) IN-PROGRESS</text>

    <!-- Embedded Telemetry Graphs Row (14D Study + EMA Graph & Quartile Boxplot) -->
    <rect x="28" y="302" width="322" height="122" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
    <text x="42" y="322" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10" font-weight="400">14-DAY STUDY BARS &amp; 7D EMA CURVE</text>
    <line x1="42" y1="408" x2="336" y2="408" stroke="${pal.border}" stroke-width="0.8"/>
    ${barsSvg}
    ${emaPolyline}

    <rect x="370" y="302" width="322" height="122" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
    <text x="384" y="322" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10" font-weight="400">BOX-AND-WHISKER QUARTILES (0H–12H)</text>
    <text x="384" y="344" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">P25: ${p25.toFixed(1)}h  |  P50: ${p50.toFixed(1)}h  |  P75: ${p75.toFixed(1)}h</text>
    <line x1="390" y1="376" x2="670" y2="376" stroke="${pal.muted}" stroke-width="1.5" stroke-dasharray="3 3"/>
    <rect x="${qLeft}" y="362" width="${qWidth}" height="28" fill="${pal.panel}" stroke="${pal.sky}" stroke-width="2"/>
    <line x1="${qMed}" y1="358" x2="${qMed}" y2="394" stroke="${pal.pink}" stroke-width="3"/>
    <text x="390" y="412" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">0h</text>
    <text x="530" y="412" text-anchor="middle" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">6h</text>
    <text x="670" y="412" text-anchor="end" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">12h</text>

    <!-- Footer Serial Strip -->
    <rect x="28" y="438" width="664" height="74" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
    <text x="42" y="460" fill="${pal.accent}" font-family="Inter, sans-serif" font-size="11" font-weight="400">DIRECTIVE // ${escapeHtml((document.getElementById('focus-directive-input')?.value || 'CONSISTENT DAILY EXECUTION & ZERO DEFICIT SPILLOVER').slice(0, 60))}</text>
    <text x="42" y="480" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">DAILY YIELD: ${yieldInfo.score}/100 [GRADE: ${yieldInfo.grade}]   |   OPERATOR: AUTUMN   |   SYS: LEDGER-06</text>
    <text x="42" y="498" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">STAMP: ${escapeHtml(new Date().toISOString())}</text>
  </svg>`;
}

function renderStatCardPreview() {
  const box = document.getElementById('stat-card-preview-box');
  if (!box) return;
  box.innerHTML = buildStatCardSvgString();
}

function renderStatCardToCanvas(callback) {
  const svgStr = buildStatCardSvgString();
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1440;
    canvas.height = 1120;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    callback(canvas, svgStr);
  };
  img.src = url;
}

function copyStatCardPngToClipboard() {
  renderStatCardToCanvas((canvas) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('STAT CARD COPIED', 'High-DPI PNG card copied directly to clipboard!');
      } catch (err) {
        showToast('CLIPBOARD FALLBACK', 'Browser blocked image clipboard; downloading PNG instead.', true);
        downloadStatCardFile('png');
      }
    }, 'image/png');
  });
}

function downloadStatCardFile(format = 'png') {
  const dateStr = document.getElementById('stat-card-date-input')?.value || getLocalDateString(new Date());
  const prefix = currentStatCardMode === 'journal' ? 'autumn-weekly-journal' : 'autumn-flight-recorder';
  const baseName = `${prefix}-${dateStr}`;
  if (format === 'svg') {
    const svgStr = buildStatCardSvgString();
    triggerFileDownload(svgStr, `${baseName}.svg`, 'image/svg+xml;charset=utf-8');
    showToast('SVG DOWNLOADED', `Saved ${baseName}.svg`);
    return;
  }
  renderStatCardToCanvas((canvas) => {
    const link = document.createElement('a');
    link.download = `${baseName}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('PNG DOWNLOADED', `Saved high-resolution ${baseName}.png`);
  });
}

// Warn before losing unsaved journal / general-note edits on refresh or tab close.

const BACKUP_TABLES = [
  { name: 'study_ledger', key: 'date' },
  { name: 'steps_ledger', key: 'date' },
  { name: 'daily_notes', key: 'date' },
  { name: 'general_notes', key: 'id' },
  { name: 'calendar_events_cache', key: 'event_id' },
  { name: 'task_columns', key: 'id' },
  { name: 'task_items', key: 'id' },
  { name: 'recurring_habits', key: 'id' },
  { name: 'running_logs', key: 'id' },
  { name: 'portfolio_logs', key: 'id' },
  { name: 'youtube_resources', key: 'id' },
  { name: 'operational_yield_ledger', key: 'date' },
  { name: 'drive_config', key: 'config_key' }
];

// Supabase refuses an unfiltered DELETE, so each key type needs a "match nothing" value
// that is still valid for that column type (a non-date string errors on a date column).
const BACKUP_DELETE_SENTINEL = {
  date: '1900-01-01',
  id: '00000000-0000-0000-0000-000000000000',
  event_id: '__autumn_none__',
  config_key: '__autumn_none__'
};

const BACKUP_LOCAL_KEYS = [
  'autumn_display_profile', 'autumn_focus_directive',
  'autumn_task_col_order', 'autumn_task_item_order', 'autumn_task_status_map',
  'autumn_task_meta_map', 'autumn_task_col_collapsed', 'autumn_task_child_collapsed', 'autumn_nav3_expanded',
  'autumn_journal_order', 'autumn_gen_note_order',
  'autumn_redeemed_passes_map', 'autumn_pass_used_dates_map',
  'autumn_gdrive_config'
];

let pendingBackupPayload = null;

async function buildFullBackupPayload() {
  const payload = {
    app: 'autumn',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    tables: {},
    local: {}
  };

  for (const spec of BACKUP_TABLES) {
    const { data, error } = await supabaseClient.from(spec.name).select('*');
    payload.tables[spec.name] = error
      ? { key: spec.key, rows: [], error: error.message }
      : { key: spec.key, rows: data || [] };
  }

  BACKUP_LOCAL_KEYS.forEach((k) => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) payload.local[k] = v;
    } catch (e) {}
  });

  return payload;
}

async function downloadFullBackup() {
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to export a backup.', true);
  showToast('BUILDING BACKUP', 'Reading all 13 tables…');
  try {
    const payload = await buildFullBackupPayload();
    const rowCount = Object.values(payload.tables).reduce((n, t) => n + t.rows.length, 0);
    triggerFileDownload(
      JSON.stringify(payload, null, 2),
      'autumn-backup-' + getLocalDateString(new Date()) + '.json',
      'application/json;charset=utf-8;'
    );
    showToast('BACKUP DOWNLOADED', rowCount + ' rows across ' + BACKUP_TABLES.length + ' tables.');
  } catch (err) {
    showToast('BACKUP FAILED', err.message, true);
  }
}

// Builds the per-table checkboxes. Extracted so it can be exercised independently of the
// owner-only guard in openBackupModal().
function populateBackupTableChecks(payload) {
  const list = document.getElementById('backup-table-checks');
  if (!list) return 0;
  list.innerHTML = BACKUP_TABLES.map((t) => {
    const present = payload ? Boolean(payload.tables && payload.tables[t.name]) : true;
    return '<label class="flex items-center gap-1.5 font-mono-tech text-[11px] text-[#0c1f17] truncate">' +
      '<input type="checkbox" class="tech-checkbox" data-backup-table="' + t.name + '"' +
        (present ? ' checked' : ' disabled') + '>' +
      '<span class="truncate">' + t.name + '</span>' +
    '</label>';
  }).join('');
  return list.querySelectorAll('[data-backup-table]').length;
}

async function openBackupModal() {
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to back up or restore.', true);
  if (window.__autumnLazy && typeof window.__autumnLazy.ensureModalsMounted === 'function') {
    await window.__autumnLazy.ensureModalsMounted();
  }
  pendingBackupPayload = null;
  const summary = document.getElementById('backup-file-summary');
  if (summary) summary.textContent = 'No file loaded yet.';
  const input = document.getElementById('backup-file-input');
  if (input) input.value = '';
  populateBackupTableChecks(null);
  openModal('backup-modal');
}

function inspectBackupFile(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  const summary = document.getElementById('backup-file-summary');
  if (!file || !summary) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== 'object' || !parsed.tables) {
        throw new Error('not an autumn backup file');
      }
      pendingBackupPayload = parsed;
      const rowTotal = Object.keys(parsed.tables).reduce((n, k) => {
        const t = parsed.tables[k];
        return n + ((t && Array.isArray(t.rows)) ? t.rows.length : 0);
      }, 0);
      summary.textContent = 'Loaded ' + file.name + ' — exported ' +
        (parsed.exportedAt || 'unknown') + ' • ' + rowTotal + ' rows, ' +
        Object.keys(parsed.tables).length + ' table(s).';

      // Tick only the tables the file actually contains.
      document.querySelectorAll('[data-backup-table]').forEach((cb) => {
        const present = Boolean(parsed.tables[cb.getAttribute('data-backup-table')]);
        cb.checked = present;
        cb.disabled = !present;
      });
    } catch (err) {
      pendingBackupPayload = null;
      summary.textContent = 'Invalid file: ' + err.message;
    }
  };
  reader.readAsText(file);
}

async function runRestoreFromBackup() {
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to restore a backup.', true);
  if (!pendingBackupPayload) return showToast('NO FILE', 'Choose a backup JSON file first.', true);

  const modeEl = document.querySelector('input[name="backup-restore-mode"]:checked');
  const mode = modeEl ? modeEl.value : 'merge';
  const selected = Array.from(document.querySelectorAll('[data-backup-table]'))
    .filter((cb) => cb.checked && !cb.disabled)
    .map((cb) => cb.getAttribute('data-backup-table'));

  if (selected.length === 0) return showToast('NOTHING SELECTED', 'Tick at least one table to restore.', true);

  const verb = mode === 'replace' ? 'REPLACE every existing row in' : 'MERGE (upsert) into';
  confirmAction(
    'Restore Backup?',
    verb + ' ' + selected.length + ' table(s): ' + selected.join(', ') + '. This cannot be undone.',
    async () => {
      closeModal('backup-modal');
      showToast('RESTORING', 'Writing ' + selected.length + ' table(s)…');

      const problems = [];
      for (const name of selected) {
        const spec = BACKUP_TABLES.find((t) => t.name === name);
        const table = pendingBackupPayload.tables[name];
        const rows = (table && Array.isArray(table.rows)) ? table.rows : [];
        if (!spec || rows.length === 0) continue;

        if (mode === 'replace') {
          const sentinel = BACKUP_DELETE_SENTINEL[spec.key] || '__autumn_none__';
          const del = await supabaseClient.from(name).delete().neq(spec.key, sentinel);
          if (del.error) {
            problems.push(name + ' (delete): ' + del.error.message);
            continue;
          }
        }

        const res = await supabaseClient.from(name).upsert(rows, { onConflict: spec.key });
        if (res.error) problems.push(name + ': ' + res.error.message);
      }

      // Device settings are always merged — never wiped, so unrelated keys survive.
      if (pendingBackupPayload.local) {
        Object.keys(pendingBackupPayload.local).forEach((k) => {
          try { localStorage.setItem(k, pendingBackupPayload.local[k]); } catch (e) {}
        });
      }

      if (problems.length) {
        showToast('RESTORE INCOMPLETE', problems.slice(0, 3).join(' | '), true);
        setTimeout(() => location.reload(), 2800);
      } else {
        showToast('RESTORE COMPLETE', selected.length + ' table(s) restored. Reloading…');
        setTimeout(() => location.reload(), 1200);
      }
    }
  );
}

let currentReportPeriod = 'week';

function getReportDateRange(period) {
  const todayStr = getLocalDateString(new Date());
  if (period === 'week') {
    return { from: getWeekMondayDateString(todayStr), to: todayStr, label: 'THIS WEEK (MON → TODAY)' };
  }
  if (period === 'month') {
    const d = new Date();
    const from = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
    return { from, to: todayStr, label: 'THIS MONTH TO DATE' };
  }
  if (period === '30') {
    return { from: addDaysToDateStr(todayStr, -29), to: todayStr, label: 'LAST 30 DAYS' };
  }
  const active = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day);
  return { from: active.length ? active[0].date : todayStr, to: todayStr, label: 'WHOLE PHASE' };
}

async function openReportModal() {
  if (window.__autumnLazy && typeof window.__autumnLazy.ensureModalsMounted === 'function') {
    await window.__autumnLazy.ensureModalsMounted();
  }
  openModal('report-modal');
  renderReport(currentReportPeriod || 'week');
}

function renderReport(period) {
  currentReportPeriod = period || currentReportPeriod || 'week';
  const range = getReportDateRange(currentReportPeriod);

  document.querySelectorAll('[data-report-tab]').forEach((btn) => {
    btn.classList.toggle('active-view', btn.getAttribute('data-report-tab') === currentReportPeriod);
  });
  const rangeEl = document.getElementById('report-range-label');
  if (rangeEl) rangeEl.textContent = range.from + ' → ' + range.to;

  const inRange = (r) => !r.is_gap_day && r.date >= range.from && r.date <= range.to;
  const studyRows = getPhaseActiveRows(globalStudyRows).filter(inRange);
  const stepsRows = getPhaseActiveRows(globalStepsRows).filter(inRange);

  const dates = Array.from(new Set([
    ...studyRows.map(r => r.date),
    ...stepsRows.map(r => r.date)
  ])).sort();

  const studyMap = {};
  studyRows.forEach(r => { studyMap[r.date] = Number(r.actual_hours) || 0; });
  const stepsMap = {};
  stepsRows.forEach(r => { stepsMap[r.date] = Number(r.actual_steps) || 0; });

  let totalHours = 0, totalSteps = 0, scoreSum = 0, passes = 0;
  let bestDay = { date: '—', score: -1 };
  const gradeCounts = {};
  const rowParts = [];

  dates.slice().reverse().forEach((d) => {
    const h = studyMap[d] || 0;
    const st = stepsMap[d] || 0;
    const y = computeDailyOperationalYield(d);
    totalHours += h;
    totalSteps += st;
    scoreSum += y.score;
    if (y.score > bestDay.score) bestDay = { date: d, score: y.score };
    if (y.passEarned !== 'NONE') passes++;
    gradeCounts[y.grade] = (gradeCounts[y.grade] || 0) + 1;
    rowParts.push(
      '<tr><td class="font-semibold">' + d + '</td><td>' + formatHours(h) + '</td><td>' +
      formatSteps(st) + '</td><td class="font-bold">' + y.score + '</td><td>' + y.grade + '</td></tr>'
    );
  });

  const days = dates.length;
  const avgScore = days ? Math.round(scoreSum / days) : 0;
  const gradeMix = Object.keys(gradeCounts).sort().map(g => g + '×' + gradeCounts[g]).join('  ') || '—';

  const kpiEl = document.getElementById('report-kpis');
  if (kpiEl) {
    const card = (label, value, sub, accent) =>
      '<div class="metric-box ' + (accent || '') + '">' +
        '<div class="font-mono-tech text-[9px] uppercase text-[#436152]">' + label + '</div>' +
        '<div class="font-mono-tech text-base font-bold text-[#0c1f17] mt-0.5">' + value + '</div>' +
        '<div class="font-mono-tech text-[10px] text-[#56735f] mt-0.5">' + sub + '</div>' +
      '</div>';
    kpiEl.innerHTML =
      card('Study', formatHours(totalHours), days + ' day(s) logged', 'accent-blue') +
      card('Steps', formatSteps(totalSteps), 'avg ' + (days ? formatSteps(Math.round(totalSteps / days)) : '0') + '/day', 'accent-amber') +
      card('Avg Score', avgScore + ' pts', days ? 'per logged day' : 'no data', 'accent-red') +
      card('Best Day', bestDay.score >= 0 ? bestDay.score + ' pts' : '—', bestDay.date) +
      card('Passes Earned', String(passes), 'in this period') +
      card('Grade Mix', gradeMix, 'A+ · A · A- · B · C · D');
  }

  const tbody = document.getElementById('report-tbody');
  if (tbody) {
    tbody.innerHTML = rowParts.length
      ? rowParts.join('')
      : '<tr><td colspan="5" class="text-center py-6 text-[#56735f]">No logged days in this period.</td></tr>';
  }
}

const TRASH_KEY = 'autumn_trash_vault';
const TRASH_TTL_DAYS = 30;

function loadTrashVault() {
  try {
    const raw = safeStorage.getItem(TRASH_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - TRASH_TTL_DAYS * 86400000;
    return (Array.isArray(parsed) ? parsed : []).filter(t => new Date(t.deletedAt).getTime() > cutoff);
  } catch (e) { return []; }
}

function saveTrashVault(list) {
  safeStorage.setItem(TRASH_KEY, JSON.stringify(list.slice(-100)));
}

function autumnTrashPush(table, row) {
  if (!row) return;
  const list = loadTrashVault();
  list.push({ id: 'tr_' + Date.now(), table: table, row: row, deletedAt: new Date().toISOString() });
  saveTrashVault(list);
}

async function restoreFromTrash(trashId) {
  if (!currentUser) return showToast('READ-ONLY', 'Sign in as autumn to restore rows.', true);
  const list = loadTrashVault();
  const entry = list.find(t => t.id === trashId);
  if (!entry) return;
  const { error } = await supabaseClient.from(entry.table).insert(entry.row);
  if (error) return showToast('RESTORE FAILED', error.message, true);
  saveTrashVault(list.filter(t => t.id !== trashId));
  showToast('RESTORED', 'Row re-inserted into ' + entry.table + '.');
  renderToolsTrash();
  if (typeof fetchAndRenderTasks === 'function') fetchAndRenderTasks();
  if (typeof fetchAndRenderHabits === 'function') fetchAndRenderHabits();
  if (typeof fetchAndRenderRunningLogs === 'function') fetchAndRenderRunningLogs();
}

function purgeTrashVault() {
  confirmAction('Empty the trash vault?', 'Permanently forgets every locally snapshotted deleted row. This cannot be undone.', () => {
    saveTrashVault([]);
    renderToolsTrash();
    showToast('TRASH EMPTIED', 'The local restore vault is empty.');
  });
}


// --------------------------------------------------- 13.4 diagnostics (T1.3)
function localCacheAge(key) {
  try {
    const raw = safeStorage.getItem(key);
    if (!raw) return '—';
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.savedAt) return '—';
    const mins = Math.round((Date.now() - parsed.savedAt) / 60000);
    return mins < 1 ? 'just now' : (mins < 90 ? mins + ' min ago' : Math.round(mins / 60) + ' h ago');
  } catch (e) { return '—'; }
}

function localStorageFootprint() {
  let bytes = 0;
  let keys = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('autumn') !== 0) continue;
      keys += 1;
      bytes += (k.length + String(localStorage.getItem(k) || '').length) * 2;
    }
  } catch (e) {}
  return { keys: keys, kb: Math.round(bytes / 1024) };
}

function diagRow(label, value, tone) {
  const toneClass = tone === 'warn' ? 'text-[#b45309]' : (tone === 'bad' ? 'text-[#b91c1c]' : 'text-[#0c1f17]');
  return '<div class="flex items-start justify-between gap-3 py-1 border-b border-[#e2efe8]">' +
    '<span class="font-mono-tech text-[10px] uppercase text-[#436152] shrink-0">' + escapeHtml(label) + '</span>' +
    '<span class="font-mono-tech text-[11px] text-right break-words ' + toneClass + '">' + value + '</span>' +
    '</div>';
}

function renderToolsDiagnostics() {
  const host = document.getElementById('tools-diag-body');
  if (!host) return;
  const storage = localStorageFootprint();
  const counts = [
    ['study', globalStudyRows.length],
    ['steps', globalStepsRows.length],
    ['tasks', globalTaskItems.length],
    ['columns', globalTaskColumns.length],
    ['habits', globalHabits.length],
    ['runs', globalRunningLogs.length],
    ['journal', globalNotes.length],
    ['notes', globalGeneralNotes.length],
    ['events', globalCalendarEvents.length]
  ].map(t => '<span class="tech-badge badge-neutral !text-[9px]">' + t[0] + ': ' + t[1] + '</span>').join(' ');

  host.innerHTML =
    diagRow('BUILD', escapeHtml(window.__autumnBuild || '—')) +
    diagRow('BOOT', window.__autumnBootOk ? 'OK' : 'DEGRADED', window.__autumnBootOk ? '' : 'warn') +
    diagRow('AUTH', currentUser ? 'OWNER OPS // autumn' : 'READ-ONLY // GUEST') +
    diagRow('NETWORK', navigator.onLine ? 'ONLINE' : 'OFFLINE', navigator.onLine ? '' : 'bad') +
    diagRow('REALTIME', realtimeChannel ? 'SUBSCRIBED' : 'NOT CONNECTED', realtimeChannel ? '' : 'warn') +
    diagRow('PENDING WRITES', String(pendingWrites.length), pendingWrites.length ? 'warn' : '') +
    diagRow('TASK LINK SYNC', taskMetaColumnsAvailable === false
      ? 'LOCAL ONLY — run the task_items migration'
      : (taskMetaColumnsAvailable ? 'SUPABASE COLUMNS' : 'unknown'),
      taskMetaColumnsAvailable === false ? 'warn' : '') +
    diagRow('SUBTASK NESTING', taskParentColumnsAvailable === false
      ? 'LOCAL ONLY — run the task_items migration'
      : (taskParentColumnsAvailable ? 'SUPABASE COLUMNS (' + globalTaskItems.filter(t => getTaskParentId(t)).length + ' nested)' : 'unknown'),
      taskParentColumnsAvailable === false ? 'warn' : '') +
    diagRow('LEDGER CACHE', 'study ' + localCacheAge('autumn_cache_study_ledger') + ' · steps ' + localCacheAge('autumn_cache_steps_ledger')) +
    diagRow('LOCAL STORAGE', storage.keys + ' autumn keys · ' + storage.kb + ' KB') +
    diagRow('TRASH VAULT', loadTrashVault().length + ' row(s) restorable') +
    diagRow('THEME', escapeHtml(activeDisplayProfile)) +
    diagRow('VIEWPORT', window.innerWidth + '×' + window.innerHeight) +
    '<div class="mt-2 flex flex-wrap gap-1">' + counts + '</div>' +
    '<div class="mt-3 flex flex-wrap gap-1.5">' +
    '<button type="button" onclick="flushWriteQueue(true)" class="btn-export-tag">⇅ RETRY WRITES</button>' +
    '<button type="button" onclick="recomputeEverything()" class="btn-export-tag">⟳ RECOMPUTE GRADES</button>' +
    '<button type="button" onclick="clearAutumnCaches()" class="btn-export-tag">⌫ CLEAR CACHES</button>' +
    '<button type="button" onclick="copyDiagnostics()" class="btn-export-tag">⎘ COPY REPORT</button>' +
    '</div>';
}


function recomputeEverything() {
  try {
    if (typeof fetchAndRenderStudy === 'function') fetchAndRenderStudy();
    if (typeof fetchAndRenderSteps === 'function') fetchAndRenderSteps();
    if (typeof fetchAndSyncOperationalYield === 'function') fetchAndSyncOperationalYield();
    if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
    if (typeof renderPlannerInsights === 'function') renderPlannerInsights();
    showToast('RECOMPUTED', 'Ledgers, grades and telemetry re-ran against live data.');
  } catch (e) {
    showToast('RECOMPUTE FAILED', (e && e.message) || 'unknown error', true);
  }
  renderToolsDiagnostics();
}

function clearAutumnCaches() {
  confirmAction('Clear local caches?', 'Removes the offline ledger mirror in THIS browser. Supabase data is untouched; the next load re-fetches everything.', () => {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.indexOf('autumn_cache') === 0) doomed.push(k);
      }
      doomed.forEach(k => safeStorage.removeItem(k));
      showToast('CACHES CLEARED', doomed.length + ' cache key(s) removed.');
    } catch (e) {}
    renderToolsDiagnostics();
  });
}

function copyDiagnostics() {
  const text = [
    'autumn // diagnostics',
    'build: ' + window.__autumnBuild,
    'boot: ' + window.__autumnBootOk,
    'auth: ' + (currentUser ? 'owner' : 'guest'),
    'online: ' + navigator.onLine,
    'pending writes: ' + pendingWrites.length,
    'study rows: ' + globalStudyRows.length,
    'steps rows: ' + globalStepsRows.length,
    'tasks: ' + globalTaskItems.length,
    'notes: ' + globalNotes.length,
    'at: ' + new Date().toISOString()
  ].join('\n');
  try {
    navigator.clipboard.writeText(text).then(
      () => showToast('COPIED', 'Diagnostics copied to the clipboard.'),
      () => downloadBlob('autumn-diagnostics.txt', text)
    );
  } catch (e) {
    downloadBlob('autumn-diagnostics.txt', text);
  }
}


// ---------------------------------------------------- 13.5 export suite (T2.6)
// One download helper, six artefacts: study CSV, steps CSV, tasks CSV, journal
// Markdown, calendar ICS, and a full JSON snapshot (the restore path already exists).
function exportLedgerCsv(kind) {
  const isStudy = kind === 'study';
  const rows = isStudy ? globalStudyRows : globalStepsRows;
  if (!rows || rows.length === 0) return showToast('NOTHING TO EXPORT', 'No ' + kind + ' rows are loaded yet.', true);
  const columns = isStudy
    ? [
        { key: 'date', label: 'date' },
        { key: 'actual_hours', label: 'actual_hours' },
        { key: 'computed_target', label: 'computed_target' },
        { key: 'computed_overflow', label: 'computed_overflow' },
        { key: 'source', label: 'source' }
      ]
    : [
        { key: 'date', label: 'date' },
        { key: 'actual_steps', label: 'actual_steps' },
        { key: 'computed_target', label: 'computed_target' },
        { key: 'computed_overflow', label: 'computed_overflow' },
        { key: 'source', label: 'source' }
      ];
  downloadBlob('autumn-' + kind + '-ledger-' + getLocalDateString(new Date()) + '.csv',
    toCsv(rows, columns), 'text/csv;charset=utf-8');
}

function exportTasksCsv() {
  if (!globalTaskItems || globalTaskItems.length === 0) return showToast('NOTHING TO EXPORT', 'No tasks loaded yet.', true);
  const colName = (id) => {
    const col = globalTaskColumns.find(c => c.id === id);
    return col ? col.title : '';
  };
  const rows = globalTaskItems.map(t => {
    const meta = (typeof getTaskMeta === 'function') ? getTaskMeta(t.id) : { dueDate: '' };
    const parentTask = (typeof getTaskParentId === 'function' && getTaskParentId(t))
      ? (typeof getTaskById === 'function' ? getTaskById(getTaskParentId(t)) : null)
      : null;
    return {
      column: colName(t.column_id),
      title: (typeof getTaskDepth === 'function' ? '  '.repeat(getTaskDepth(t)) : '') + t.title,
      parent: parentTask ? parentTask.title : '',
      done: t.is_done ? 'yes' : 'no',
      due_date: meta.dueDate || '',
      status: (typeof getTaskProgressState === 'function') ? getTaskProgressState(t.id) : ''
    };
  });
  downloadBlob('autumn-tasks-' + getLocalDateString(new Date()) + '.csv',
    toCsv(rows, [{ key: 'column' }, { key: 'title' }, { key: 'parent' }, { key: 'done' }, { key: 'due_date' }, { key: 'status' }]),
    'text/csv;charset=utf-8');
}


function exportNotesMarkdown() {
  if (globalNotes.length === 0 && globalGeneralNotes.length === 0) {
    return showToast('NOTHING TO EXPORT', 'No notes loaded yet.', true);
  }
  const parts = ['# autumn // notes export', 'generated: ' + new Date().toISOString(), ''];
  if (globalNotes.length > 0) {
    parts.push('## Weekly journal');
    globalNotes.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(n => {
      parts.push('', '### ' + (n.date || 'undated') + (n.title ? ' — ' + n.title : ''));
      parts.push(stripHtmlTags(n.content || ''));
    });
  }
  if (globalGeneralNotes.length > 0) {
    parts.push('', '## General notes');
    globalGeneralNotes.forEach(n => {
      parts.push('', '### ' + (n.title || 'Untitled'));
      parts.push(stripHtmlTags(n.content || ''));
    });
  }
  downloadBlob('autumn-notes-' + getLocalDateString(new Date()) + '.md', parts.join('\n'), 'text/markdown;charset=utf-8');
}

function exportCalendarIcs() {
  if (!globalCalendarEvents || globalCalendarEvents.length === 0) {
    return showToast('NOTHING TO EXPORT', 'The calendar has no loaded events.', true);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//autumn//command ledger//EN', 'CALSCALE:GREGORIAN'];
  globalCalendarEvents.forEach((ev) => {
    if (!ev.start || !ev.end) return;
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + esc(ev.id || ('autumn-' + ev.start.getTime())));
    lines.push('DTSTAMP:' + stamp(new Date()));
    if (ev.isAllDay) {
      lines.push('DTSTART;VALUE=DATE:' + getLocalDateString(ev.start).replace(/-/g, ''));
    } else {
      lines.push('DTSTART:' + stamp(ev.start));
      lines.push('DTEND:' + stamp(ev.end));
    }
    lines.push('SUMMARY:' + esc(ev.title));
    if (ev.location) lines.push('LOCATION:' + esc(ev.location));
    if (ev.description) lines.push('DESCRIPTION:' + esc(stripHtmlTags(ev.description).slice(0, 900)));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  downloadBlob('autumn-calendar-' + getLocalDateString(new Date()) + '.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
}

function exportFullSnapshot() {
  const snapshot = {
    meta: { app: 'autumn', build: window.__autumnBuild, exportedAt: new Date().toISOString() },
    study: globalStudyRows,
    steps: globalStepsRows,
    tasks: { columns: globalTaskColumns, items: globalTaskItems },
    habits: globalHabits,
    runs: globalRunningLogs,
    journal: globalNotes,
    generalNotes: globalGeneralNotes,
    prefs: {
      theme: activeDisplayProfile,
      taskColOrder: taskColOrder,
      taskItemOrder: taskItemOrder,
      taskStatusMap: taskStatusMap,
      taskMetaMap: taskMetaMap,
      ledgerWindowDays: ledgerWindowDays
    }
  };
  downloadBlob('autumn-snapshot-' + getLocalDateString(new Date()) + '.json',
    JSON.stringify(snapshot, null, 2), 'application/json;charset=utf-8');
}

function downloadNetlifyBundleIndex() {
  const htmlSource = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  downloadBlob('index.html', htmlSource, 'text/html;charset=utf-8');
  showToast('NETLIFY BUNDLE', 'Downloaded standalone index.html for Netlify Drop.');
}

function downloadNetlifyTomlConfig() {
  const toml = [
    '# Netlify Static Site Configuration for autumn // PERSONAL COMMAND LEDGER',
    '[build]',
    '  publish = "."',
    '  command = "echo \'Static bundle ready\'"',
    '',
    '[[headers]]',
    '  for = "/*"',
    '  [headers.values]',
    '    X-Frame-Options = "SAMEORIGIN"',
    '    X-Content-Type-Options = "nosniff"',
    '    Referrer-Policy = "strict-origin-when-cross-origin"',
    '',
    '[[redirects]]',
    '  from = "/*"',
    '  to = "/index.html"',
    '  status = 200'
  ].join('\n');
  downloadBlob('netlify.toml', toml, 'text/plain;charset=utf-8');
  showToast('NETLIFY CONFIG', 'Downloaded netlify.toml configuration file.');
}

function renderToolsExport() {
  const host = document.getElementById('tools-export-body');
  if (!host) return;
  const tile = (label, hint, fn) =>
    '<button type="button" onclick="' + fn + '" class="cmd-frame p-2.5 text-left hover:border-[#059669] transition-colors">' +
    '<div class="font-mono-tech text-[11px] font-bold text-[#0c1f17]">' + label + '</div>' +
    '<div class="font-mono-tech text-[10px] text-[#436152] mt-0.5">' + hint + '</div>' +
    '</button>';
  host.innerHTML =
    '<div class="p-3 mb-3 border border-[#059669] bg-[#dcfce7]/40 font-mono-tech text-xs" style="border-radius:10px;">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<div>' +
          '<div class="font-bold text-[#047857]">◆ NETLIFY STATIC SITE DEPLOYMENT FOLDER (/netlify-static)</div>' +
          '<div class="text-[10px] text-[#436152] mt-0.5">Drag &amp; drop the project\'s <code>netlify-deploy/</code> directory directly into <strong>app.netlify.com/drop</strong> or download the standalone static files below.</div>' +
        '</div>' +
        '<div class="flex items-center gap-1.5">' +
          '<button type="button" onclick="downloadNetlifyBundleIndex()" class="btn-chamfer !py-1 !px-2.5 !text-[10px]">↓ index.html</button>' +
          '<button type="button" onclick="downloadNetlifyTomlConfig()" class="btn-tech-outline !py-1 !px-2.5 !text-[10px]">↓ netlify.toml</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
    tile('↓ STUDY LEDGER CSV', globalStudyRows.length + ' rows · targets + spillover', "exportLedgerCsv('study')") +
    tile('↓ STEPS LEDGER CSV', globalStepsRows.length + ' rows · targets + spillover', "exportLedgerCsv('steps')") +
    tile('↓ TASKS CSV', globalTaskItems.length + ' tasks · column, done, deadline', 'exportTasksCsv()') +
    tile('↓ NOTES MARKDOWN', (globalNotes.length + globalGeneralNotes.length) + ' notes · journal + general', 'exportNotesMarkdown()') +
    tile('↓ CALENDAR ICS', globalCalendarEvents.length + ' events · import anywhere', 'exportCalendarIcs()') +
    tile('↓ FULL JSON SNAPSHOT', 'Everything above + preferences', 'exportFullSnapshot()') +
    '</div>';
}


// ------------------------------------------------- 13.6 weekly review (T2.7)
function getWeekReviewRange() {
  return { from: getWeekMondayDateString(new Date()), to: getLocalDateString(new Date()) };
}

function computeWeekReview() {
  const range = getWeekReviewRange();
  const activeStudy = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day && r.date >= range.from && r.date <= range.to);
  const activeSteps = getPhaseActiveRows(globalStepsRows).filter(r => !r.is_gap_day && r.date >= range.from && r.date <= range.to);
  const dates = Array.from(new Set(activeStudy.map(r => r.date).concat(activeSteps.map(r => r.date)))).sort();
  const studyMap = {};
  activeStudy.forEach(r => { studyMap[r.date] = Number(r.actual_hours) || 0; });
  const stepsMap = {};
  activeSteps.forEach(r => { stepsMap[r.date] = Number(r.actual_steps) || 0; });

  let hours = 0, steps = 0, scoreSum = 0, passes = 0;
  let best = null, worst = null;
  const grades = {};
  dates.forEach((d) => {
    const y = computeDailyOperationalYield(d);
    hours += studyMap[d] || 0;
    steps += stepsMap[d] || 0;
    scoreSum += y.score;
    if (y.passEarned && y.passEarned !== 'NONE') passes += 1;
    grades[y.grade] = (grades[y.grade] || 0) + 1;
    if (!best || y.score > best.score) best = { date: d, score: y.score, grade: y.grade };
    if (!worst || y.score < worst.score) worst = { date: d, score: y.score, grade: y.grade };
  });
  const debt = globalStudyRows.length
    ? Math.max(0, Number(globalStudyRows[globalStudyRows.length - 1].computed_overflow) || 0)
    : 0;
  return {
    from: range.from, to: range.to, days: dates.length, hours: hours, steps: steps,
    avgScore: dates.length ? Math.round(scoreSum / dates.length) : 0,
    passes: passes, grades: grades, best: best, worst: worst, debt: debt
  };
}

function renderToolsReview() {
  const host = document.getElementById('tools-review-body');
  if (!host) return;
  const r = computeWeekReview();
  const gradeMix = Object.keys(r.grades).sort().map(g => g + '×' + r.grades[g]).join('  ') || '—';
  const kpi = (label, value, sub, tone) =>
    '<div class="metric-box ' + (tone || '') + '">' +
    '<div class="section-tag mb-1"><span class="diamond">◆</span> ' + label + '</div>' +
    '<div class="font-mono-tech text-xl font-bold text-[#0c1f17] leading-tight">' + value + '</div>' +
    '<div class="font-mono-tech text-[10px] text-[#436152] mt-0.5">' + sub + '</div></div>';

  host.innerHTML =
    '<div class="font-mono-tech text-[10px] text-[#436152] mb-2">WEEK ' + r.from + ' → ' + r.to + ' · ' + r.days + ' logged day(s)</div>' +
    '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">' +
    kpi('STUDY', formatHours(r.hours), 'this week', 'accent-green') +
    kpi('STEPS', formatSteps(r.steps), 'this week', 'accent-amber') +
    kpi('AVG SCORE', r.avgScore + ' pts', 'per logged day', 'accent-blue') +
    kpi('BEST DAY', r.best ? r.best.score + ' pts' : '—', r.best ? r.best.date + ' · ' + r.best.grade : 'no data') +
    kpi('WEAKEST DAY', r.worst ? r.worst.score + ' pts' : '—', r.worst ? r.worst.date + ' · ' + r.worst.grade : 'no data', 'accent-red') +
    kpi('OPEN DEBT', formatHours(r.debt), 'carried forward', r.debt > 0 ? 'accent-red' : '') +
    '</div>' +
    '<div class="mt-2 font-mono-tech text-[11px] text-[#0c1f17]">GRADE MIX: ' + escapeHtml(gradeMix) +
    ' · PASSES EARNED: ' + r.passes + '</div>' +
    '<div class="mt-3 flex flex-wrap gap-1.5">' +
    '<button type="button" onclick="saveWeeklyReviewToJournal()" class="btn-chamfer !py-1.5 !px-3 !text-xs">Edit WRITE INTO THIS WEEK\'S JOURNAL</button>' +
    '<button type="button" onclick="renderToolsReview()" class="btn-tech-outline !py-1.5 !px-3 !text-xs">⟳ REFRESH</button>' +
    '</div>';
}

async function saveWeeklyReviewToJournal() {
  if (!currentUser) return showToast('READ-ONLY', 'Sign in as autumn to write the review.', true);
  const r = computeWeekReview();
  const key = r.from;
  const gradeMix = Object.keys(r.grades).sort().map(g => g + '×' + r.grades[g]).join(', ') || '—';
  const block =
    '<h3>WEEKLY REVIEW // ' + r.from + ' → ' + r.to + '</h3>' +
    '<ul>' +
    '<li>Study: ' + formatHours(r.hours) + ' · Steps: ' + formatSteps(r.steps) + ' steps</li>' +
    '<li>Average operational score: ' + r.avgScore + ' pts over ' + r.days + ' logged day(s)</li>' +
    '<li>Grade mix: ' + gradeMix + ' · Quota passes earned: ' + r.passes + '</li>' +
    '<li>Best day: ' + (r.best ? r.best.date + ' (' + r.best.score + ' pts)' : '—') +
    ' · Weakest: ' + (r.worst ? r.worst.date + ' (' + r.worst.score + ' pts)' : '—') + '</li>' +
    '<li>Open study debt: ' + formatHours(r.debt) + '</li>' +
    '</ul>';
  const existing = (globalNotes || []).find(n => n.date === key);
  const merged = block + (existing && existing.content ? existing.content : '');
  const { error } = await supabaseClient
    .from('daily_notes')
    .upsert({ date: key, title: existing ? existing.title : 'Weekly Review', mood: 'REVIEW', content: merged }, { onConflict: 'date' });
  if (error) {
    if (queueWriteIfOffline(error, 'daily_notes', { date: key, title: 'Weekly Review', mood: 'REVIEW', content: merged }, 'date')) return;
    return showToast('SAVE FAILED', error.message, true);
  }
  showToast('REVIEW SAVED', 'Written into the journal entry for ' + key + '.');
  if (typeof fetchAndRenderNotes === 'function') fetchAndRenderNotes();
}


// --------------------------------------------- 13.7 habit streak strips (T2.8)
// Supabase stores only completed_period + streak_count per habit, so a true 12-week
// history grid is not derivable. This renders the last 12 periods with the recorded
// streak filled in — honest about what the schema can support.
function renderToolsHabits() {
  const host = document.getElementById('tools-habits-body');
  if (!host) return;
  if (!globalHabits || globalHabits.length === 0) {
    host.innerHTML = '<div class="font-mono-tech text-[11px] text-[#436152] p-3 bg-[#eff8f2] border border-[#c5ded0]">No recurring habits yet. Add them in 04 // TASKS → RECURRING TASKS &amp; HABITS.</div>';
    return;
  }
  const rows = globalHabits.map((h) => {
    const streak = Number(h.streak_count) || 0;
    const done = h.completed_period && h.completed_period === getHabitCurrentPeriodKey(h.frequency);
    const cells = [];
    for (let i = 11; i >= 0; i -= 1) {
      const filled = i < streak;
      cells.push('<span title="' + (filled ? 'counted in the recorded streak' : 'not recorded') + '" class="inline-block w-2.5 h-3.5 border ' +
        (filled ? 'bg-[#059669] border-[#047857]' : 'bg-[#e8f3ec] border-[#c5ded0]') + '"></span>');
    }
    return '<div class="py-1.5 border-b border-[#e2efe8] flex items-center justify-between gap-2 flex-wrap">' +
      '<div class="min-w-0">' +
      '<div class="font-mono-tech text-[11px] font-bold text-[#0c1f17] truncate">' + escapeHtml(h.title || 'Habit') + '</div>' +
      '<div class="font-mono-tech text-[9px] text-[#436152]">' + escapeHtml(h.frequency || '') + ' · streak ' + streak +
      (done ? ' · <span class="text-[#047857] font-bold">CURRENT PERIOD DONE</span>' : '') + '</div>' +
      '</div>' +
      '<div class="flex gap-0.5 items-center">' + cells.join('') + '</div>' +
      '</div>';
  }).join('');
  host.innerHTML = rows +
    '<div class="font-mono-tech text-[9px] text-[#436152] mt-2 leading-relaxed">Each cell = one prior period. Filled cells come from the recorded streak_count; the schema keeps no per-period history.</div>';
}


// ---------------------------------------------- 13.8 achievements (T3.13)
// Everything here is derived from data the app already holds — no schema change.
function computeAchievements() {
  const activeStudy = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day);
  const activeSteps = getPhaseActiveRows(globalStepsRows).filter(r => !r.is_gap_day);

  let run = 0, bestStudyStreak = 0;
  activeStudy.forEach((r) => {
    if ((Number(r.actual_hours) || 0) >= resolveScoringBaseline(r.date, globalStudyRows, getStudyBaseGoalForDate, MAX_DAILY).baseline) { run += 1; bestStudyStreak = Math.max(bestStudyStreak, run); }
    else run = 0;
  });
  run = 0;
  let bestStepsStreak = 0;
  activeSteps.forEach((r) => {
    if ((Number(r.actual_steps) || 0) >= resolveScoringBaseline(r.date, globalStepsRows, getStepsBaseGoalForDate, STEPS_MAX_DAILY).baseline) { run += 1; bestStepsStreak = Math.max(bestStepsStreak, run); }
    else run = 0;
  });

  const totalHours = activeStudy.reduce((a, r) => a + (Number(r.actual_hours) || 0), 0);
  const totalSteps = activeSteps.reduce((a, r) => a + (Number(r.actual_steps) || 0), 0);
  const doneTasks = (globalTaskItems || []).filter(t => t.is_done).length;
  const habitStreaks = (globalHabits || []).reduce((a, h) => a + (Number(h.streak_count) || 0), 0);
  const noteCount = (globalNotes || []).length + (globalGeneralNotes || []).length;

  let aPlusDays = 0, centuryDays = 0;
  activeStudy.slice(-120).forEach((r) => {
    const y = computeDailyOperationalYield(r.date);
    if (y.grade === 'A+') aPlusDays += 1;
    if (y.score >= 100) centuryDays += 1;
  });

  return [
    { title: 'CONSISTENCY', sub: '7-day study streak', value: bestStudyStreak, target: 7 },
    { title: 'DISCIPLINE', sub: '30-day study streak', value: bestStudyStreak, target: 30 },
    { title: 'KINETIC', sub: '7-day steps streak', value: bestStepsStreak, target: 7 },
    { title: 'CENTURION', sub: '100+ point day', value: centuryDays, target: 1 },
    { title: 'PERFECTIONIST', sub: '5 × A+ graded days', value: aPlusDays, target: 5 },
    { title: 'SCHOLAR', sub: '100 study hours logged', value: Math.round(totalHours), target: 100 },
    { title: 'TREKKER', sub: '100,000 steps logged', value: Math.round(totalSteps), target: 100000 },
    { title: 'EXECUTOR', sub: '50 tasks completed', value: doneTasks, target: 50 },
    { title: 'SCRIBE', sub: '30 notes written', value: noteCount, target: 30 },
    { title: 'RITUALIST', sub: '20 cumulative habit streak', value: habitStreaks, target: 20 }
  ].map(a => Object.assign(a, { unlocked: a.value >= a.target }));
}

function renderToolsAchievements() {
  const host = document.getElementById('tools-ach-body');
  if (!host) return;
  const list = computeAchievements();
  const unlocked = list.filter(a => a.unlocked).length;
  host.innerHTML =
    '<div class="font-mono-tech text-[10px] text-[#436152] mb-2">' + unlocked + ' / ' + list.length + ' unlocked</div>' +
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
    list.map((a) => {
      const pct = Math.max(0, Math.min(100, Math.round((a.value / a.target) * 100)));
      const valueText = a.target >= 1000 ? formatSteps(a.value) : String(a.value);
      return '<div class="cmd-frame p-2 ' + (a.unlocked ? 'border-[#86efac] bg-[#dcfce7]/40' : '') + '">' +
        '<div class="flex items-center justify-between gap-2">' +
        '<span class="font-mono-tech text-[11px] font-bold ' + (a.unlocked ? 'text-[#047857]' : 'text-[#0c1f17]') + '">' +
        (a.unlocked ? ' ' : ' ') + escapeHtml(a.title) + '</span>' +
        '<span class="font-mono-tech text-[9px] text-[#436152]">' + valueText + ' / ' + (a.target >= 1000 ? formatSteps(a.target) : a.target) + '</span>' +
        '</div>' +
        '<div class="font-mono-tech text-[9px] text-[#436152] mt-0.5">' + escapeHtml(a.sub) + '</div>' +
        '<div class="h-1 bg-[#e8f3ec] mt-1.5"><div class="h-1 ' + (a.unlocked ? 'bg-[#059669]' : 'bg-[#87b39b]') + '" style="width:' + pct + '%"></div></div>' +
        '</div>';
    }).join('') +
    '</div>';
}


// -------------------------------------------------- 13.9 install prompt & ambient UI helpers (deferredInstallPrompt lives in Core)

async function promptInstall() {
  if (!deferredInstallPrompt) {
    return showToast('INSTALL APP', 'Use your browser menu → "Install app" or "Add to Home Screen".', false);
  }
  try {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    showToast('INSTALL APP', (choice && choice.outcome === 'accepted') ? 'Installing autumn…' : 'Install dismissed.');
  } catch (e) {
    showToast('INSTALL FAILED', (e && e.message) || 'Install prompt unavailable.', true);
  }
}


// ------------------------------------------------ 13.11 trash renderer (T1.4)
function renderToolsTrash() {
  const host = document.getElementById('tools-trash-body');
  if (!host) return;
  const list = loadTrashVault().slice().reverse();
  if (list.length === 0) {
    host.innerHTML = '<div class="font-mono-tech text-[11px] text-[#436152] p-3 bg-[#eff8f2] border border-[#c5ded0]">The vault is empty. Deleted rows are snapshotted here for ' + TRASH_TTL_DAYS + ' days and can be re-inserted into Supabase.</div>';
    return;
  }
  host.innerHTML = list.map((t) => {
    const label = (t.row && (t.row.title || t.row.date || t.row.id)) || '(row)';
    const hours = Math.round((Date.now() - new Date(t.deletedAt).getTime()) / 3600000);
    return '<div class="flex items-center justify-between gap-2 py-1.5 border-b border-[#e2efe8]">' +
      '<div class="min-w-0">' +
      '<div class="font-mono-tech text-[11px] text-[#0c1f17] truncate">' + escapeHtml(String(label)) + '</div>' +
      '<div class="font-mono-tech text-[9px] text-[#436152]">' + escapeHtml(t.table) + ' · deleted ' + (hours < 1 ? 'moments' : hours + 'h') + ' ago</div>' +
      '</div>' +
      '<button type="button" onclick="restoreFromTrash(\'' + escapeHtml(t.id) + '\')" class="btn-export-tag">↺ RESTORE</button>' +
      '</div>';
  }).join('') +
    '<button type="button" onclick="purgeTrashVault()" class="btn-export-tag mt-2">⌫ EMPTY VAULT</button>';
}

// ----------------------------------------------- 13.12 keyboard help (T2.9)
function renderToolsKeys() {
  const host = document.getElementById('tools-keys-body');
  if (!host) return;
  const rows = [
    ['/', 'Focus the global search'],
    ['Ctrl+K / Cmd+K', 'Focus the global search'],
    ['Right / Up / Down / Enter', 'Walk and open search results'],
    ['Double-click / Enter', 'Inline-edit focused study or steps ledger row'],
    ['ArrowUp / ArrowDown', 'Navigate between ledger rows during inline editing'],
    ['>', 'Command mode — type >study 7.5, >theme, >export'],
    ['g then s/p/c/t/n/r/f', 'Jump to Study / Steps / Calendar / Tasks / Notes / Resources / Focus'],
    ['t', 'Start or pause the study stopwatch'],
    ['`', 'Open the terminal (CLI + scratchpad)'],
    ['Esc', 'Cancel inline edit, close top dialog, or close search'],
    ['?', 'Open this shortcut sheet'],
    ['Tab / Shift+Tab', 'Cycles inside an open dialog (focus is trapped)']
  ];
  host.innerHTML = '<table class="tech-table w-full"><tbody>' +
    rows.map(r => '<tr><td class="font-mono-tech text-[10px] text-[#047857] whitespace-nowrap !py-1">' + escapeHtml(r[0]) + '</td>' +
      '<td class="text-[11px] !py-1">' + escapeHtml(r[1]) + '</td></tr>').join('') +
    '</tbody></table>';
}


// ---------------------------------------------- 13.13 health import (T3.12)
// Accepts the 2-column CSV (date,steps) that Apple Health shortcuts, Google Fit takeout
// and most step apps export. Always dry-runs first, then upserts on confirm.
let healthImportPreview = [];

function parseHealthCsv(text) {
  const byDate = {};
  String(text || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[,;\t]/);
    if (parts.length < 2) return;
    const rawDate = parts[0].replace(/"/g, '').trim();
    const rawSteps = parts[1].replace(/"/g, '').replace(/[^0-9.]/g, '');
    let iso = '';
    const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const usMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (isoMatch) iso = isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
    else if (usMatch) iso = usMatch[3] + '-' + String(usMatch[1]).padStart(2, '0') + '-' + String(usMatch[2]).padStart(2, '0');
    if (!iso) return;
    const steps = Math.round(Number(rawSteps));
    if (!Number.isFinite(steps) || steps <= 0) return;
    byDate[iso] = Math.max(byDate[iso] || 0, steps);
  });
  return Object.keys(byDate).sort().map(d => ({ date: d, steps: byDate[d] }));
}

function previewHealthImport() {
  const box = document.getElementById('health-import-text');
  const host = document.getElementById('tools-health-preview');
  if (!box || !host) return;
  const parsed = parseHealthCsv(box.value);
  if (parsed.length === 0) {
    healthImportPreview = [];
    host.innerHTML = '<div class="font-mono-tech text-[11px] text-[#b45309] p-2 bg-[#fef3c7] border border-[#fcd34d]">No usable rows found. Expected two columns per line: <strong>2026-10-31, 10500</strong>.</div>';
    return;
  }
  const existing = {};
  globalStepsRows.forEach((r) => { existing[r.date] = Number(r.actual_steps) || 0; });
  healthImportPreview = parsed.map((row) => {
    const before = existing[row.date];
    return Object.assign({}, row, { before: before, isNew: before === undefined, delta: before === undefined ? row.steps : row.steps - before });
  });
  const added = healthImportPreview.filter(r => r.isNew).length;
  const changed = healthImportPreview.filter(r => !r.isNew && r.delta !== 0).length;
  host.innerHTML =
    '<div class="font-mono-tech text-[10px] text-[#436152] mb-1">DRY RUN · ' + healthImportPreview.length + ' day(s) parsed · ' + added + ' new · ' + changed + ' changed</div>' +
    '<div class="max-h-[210px] overflow-y-auto border border-[#c5ded0]">' +
    '<table class="tech-table w-full"><thead class="sticky top-0 bg-[#f4faf6]"><tr><th>Date</th><th>In file</th><th>Current</th><th>Effect</th></tr></thead><tbody>' +
    healthImportPreview.slice().reverse().map((r) =>
      '<tr><td>' + r.date + '</td><td>' + formatSteps(r.steps) + '</td>' +
      '<td>' + (r.isNew ? '—' : formatSteps(r.before)) + '</td>' +
      '<td>' + (r.isNew ? '<span class="tech-badge badge-green !text-[9px]">NEW</span>'
        : (r.delta === 0 ? '<span class="tech-badge badge-neutral !text-[9px]">SAME</span>'
          : '<span class="tech-badge ' + (r.delta > 0 ? 'badge-blue' : 'badge-amber') + ' !text-[9px]">' + (r.delta > 0 ? '+' : '') + formatSteps(r.delta) + '</span>')) + '</td></tr>'
    ).join('') + '</tbody></table></div>' +
    '<button type="button" onclick="applyHealthImport()" class="btn-chamfer !py-1.5 !px-3 !text-xs mt-2">⇧ IMPORT ' + healthImportPreview.length + ' DAY(S)</button>';
}

async function applyHealthImport() {
  if (!currentUser) return showToast('READ-ONLY', 'Sign in as autumn to import step history.', true);
  if (healthImportPreview.length === 0) return showToast('NOTHING TO IMPORT', 'Parse a CSV first.', true);
  const rows = healthImportPreview.map(r => ({
    date: r.date,
    actual_steps: r.steps,
    target_steps: getStepsBaseGoalForDate(r.date),
    source: 'import'
  }));
  const { error } = await supabaseClient.from('steps_ledger').upsert(rows, { onConflict: 'date' });
  if (error) return showToast('IMPORT FAILED', error.message, true);
  showToast('IMPORTED', rows.length + ' day(s) written to the steps ledger.');
  healthImportPreview = [];
  const box = document.getElementById('health-import-text');
  if (box) box.value = '';
  const host = document.getElementById('tools-health-preview');
  if (host) host.innerHTML = '';
  if (typeof fetchAndRenderSteps === 'function') fetchAndRenderSteps();
}

function readHealthFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const box = document.getElementById('health-import-text');
    if (box) box.value = String(reader.result || '');
    previewHealthImport();
  };
  reader.readAsText(file);
  input.value = '';
}


// ------------------------------------------------ 13.14 attachments (T2.10)
// DEVIATION from the plan: attachments are embedded as data: URLs inside the note HTML
// instead of IndexedDB blobs. IndexedDB is device-local, so a note synced to the phone
// would render a broken image; data URLs travel with the row, survive export and print.
// Guard rails: 1.5 MB per file, images and PDFs only, cursor-aware insertion.
const ATTACHMENT_MAX_BYTES = 1.5 * 1024 * 1024;

function insertAttachmentIntoNote(file, dataUrl) {
  const active = document.activeElement;
  const target = (active && active.isContentEditable) ? active : document.getElementById('note-content-editor');
  if (!target) return showToast('NO EDITOR', 'Open 05 // NOTES and put the cursor in the journal first.', true);
  if (!target.isContentEditable) return showToast('READ-ONLY', 'That editor is locked — sign in as autumn.', true);
  target.focus();
  const safeName = escapeHtml(file.name);
  const html = /^image\//.test(file.type)
    ? '<div><img src="' + dataUrl + '" alt="' + safeName + '" style="max-width:100%;border:1px solid #c5ded0;margin:6px 0"></div>'
    : '<div><a href="' + dataUrl + '" download="' + safeName + '" target="_blank" rel="noopener noreferrer"> ' + safeName + '</a></div>';
  let inserted = false;
  try { inserted = document.execCommand('insertHTML', false, html); } catch (e) { inserted = false; }
  if (!inserted) target.insertAdjacentHTML('beforeend', html);
  if (typeof updateWordCount === 'function') updateWordCount();
  if (typeof updateGeneralNoteWordCount === 'function') updateGeneralNoteWordCount();
  showToast('ATTACHED', file.name + ' embedded (' + Math.round(dataUrl.length / 1024) + ' KB). Save the note to persist it.');
}

function handleAttachmentFiles(input) {
  const files = Array.from(input.files || []);
  input.value = '';
  if (files.length === 0) return;
  files.forEach((file) => {
    if (file.size > ATTACHMENT_MAX_BYTES) {
      showToast('FILE TOO LARGE', file.name + ' is ' + Math.round(file.size / 1024) + ' KB — the cap is 1.5 MB.', true);
      return;
    }
    const isImage = /^image\//.test(file.type);
    if (!isImage && file.type !== 'application/pdf') {
      showToast('UNSUPPORTED FILE', 'Only images and PDFs can be attached.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => insertAttachmentIntoNote(file, String(reader.result || ''));
    reader.onerror = () => showToast('READ FAILED', 'Could not read ' + file.name + '.', true);
    reader.readAsDataURL(file);
  });
}


// -------------------------------------------- 13.15 command palette (T2.5)
// The global search becomes dual-mode: ">cmd args" runs a command, everything else is
// the normal content search. Logging commands are delegated to the existing terminal
// CLI parser, so there is exactly one implementation of "study 7.5" / "steps 10500".
function runTerminalCommandString(text) {
  const input = document.getElementById('terminal-quick-input');
  if (!input) return false;
  if (typeof isTerminalDrawerOpen !== 'undefined' && !isTerminalDrawerOpen) toggleTerminalDrawer();
  input.value = text;
  const form = input.closest('form');
  if (!form) return false;
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  input.value = '';
  return true;
}

const PALETTE_COMMANDS = [
  { id: 'study', usage: '>study 7.5 [YYYY-MM-DD]', hint: 'Log study hours (terminal parser)', run: (a) => runTerminalCommandString('study ' + a) },
  { id: 'steps', usage: '>steps 10500 [YYYY-MM-DD]', hint: 'Log steps (terminal parser)', run: (a) => runTerminalCommandString('steps ' + a) },
  { id: 'task', usage: '>task <Column> | <Title> | [YYYY-MM-DD]', hint: 'Create a task', run: (a) => runTerminalCommandString('task ' + a) },
  { id: 'run', usage: '>run 5k 5:30 [location]', hint: 'Log a run', run: (a) => runTerminalCommandString('run ' + a) },
  { id: 'habit', usage: '>habit <keyword>', hint: 'Check off a habit', run: (a) => runTerminalCommandString('habit ' + a) },
  { id: 'theme', usage: '>theme', hint: 'Cycle the display mood profile', run: () => cycleDisplayColorProfile() },
  { id: 'focus', usage: '>focus', hint: 'Toggle Focus mode', run: () => toggleFocusMode() },
  { id: 'tools', usage: '>tools', hint: 'Open the tools hub', run: () => openToolsModal('diagnostics') },
  { id: 'diag', usage: '>diag', hint: 'Diagnostics panel', run: () => openToolsModal('diagnostics') },
  { id: 'export', usage: '>export', hint: 'Export suite', run: () => openToolsModal('export') },
  { id: 'review', usage: '>review', hint: 'Weekly review', run: () => openToolsModal('review') },
  { id: 'trash', usage: '>trash', hint: 'Restore deleted rows', run: () => openToolsModal('trash') },
  { id: 'audio', usage: '>audio', hint: 'Toggle ambient focus audio', run: () => toggleAmbientAudio() },
  { id: 'sync', usage: '>sync', hint: 'Flush queued offline writes', run: () => flushWriteQueue(true) },
  { id: 'keys', usage: '>keys', hint: 'Keyboard shortcut sheet', run: () => openToolsModal('keys') },
  { id: 'print', usage: '>print', hint: 'Print the current view', run: () => window.print() },
  { id: 'gps', usage: '>gps', hint: 'Lock live GPS for UM 3D Atlas walking routes', run: () => window.umAtlas && window.umAtlas.requestUserCampusGps(true) },
  { id: 'dense', usage: '>dense', hint: 'Toggle Pro Ultra-Dense / Standard UI density', run: () => toggleDensityMode() },
  { id: 'netlify', usage: '>netlify', hint: 'Open Netlify static bundle & export suite', run: () => openToolsModal('export') },
  { id: 'changelog', usage: '>changelog', hint: 'Version & release changelog', run: () => openToolsModal('changelog') },
  { id: 'version', usage: '>version', hint: 'Version & release changelog', run: () => openToolsModal('changelog') }
];

// ---- command history (D3.10) -------------------------------------------
// The last 10 commands run from the palette, surfaced as "RECENT" whenever the operator
// opens command mode with a bare ">". No extra keystrokes, no conflict with list nav.
const CMD_HISTORY_KEY = 'autumn_cmd_history';

function loadCommandHistory() {
  try {
    const raw = safeStorage.getItem(CMD_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch (e) { return []; }
}

function recordCommandHistory(text) {
  const clean = String(text || '').trim();
  if (!clean) return;
  const list = loadCommandHistory().filter(entry => entry !== clean);
  list.unshift(clean);
  safeStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
}

function executeCommandString(text) {
  const body = String(text || '').replace(/^>/, '').trim();
  const segments = body.split(/\s+/);
  const cmd = (segments[0] || '').toLowerCase();
  const args = segments.slice(1).join(' ');
  const found = PALETTE_COMMANDS.find(c => c.id === cmd);
  if (!found) return false;
  recordCommandHistory('>' + cmd + (args ? ' ' + args : ''));
  found.run(args);
  return true;
}

function paletteMatches(rawQuery) {
  const body = String(rawQuery || '').replace(/^>/, '').trim();
  const segments = body.split(/\s+/);
  const cmd = (segments[0] || '').toLowerCase();
  const args = segments.slice(1).join(' ');
  const exact = PALETTE_COMMANDS.find(c => c.id === cmd);

  if (exact) {
    return [{
      category: 'RUN // ' + exact.id.toUpperCase(),
      badgeClass: 'badge-green',
      title: exact.usage,
      subtitle: exact.hint,
      action: () => {
        clearGlobalSearch();
        recordCommandHistory('>' + exact.id + (args ? ' ' + args : ''));
        exact.run(args);
      }
    }];
  }

  const recent = body === ''
    ? loadCommandHistory().slice(0, 4).map(entry => ({
        category: 'RECENT',
        badgeClass: 'badge-amber',
        title: entry,
        subtitle: 'run it again',
        action: () => { clearGlobalSearch(); executeCommandString(entry); }
      }))
    : [];

  const needle = body.toLowerCase();
  const matches = PALETTE_COMMANDS
    .filter(c => !needle || c.id.indexOf(needle) !== -1 || c.hint.toLowerCase().indexOf(needle) !== -1)
    .map(c => ({
      category: 'COMMAND',
      badgeClass: 'badge-blue',
      title: c.usage,
      subtitle: c.hint,
      action: () => {
        clearGlobalSearch();
        recordCommandHistory('>' + c.id);
        c.run('');
      }
    }));

  return recent.concat(matches);
}


// -------------------------------------------------- 13.16 tools router
const TOOLS_PANELS = ['diagnostics', 'export', 'review', 'habits', 'achievements', 'trash', 'health', 'attachments', 'keys', 'system', 'changelog'];

const TOOLS_RENDERERS = {
  diagnostics: () => renderToolsDiagnostics(),
  export: () => renderToolsExport(),
  review: () => renderToolsReview(),
  habits: () => renderToolsHabits(),
  achievements: () => renderToolsAchievements(),
  trash: () => renderToolsTrash(),
  health: () => previewHealthImport(),
  attachments: () => {},
  keys: () => renderToolsKeys(),
  system: () => renderToolsSystem(),
  changelog: () => renderChangelog()
};

function showToolsPanel(name) {
  const panelName = TOOLS_PANELS.indexOf(name) >= 0 ? name : 'diagnostics';
  TOOLS_PANELS.forEach((p) => {
    const el = document.getElementById('tools-panel-' + p);
    const tab = document.getElementById('tools-tab-' + p);
    if (el) el.classList.toggle('hidden', p !== panelName);
    if (tab) {
      tab.classList.toggle('active-view', p === panelName);
      tab.setAttribute('aria-selected', p === panelName ? 'true' : 'false');
      // Roving tabindex: only the selected panel tab is in the Tab order (WAI-ARIA tabs).
      tab.setAttribute('tabindex', p === panelName ? '0' : '-1');
    }
  });
  const render = TOOLS_RENDERERS[panelName];
  if (render) {
    try { render(); } catch (e) { console.warn('[autumn] tools panel "' + panelName + '" failed:', e); }
  }
  updateAmbientAudioUI();
}

async function openToolsModal(name) {
  if (window.__autumnLazy && typeof window.__autumnLazy.ensureModalsMounted === 'function') {
    await window.__autumnLazy.ensureModalsMounted();
  }
  openModal('tools-modal');
  showToolsPanel(name || 'diagnostics');
}

// The "system" panel holds toggles that are not data views.
function renderToolsSystem() {
  if (typeof updateAmbientAudioUI === 'function') updateAmbientAudioUI();
  const status = document.getElementById('tools-system-status');
  if (status) status.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
  const pending = document.getElementById('tools-system-pending');
  if (pending) pending.textContent = pendingWrites.length + ' queued';
  const installBtn = document.getElementById('tools-install-btn');
  if (installBtn && deferredInstallPrompt) installBtn.classList.remove('hidden');
}

async function runSelfTest() {
  if (window.__autumnLazy && typeof window.__autumnLazy.ensureModule === 'function') {
    await Promise.allSettled([
      window.__autumnLazy.ensureModule('mod-steps'),
      window.__autumnLazy.ensureModule('mod-calendar'),
      window.__autumnLazy.ensureModule('mod-tasks'),
      window.__autumnLazy.ensureModule('tasks-power'),
      window.__autumnLazy.ensureModule('mod-notes'),
      window.__autumnLazy.ensureModule('mod-resources'),
      window.__autumnLazy.ensureModule('changelog-data')
    ]);
  }
  if (window.umAtlas && typeof window.umAtlas.loadUmSearchIndex === 'function') {
    try { await window.umAtlas.loadUmSearchIndex(); } catch (e) {}
  }
  const results = [];
  const check = (name, fn) => {
    try {
      const out = fn();
      results.push({ name: name, ok: out === true, detail: out === true ? 'ok' : String(out) });
    } catch (e) {
      results.push({ name: name, ok: false, detail: (e && e.message) || String(e) });
    }
  };

  check('getLocalDateString pads month/day', () => getLocalDateString(new Date(2026, 0, 5)) === '2026-01-05');
  check('formatHours(1.5) → 1h 30m', () => {
    const s = formatHours(1.5);
    return s.indexOf('1h') === 0 && s.indexOf('30m') !== -1 ? true : s;
  });
  check('escapeHtml neutralises a tag', () => escapeHtml('<b>') === '&lt;b&gt;');
  check('drive kind: docx from an octet-stream upload', () => getDriveFileKind({ name: 'Lecture Notes.docx', mimeType: 'application/octet-stream' }) === 'docx');
  check('drive kind: legacy .doc', () => getDriveFileKind({ name: 'old.doc', mimeType: 'application/msword' }) === 'doc');
  check('drive kind: xlsx from mime only', () => getDriveFileKind({ name: 'no-extension', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) === 'xlsx');
  check('drive kind: google sheet', () => getDriveFileKind({ name: 'Grades', mimeType: 'application/vnd.google-apps.spreadsheet' }) === 'gsheet');
  check('drive kind: pptx from the name only', () => getDriveFileKind({ name: 'Deck.pptx', mimeType: '' }) === 'pptx');
  check('reader offers drive/office/gview/native for docx', () => {
    const built = buildDriveReaderSources({ id: 'ABC', name: 'a.docx', mimeType: 'application/octet-stream', webContentLink: 'https://drive.google.com/uc?id=ABC' });
    return ['drive', 'office', 'gview', 'native'].every(id => built.sources.some(s => s.id === id)) && built.sourceId === 'drive';
  });
  check('reader defaults a Google Doc to the docs.google.com embed', () => {
    const built = buildDriveReaderSources({ id: 'XYZ', name: 'Plan', mimeType: 'application/vnd.google-apps.document' });
    return built.sourceId === 'gdocs' && built.sources[0].url === 'https://docs.google.com/document/d/XYZ/preview?rm=minimal';
  });
  check('reader quotes the Office Online src', () => {
    const built = buildDriveReaderSources({ id: 'Q 1', name: 'q.xlsx', mimeType: 'application/vnd.ms-excel', webContentLink: 'https://drive.google.com/uc?id=Q%201' });
    const office = built.sources.find(s => s.id === 'office');
    return Boolean(office) && office.url.indexOf('view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fdrive.google.com') !== -1;
  });
  check('escapeHtml escapes quotes', () => escapeHtml('"\'') === '&quot;&#039;');
  check('jsAttrQuote escapes a single quote', () => jsAttrQuote("a'b").indexOf('&#039;') !== -1);
  check('sanitizeNoteHtml drops <img>', () => sanitizeNoteHtml('<img src=x onerror=alert(1)>').indexOf('<img') === -1);
  check('sanitizeNoteHtml drops javascript: href', () => sanitizeNoteHtml('<a href="javascript:x">a</a>').indexOf('javascript:') === -1);
  check('sanitizeNoteHtml keeps <b>', () => sanitizeNoteHtml('<b>k</b>').indexOf('<b>k</b>') !== -1);
  check('stripHtmlTags strips markup', () => stripHtmlTags('<b>a</b><br>b') === 'a b');
  check('isWeekendDate saturday', () => isWeekendDate('2026-10-31') === true);
  check('isWeekendDate monday', () => isWeekendDate('2026-11-02') === false);
  check('study base goal weekday', () => getStudyBaseGoalForDate('2026-11-02') === STUDY_WEEKDAY_GOAL);
  // v1.3.0 — surplus/debt aware scoring baseline
  check('scoring baseline follows a carried surplus', () => {
    const rows = [{ date: '2026-11-01', computed_overflow: -2.7 }];
    const base = resolveScoringBaseline('2026-11-02', rows, getStudyBaseGoalForDate, MAX_DAILY);
    return Math.abs(base.baseline - (getStudyBaseGoalForDate('2026-11-02') - 2.7)) < 0.001 && Math.abs(base.surplus - 2.7) < 0.001;
  });
  check('scoring baseline floors at 25% of base', () => {
    const rows = [{ date: '2026-11-01', computed_overflow: -99 }];
    return resolveScoringBaseline('2026-11-02', rows, getStudyBaseGoalForDate, MAX_DAILY).baseline === getStudyBaseGoalForDate('2026-11-02') * SCORING_BASELINE_FLOOR_RATIO;
  });
  check('debt raises the scoring baseline', () => {
    const rows = [{ date: '2026-11-01', computed_overflow: 2.7 }];
    const base = resolveScoringBaseline('2026-11-02', rows, getStudyBaseGoalForDate, MAX_DAILY);
    return Math.abs(base.baseline - (getStudyBaseGoalForDate('2026-11-02') + 2.7)) < 0.001;
  });
  check('surplus boost is capped, proportional and progress-gated', () =>
    computeSurplusBoostPts(99, 7, 1, 6) === 6 &&
    Math.abs(computeSurplusBoostPts(3.5, 7, 1, 6) - 3) < 0.001 &&
    computeSurplusBoostPts(2.7, 7, 0, 6) === 0);
  check('study base goal weekend', () => getStudyBaseGoalForDate('2026-10-31') === STUDY_WEEKEND_GOAL);
  check('steps base goal weekday', () => getStepsBaseGoalForDate('2026-11-02') === STEPS_WEEKDAY_GOAL);
  check('addDaysToDateStr crosses a month', () => addDaysToDateStr('2026-10-31', 1) === '2026-11-01');
  check('evaluateTaskDeadline overdue', () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const info = evaluateTaskDeadline(getLocalDateString(d));
    return info && info.level === 'OVERDUE' ? true : 'got ' + JSON.stringify(info);
  });
  check('evaluateTaskDeadline due today', () => {
    const info = evaluateTaskDeadline(getLocalDateString(new Date()));
    return info && info.level === 'CRITICAL' ? true : 'got ' + JSON.stringify(info);
  });
  check('simpleHash is deterministic', () => simpleHash('autumn') === simpleHash('autumn'));
  check('formatSteps groups thousands', () => formatSteps(12345) === '12,345');
  check('formatTimerHMS(3661)', () => formatTimerHMS(3661) === '01:01:01');
  check('calcPearsonCorrelation perfect line = 1', () => {
    const r = calcPearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]);
    return Math.abs(r - 1) < 1e-9 ? true : String(r);
  });
  // Tools-hub regressions: the offline queue, its merge rule, the task-meta hydration and
  // the command palette are the newest moving parts, so they get assertions too.
  check('isNetworkError detects a dead link', () => isNetworkError({ message: 'TypeError: Failed to fetch' }) === true);
  check('isNetworkError ignores RLS rejections', () => isNetworkError({ message: 'row-level security policy' }) === false);
  check('mergeQueuedPayload keeps the larger online value', () => {
    const snapshot = globalStudyRows;
    globalStudyRows = [{ date: '2000-01-01', actual_hours: 9 }];
    const merged = mergeQueuedPayload({ table: 'study_ledger', payload: { date: '2000-01-01', actual_hours: 4 } });
    globalStudyRows = snapshot;
    return merged.actual_hours === 9 ? true : String(merged.actual_hours);
  });
  check('mergeQueuedPayload keeps the larger offline value', () => {
    const snapshot = globalStudyRows;
    globalStudyRows = [{ date: '2000-01-02', actual_hours: 3 }];
    const merged = mergeQueuedPayload({ table: 'study_ledger', payload: { date: '2000-01-02', actual_hours: 6 } });
    globalStudyRows = snapshot;
    return merged.actual_hours === 6 ? true : String(merged.actual_hours);
  });
  check('hydrateTaskMetaFromRows merges instead of overwriting', () => {
    const snapshot = taskMetaMap;
    taskMetaMap = { t1: { dueDate: '2026-11-05', eventId: 'ev-local' } };
    hydrateTaskMetaFromRows([{ id: 't1', due_date: null, event_id: null }]);
    const kept = taskMetaMap.t1 && taskMetaMap.t1.eventId === 'ev-local' && taskMetaMap.t1.dueDate === '2026-11-05';
    taskMetaMap = snapshot;
    return kept === true ? true : JSON.stringify(taskMetaMap.t1);
  });
  check('parseHealthCsv dedupes by highest value', () => {
    const rows = parseHealthCsv('date,steps\n2026-10-30,9000\n2026-10-30,12000\n2026-10-31,7200');
    return rows.length === 2 && rows[0].steps === 12000 ? true : JSON.stringify(rows);
  });
  check('toCsv quotes commas', () => toCsv([{ a: 'x,y' }], [{ key: 'a' }]) === 'a\r\n"x,y"');
  check('paletteMatches lists commands for a bare ">"', () => paletteMatches('>').length > 5);
  check('paletteMatches resolves an exact command', () => {
    const matches = paletteMatches('>theme');
    return matches.length === 1 && matches[0].category.indexOf('RUN') === 0;
  });
  check('computeCurrentStudyStreak returns a number', () => Number.isFinite(computeCurrentStudyStreak()));
  // v1.4.0 — MD3 Cockpit, trajectory grade helper & Netlify/Density commands
  check('getGradeAndPassFromScore maps A+ and A thresholds', () =>
    getGradeAndPassFromScore(105).grade === 'A+' &&
    getGradeAndPassFromScore(96).grade === 'A' &&
    getGradeAndPassFromScore(45).grade === 'D');
  check('TAB_META has 6 core modules + focus (no redundant cockpit)', () => !TAB_META.overview && Boolean(TAB_META.study && TAB_META.resources));
  check('UM 3D Atlas fuzzy matcher resolves FSKTM & KK8 events', () => {
    if (!window.umAtlas) return 'umAtlas not loaded';
    const info = window.umAtlas.resolveEventUmTelemetry({ id: 't1', title: 'Algorithms Lecture @ FSKTM', location: 'Dewan Kuliah 2, FSKTM', start: new Date(Date.now() + 3600000), end: new Date(Date.now() + 7200000) });
    return Boolean(info && info.walkMins > 0 && info.deepLinkUrl.indexOf('um-3d-atlas.netlify.app') !== -1);
  });
  check('Task power module & correlation matrix initialized', () => Boolean(window.tasksPower && window.analyticsMatrix));
  check('Zero-dependency native SVG chart engine loaded (v1.5.0)', () => Boolean(window.AutumnCharts && typeof window.AutumnCharts.renderCumulativeChart === 'function' && APP_VERSION === '1.5.0'));

  const failed = results.filter((r) => !r.ok);
  const rowsHtml = results.map((r) =>
    '<div style="display:flex;gap:.5rem">' +
    '<span style="color:' + (r.ok ? '#34d399' : '#fca5a5') + '">' + (r.ok ? '[OK]' : '[ERR]') + '</span>' +
    '<span style="flex:1">' + escapeHtml(r.name) + '</span>' +
    '<span style="color:#8aa79a;max-width:46%;text-align:right">' + escapeHtml(r.detail) + '</span>' +
    '</div>'
  ).join('');

  const old = document.getElementById('autumn-selftest');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'autumn-selftest';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Self test results');
  box.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(12,31,23,.86);display:flex;' +
    'align-items:center;justify-content:center;padding:1rem;font-family:"Inter",sans-serif;';
  box.innerHTML =
    '<div style="background:#0f241b;color:#d1fae5;border:1px solid #059669;max-width:760px;width:100%;' +
    'max-height:86vh;overflow:auto;padding:1rem;font-size:12px;line-height:1.7">' +
    '<div style="display:flex;justify-content:space-between;gap:1rem;border-bottom:1px solid #1e4635;padding-bottom:.5rem;margin-bottom:.5rem">' +
    '<strong>SELF-TEST // ' + (results.length - failed.length) + '/' + results.length + ' PASSED</strong>' +
    '<button type="button" onclick="document.getElementById(\'autumn-selftest\').remove()" ' +
    'style="background:#132d22;color:#34d399;border:1px solid #059669;padding:0 .5rem;cursor:pointer">CLOSE</button>' +
    '</div>' + rowsHtml + '</div>';
  document.body.appendChild(box);
  console.info('[autumn] self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed', failed);
  return results;
}

window.initExtrasModule = function () {
  const statDateIn = document.getElementById("stat-card-date-input");
  if (statDateIn && !statDateIn.value) statDateIn.value = getLocalDateString(new Date());
  if (typeof updateTerminalAuthUI === "function") updateTerminalAuthUI();
  if (typeof syncTerminalDrawerFromGeneralNotes === "function") syncTerminalDrawerFromGeneralNotes();
  if (typeof updateAmbientAudioUI === "function") updateAmbientAudioUI();
};
