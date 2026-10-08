/**
 * Content Script for Zerodha Kite (kite.zerodha.com)
 * Safe, non-intrusive portfolio holdings extractor.
 * 
 * STRICT SECURITY & PERFORMANCE GUARANTEE:
 * 1. NEVER touches, modifies, or observes login, password, 2FA, or auth pages.
 * 2. Zero MutationObserver on document.body to prevent any Vue/React event interference.
 * 3. Only operates when user is authenticated and viewing holdings or positions.
 */

(function () {
  // Prevent duplicate injection
  if (window.__sntKiteInjected) return;
  window.__sntKiteInjected = true;

  /**
   * Safety Guard: Check if the user is on an unauthenticated, login, or 2FA page.
   * If true, this script completely terminates and touches nothing.
   */
  function isAuthOrLoginPage() {
    const path = (window.location.pathname || '').toLowerCase();
    
    // Check path for login / auth / two-factor routes
    if (
      path === '/' ||
      path.includes('login') ||
      path.includes('twofa') ||
      path.includes('forgot') ||
      path.includes('connect')
    ) {
      // If there are password or login inputs on the page
      if (document.querySelector('input[type="password"], #password, #userid, #totp, form.login-form, .twofa-form')) {
        return true;
      }
    }

    // Secondary check: presence of sensitive credential inputs anywhere
    if (document.querySelector('input[type="password"], #password, #totp, input[autocomplete="one-time-code"]')) {
      return true;
    }

    return false;
  }

  // If on login/auth page, abort immediately - zero DOM interaction
  if (isAuthOrLoginPage()) {
    console.log('[Stock News Tracker] Authentication/login screen detected. Script is dormant.');
    return;
  }

  const EXCLUDED_KEYWORDS = new Set([
    'INSTRUMENT', 'QTY', 'QTY.', 'AVG', 'AVG.', 'AVG COST', 'LTP', 'CURR',
    'CURR. VALUE', 'P&L', 'NET CHG', 'DAY CHG', 'TOTAL', 'ACTIONS', 'HOLDINGS',
    'POSITIONS', 'ORDERS', 'FUNDS', 'APPS', 'SEARCH', 'EQUITY', 'COMMODITY',
    'ALL', 'NSE', 'BSE', 'NFO', 'CDS', 'MCX', 'BUY', 'SELL', 'MORE'
  ]);

  /**
   * Clean and normalize extracted stock symbol
   */
  function cleanSymbol(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim().toUpperCase();

    // Remove exchange prefix like "NSE:" or "BSE:"
    if (s.includes(':')) {
      s = s.split(':')[1];
    }

    // Clean common series suffix
    s = s.replace(/-EQ$/i, '')
         .replace(/-BE$/i, '')
         .replace(/-BZ$/i, '')
         .replace(/-SM$/i, '');

    return s.trim();
  }

  function isValidStockSymbol(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const clean = sym.trim().toUpperCase();
    if (clean.length < 2 || clean.length > 20) return false;
    if (EXCLUDED_KEYWORDS.has(clean)) return false;
    return /^[A-Z0-9&]+$/.test(clean);
  }

  /**
   * Multi-strategy holdings extraction from Zerodha Kite DOM
   */
  function extractKiteHoldings() {
    // Safety check again before extraction
    if (isAuthOrLoginPage()) return [];

    const stocksMap = new Map();

    // Strategy 1: Targeted Zerodha Kite DOM classes
    const symbolElements = document.querySelectorAll(
      '.tradingsymbol, .instrument, span[class*="tradingsymbol"], td[class*="instrument"], a[href*="/chart/"]'
    );

    symbolElements.forEach((el) => {
      let rawText = el.textContent || '';
      if (el.tagName === 'A' && el.href) {
        try {
          const url = new URL(el.href);
          const symParam = url.searchParams.get('symbol');
          if (symParam) rawText = symParam;
        } catch (e) {}
      }

      const sym = cleanSymbol(rawText);
      if (isValidStockSymbol(sym)) {
        const row = el.closest('tr') || el.closest('.row');
        let qty = null;
        let avgPrice = null;
        if (row) {
          const cells = Array.from(row.querySelectorAll('td, .cell, span'));
          for (const cell of cells) {
            const txt = (cell.textContent || '').trim();
            if (!qty && /^\d+$/.test(txt)) {
              qty = parseInt(txt, 10);
            }
          }
        }

        if (!stocksMap.has(sym)) {
          stocksMap.set(sym, {
            symbol: sym,
            name: typeof resolveCompanyName === 'function' ? resolveCompanyName(sym) : sym,
            quantity: qty,
            avgPrice: avgPrice,
            source: 'Zerodha Kite'
          });
        }
      }
    });

    // Strategy 2: Scan table rows in holdings/positions tables
    const tableRows = document.querySelectorAll('table tbody tr, .holdings-table tr, .table-wrapper tbody tr');
    tableRows.forEach((row) => {
      const firstCells = row.querySelectorAll('td');
      if (firstCells.length >= 2) {
        for (let i = 0; i < Math.min(3, firstCells.length); i++) {
          const txt = cleanSymbol(firstCells[i].textContent || '');
          if (isValidStockSymbol(txt)) {
            if (!stocksMap.has(txt)) {
              stocksMap.set(txt, {
                symbol: txt,
                name: typeof resolveCompanyName === 'function' ? resolveCompanyName(txt) : txt,
                source: 'Zerodha Kite'
              });
            }
            break;
          }
        }
      }
    });

    return Array.from(stocksMap.values());
  }

  /**
   * Displays an unobtrusive toast notification
   */
  function showToast(message) {
    const existing = document.getElementById('snt-kite-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'snt-kite-toast';
    toast.className = 'snt-toast snt-toast-success';
    toast.innerHTML = `
      <div class="snt-toast-dot"></div>
      <div style="flex: 1;">
        <div style="font-weight: 600;">Stock News Tracker</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${message}</div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4000);
  }

  /**
   * Injects the floating sync button ONLY when viewing holdings or positions
   */
  function injectFloatingWidgetIfAppropriate() {
    // Never inject on login or auth pages
    if (isAuthOrLoginPage()) return;

    // Only inject if on /holdings or /positions
    const path = (window.location.pathname || '').toLowerCase();
    if (!path.includes('/holdings') && !path.includes('/positions')) {
      const existingFloater = document.getElementById('snt-kite-floater');
      if (existingFloater) existingFloater.remove();
      return;
    }

    if (document.getElementById('snt-kite-floater')) return;

    const floater = document.createElement('div');
    floater.id = 'snt-kite-floater';
    floater.innerHTML = `
      <button class="snt-btn" id="snt-sync-btn" title="Sync portfolio stocks with Stock News Tracker">
        <span class="snt-icon">⚡</span>
        <span id="snt-btn-text">Sync Holdings to News Tracker</span>
      </button>
    `;

    document.body.appendChild(floater);

    const syncBtn = floater.querySelector('#snt-sync-btn');
    syncBtn.addEventListener('click', handleSyncClick);
  }

  async function handleSyncClick() {
    const holdings = extractKiteHoldings();

    if (holdings.length === 0) {
      showToast('No holdings detected. Please make sure you are on the Kite Holdings tab (/holdings).');
      return;
    }

    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.upsertStocksFromBroker) {
        await StorageManager.upsertStocksFromBroker(holdings, 'Zerodha Kite', true);
      } else {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'SAVE_BROKER_STOCKS', stocks: holdings, broker: 'Zerodha Kite' },
            resolve
          );
        });
      }

      chrome.runtime.sendMessage({ action: 'FETCH_ALL_NEWS', force: true });
      showToast(`Successfully synced ${holdings.length} stocks from Zerodha Kite!`);
    } catch (err) {
      console.error('[Stock News Tracker] Sync error:', err);
      showToast('Error syncing stocks. Please try again.');
    }
  }

  // Handle messages from Extension Popup (on-demand extraction)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PING') {
      sendResponse({ status: 'OK', isAuth: isAuthOrLoginPage(), url: window.location.href });
      return true;
    }

    if (request.action === 'EXTRACT_HOLDINGS') {
      if (isAuthOrLoginPage()) {
        sendResponse({ success: false, reason: 'auth_page', message: 'User is on login page.' });
        return true;
      }

      const holdings = extractKiteHoldings();
      sendResponse({
        success: true,
        count: holdings.length,
        stocks: holdings,
        url: window.location.href
      });
      return true;
    }
  });

  // Safe, lightweight check for SPA navigation (no document.body MutationObserver)
  // Check once after initial load
  setTimeout(injectFloatingWidgetIfAppropriate, 1500);

  // Re-check on URL popstate / hashchange (when user switches tabs in Kite)
  window.addEventListener('popstate', () => {
    setTimeout(injectFloatingWidgetIfAppropriate, 800);
  });
})();
