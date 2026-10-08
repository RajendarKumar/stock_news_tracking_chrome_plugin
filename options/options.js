/**
 * Options & Settings Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let trackedStocks = [];
  let settings = {};

  // DOM Elements
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.settings-section');
  const holdingsTbody = document.getElementById('holdings-tbody');
  const totalStocksLabel = document.getElementById('total-stocks-label');
  const holdingsSearch = document.getElementById('holdings-search');
  const btnAddModal = document.getElementById('btn-add-modal');
  const btnClearHoldingsOptions = document.getElementById('btn-clear-holdings-options');
  const btnClearAllOptions = document.getElementById('btn-clear-all-options');
  const modalAddStock = document.getElementById('modal-add-stock');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const modalFormAdd = document.getElementById('modal-form-add');
  const modalInputSymbol = document.getElementById('modal-input-symbol');
  const modalInputName = document.getElementById('modal-input-name');

  // Settings Form Elements
  const selectRefreshInterval = document.getElementById('select-refresh-interval');
  const toggleNotifications = document.getElementById('toggle-notifications');
  const selectNewsRegion = document.getElementById('select-news-region');
  const inputMaxArticles = document.getElementById('input-max-articles');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const saveStatus = document.getElementById('save-status');

  // Broker Sync & Tester Elements
  const btnOpenKite = document.getElementById('btn-open-kite');
  const testSymbolInput = document.getElementById('test-symbol-input');
  const btnRunTest = document.getElementById('btn-run-test');
  const testResultsContainer = document.getElementById('test-results-container');

  // Backup Elements
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImportJson = document.getElementById('file-import-json');
  const btnResetData = document.getElementById('btn-reset-data');

  // Load Initial Data
  await loadData();
  loadSettingsForm();

  // Navigation switching
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('data-section');
      navLinks.forEach((l) => l.classList.remove('active'));
      sections.forEach((s) => s.classList.remove('active'));

      link.classList.add('active');
      const targetSec = document.getElementById(targetId);
      if (targetSec) targetSec.classList.add('active');
    });
  });

  async function loadData() {
    trackedStocks = await StorageManager.getStocks();
    settings = await StorageManager.getSettings();
    renderHoldingsTable();
  }

  function renderHoldingsTable() {
    holdingsTbody.innerHTML = '';
    const q = holdingsSearch.value.toLowerCase().trim();

    const filtered = trackedStocks.filter(
      (s) => s.symbol.toLowerCase().includes(q) || (s.name && s.name.toLowerCase().includes(q))
    );

    totalStocksLabel.textContent = `${trackedStocks.length} Stocks`;

    // Update Clear button visibilities and counters
    if (btnClearAllOptions) {
      if (trackedStocks.length > 0) {
        btnClearAllOptions.style.display = 'inline-block';
        btnClearAllOptions.textContent = `🗑️ Clear Complete List (${trackedStocks.length})`;
      } else {
        btnClearAllOptions.style.display = 'none';
      }
    }

    if (btnClearHoldingsOptions) {
      const holdingsCount = trackedStocks.filter((s) => s.source === 'Zerodha Kite' || s.category === 'holding').length;
      if (holdingsCount > 0) {
        btnClearHoldingsOptions.style.display = 'inline-block';
        btnClearHoldingsOptions.textContent = `Clear Holdings Only (${holdingsCount})`;
      } else {
        btnClearHoldingsOptions.style.display = 'none';
      }
    }

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const emptyMsg = trackedStocks.length === 0
        ? 'No tracked stocks yet. Click "+ Add New Stock" or sync holdings from Zerodha Kite.'
        : 'No stocks match your query.';
      tr.innerHTML = `
        <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 32px;">
          ${emptyMsg}
        </td>
      `;
      holdingsTbody.appendChild(tr);
      return;
    }

    filtered.forEach((stock) => {
      const tr = document.createElement('tr');
      const dateStr = stock.addedAt ? new Date(stock.addedAt).toLocaleDateString() : '-';

      const isHolding = stock.source === 'Zerodha Kite' || stock.category === 'holding';
      const badgeText = isHolding ? '🏢 Holding' : '⭐ Watchlist';
      const badgeStyle = isHolding ? 'background: rgba(16, 185, 129, 0.15); color: #10b981;' : 'background: rgba(59, 130, 246, 0.15); color: #60a5fa;';

      tr.innerHTML = `
        <td style="font-weight: 700; color: #60a5fa;">${escapeHtml(stock.symbol)}</td>
        <td>${escapeHtml(stock.name || stock.symbol)}</td>
        <td><span class="badge-count" style="font-size: 11px; ${badgeStyle}">${badgeText}</span></td>
        <td>${stock.quantity !== null && stock.quantity !== undefined ? stock.quantity : '-'}</td>
        <td style="color: var(--text-muted); font-size: 12px;">${dateStr}</td>
        <td>
          <button class="btn btn-danger btn-delete-stock" data-symbol="${escapeHtml(stock.symbol)}" style="padding: 4px 8px; font-size: 11px;">
            Delete
          </button>
        </td>
      `;

      const delBtn = tr.querySelector('.btn-delete-stock');
      delBtn.addEventListener('click', async () => {
        if (confirm(`Remove ${stock.symbol} from your tracked portfolio?`)) {
          await StorageManager.removeStock(stock.symbol);
          await loadData();
        }
      });

      holdingsTbody.appendChild(tr);
    });
  }

  // One-click Clear Holdings with Confirmation
  if (btnClearHoldingsOptions) {
    btnClearHoldingsOptions.addEventListener('click', async () => {
      const holdings = trackedStocks.filter((s) => s.source === 'Zerodha Kite' || s.category === 'holding');
      if (holdings.length === 0) {
        alert('No broker holdings currently tracked to clear.');
        return;
      }

      const confirmed = confirm(
        `Are you sure you want to clear your holdings list (${holdings.length} stocks)?\n\nThis will remove all companies synced from Zerodha Kite. Any custom watchlist companies will be preserved.`
      );

      if (confirmed) {
        await StorageManager.clearHoldings();
        await loadData();
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
        alert(`✓ Successfully cleared ${holdings.length} holdings.`);
      }
    });
  }

  // One-click Clear Complete List with Confirmation
  if (btnClearAllOptions) {
    btnClearAllOptions.addEventListener('click', async () => {
      const totalCount = trackedStocks.length;
      if (totalCount === 0) {
        alert('No companies currently tracked to clear.');
        return;
      }

      const confirmed = confirm(
        `Are you sure you want to clear the COMPLETE list (${totalCount} companies)?\n\n` +
        `This will remove ALL tracked companies (both broker holdings and watchlist) and their cached news.\n\n` +
        `Click "OK" to permanently remove all companies.`
      );

      if (confirmed) {
        await StorageManager.clearCompleteList();
        await loadData();
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
        alert(`✓ Complete list cleared successfully (${totalCount} companies removed).`);
      }
    });
  }

  // Add Stock Modal
  btnAddModal.addEventListener('click', () => {
    modalInputSymbol.value = '';
    modalInputName.value = '';
    modalAddStock.showModal();
  });

  btnCloseModal.addEventListener('click', () => modalAddStock.close());
  btnCancelModal.addEventListener('click', () => modalAddStock.close());

  modalInputSymbol.addEventListener('input', () => {
    const sym = cleanStockSymbol(modalInputSymbol.value);
    if (sym && POPULAR_STOCKS_MAP[sym]) {
      modalInputName.value = POPULAR_STOCKS_MAP[sym];
    }
  });

  modalFormAdd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const symbol = cleanStockSymbol(modalInputSymbol.value);
    const name = modalInputName.value.trim();

    if (symbol) {
      await StorageManager.addStock(symbol, name, 'manual');
      modalAddStock.close();
      await loadData();
      chrome.runtime.sendMessage({ action: 'FETCH_STOCK_NEWS', symbol, name });
    }
  });

  // Settings Form
  function loadSettingsForm() {
    selectRefreshInterval.value = String(settings.refreshInterval || 30);
    toggleNotifications.checked = Boolean(settings.notificationsEnabled);
    selectNewsRegion.value = settings.region || 'IN';
    inputMaxArticles.value = settings.maxArticlesPerStock || 10;
  }

  btnSaveSettings.addEventListener('click', async () => {
    const updated = {
      refreshInterval: parseInt(selectRefreshInterval.value, 10),
      notificationsEnabled: toggleNotifications.checked,
      region: selectNewsRegion.value,
      maxArticlesPerStock: parseInt(inputMaxArticles.value, 10)
    };

    await StorageManager.saveSettings(updated);
    settings = updated;

    // Notify background worker
    chrome.runtime.sendMessage({ action: 'UPDATE_SETTINGS', settings: updated });

    saveStatus.textContent = '✓ Settings saved successfully!';
    saveStatus.style.color = '#10b981';
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 3000);
  });

  // Open Zerodha Kite tab
  btnOpenKite.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://kite.zerodha.com/holdings' });
  });

  // Live Feed Tester
  btnRunTest.addEventListener('click', async () => {
    const rawSym = testSymbolInput.value.trim();
    if (!rawSym) return;

    btnRunTest.disabled = true;
    btnRunTest.textContent = 'Fetching...';
    testResultsContainer.style.display = 'flex';
    testResultsContainer.innerHTML = '<div style="color: #94a3b8;">Connecting to Google News RSS feed...</div>';

    try {
      const feedUrl = buildNewsFeedUrl(rawSym, '', settings.region || 'IN');
      const res = await fetch(feedUrl);
      const xml = await res.text();
      const articles = parseRssFeed(xml, rawSym);

      testResultsContainer.innerHTML = '';
      if (articles.length === 0) {
        testResultsContainer.innerHTML = '<div style="color: #ef4444;">No news found for this symbol.</div>';
      } else {
        articles.slice(0, 5).forEach((art) => {
          const card = document.createElement('div');
          card.className = 'test-card';
          card.innerHTML = `
            <div style="font-size: 11px; color: #10b981; font-weight: 700; margin-bottom: 4px;">${art.source} • ${art.relativeTime}</div>
            <a href="${escapeHtml(art.link)}" target="_blank">${escapeHtml(art.title)}</a>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${escapeHtml(art.snippet)}</p>
          `;
          testResultsContainer.appendChild(card);
        });
      }
    } catch (err) {
      testResultsContainer.innerHTML = `<div style="color: #ef4444;">Error fetching feed: ${err.message}</div>`;
    } finally {
      btnRunTest.disabled = false;
      btnRunTest.textContent = 'Fetch Live News';
    }
  });

  // Backup: Export JSON
  btnExportJson.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trackedStocks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `stock_news_holdings_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Backup: Import JSON
  btnImportJson.addEventListener('click', () => fileImportJson.click());

  fileImportJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          await StorageManager.upsertStocksFromBroker(imported, 'Imported Backup', false);
          await loadData();
          alert(`Successfully imported ${imported.length} stocks!`);
        } else {
          alert('Invalid JSON file format.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  });

  // Reset Everything
  btnResetData.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all tracked stocks and cached news? This cannot be undone.')) {
      await StorageManager.clearAllData();
      await loadData();
      alert('All extension data has been reset.');
    }
  });

  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, (m) => map[m]);
  }
});

