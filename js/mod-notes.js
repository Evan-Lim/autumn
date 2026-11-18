// ============================================================================
// autumn // 05 DAILY JOURNAL, GENERAL NOTES & PORTFOLIO LOGS (lazy-loaded)
// ============================================================================

function applyRichTextCommand(command, editor) {
  if (!editor) return false;
  try {
    if (typeof document.queryCommandSupported === 'function' && !document.queryCommandSupported(command)) {
      showToast('FORMAT UNAVAILABLE', 'This browser does not support "' + command + '".', true);
      return false;
    }
    const applied = document.execCommand(command, false, null);
    if (!applied) showToast('FORMAT UNAVAILABLE', 'The "' + command + '" command was rejected by this browser.', true);
    return applied;
  } catch (e) {
    showToast('FORMAT FAILED', (e && e.message) || 'Rich-text command failed.', true);
    return false;
  }
}

function formatJournalDoc(command) {
  if (!currentUser) return;
  const editor = document.getElementById('note-content-editor');
  if (!editor) return;
  editor.focus();
  applyRichTextCommand(command, editor);
  updateWordCount();
}

function normalizeNoteHtml(rawContent) {
  if (!rawContent) return '';
  // If content has no HTML tags at all, convert plain newlines to <br>
  if (!/<[a-z][\s\S]*>/i.test(rawContent)) {
    return escapeHtml(rawContent).replace(/\r?\n/g, '<br>');
  }
  return sanitizeNoteHtml(rawContent);
}

try {
  const savedJOrder = JSON.parse(localStorage.getItem('autumn_journal_order') || '[]');
  if (Array.isArray(savedJOrder)) journalEntryOrder = savedJOrder;
  const savedGOrder = JSON.parse(localStorage.getItem('autumn_gen_note_order') || '[]');
  if (Array.isArray(savedGOrder)) generalNoteOrder = savedGOrder;
} catch (e) {}

function sortJournalNotesBySavedOrder(notes) {
  if (!Array.isArray(journalEntryOrder) || journalEntryOrder.length === 0) return notes;
  const orderMap = {};
  journalEntryOrder.forEach((d, idx) => { orderMap[d] = idx; });
  return notes.slice().sort((a, b) => {
    const posA = orderMap[a.date] !== undefined ? orderMap[a.date] : -1;
    const posB = orderMap[b.date] !== undefined ? orderMap[b.date] : -1;
    if (posA !== posB) return posA - posB;
    return b.date.localeCompare(a.date);
  });
}

function sortGeneralNotesBySavedOrder(notes) {
  if (!Array.isArray(generalNoteOrder) || generalNoteOrder.length === 0) return notes;
  const orderMap = {};
  generalNoteOrder.forEach((id, idx) => { orderMap[id] = idx; });
  return notes.slice().sort((a, b) => {
    const posA = orderMap[a.id] !== undefined ? orderMap[a.id] : -1;
    const posB = orderMap[b.id] !== undefined ? orderMap[b.id] : -1;
    if (posA !== posB) return posA - posB;
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
  });
}

async function persistNotesOrderConfig() {
  try {
    localStorage.setItem('autumn_journal_order', JSON.stringify(journalEntryOrder));
    localStorage.setItem('autumn_gen_note_order', JSON.stringify(generalNoteOrder));
  } catch (e) {}

  if (currentUser) {
    await supabaseClient
      .from('daily_notes')
      .upsert({
        date: NOTES_ORDER_DATE_KEY,
        title: '__NOTES_ORDER__',
        mood: 'SYSTEM',
        content: JSON.stringify({ journalOrder: journalEntryOrder, generalNoteOrder: generalNoteOrder }),
        updated_at: new Date().toISOString()
      }, { onConflict: 'date' });
  }
}

function moveJournalEntry(dateStr, delta) {
  const sorted = sortJournalNotesBySavedOrder(globalNotes);
  const currentDates = sorted.map(n => n.date);
  const idx = currentDates.indexOf(dateStr);
  if (idx === -1) return;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= currentDates.length) return;

  const temp = currentDates[idx];
  currentDates[idx] = currentDates[targetIdx];
  currentDates[targetIdx] = temp;

  journalEntryOrder = currentDates;
  globalNotes = sortJournalNotesBySavedOrder(globalNotes);
  persistNotesOrderConfig();
  renderNotesArchive();
}

function moveGeneralNoteEntry(noteId, delta) {
  const sorted = sortGeneralNotesBySavedOrder(globalGeneralNotes);
  const currentIds = sorted.map(n => n.id);
  const idx = currentIds.indexOf(noteId);
  if (idx === -1) return;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= currentIds.length) return;

  const temp = currentIds[idx];
  currentIds[idx] = currentIds[targetIdx];
  currentIds[targetIdx] = temp;

  generalNoteOrder = currentIds;
  globalGeneralNotes = sortGeneralNotesBySavedOrder(globalGeneralNotes);
  persistNotesOrderConfig();
  renderGeneralNotesArchive();
}

// Reserved `daily_notes` rows used as a lightweight key/value store for app config.
// Every one of them is dated in 1970, so they must NEVER surface as journal entries.
function isReservedSystemNoteDate(dateStr) {
  if (!dateStr) return true;
  return String(dateStr) < '2000-01-01';
}

async function fetchAndRenderNotes() {
  const [notesRes, orderRes] = await Promise.all([
    supabaseClient
      .from('daily_notes')
      .select('*')
      // Single range guard instead of one .neq() per reserved key: this automatically
      // excludes GCAL_CONFIG (1970-01-01), GDRIVE_CONFIG (1970-01-02), TASK_COL_ORDER
      // (1970-01-03), NOTES_ORDER (1970-01-04) AND GCAL_MANUAL_MONTHS (1970-01-05),
      // which previously leaked into the archive as a phantom "WK Jan 5 – Jan 11, 1970".
      .gte('date', '2000-01-01')
      .order('date', { ascending: false }),
    supabaseClient
      .from('daily_notes')
      .select('content')
      .eq('date', NOTES_ORDER_DATE_KEY)
      .maybeSingle()
  ]);

  if (notesRes.error) {
    console.warn('daily_notes fetch note:', notesRes.error.message);
  }

  if (orderRes && orderRes.data && orderRes.data.content) {
    try {
      const parsed = JSON.parse(orderRes.data.content);
      if (Array.isArray(parsed.journalOrder) && parsed.journalOrder.length > 0) {
        journalEntryOrder = parsed.journalOrder;
        localStorage.setItem('autumn_journal_order', JSON.stringify(journalEntryOrder));
      }
      if (Array.isArray(parsed.generalNoteOrder) && parsed.generalNoteOrder.length > 0) {
        generalNoteOrder = parsed.generalNoteOrder;
        localStorage.setItem('autumn_gen_note_order', JSON.stringify(generalNoteOrder));
      }
    } catch (e) {}
  }

  globalNotes = sortJournalNotesBySavedOrder(
    (notesRes.data || []).filter(n => !isReservedSystemNoteDate(n.date) && n.title !== '__NOTES_ORDER__')
  );
  renderNotesArchive();
  loadNoteForDate(selectedNoteDate);
}


function renderNotesArchive() {
  const list = document.getElementById('notes-archive-list');
  globalNotes = sortJournalNotesBySavedOrder(globalNotes);
  document.getElementById('notes-count').textContent = globalNotes.length;
  list.innerHTML = '';

  if (globalNotes.length === 0) {
    list.innerHTML = `<div class="font-mono-tech text-xs text-[#56735f] py-6 text-center">No weekly journal entries archived yet.</div>`;
    return;
  }

  globalNotes.forEach((note, idx) => {
    const isSelected = note.date === selectedNoteDate;
    const item = document.createElement('div');
    item.onclick = () => selectJournalDate(note.date, true);
    item.className = `w-full text-left p-2.5 border transition-all cursor-pointer select-none ${
      isSelected
        ? 'border-[#059669] bg-[#dcfce7]'
        : 'border-[#c5ded0] bg-white hover:border-[#87b39b]'
    }`;

    const previewTitle = note.title ? escapeHtml(note.title) : 'Untitled Weekly Log';
    const plainText = stripHtmlTags(note.content || '');
    const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const weekLabel = formatWeekSpanLabel(note.date);

    item.innerHTML = `
      <div class="flex items-center justify-between gap-1 font-mono-tech text-[10px]">
        <span class="font-bold text-[#0c1f17] truncate">${escapeHtml(weekLabel)}</span>
        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
          <span class="text-[10px] text-[#047857] mr-0.5">${escapeHtml(note.mood || 'OPTIMAL')}</span>
          <button
            type="button"
            onclick="moveJournalEntry('${note.date}', -1)"
            ${idx === 0 ? 'disabled' : ''}
            class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
            title="Move weekly entry up"
          >▲</button>
          <button
            type="button"
            onclick="moveJournalEntry('${note.date}', 1)"
            ${idx === globalNotes.length - 1 ? 'disabled' : ''}
            class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
            title="Move weekly entry down"
          >▼</button>
        </div>
      </div>
      <div class="text-xs font-semibold text-[#0c1f17] truncate mt-1">${previewTitle}</div>
      <div class="font-mono-tech text-[10px] text-[#56735f] mt-0.5">${words} words • key: ${note.date}</div>
    `;
    list.appendChild(item);
  });
}

// ── Weekly Journal editor state ─────────────────────────────────────────
// The editor previously had NO autosave and no navigation guard: clicking another week
// (or closing the tab) silently threw away whatever had been typed.

let journalLoadedKey = null;
let journalAutosaveTimer = null;
const JOURNAL_AUTOSAVE_MS = 2500;

function setJournalSaveStatus(text) {
  const statusEl = document.getElementById('note-last-saved');
  if (statusEl && text) statusEl.textContent = text;
}

function selectJournalDate(dateStr, keepExactKey = false, pickerDisplayValue = null) {
  const resolvedKey = keepExactKey ? dateStr : getWeekMondayDateString(dateStr);

  // Re-selecting the week that is already open must never reload over unsaved text.
  if (journalEditorDirty && journalLoadedKey === resolvedKey) return;

  // Never silently discard unsaved edits when hopping between weeks.
  if (journalEditorDirty && journalLoadedKey && journalLoadedKey !== resolvedKey) {
    confirmAction(
      'Unsaved Journal Edits',
      'This weekly entry has unsaved changes. Load another week and discard them?',
      () => {
        journalEditorDirty = false;
        applyJournalSelection(resolvedKey, pickerDisplayValue);
      }
    );
    return;
  }
  applyJournalSelection(resolvedKey, pickerDisplayValue);
}

function applyJournalSelection(resolvedKey, pickerDisplayValue = null) {
  selectedNoteDate = resolvedKey;
  const picker = document.getElementById('notes-date-picker');
  // Keep the day the user actually picked visible instead of snapping it back to the
  // Monday key; the loaded entry is still the week containing that day.
  if (picker) picker.value = pickerDisplayValue || resolvedKey;
  renderNotesArchive();
  loadNoteForDate(resolvedKey);
}

function loadNoteForDate(dateStr) {
  journalLoadedKey = dateStr;
  journalEditorDirty = false;
  const weekSpanText = formatWeekSpanLabel(dateStr);
  document.getElementById('note-active-date-badge').textContent = weekSpanText;
  const existing = globalNotes.find(n => n.date === dateStr);

  const titleInput = document.getElementById('note-title-input');
  const moodInput = document.getElementById('note-mood-input');
  const contentEditor = document.getElementById('note-content-editor');
  const statusEl = document.getElementById('note-last-saved');

  if (existing) {
    titleInput.value = existing.title || '';
    moodInput.value = existing.mood || 'OPTIMAL';
    contentEditor.innerHTML = normalizeNoteHtml(existing.content || '');
    const updated = existing.updated_at ? new Date(existing.updated_at).toLocaleString() : 'Recorded';
    statusEl.textContent = `ARCHIVED WEEKLY LOG (${weekSpanText}) // Last updated: ${updated}`;
  } else {
    titleInput.value = '';
    moodInput.value = 'OPTIMAL';
    contentEditor.innerHTML = '';
    statusEl.textContent = `NEW WEEKLY LOG SLOT // No entry saved for ${weekSpanText} yet.`;
  }
  updateWordCount();
}

function updateWordCount() {
  const editor = document.getElementById('note-content-editor');
  const text = editor ? (editor.innerText || editor.textContent || '').trim() : '';
  const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('note-word-count').textContent = `${count} words`;
}

onReady('note-content-editor', 'input', updateWordCount);

// Persists the current weekly entry. `silent` = autosave (no toast, no editor rebuild).
async function saveJournalEntry(opts = {}) {
  const silent = Boolean(opts.silent);
  if (!currentUser) {
    if (!silent) showToast('ACCESS DENIED', 'Sign in as autumn to save journal notes.', true);
    return false;
  }
  if (!selectedNoteDate) return false;

  const title = document.getElementById('note-title-input').value.trim();
  const mood = document.getElementById('note-mood-input').value;
  const content = document.getElementById('note-content-editor').innerHTML.trim();

  const { error } = await supabaseClient
    .from('daily_notes')
    .upsert({
      date: selectedNoteDate,
      title,
      mood,
      content,
      updated_at: new Date().toISOString()
    }, { onConflict: 'date' });

  if (error) {
    setJournalSaveStatus('SAVE FAILED — ' + error.message);
    if (!silent) showToast('SAVE ERROR', error.message, true);
    return false;
  }

  journalEditorDirty = false;
  if (journalAutosaveTimer) {
    clearTimeout(journalAutosaveTimer);
    journalAutosaveTimer = null;
  }

  // Update the in-memory archive instead of re-fetching, so an autosave can never
  // rebuild the editor underneath the caret.
  const savedEntry = {
    date: selectedNoteDate,
    title,
    mood,
    content,
    updated_at: new Date().toISOString()
  };
  const idx = globalNotes.findIndex(n => n.date === savedEntry.date);
  if (idx >= 0) globalNotes[idx] = Object.assign({}, globalNotes[idx], savedEntry);
  else globalNotes.push(savedEntry);
  renderNotesArchive();

  setJournalSaveStatus(
    `ARCHIVED WEEKLY LOG (${formatWeekSpanLabel(selectedNoteDate)}) // Last updated: ${new Date().toLocaleString()}`
  );
  if (!silent) showToast('JOURNAL SAVED', `Weekly log for ${selectedNoteDate} committed.`);
  return true;
}

// Any edit in the form (rich-text body, title or mood) marks it unsaved and schedules
// an autosave once typing pauses.
onReady('note-editor-form', 'input', () => {
  journalEditorDirty = true;
  setJournalSaveStatus(`UNSAVED CHANGES // autosaving in ${Math.round(JOURNAL_AUTOSAVE_MS / 1000)}s…`);
  if (journalAutosaveTimer) clearTimeout(journalAutosaveTimer);
  journalAutosaveTimer = setTimeout(() => saveJournalEntry({ silent: true }), JOURNAL_AUTOSAVE_MS);
});

onReady('notes-date-picker', 'change', (e) => {
  if (e.target.value) selectJournalDate(e.target.value, false, e.target.value);
});

onReady('note-editor-form', 'submit', async (e) => {
  e.preventDefault();
  await saveJournalEntry({ silent: false });
});

onReady('delete-note-btn', 'click', () => {
  if (!currentUser) return;
  confirmAction(
    `Delete Journal Entry for ${selectedNoteDate}?`,
    'This will permanently remove this daily journal entry from Supabase.',
    async () => {
      const { error } = await supabaseClient
        .from('daily_notes')
        .delete()
        .eq('date', selectedNoteDate);

      if (error) showToast('DELETE ERROR', error.message, true);
      else {
        showToast('ENTRY DELETED', `Removed journal entry for ${selectedNoteDate}.`);
        fetchAndRenderNotes();
      }
    }
  );
});

// ==========================================
// 10B. TAB 5: GENERAL NOTES & INFO LOGIC (RICH TEXT)
// ==========================================
function formatGeneralNoteDoc(command) {
  if (!currentUser) return;
  const editor = document.getElementById('gen-note-content-editor');
  if (!editor) return;
  editor.focus();
  applyRichTextCommand(command, editor);
  updateGeneralNoteWordCount();
}

async function fetchAndRenderGeneralNotes() {
  const { data, error } = await supabaseClient
    .from('general_notes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('general_notes fetch note:', error.message);
  }

  globalGeneralNotes = sortGeneralNotesBySavedOrder(data || []);
  renderGeneralNotesArchive();
  if (typeof syncTerminalDrawerFromGeneralNotes === 'function') {
    syncTerminalDrawerFromGeneralNotes();
  }

  if (selectedGeneralNoteId) {
    const stillExists = globalGeneralNotes.find(n => n.id === selectedGeneralNoteId);
    if (stillExists) {
      // Never clobber text the user is still editing (e.g. a background refresh).
      if (!generalNoteDirty) loadGeneralNoteIntoEditor(stillExists);
      return;
    }
  }

  if (globalGeneralNotes.length > 0) {
    if (generalNoteDirty) { renderGeneralNotesArchive(); return; }
    selectedGeneralNoteId = globalGeneralNotes[0].id;
    renderGeneralNotesArchive();
    loadGeneralNoteIntoEditor(globalGeneralNotes[0]);
  } else {
    createNewGeneralNoteSlot();
  }
}

function renderGeneralNotesArchive() {
  const list = document.getElementById('gen-notes-archive-list');
  const countEl = document.getElementById('gen-notes-count');
  const searchInput = document.getElementById('gen-notes-search');
  if (!list) return;

  globalGeneralNotes = sortGeneralNotesBySavedOrder(globalGeneralNotes);

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const filtered = globalGeneralNotes.filter(n => {
    if (!query) return true;
    return (
      (n.title || '').toLowerCase().includes(query) ||
      (n.category || '').toLowerCase().includes(query) ||
      stripHtmlTags(n.content || '').toLowerCase().includes(query)
    );
  });

  if (countEl) countEl.textContent = filtered.length;
  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = `<div class="font-mono-tech text-xs text-[#56735f] py-6 text-center">No general notes saved yet.</div>`;
    return;
  }

  filtered.forEach((note, idx) => {
    const isSelected = note.id === selectedGeneralNoteId;
    const isTerminalNote = note.category === 'TERMINAL' || (note.title || '').startsWith('TERMINAL SCRATCHPAD //');
    const item = document.createElement('div');
    item.onclick = () => selectGeneralNote(note.id);
    item.className = `w-full text-left p-2.5 border transition-all cursor-pointer select-none ${
      isSelected
        ? 'border-[#059669] bg-[#dcfce7]'
        : isTerminalNote
          ? 'border-[#059669]/60 bg-[#f0fdf4] hover:border-[#059669]'
          : 'border-[#c5ded0] bg-white hover:border-[#87b39b]'
    }`;

    const previewTitle = note.title ? escapeHtml(note.title) : 'Untitled General Note';
    const plainText = stripHtmlTags(note.content || '');
    const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const dateShort = note.updated_at ? new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    item.innerHTML = `
      <div class="flex items-center justify-between gap-1 font-mono-tech text-[10px]">
        <span class="font-bold ${isTerminalNote ? 'text-[#047857] bg-[#dcfce7] px-1 border border-[#86efac]' : 'text-[#0369a1]'} uppercase truncate">
          ${isTerminalNote ? '⌘ TERMINAL // DAILY' : escapeHtml(note.category || 'GENERAL')}
        </span>
        <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
          <span class="text-[#56735f] mr-0.5">${dateShort}</span>
          <button
            type="button"
            onclick="moveGeneralNoteEntry('${note.id}', -1)"
            ${idx === 0 ? 'disabled' : ''}
            class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
            title="Move general note up"
          >▲</button>
          <button
            type="button"
            onclick="moveGeneralNoteEntry('${note.id}', 1)"
            ${idx === filtered.length - 1 ? 'disabled' : ''}
            class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
            title="Move general note down"
          >▼</button>
        </div>
      </div>
      <div class="text-xs font-semibold text-[#0c1f17] truncate mt-1">${previewTitle}</div>
      <div class="font-mono-tech text-[10px] text-[#56735f] mt-0.5">${words} words</div>
    `;
    list.appendChild(item);
  });
}

// ── General Notes editor state (mirrors the Weekly Journal behaviour) ────

let generalNoteAutosaveTimer = null;
const GENERAL_NOTE_AUTOSAVE_MS = 2500;

function setGeneralNoteStatus(text) {
  const el = document.getElementById('gen-note-last-saved');
  if (el && text) el.textContent = text;
}

function selectGeneralNote(noteId) {
  if (generalNoteDirty && noteId !== selectedGeneralNoteId) {
    confirmAction(
      'Unsaved Note Changes',
      'This note has unsaved changes. Load another note and discard them?',
      () => {
        generalNoteDirty = false;
        applyGeneralNoteSelection(noteId);
      }
    );
    return;
  }
  applyGeneralNoteSelection(noteId);
}

function applyGeneralNoteSelection(noteId) {
  selectedGeneralNoteId = noteId;
  renderGeneralNotesArchive();
  const found = globalGeneralNotes.find(n => n.id === noteId);
  if (found) loadGeneralNoteIntoEditor(found);
}

function createNewGeneralNoteSlot() {
  selectedGeneralNoteId = null;
  renderGeneralNotesArchive();
  document.getElementById('gen-note-active-badge').textContent = 'NEW NOTE';
  document.getElementById('gen-note-title-input').value = '';
  document.getElementById('gen-note-category-input').value = 'GENERAL';
  document.getElementById('gen-note-content-editor').innerHTML = '';
  document.getElementById('gen-note-last-saved').textContent = 'NEW GENERAL NOTE // Fill in title and content below to save.';
  updateGeneralNoteWordCount();
}

function loadGeneralNoteIntoEditor(noteObj) {
  generalNoteDirty = false;
  document.getElementById('gen-note-active-badge').textContent = noteObj.category || 'GENERAL';
  document.getElementById('gen-note-title-input').value = noteObj.title || '';
  document.getElementById('gen-note-category-input').value = noteObj.category || 'GENERAL';
  document.getElementById('gen-note-content-editor').innerHTML = normalizeNoteHtml(noteObj.content || '');
  const updated = noteObj.updated_at ? new Date(noteObj.updated_at).toLocaleString() : 'Saved';
  document.getElementById('gen-note-last-saved').textContent = `SAVED NOTE // Last updated: ${updated}`;
  updateGeneralNoteWordCount();
}

function updateGeneralNoteWordCount() {
  const editor = document.getElementById('gen-note-content-editor');
  const text = editor ? (editor.innerText || editor.textContent || '').trim() : '';
  const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('gen-note-word-count').textContent = `${count} words`;
}

onReady('gen-note-content-editor', 'input', updateGeneralNoteWordCount);

// Persists the current general note. `silent` = autosave (no toast, no editor rebuild).
async function saveGeneralNote(opts = {}) {
  const silent = Boolean(opts.silent);
  if (!currentUser) {
    if (!silent) showToast('ACCESS DENIED', 'Sign in as autumn to save general notes.', true);
    return false;
  }

  const title = document.getElementById('gen-note-title-input').value.trim();
  const category = document.getElementById('gen-note-category-input').value;
  const content = document.getElementById('gen-note-content-editor').innerHTML.trim();

  if (!title) {
    // A title is required by the schema flow, so autosave just waits for one.
    if (silent) setGeneralNoteStatus('UNSAVED // add a title to autosave');
    else showToast('TITLE REQUIRED', 'Give the note a title before saving.', true);
    return false;
  }

  let error = null;
  if (selectedGeneralNoteId) {
    const res = await supabaseClient
      .from('general_notes')
      .update({ title, category, content, updated_at: new Date().toISOString() })
      .eq('id', selectedGeneralNoteId);
    error = res.error;
  } else {
    const res = await supabaseClient
      .from('general_notes')
      .insert({ title, category, content, updated_at: new Date().toISOString() })
      .select()
      .single();
    error = res.error;
    if (res.data && res.data.id) selectedGeneralNoteId = res.data.id;
  }

  if (error) {
    setGeneralNoteStatus('SAVE FAILED — ' + error.message);
    if (!silent) showToast('SAVE ERROR', error.message, true);
    return false;
  }

  generalNoteDirty = false;
  if (generalNoteAutosaveTimer) {
    clearTimeout(generalNoteAutosaveTimer);
    generalNoteAutosaveTimer = null;
  }

  // Refresh the in-memory list (no re-fetch) so the archive stays in sync without
  // rebuilding the editor underneath the caret.
  const saved = {
    id: selectedGeneralNoteId,
    title,
    category,
    content,
    updated_at: new Date().toISOString()
  };
  const idx = globalGeneralNotes.findIndex(n => n.id === selectedGeneralNoteId);
  if (idx >= 0) globalGeneralNotes[idx] = Object.assign({}, globalGeneralNotes[idx], saved);
  else globalGeneralNotes.unshift(saved);
  renderGeneralNotesArchive();

  setGeneralNoteStatus(`SAVED NOTE // Last updated: ${new Date().toLocaleString()}`);
  if (!silent) showToast(selectedGeneralNoteId ? 'GENERAL NOTE SAVED' : 'GENERAL NOTE CREATED', `Saved "${title}".`);
  return true;
}

onReady('gen-note-editor-form', 'input', () => {
  generalNoteDirty = true;
  setGeneralNoteStatus(`UNSAVED CHANGES // autosaving in ${Math.round(GENERAL_NOTE_AUTOSAVE_MS / 1000)}s…`);
  if (generalNoteAutosaveTimer) clearTimeout(generalNoteAutosaveTimer);
  generalNoteAutosaveTimer = setTimeout(() => saveGeneralNote({ silent: true }), GENERAL_NOTE_AUTOSAVE_MS);
});

onReady('gen-note-editor-form', 'submit', async (e) => {
  e.preventDefault();
  await saveGeneralNote({ silent: false });
});

onReady('delete-gen-note-btn', 'click', () => {
  if (!currentUser || !selectedGeneralNoteId) return;
  const currentTitle = document.getElementById('gen-note-title-input').value || 'this note';
  confirmAction(
    `Delete General Note "${currentTitle}"?`,
    'This will permanently remove this general note from Supabase.',
    async () => {
      const { error } = await supabaseClient
        .from('general_notes')
        .delete()
        .eq('id', selectedGeneralNoteId);

      if (error) showToast('DELETE ERROR', error.message, true);
      else {
        selectedGeneralNoteId = null;
        showToast('GENERAL NOTE DELETED', `Removed "${currentTitle}".`);
        fetchAndRenderGeneralNotes();
      }
    }
  );
});

// ==========================================
// 10B-2. TAB 5: COMPETITIONS / ACTIVITIES & POSITIONS LEDGERS
// ==========================================
let editingPortfolioId = null;

const PORTFOLIO_CATEGORY_META = {
  COMPETITION: {
    bannerTop: 'PORTFOLIO LEDGER // 01',
    title: 'COMPETITIONS & ACTIVITIES',
    col1Header: 'COMPETITION / ACTIVITY',
    col2Header: 'DATE / DURATION',
    col3Header: 'RESULTS / POSITION',
    emptyMsg: 'No competitions or activities logged yet. Use the form above to add entries.'
  },
  POSITION: {
    bannerTop: 'PORTFOLIO LEDGER // 02',
    title: 'POSITIONS & LEADERSHIP ROLES',
    col1Header: 'POSITION / ORGANIZATION',
    col2Header: 'DATE / TENURE',
    col3Header: 'ROLE / ACHIEVEMENT',
    emptyMsg: 'No leadership positions or roles logged yet. Use the form above to add entries.'
  }
};

function handlePortfolioCategoryChange() {
  const cat = document.getElementById('portfolio-category-input')?.value || 'COMPETITION';
  const titleLbl = document.getElementById('portfolio-title-label');
  const titleIn = document.getElementById('portfolio-title-input');
  const resLbl = document.getElementById('portfolio-result-label');
  const resIn = document.getElementById('portfolio-result-input');

  if (cat === 'POSITION') {
    if (titleLbl) titleLbl.textContent = '1. Position / Organization';
    if (titleIn) titleIn.placeholder = 'e.g., President — Robotics Society';
    if (resLbl) resLbl.textContent = '3. Role / Division / Scope';
    if (resIn) resIn.placeholder = 'e.g., Executive Committee / Lead';
  } else {
    if (titleLbl) titleLbl.textContent = '1. Competition / Activity';
    if (titleIn) titleIn.placeholder = 'e.g., National Physics Olympiad';
    if (resLbl) resLbl.textContent = '3. Results / Position';
    if (resIn) resIn.placeholder = 'e.g., Gold Medal / 1st Place';
  }
}

async function fetchAndRenderPortfolioLogs() {
  const { data, error } = await supabaseClient
    .from('portfolio_logs')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('portfolio_logs fetch note:', error.message);
  }

  globalPortfolioLogs = data || [];
  renderPortfolioTables();
}

function renderPortfolioTables() {
  const container = document.getElementById('portfolio-tables-container');
  if (!container) return;
  container.innerHTML = '';

  const isOwner = Boolean(currentUser);

  ['COMPETITION', 'POSITION'].forEach(catKey => {
    const meta = PORTFOLIO_CATEGORY_META[catKey];
    const catRows = globalPortfolioLogs.filter(r => r.category === catKey);
    const tableDomId = `portfolio-table-${catKey.toLowerCase()}`;

    const rowsHtml = catRows.length === 0
      ? `
        <tr>
          <td colspan="${isOwner ? 5 : 4}" class="text-center py-8 text-[#56735f] font-mono-tech text-xs">
            ${meta.emptyMsg}
          </td>
        </tr>
      `
      : catRows.map((row, idx) => {
          const rowClass = row.row_style === 'THRESHOLD'
            ? 'run-row-threshold'
            : row.row_style === 'EASY'
              ? 'run-row-easy'
              : '';

          if (isOwner && editingPortfolioId === row.id) {
            return `
              <tr class="bg-[#eff8f2]">
                <td colspan="5" class="p-2.5 sm:p-3">
                  <div class="font-mono-tech text-[10px] uppercase text-[#047857] font-bold mb-2">Edit EDITING ${meta.title} ENTRY</div>
                  <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div class="sm:col-span-2">
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-port-title-${row.id}">${meta.col1Header}</label>
                      <input type="text" id="edit-port-title-${row.id}" value="${escapeHtml(row.title || '')}" class="tech-input !py-1.5 !px-2 !text-xs">
                    </div>
                    <div>
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-port-date-${row.id}">${meta.col2Header}</label>
                      <input type="text" id="edit-port-date-${row.id}" value="${escapeHtml(row.date_str || '')}" placeholder="14/5/2026 or Mar – Aug 2026" class="tech-input !py-1.5 !px-2 !text-xs">
                    </div>
                    <div>
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-port-result-${row.id}">${meta.col3Header}</label>
                      <input type="text" id="edit-port-result-${row.id}" value="${escapeHtml(row.result_str || '')}" class="tech-input !py-1.5 !px-2 !text-xs">
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-[#c5ded0]">
                    <div class="flex items-center gap-2">
                      <label class="font-mono-tech text-[9px] uppercase text-[#436152]" for="edit-port-style-${row.id}">Highlight:</label>
                      <select id="edit-port-style-${row.id}" class="tech-input !py-1 !px-2 !text-xs !w-32">
                        <option value="STANDARD" ${(row.row_style || 'STANDARD') === 'STANDARD' ? 'selected' : ''}>Standard (White)</option>
                        <option value="THRESHOLD" ${row.row_style === 'THRESHOLD' ? 'selected' : ''}>Highlight (Yellow)</option>
                        <option value="EASY" ${row.row_style === 'EASY' ? 'selected' : ''}>Verified (Green)</option>
                      </select>
                    </div>
                    <div class="flex items-center gap-2">
                      <button type="button" onclick="cancelEditPortfolioRow()" class="btn-tech-outline !py-1 !px-3 !text-xs">Cancel</button>
                      <button type="button" onclick="saveEditedPortfolioRow('${row.id}')" class="btn-chamfer !py-1 !px-3.5 !text-xs">Save Changes</button>
                    </div>
                  </div>
                </td>
              </tr>
            `;
          }

          return `
            <tr class="${rowClass}">
              <td class="text-center font-semibold border-r border-[#c5ded0]/60 w-8 sm:w-10 align-middle">${idx + 1}</td>
              <td class="font-bold border-r border-[#c5ded0]/60 break-words align-middle py-2">
                <div class="text-xs sm:text-sm leading-snug">${escapeHtml(row.title || '')}</div>
                <!-- Mobile-only stacked date badge so columns never squish on phones -->
                <div class="sm:hidden mt-1">
                  <span class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5"> ${escapeHtml(row.date_str || '')}</span>
                </div>
              </td>
              <td class="hidden sm:table-cell text-center font-semibold border-r border-[#c5ded0]/60 break-words align-middle">${escapeHtml(row.date_str || '')}</td>
              <td class="font-semibold break-words align-middle text-[11px] sm:text-xs">${escapeHtml(row.result_str || '')}</td>
              ${isOwner ? `
                <td class="text-center sm:text-right align-middle p-1 sm:p-2">
                  <div class="grid grid-cols-2 sm:inline-flex items-center gap-1 w-fit mx-auto sm:mx-0">
                    <button type="button" onclick="movePortfolioRow('${catKey}', '${row.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1 disabled:opacity-30" title="Move row up">▲</button>
                    <button type="button" onclick="movePortfolioRow('${catKey}', '${row.id}', 1)" ${idx === catRows.length - 1 ? 'disabled' : ''} class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1 disabled:opacity-30" title="Move row down">▼</button>
                    <button type="button" onclick="startEditPortfolioRow('${row.id}')" class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1" title="Edit row">Edit</button>
                    <button type="button" onclick="deletePortfolioRow('${row.id}')" class="touch-action-btn danger !min-w-[24px] !min-h-[24px] !px-1" title="Delete row">×</button>
                  </div>
                </td>
              ` : ''}
            </tr>
          `;
        }).join('');

    const tableWrap = document.createElement('div');
    tableWrap.className = 'border border-[#87b39b] bg-white overflow-hidden max-w-full flex flex-col justify-between';

    tableWrap.innerHTML = `
      <div>
        <!-- Spreadsheet-Style Technical Banner -->
        <div class="bg-[#d5e6dc] text-center font-mono-tech text-xs font-bold uppercase tracking-widest py-1 border-b border-[#87b39b] text-[#0c1f17]">
          ${meta.bannerTop}
        </div>
        <div class="bg-[#e8f3ec] text-center font-mono-tech text-xs font-bold uppercase tracking-wider py-1 border-b border-[#87b39b] text-[#047857]">
          ${meta.title} (${catRows.length})
        </div>
        <div class="w-full overflow-x-auto">
          <table id="${tableDomId}" class="tech-table w-full">
            <thead>
              <tr class="bg-[#f4faf6]">
                <th class="!text-center w-8 sm:w-12 border-r border-[#c5ded0]">#</th>
                <th class="w-auto border-r border-[#c5ded0]">${meta.col1Header}</th>
                <th class="hidden sm:table-cell !text-center w-36 border-r border-[#c5ded0]">${meta.col2Header}</th>
                <th class="w-[34%] sm:w-44 border-r border-[#c5ded0]">${meta.col3Header}</th>
                ${isOwner ? `<th data-no-export="true" class="!text-center sm:!text-right w-[62px] sm:w-28">ACT</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
      <div class="table-export-bar px-3 pb-2">
        <span>EXPORT ${meta.title}:</span>
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'csv')" class="btn-export-tag">↓ CSV</button>
          <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'md')" class="btn-export-tag">↓ MD</button>
          <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'json')" class="btn-export-tag">↓ JSON</button>
          <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'copy')" class="btn-export-tag">⎘ COPY MD</button>
        </div>
      </div>
    `;

    container.appendChild(tableWrap);
  });
}

onReady('add-portfolio-form', 'submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to log entries.', true);

  const category = document.getElementById('portfolio-category-input').value;
  const title = document.getElementById('portfolio-title-input').value.trim();
  const dateStr = document.getElementById('portfolio-date-input').value.trim();
  const resultStr = document.getElementById('portfolio-result-input').value.trim();
  const rowStyle = document.getElementById('portfolio-style-input').value;

  if (!title || !dateStr || !resultStr) return;

  const existingCatRows = globalPortfolioLogs.filter(r => r.category === category);
  const nextSortOrder = existingCatRows.length > 0
    ? Math.max(...existingCatRows.map(r => Number(r.sort_order) || 0)) + 1
    : 1;

  const { error } = await supabaseClient
    .from('portfolio_logs')
    .insert({
      category,
      title,
      date_str: dateStr,
      result_str: resultStr,
      row_style: rowStyle,
      sort_order: nextSortOrder
    });

  if (error) {
    showToast('DATABASE ERROR', error.message, true);
  } else {
    document.getElementById('portfolio-title-input').value = '';
    document.getElementById('portfolio-date-input').value = '';
    document.getElementById('portfolio-result-input').value = '';
    showToast('RECORD LOGGED', `Added "${title}" to ${category === 'POSITION' ? 'Positions' : 'Competitions & Activities'}.`);
    fetchAndRenderPortfolioLogs();
  }
});

function startEditPortfolioRow(rowId) {
  if (!currentUser) return;
  editingPortfolioId = rowId;
  renderPortfolioTables();
}

function cancelEditPortfolioRow() {
  editingPortfolioId = null;
  renderPortfolioTables();
}

async function saveEditedPortfolioRow(rowId) {
  if (!currentUser) return;
  const newTitle = document.getElementById(`edit-port-title-${rowId}`)?.value.trim();
  const newDate = document.getElementById(`edit-port-date-${rowId}`)?.value.trim();
  const newResult = document.getElementById(`edit-port-result-${rowId}`)?.value.trim();
  const newStyle = document.getElementById(`edit-port-style-${rowId}`)?.value || 'STANDARD';

  if (!newTitle || !newDate || !newResult) return;

  const { error } = await supabaseClient
    .from('portfolio_logs')
    .update({
      title: newTitle,
      date_str: newDate,
      result_str: newResult,
      row_style: newStyle
    })
    .eq('id', rowId);

  editingPortfolioId = null;
  if (error) {
    showToast('UPDATE ERROR', error.message, true);
  } else {
    showToast('RECORD UPDATED', `Updated "${newTitle}".`);
    fetchAndRenderPortfolioLogs();
  }
}

async function movePortfolioRow(catKey, rowId, delta) {
  if (!currentUser) return;
  const catRows = globalPortfolioLogs.filter(r => r.category === catKey);
  const idx = catRows.findIndex(r => r.id === rowId);
  if (idx === -1) return;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= catRows.length) return;

  // Swap items in array and reassign sequential sort_order
  const reordered = catRows.slice();
  const temp = reordered[idx];
  reordered[idx] = reordered[targetIdx];
  reordered[targetIdx] = temp;

  await Promise.all(
    reordered.map((r, i) =>
      supabaseClient.from('portfolio_logs').update({ sort_order: i + 1 }).eq('id', r.id)
    )
  );
  fetchAndRenderPortfolioLogs();
}

function deletePortfolioRow(rowId) {
  if (!currentUser) return;
  const target = globalPortfolioLogs.find(r => r.id === rowId);
  confirmAction(
    `Delete "${target ? target.title : 'this entry'}"?`,
    'This will permanently remove this record from Supabase.',
    async () => {
      const { error } = await supabaseClient
        .from('portfolio_logs')
        .delete()
        .eq('id', rowId);

      if (error) showToast('DELETE ERROR', error.message, true);
      else {
        showToast('RECORD DELETED', 'Removed entry from ledger.', false, () => restoreDeletedRow('portfolio_logs', target, fetchAndRenderPortfolioLogs));
        fetchAndRenderPortfolioLogs();
      }
    }
  );
}

window.initNotesModule = async function () {
  const picker = document.getElementById("notes-date-picker");
  if (picker && !picker.value) {
    const wk = typeof getWeekMondayDateString === "function" ? getWeekMondayDateString(new Date()) : getLocalDateString(new Date());
    if (!selectedNoteDate) selectedNoteDate = wk;
    picker.value = selectedNoteDate;
  }
  if (typeof syncOwnerPermissions === "function") syncOwnerPermissions(document.getElementById("tab-notes"));
  if (Array.isArray(globalNotes) && globalNotes.length > 0) {
    renderNotesArchive();
    loadNoteForDate(selectedNoteDate || getWeekMondayDateString(new Date()));
  } else {
    fetchAndRenderNotes();
  }
  if (Array.isArray(globalGeneralNotes) && globalGeneralNotes.length > 0) {
    renderGeneralNotesArchive();
  } else {
    fetchAndRenderGeneralNotes();
  }
  if (Array.isArray(globalPortfolioLogs) && globalPortfolioLogs.length > 0) {
    renderPortfolioTables();
  } else {
    fetchAndRenderPortfolioLogs();
  }
};
