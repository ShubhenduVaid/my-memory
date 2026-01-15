const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsList = document.getElementById('results-list') as HTMLDivElement;
const previewTitle = document.getElementById('preview-title') as HTMLDivElement;
const previewContent = document.getElementById('preview-content') as HTMLDivElement;

let selectedIndex = -1;
let results: any[] = [];

let debounceTimer: number;
let lastQuery = '';

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();
  
  // Immediate local search for responsiveness
  if (query.length >= 2 && query !== lastQuery) {
    (window as any).api.searchLocal(query).then((localResults: any[]) => {
      if (searchInput.value.trim() === query) {
        results = localResults;
        renderResults();
        if (results.length > 0) selectResult(0);
      }
    });
  }
  
  // Debounced AI search - only after 800ms of no typing
  debounceTimer = window.setTimeout(async () => {
    if (query.length < 2) {
      resultsList.innerHTML = '';
      previewTitle.textContent = 'Select a note to preview';
      previewContent.textContent = '';
      return;
    }
    lastQuery = query;
    results = await (window as any).api.search(query);
    renderResults();
    if (results.length > 0) selectResult(0);
  }, 800);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); selectResult(selectedIndex + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selectResult(selectedIndex - 1); }
  else if (e.key === 'Enter' && selectedIndex >= 0) {
    (window as any).api.openNote(results[selectedIndex].id);
  }
});

function renderResults() {
  resultsList.innerHTML = results.map((r, i) => `
    <div class="result ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
      <div class="result-title">${escapeHtml(r.title)}</div>
      <div class="result-folder">${escapeHtml(r.folder || '')}</div>
    </div>
  `).join('');
  
  resultsList.querySelectorAll('.result').forEach(el => {
    el.addEventListener('click', () => {
      selectResult(parseInt(el.getAttribute('data-index')!));
    });
    el.addEventListener('dblclick', () => {
      (window as any).api.openNote(results[parseInt(el.getAttribute('data-index')!)].id);
    });
  });
}

function selectResult(index: number) {
  if (results.length === 0) return;
  selectedIndex = Math.max(0, Math.min(index, results.length - 1));
  
  resultsList.querySelectorAll('.result').forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
  });
  
  const selected = results[selectedIndex];
  previewTitle.textContent = selected.title;
  
  // Render markdown for AI answers
  if (selected.id === 'ai-answer') {
    previewContent.innerHTML = simpleMarkdown(selected.content || selected.snippet || '');
  } else {
    previewContent.textContent = selected.content || selected.snippet || '';
  }
}

function simpleMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
