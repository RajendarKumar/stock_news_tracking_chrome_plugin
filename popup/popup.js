/**
 * Popup Script for Stock News Tracker
 * Manages news feed rendering, company filtering, broker sync, and portfolio management.
 * 
 * STRICT PRIVACY & CONTROL:
 * - NO automatic background sync on broker.
 * - Sync runs ONLY when user clicks the "Sync Holdings" button.
 * - Extracts ONLY symbols from holdings table.
 * - Allows tracking any custom company (watchlist) independently of broker holdings.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let trackedStocks = [];
  let cachedNewsMap = {};
  let readArticleIds = new Set();
  let bookmarkedArticles = [];
  let activeCategoryFilter = 'ALL'; // 'ALL' | 'HOLDING' | 'WATCHLIST'
  let activeSymbolFilter = 'ALL';
  let searchQuery = '';

  // DOM Elements
  const tabButtons = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const scopeButtons = document.querySelectorAll('.scope-btn');
  const countCatHoldings = document.getElementById('count-cat-holdings');
  const countCatWatchlist = document.getElementById('count-cat-watchlist');
  const pillsContainer = document.getElementById('stock-pills-bar');
  const activeCompanyBanner = document.getElementById('active-company-banner');
  const activeCompanyLabel = document.getElementById('active-company-label');
  const btnClearActiveCompany = document.getElementById('btn-clear-active-company');
  const newsFeedList = document.getElementById('news-feed-list');
  const newsLoadingState = document.getElementById('news-loading-state');
  const newsEmptyState = document.getElementById('news-empty-state');
  const searchInput = document.getElementById('news-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnMarkAllRead = document.getElementById('btn-mark-all-read');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const linkOptions = document.getElementById('link-options');
  const brokerStatusDot = document.getElementById('broker-status-dot');
  const brokerSyncTitle = document.getElementById('broker-sync-title');
  const brokerSyncDesc = document.getElementById('broker-sync-desc');
  const btnSyncBroker = document.getElementById('btn-sync-broker');
  const syncSpinner = document.getElementById('sync-spinner');
  const syncBtnLabel = document.getElementById('sync-btn-label');
  const navNewsBadge = document.getElementById('nav-news-badge');
  const navStocksCount = document.getElementById('nav-stocks-count');
  const portfolioTotalCount = document.getElementById('portfolio-total-count');
  const portfolioStocksList = document.getElementById('portfolio-stocks-list');
  const formAddStock = document.getElementById('form-add-stock');
  const inputAddSymbol = document.getElementById('input-add-symbol');
  const inputAddName = document.getElementById('input-add-name');
  const btnClearHoldings = document.getElementById('btn-clear-holdings');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnClearSample = document.getElementById('btn-clear-sample');
  const bookmarksCount = document.getElementById('bookmarks-count');
  const bookmarksFeedList = document.getElementById('bookmarks-feed-list');
  const bookmarksEmptyState = document.getElementById('bookmarks-empty-state');
  const footerSyncTime = document.getElementById('footer-sync-time');
  const btnEmptySync = document.getElementById('btn-empty-sync');
  const quickChips = document.querySelectorAll('.quick-chip');
  const BROKER_TABS_QUERY = {
    url: ['*://kite.zerodha.com/*', '*://*.angelone.in/*']
  };

  // Keep broker sync available even if loading the rest of the popup fails.
  btnSyncBroker.addEventListener('click', handleBrokerSync);
  btnEmptySync.addEventListener('click', handleBrokerSync);
  checkBrokerTabAvailability();

  // Initial Data Load
  await loadAllData();

  // Navigation Tabs Event
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const activeContent = document.getElementById(targetTab);
      if (activeContent) activeContent.classList.add('active');

      if (targetTab === 'tab-bookmarks') {
        renderBookmarks();
      }
    });
  });

  // Scope Toggle Event (All | Holdings | Watchlist)
  scopeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      scopeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategoryFilter = btn.getAttribute('data-category');
      activeSymbolFilter = 'ALL';
      if (activeCompanyBanner) activeCompanyBanner.style.display = 'none';
      renderStockPills();
      renderNewsFeed();
    });
  });

  if (btnClearActiveCompany) {
    btnClearActiveCompany.addEventListener('click', () => {
      activeSymbolFilter = 'ALL';
      if (activeCompanyBanner) activeCompanyBanner.style.display = 'none';
      updateActivePill();
      renderNewsFeed();
    });
  }

  // Load and cache all extension state
  async function loadAllData() {
    trackedStocks = await StorageManager.getStocks();
    cachedNewsMap = await StorageManager.getCachedNews();
    readArticleIds = await StorageManager.getReadArticleIds();
    bookmarkedArticles = await StorageManager.getBookmarks();
    const lastSync = await StorageManager.getLastSyncInfo();

    updateHeaderAndCounts();
    renderStockPills();
    renderNewsFeed();
    renderPortfolioList();

    if (lastSync && lastSync.timestamp) {
      footerSyncTime.textContent = `Synced: ${formatTime(lastSync.timestamp)}`;
    }

    if (Object.keys(cachedNewsMap).length === 0 && trackedStocks.length > 0) {
      refreshNews(false);
    }
  }

  function isHoldingStock(stock) {
    return stock.source === 'Zerodha Kite' || stock.category === 'holding';
  }

  function updateHeaderAndCounts() {
    navStocksCount.textContent = trackedStocks.length;
    portfolioTotalCount.textContent = trackedStocks.length;
    bookmarksCount.textContent = bookmarkedArticles.length;

    // Scope counts
    const holdingsCount = trackedStocks.filter(isHoldingStock).length;
    const watchlistCount = trackedStocks.filter((s) => !isHoldingStock(s)).length;
    if (countCatHoldings) countCatHoldings.textContent = holdingsCount;
    if (countCatWatchlist) countCatWatchlist.textContent = watchlistCount;

    // Show/hide Clear Holdings button
    if (btnClearHoldings) {
      if (holdingsCount > 0) {
        btnClearHoldings.style.display = 'inline-block';
        btnClearHoldings.textContent = `Clear Holdings (${holdingsCount})`;
      } else {
        btnClearHoldings.style.display = 'none';
      }
    }

    // Show/hide Clear Complete List button
    if (btnClearAll) {
      if (trackedStocks.length > 0) {
        btnClearAll.style.display = 'inline-block';
        btnClearAll.textContent = `🗑️ Clear Complete List (${trackedStocks.length})`;
      } else {
        btnClearAll.style.display = 'none';
      }
    }

    // Check if sample stocks exist
    const hasSample = trackedStocks.some((s) => s.source === 'sample');
    if (btnClearSample) btnClearSample.style.display = hasSample ? 'inline-block' : 'none';

    // Calculate unread count
    let unreadCount = 0;
    for (const sym in cachedNewsMap) {
      for (const item of cachedNewsMap[sym] || []) {
        if (!readArticleIds.has(item.id)) unreadCount++;
      }
    }

    if (unreadCount > 0) {
      navNewsBadge.style.display = 'inline-block';
      navNewsBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    } else {
      navNewsBadge.style.display = 'none';
    }
  }

  function getBrokerForUrl(url) {
    try {
      const host = new URL(url).hostname;
      if (host === 'kite.zerodha.com') return { name: 'Zerodha Kite' };
      if (host === 'angelone.in' || host.endsWith('.angelone.in')) return { name: 'Angel One' };
    } catch (error) {
      return null;
    }
    return null;
  }

  // Show whether either supported broker is already open.
  function checkBrokerTabAvailability() {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      const activeTab = activeTabs && activeTabs[0];
      const activeBroker = activeTab ? getBrokerForUrl(activeTab.url || '') : null;

      chrome.tabs.query(BROKER_TABS_QUERY, (brokerTabs) => {
        const availableTabs = brokerTabs || [];
        const broker = activeBroker ||
          (availableTabs.length === 1 ? getBrokerForUrl(availableTabs[0].url || '') : null);

        if (broker) {
          brokerStatusDot.classList.add('connected');
          brokerSyncTitle.textContent = `${broker.name} Open`;
          brokerSyncDesc.textContent = 'Click to sync holdings on demand';
          syncBtnLabel.textContent = '⚡ Sync Holdings';
        } else {
          brokerStatusDot.classList.remove('connected');
          brokerSyncTitle.textContent = availableTabs.length > 1 ? 'Choose a Broker Tab' : 'Broker Holdings Sync';
          brokerSyncDesc.textContent = availableTabs.length > 1
            ? 'Select broker tab to sync'
            : 'Open Zerodha Kite or Angel One to sync';
          syncBtnLabel.textContent = availableTabs.length > 0 ? '⚡ Sync Holdings' : 'Open Zerodha Kite';
        }
      });
    });
  }

  // Handle manual sync from either supported broker.
  async function handleBrokerSync() {
    syncSpinner.style.display = 'inline-block';
    syncBtnLabel.textContent = 'Checking broker...';
    btnSyncBroker.disabled = true;

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabs = await chrome.tabs.query(BROKER_TABS_QUERY);
      const activeBroker = activeTab && getBrokerForUrl(activeTab.url || '');
      let brokerTab = activeBroker ? activeTab : null;

      if (!brokerTab) {
        const sameWindowTabs = activeTab
          ? tabs.filter((tab) => tab.windowId === activeTab.windowId)
          : [];
        const candidates = sameWindowTabs.length > 0 ? sameWindowTabs : tabs;
        const activeBrokerTabs = candidates.filter((tab) => tab.active);

        if (activeBrokerTabs.length === 1) {
          brokerTab = activeBrokerTabs[0];
        } else if (candidates.length === 1) {
          brokerTab = candidates[0];
        } else if (candidates.length > 1) {
          throw new Error('More than one broker tab is open. Switch to the Angel One or Zerodha tab you want to sync, then click Sync Holdings.');
        }
      }

      if (!brokerTab) {
        syncSpinner.style.display = 'none';
        syncBtnLabel.textContent = 'Open Zerodha Kite';
        btnSyncBroker.disabled = false;
        await chrome.tabs.create({ url: 'https://kite.zerodha.com/holdings' });
        window.close();
        return;
      }

      const broker = getBrokerForUrl(brokerTab.url || '');
      const tabUrl = (brokerTab.url || '').toLowerCase();
      if (!broker) {
        throw new Error('The active tab is not a supported broker page.');
      }

      if (/(^|\/)(login|signin|auth|twofa|otp)(\/|$)/.test(new URL(tabUrl).pathname) ||
          tabUrl === 'https://kite.zerodha.com/') {
        alert(`You are on the ${broker.name} login screen. Log in and open your Holdings or Positions page, then sync again.`);
        return;
      }

      syncBtnLabel.textContent = `Reading ${broker.name}...`;
      const results = await chrome.scripting.executeScript({
        target: { tabId: brokerTab.id },
        args: [broker.name],
        func: (brokerName) => {
          const route = `${window.location.pathname}${window.location.hash}`.toLowerCase();
          const authRoute = /login|signin|auth|twofa|otp|forgot|reset/.test(route);
          const hasCredentialInput = document.querySelector(
            'input[type="password"], input[type="tel"], input[autocomplete="username"], ' +
            'input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], ' +
            'input[name*="mobile" i], input[id*="mobile" i]'
          );
          if (authRoute || hasCredentialInput) return { success: false, reason: 'auth' };

          const portfolioHeading = Array.from(
            document.querySelectorAll('h1, h2, h3, [role="tab"][aria-selected="true"], button[aria-selected="true"]')
          ).some((element) => /holding|position/.test((element.textContent || '').toLowerCase()));
          if (!/holding|position|portfolio/.test(route) && !portfolioHeading) {
            return { success: false, reason: 'not_portfolio' };
          }

          const excluded = new Set([
            'INSTRUMENT', 'SYMBOL', 'SCRIP', 'STOCK', 'QTY', 'QUANTITY', 'AVG',
            'AVERAGE', 'LTP', 'PRICE', 'VALUE', 'P&L', 'PNL', 'CHANGE', 'HOLDINGS',
            'POSITIONS', 'PORTFOLIO', 'TOTAL', 'ACTIONS', 'BUY', 'SELL', 'NSE', 'BSE'
          ]);
          const symbols = new Set();
          const cleanSymbol = (value) => {
            let symbol = (value || '').trim().toUpperCase();
            if (symbol.includes(':')) symbol = symbol.split(':').pop();
            return symbol.replace(/-(EQ|BE|BZ|SM|BL|IL)$/i, '').trim();
          };
          const addSymbol = (value) => {
            const symbol = cleanSymbol(value);
            if (
              symbol.length >= 2 &&
              symbol.length <= 20 &&
              /[A-Z]/.test(symbol) &&
              !excluded.has(symbol) &&
              /^[A-Z0-9&]+$/.test(symbol)
            ) {
              symbols.add(symbol);
            }
          };

          const rowSelector = 'table tbody tr, [role="row"], .ag-row, .cdk-row, .mat-row, .mat-mdc-row';
          document.querySelectorAll(rowSelector).forEach((row) => {
            if (row.getClientRects().length === 0) return;

            const container = row.closest(
              'table, [role="grid"], [role="table"], .ag-root, .mat-table, .mat-mdc-table'
            );
            if (!container) return;

            const headers = Array.from(container.querySelectorAll(
              'thead th, [role="columnheader"], .ag-header-cell, .mat-header-cell, .mat-mdc-header-cell'
            )).map((header) => (header.textContent || '').trim().toLowerCase());
            const semanticAncestors = [];
            let ancestor = container;
            while (ancestor && ancestor !== document.body) {
              const label = [
                ancestor.getAttribute('aria-label') || '',
                ancestor.id || '',
                typeof ancestor.className === 'string' ? ancestor.className : ''
              ].join(' ').toLowerCase();
              if (label) semanticAncestors.push(label);

              const heading = ancestor.querySelector('h1, h2, h3, [role="heading"]');
              if (heading) semanticAncestors.push((heading.textContent || '').toLowerCase());
              ancestor = ancestor.parentElement;
            }

            const context = semanticAncestors.join(' ');
            if (/watch[\s_-]*list|market[\s_-]*watch|favourites|favorites/.test(context)) return;

            const hasInstrumentHeader = headers.some((header) => /symbol|scrip|instrument|stock/.test(header));
            const holdingColumnCount = headers.filter((header) =>
              /qty|quantity|average|avg|invested|holding value|current value|p&l|pnl/.test(header)
            ).length;
            const hasPortfolioContext = /holding|position|portfolio/.test(context);
            if (!hasPortfolioContext && !(hasInstrumentHeader && holdingColumnCount >= 2)) return;

            const cells = Array.from(row.querySelectorAll(
              'td, [role="gridcell"], .ag-cell, .cdk-cell, .mat-cell, .mat-mdc-cell'
            ));
            if (cells.length < 2) return;

            const symbolColumn = headers.findIndex((header) => /symbol|scrip|instrument|stock/.test(header));
            const symbolCellIndex = symbolColumn >= 0 ? symbolColumn : 0;
            if (symbolCellIndex >= cells.length) return;
            addSymbol(cells[symbolCellIndex].textContent || '');

            cells[symbolCellIndex].querySelectorAll(
              '.tradingsymbol, .instrument, [class*="scrip-name"], [class*="symbol-name"]'
            ).forEach((element) => {
              if (element.getClientRects().length > 0) addSymbol(element.textContent || '');
            });
          });

          return {
            success: true,
            symbols: Array.from(symbols),
            broker: brokerName,
            url: window.location.href
          };
        }
      });

      const result = results && results[0] ? results[0].result : null;
      if (!result || !result.success) {
        if (result && result.reason === 'auth') {
          alert(`The ${broker.name} login/authentication page was detected. No holdings were read.`);
        } else {
          alert(`Could not read holdings. Open the ${broker.name} Holdings or Positions page and try again.`);
        }
        return;
      }
      if (result.symbols.length === 0) {
        alert(`No stock symbols were found on this ${broker.name} page. Make sure the Holdings or Positions table is visible and loaded.`);
        return;
      }

      const extractedStocks = result.symbols.map((symbol) => ({
        symbol,
        name: typeof resolveCompanyName === 'function' ? resolveCompanyName(symbol) : symbol,
        source: broker.name,
        category: 'holding'
      }));
      await processExtractedHoldings(extractedStocks, broker.name);
    } catch (e) {
      console.error(e);
      alert('Error connecting to broker tab: ' + e.message);
    } finally {
      syncSpinner.style.display = 'none';
      btnSyncBroker.disabled = false;
      if (syncBtnLabel.textContent.startsWith('Checking') || syncBtnLabel.textContent.startsWith('Reading')) {
        syncBtnLabel.textContent = '⚡ Sync Holdings';
      }
    }
  }

  async function processExtractedHoldings(stocks, brokerName) {
    await StorageManager.upsertStocksFromBroker(stocks, brokerName);
    await loadAllData();
    syncBtnLabel.textContent = `✓ Synced ${stocks.length} Holdings`;
    setTimeout(() => {
      syncBtnLabel.textContent = '⚡ Sync Holdings';
    }, 3000);
    refreshNews(true);
  }

  // Stock & Company Filter Pills
  function renderStockPills() {
    pillsContainer.innerHTML = '';

    // Filter stocks by active category (All | Holdings | Watchlist)
    let eligibleStocks = trackedStocks;
    if (activeCategoryFilter === 'HOLDING') {
      eligibleStocks = trackedStocks.filter(isHoldingStock);
    } else if (activeCategoryFilter === 'WATCHLIST') {
      eligibleStocks = trackedStocks.filter((s) => !isHoldingStock(s));
    }

    // If total tracked stocks is empty
    if (trackedStocks.length === 0) {
      pillsContainer.innerHTML = `
        <div class="empty-pills-hint">
          <span>No companies tracked yet.</span>
          <button class="mini-btn-sync" id="hint-btn-sync">⚡ Sync Broker Holdings</button>
          <button class="mini-btn-sync" id="hint-btn-add" style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); margin-left: 6px;">+ Track Company</button>
        </div>
      `;
      const hintBtn = document.getElementById('hint-btn-sync');
      if (hintBtn) hintBtn.addEventListener('click', handleBrokerSync);
      const hintAdd = document.getElementById('hint-btn-add');
      if (hintAdd) {
        hintAdd.addEventListener('click', () => {
          const compTabBtn = document.querySelector('[data-tab="tab-portfolio"]');
          if (compTabBtn) compTabBtn.click();
          setTimeout(() => {
            const symInput = document.getElementById('input-add-symbol');
            if (symInput) symInput.focus();
          }, 100);
        });
      }
      return;
    }

    // If user clicked Holdings but has not synced any yet:
    if (eligibleStocks.length === 0 && activeCategoryFilter === 'HOLDING') {
      pillsContainer.innerHTML = `
        <div class="empty-pills-hint">
          <span>No holdings synced yet.</span>
          <button class="mini-btn-sync" id="hint-btn-sync">⚡ Sync Broker Holdings</button>
        </div>
      `;
      const hintBtn = document.getElementById('hint-btn-sync');
      if (hintBtn) hintBtn.addEventListener('click', handleBrokerSync);
      return;
    }

    // If user clicked Watchlist but has not added any custom stocks yet:
    if (eligibleStocks.length === 0 && activeCategoryFilter === 'WATCHLIST') {
      pillsContainer.innerHTML = `
        <div class="empty-pills-hint">
          <span>No custom watchlist companies tracked.</span>
          <button class="mini-btn-sync" id="hint-btn-add-wl">+ Track Company</button>
        </div>
      `;
      const hintAdd = document.getElementById('hint-btn-add-wl');
      if (hintAdd) {
        hintAdd.addEventListener('click', () => {
          const compTabBtn = document.querySelector('[data-tab="tab-portfolio"]');
          if (compTabBtn) compTabBtn.click();
          setTimeout(() => {
            const symInput = document.getElementById('input-add-symbol');
            if (symInput) symInput.focus();
          }, 100);
        });
      }
      return;
    }

    // 1. "All" pill
    const allPill = document.createElement('button');
    allPill.className = `pill ${activeSymbolFilter === 'ALL' ? 'active' : ''}`;
    allPill.setAttribute('data-symbol', 'ALL');

    let totalArticles = 0;
    for (const s of eligibleStocks) {
      totalArticles += (cachedNewsMap[s.symbol] || []).length;
    }
    allPill.innerHTML = `<span>All</span><span class="pill-count">${totalArticles}</span>`;
    allPill.addEventListener('click', () => {
      activeSymbolFilter = 'ALL';
      if (activeCompanyBanner) activeCompanyBanner.style.display = 'none';
      updateActivePill();
      renderNewsFeed();
    });
    pillsContainer.appendChild(allPill);

    // 2. Individual Company Pills
    eligibleStocks.forEach((stock) => {
      const count = (cachedNewsMap[stock.symbol] || []).length;
      const isHolding = isHoldingStock(stock);
      const pill = document.createElement('button');
      pill.className = `pill company-pill ${activeSymbolFilter === stock.symbol ? 'active' : ''}`;
      pill.setAttribute('data-symbol', stock.symbol);
      pill.setAttribute('title', `${stock.name || stock.symbol} (${isHolding ? 'Holding' : 'Watchlist'}) - Click for news`);
      pill.innerHTML = `<span>${escapeHtml(stock.symbol)}</span><span class="pill-count">${count}</span>`;

      pill.addEventListener('click', () => {
        activeSymbolFilter = stock.symbol;
        if (activeCompanyBanner && activeCompanyLabel) {
          activeCompanyBanner.style.display = 'flex';
          activeCompanyLabel.textContent = `${stock.name || stock.symbol} (${stock.symbol})`;
        }
        updateActivePill();
        renderNewsFeed();
      });
      pillsContainer.appendChild(pill);
    });

    // 3. "+ Track Company" pill at the end of the scrollbar
    const addPill = document.createElement('button');
    addPill.className = 'pill pill-add';
    addPill.innerHTML = '+ Track Company';
    addPill.setAttribute('title', 'Add any new company to track');
    addPill.addEventListener('click', () => {
      const compTabBtn = document.querySelector('[data-tab="tab-portfolio"]');
      if (compTabBtn) compTabBtn.click();
      setTimeout(() => {
        const symInput = document.getElementById('input-add-symbol');
        if (symInput) symInput.focus();
      }, 100);
    });
    pillsContainer.appendChild(addPill);
  }

  function updateActivePill() {
    const pills = pillsContainer.querySelectorAll('.pill');
    pills.forEach((p) => {
      if (p.getAttribute('data-symbol') === activeSymbolFilter) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  // Render News Feed
  function renderNewsFeed() {
    newsFeedList.innerHTML = '';

    // Determine eligible stocks
    let eligibleStocks = trackedStocks;
    if (activeCategoryFilter === 'HOLDING') {
      eligibleStocks = trackedStocks.filter(isHoldingStock);
    } else if (activeCategoryFilter === 'WATCHLIST') {
      eligibleStocks = trackedStocks.filter((s) => !isHoldingStock(s));
    }

    const eligibleSymbols = new Set(eligibleStocks.map((s) => s.symbol));

    // Collect all articles
    let articles = [];
    if (activeSymbolFilter === 'ALL') {
      for (const sym of eligibleSymbols) {
        articles.push(...(cachedNewsMap[sym] || []));
      }
      articles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else {
      if (eligibleSymbols.has(activeSymbolFilter)) {
        articles = [...(cachedNewsMap[activeSymbolFilter] || [])];
      }
    }

    // Apply search filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q) ||
          (a.snippet && a.snippet.toLowerCase().includes(q)) ||
          (a.source && a.source.toLowerCase().includes(q))
      );
    }

    if (articles.length === 0) {
      newsEmptyState.style.display = 'flex';
      newsFeedList.style.display = 'none';
      return;
    }

    newsEmptyState.style.display = 'none';
    newsFeedList.style.display = 'flex';

    articles.forEach((item) => {
      const card = createNewsCard(item);
      newsFeedList.appendChild(card);
    });
  }

  // Creates a clean, rich news card element
  function createNewsCard(item) {
    const isUnread = !readArticleIds.has(item.id);
    const isBookmarked = bookmarkedArticles.some((b) => b.id === item.id);

    const card = document.createElement('article');
    card.className = `news-card ${isUnread ? 'unread' : ''}`;
    card.setAttribute('data-id', item.id);

    card.innerHTML = `
      <div class="card-top">
        <div class="card-meta">
          <span class="ticker-tag" data-symbol="${item.symbol}">${item.symbol}</span>
          <span class="source-label" title="${escapeHtml(item.source)}">${escapeHtml(item.source)}</span>
        </div>
        <span class="time-label">${escapeHtml(item.relativeTime || '')}</span>
      </div>
      <a href="${escapeHtml(item.link)}" target="_blank" class="card-title">${escapeHtml(item.title)}</a>
      ${item.snippet ? `<p class="card-snippet">${escapeHtml(item.snippet)}</p>` : ''}
      <div class="card-footer">
        <div class="card-footer-actions">
          <button class="action-icon-btn ${isBookmarked ? 'active' : ''}" data-action="bookmark" title="${isBookmarked ? 'Remove bookmark' : 'Save article'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          <button class="action-icon-btn" data-action="mark-read" title="${isUnread ? 'Mark as read' : 'Marked as read'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
        <a href="${escapeHtml(item.link)}" target="_blank" class="action-icon-btn" title="Open article in new tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    `;

    // Clicking ticker tag on the card also filters by that company!
    const tickerTag = card.querySelector('.ticker-tag');
    if (tickerTag) {
      tickerTag.style.cursor = 'pointer';
      tickerTag.addEventListener('click', (e) => {
        e.stopPropagation();
        activeSymbolFilter = item.symbol;
        if (activeCompanyBanner && activeCompanyLabel) {
          activeCompanyBanner.style.display = 'flex';
          activeCompanyLabel.textContent = `${item.symbol}`;
        }
        updateActivePill();
        renderNewsFeed();
      });
    }

    const titleLink = card.querySelector('.card-title');
    titleLink.addEventListener('click', async () => {
      await markRead(item.id, card);
    });

    const btnBookmark = card.querySelector('[data-action="bookmark"]');
    btnBookmark.addEventListener('click', async (e) => {
      e.stopPropagation();
      await StorageManager.toggleBookmark(item);
      bookmarkedArticles = await StorageManager.getBookmarks();
      updateHeaderAndCounts();
      renderNewsFeed();
    });

    const btnMarkRead = card.querySelector('[data-action="mark-read"]');
    btnMarkRead.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markRead(item.id, card);
    });

    return card;
  }

  async function markRead(articleId, cardEl) {
    if (!readArticleIds.has(articleId)) {
      readArticleIds.add(articleId);
      await StorageManager.markArticleAsRead(articleId);
      if (cardEl) cardEl.classList.remove('unread');
      updateHeaderAndCounts();
      chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
    }
  }

  // Bookmarks View
  function renderBookmarks() {
    bookmarksFeedList.innerHTML = '';
    if (bookmarkedArticles.length === 0) {
      bookmarksEmptyState.style.display = 'flex';
      bookmarksFeedList.style.display = 'none';
      return;
    }

    bookmarksEmptyState.style.display = 'none';
    bookmarksFeedList.style.display = 'flex';

    bookmarkedArticles.forEach((item) => {
      const card = createNewsCard(item);
      bookmarksFeedList.appendChild(card);
    });
  }

  // Portfolio Management View
  function renderPortfolioList() {
    portfolioStocksList.innerHTML = '';

    if (trackedStocks.length === 0) {
      portfolioStocksList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-secondary);">
          No companies tracked yet. Track any company above or sync holdings from a supported broker.
        </div>
      `;
      return;
    }

    trackedStocks.forEach((stock) => {
      const newsCount = (cachedNewsMap[stock.symbol] || []).length;
      const isHolding = isHoldingStock(stock);
      const tagClass = isHolding ? 'tag-holding' : 'tag-watchlist';
      const tagLabel = isHolding ? '🏢 Holding' : '⭐ Watchlist';

      const item = document.createElement('div');
      item.className = 'stock-item';
      item.innerHTML = `
        <div class="stock-left">
          <div>
            <div class="stock-symbol">${escapeHtml(stock.symbol)}</div>
            <div class="stock-name" title="${escapeHtml(stock.name || stock.symbol)}">${escapeHtml(stock.name || stock.symbol)}</div>
          </div>
        </div>
        <div class="stock-right">
          <span class="stock-source-badge ${tagClass}">${tagLabel}</span>
          <span style="font-size: 11px; color: var(--text-muted);">${newsCount} news</span>
          <button class="delete-stock-btn" data-symbol="${escapeHtml(stock.symbol)}" title="Remove company">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      const deleteBtn = item.querySelector('.delete-stock-btn');
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Remove ${stock.symbol} from your tracked companies?`)) {
          await StorageManager.removeStock(stock.symbol);
          await loadAllData();
        }
      });

      portfolioStocksList.appendChild(item);
    });
  }

  // Auto-fill company name when typing symbol in Add Stock form
  inputAddSymbol.addEventListener('input', () => {
    const sym = cleanStockSymbol(inputAddSymbol.value);
    if (sym && POPULAR_STOCKS_MAP[sym]) {
      inputAddName.value = POPULAR_STOCKS_MAP[sym];
    }
  });

  // Quick Add suggestions chips
  quickChips.forEach((chip) => {
    chip.addEventListener('click', async () => {
      const sym = chip.getAttribute('data-sym');
      if (!sym) return;
      const name = POPULAR_STOCKS_MAP[sym] || sym;
      await trackNewCompany(sym, name);
    });
  });

  // Track Company form submission
  formAddStock.addEventListener('submit', async (e) => {
    e.preventDefault();
    const symbol = cleanStockSymbol(inputAddSymbol.value);
    const name = inputAddName.value.trim();
    if (!symbol) return;

    await trackNewCompany(symbol, name);
    inputAddSymbol.value = '';
    inputAddName.value = '';
  });

  async function trackNewCompany(symbol, name) {
    const newStock = await StorageManager.addStock(symbol, name, 'watchlist');
    await loadAllData();

    // Fetch news specifically for new company
    chrome.runtime.sendMessage({ action: 'FETCH_STOCK_NEWS', symbol, name: newStock.name }, async (res) => {
      if (res && res.articles) {
        cachedNewsMap[symbol] = res.articles;
        await StorageManager.saveCachedNews(cachedNewsMap);
        await loadAllData();
      }
    });
  }

  // Clear Synced Holdings with confirmation
  if (btnClearHoldings) {
    btnClearHoldings.addEventListener('click', async () => {
      const holdingsCount = trackedStocks.filter(isHoldingStock).length;
      if (holdingsCount === 0) {
        alert('No synced holdings to clear.');
        return;
      }

      const confirmed = confirm(
        `Are you sure you want to clear your holdings list (${holdingsCount} stocks)?\n\nThis will remove all companies imported from supported brokers. Any custom watchlist companies will be preserved.`
      );

      if (confirmed) {
        await StorageManager.clearHoldings();
        activeSymbolFilter = 'ALL';
        if (activeCompanyBanner) activeCompanyBanner.style.display = 'none';
        await loadAllData();
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
        alert(`✓ Successfully cleared ${holdingsCount} holdings.`);
      }
    });
  }

  // Clear Complete List of all companies with confirmation
  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
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
        activeSymbolFilter = 'ALL';
        if (activeCompanyBanner) activeCompanyBanner.style.display = 'none';
        await loadAllData();
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
        alert(`✓ Complete list cleared successfully (${totalCount} companies removed).`);
      }
    });
  }

  // Remove initial sample stocks
  if (btnClearSample) {
    btnClearSample.addEventListener('click', async () => {
      const nonSample = trackedStocks.filter((s) => s.source !== 'sample');
      await StorageManager.saveStocks(nonSample);
      await loadAllData();
    });
  }

  // Search input handling
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    renderNewsFeed();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderNewsFeed();
  });

  // Refresh feeds
  btnRefresh.addEventListener('click', () => refreshNews(true));

  async function refreshNews(showSpinner = true) {
    if (showSpinner) {
      btnRefresh.classList.add('spinning');
      newsLoadingState.style.display = 'flex';
      newsFeedList.style.display = 'none';
      newsEmptyState.style.display = 'none';
    }

    chrome.runtime.sendMessage({ action: 'FETCH_ALL_NEWS' }, async (response) => {
      btnRefresh.classList.remove('spinning');
      newsLoadingState.style.display = 'none';

      if (response && response.news) {
        cachedNewsMap = response.news;
      } else {
        cachedNewsMap = await StorageManager.getCachedNews();
      }

      await loadAllData();
    });
  }

  // Mark all as read
  btnMarkAllRead.addEventListener('click', async () => {
    await StorageManager.markAllArticlesAsRead();
    readArticleIds = await StorageManager.getReadArticleIds();
    updateHeaderAndCounts();
    renderNewsFeed();
    chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });
  });

  // Open Options page
  btnOpenOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
  linkOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, (m) => map[m]);
  }

  function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
});
