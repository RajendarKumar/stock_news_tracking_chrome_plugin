/**
 * Unified Chrome Extension Storage Manager
 * Handles local storage for settings, portfolio stocks, cached news, and read states.
 */

const DEFAULT_SETTINGS = {
  refreshInterval: 30, // in minutes
  notificationsEnabled: true,
  soundEnabled: false,
  region: 'IN', // 'IN' or 'US' or 'GLOBAL'
  maxArticlesPerStock: 10,
  brokerAutoDetect: true
};

const INITIAL_SAMPLE_STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', source: 'watchlist', category: 'watchlist', addedAt: Date.now() },
  { symbol: 'TCS', name: 'Tata Consultancy Services', source: 'watchlist', category: 'watchlist', addedAt: Date.now() },
  { symbol: 'INFY', name: 'Infosys', source: 'watchlist', category: 'watchlist', addedAt: Date.now() },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', source: 'watchlist', category: 'watchlist', addedAt: Date.now() },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', source: 'watchlist', category: 'watchlist', addedAt: Date.now() }
];

const StorageManager = {
  // --- Settings ---
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        resolve({ ...DEFAULT_SETTINGS, ...(result.settings || {}) });
      });
    });
  },

  async saveSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings: updated }, () => resolve(updated));
    });
  },

  // --- Tracked Stocks ---
  async getStocks() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['stocks', 'hasInitialized'], (result) => {
        if (!result.hasInitialized) {
          // Only populate starter stocks on initial first run
          chrome.storage.local.set({ stocks: INITIAL_SAMPLE_STOCKS, hasInitialized: true }, () => {
            resolve(INITIAL_SAMPLE_STOCKS);
          });
        } else {
          resolve(result.stocks || []);
        }
      });
    });
  },

  async saveStocks(stocks) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ stocks: stocks || [], hasInitialized: true }, () => resolve(stocks || []));
    });
  },

  async addStock(symbol, name = '', source = 'watchlist') {
    const cleanSym = (typeof cleanStockSymbol === 'function' ? cleanStockSymbol(symbol) : symbol).toUpperCase().trim();
    if (!cleanSym) return null;

    const resolvedName = (typeof resolveCompanyName === 'function' ? resolveCompanyName(cleanSym, name) : name) || cleanSym;
    let stocks = await this.getStocks();

    // If user only had default sample stocks, clear them on first custom addition
    if (stocks.length > 0 && stocks.every(s => s.source === 'sample')) {
      stocks = [];
    }

    const existingIndex = stocks.findIndex(s => s.symbol === cleanSym);
    const newStock = {
      symbol: cleanSym,
      name: resolvedName,
      category: source === 'Zerodha Kite' ? 'holding' : 'watchlist',
      source: source,
      addedAt: Date.now(),
      lastSynced: Date.now()
    };

    if (existingIndex >= 0) {
      stocks[existingIndex] = { ...stocks[existingIndex], ...newStock };
    } else {
      stocks.push(newStock);
    }

    await this.saveStocks(stocks);
    return newStock;
  },

  async removeStock(symbol) {
    const cleanSym = symbol.toUpperCase().trim();
    let stocks = await this.getStocks();
    stocks = stocks.filter(s => s.symbol !== cleanSym);
    await this.saveStocks(stocks);

    // Also remove from cached news
    const news = await this.getCachedNews();
    delete news[cleanSym];
    await this.saveCachedNews(news);
    return stocks;
  },

  /**
   * One-click clear for all stocks synced from broker holdings.
   * Keeps user's custom watchlist companies intact.
   */
  async clearHoldings() {
    let stocks = await this.getStocks();
    const holdings = stocks.filter(s => s.source === 'Zerodha Kite' || s.category === 'holding');
    // Retain custom watchlist companies
    const remaining = stocks.filter(s => s.source !== 'Zerodha Kite' && s.category !== 'holding');
    await this.saveStocks(remaining);

    // Clean cached news for removed holdings
    const news = await this.getCachedNews();
    for (const h of holdings) {
      delete news[h.symbol];
    }
    await this.saveCachedNews(news);
    await this.saveLastSyncInfo(null);
    return remaining;
  },

  /**
   * Clears all tracked companies (complete list).
   */
  async clearCompleteList() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ stocks: [], cachedNews: {}, hasInitialized: true, lastSyncInfo: null }, () => {
        resolve([]);
      });
    });
  },

  async clearAllTrackedCompanies() {
    return this.clearCompleteList();
  },

  /**
   * Updates stocks imported from Zerodha Kite holdings.
   * STRICTLY preserves all other companies the user added (watchlist/research stocks).
   */
  async upsertStocksFromBroker(extractedStocks, brokerName = 'Zerodha Kite') {
    let currentStocks = await this.getStocks();

    // Keep all custom companies other than broker holdings
    const customTracked = currentStocks.filter(s => s.source !== brokerName && s.source !== 'sample');

    const map = new Map();
    // Retain custom companies
    for (const s of customTracked) {
      map.set(s.symbol, s);
    }

    const now = Date.now();
    for (const item of extractedStocks) {
      const cleanSym = (typeof cleanStockSymbol === 'function' ? cleanStockSymbol(item.symbol) : item.symbol).toUpperCase().trim();
      if (!cleanSym) continue;

      const compName = (typeof resolveCompanyName === 'function' ? resolveCompanyName(cleanSym, item.name) : item.name) || cleanSym;

      map.set(cleanSym, {
        symbol: cleanSym,
        name: compName,
        category: 'holding',
        quantity: item.quantity !== undefined ? item.quantity : (map.get(cleanSym)?.quantity || null),
        avgPrice: item.avgPrice !== undefined ? item.avgPrice : (map.get(cleanSym)?.avgPrice || null),
        source: brokerName,
        addedAt: map.get(cleanSym)?.addedAt || now,
        lastSynced: now
      });
    }

    const updated = Array.from(map.values());
    await this.saveStocks(updated);
    await this.saveLastSyncInfo({
      timestamp: now,
      broker: brokerName,
      count: extractedStocks.length
    });

    return updated;
  },

  // --- News Cache ---
  async getCachedNews() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['cachedNews'], (result) => {
        resolve(result.cachedNews || {});
      });
    });
  },

  async saveCachedNews(newsMap) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ cachedNews: newsMap }, () => resolve(newsMap));
    });
  },

  // --- Read Articles & Bookmarks ---
  async getReadArticleIds() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['readArticleIds'], (result) => {
        resolve(new Set(result.readArticleIds || []));
      });
    });
  },

  async markArticleAsRead(articleId) {
    const readSet = await this.getReadArticleIds();
    readSet.add(articleId);
    return new Promise((resolve) => {
      chrome.storage.local.set({ readArticleIds: Array.from(readSet) }, () => resolve());
    });
  },

  async markAllArticlesAsRead() {
    const newsMap = await this.getCachedNews();
    const readSet = new Set();
    for (const symbol in newsMap) {
      for (const item of (newsMap[symbol] || [])) {
        if (item.id) readSet.add(item.id);
      }
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ readArticleIds: Array.from(readSet) }, () => resolve());
    });
  },

  async getBookmarks() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['bookmarkedArticles'], (result) => {
        resolve(result.bookmarkedArticles || []);
      });
    });
  },

  async toggleBookmark(article) {
    const bookmarks = await this.getBookmarks();
    const index = bookmarks.findIndex(b => b.id === article.id);
    if (index >= 0) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.unshift(article);
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ bookmarkedArticles: bookmarks }, () => resolve(bookmarks));
    });
  },

  // --- Sync State ---
  async getLastSyncInfo() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastSyncInfo'], (result) => {
        resolve(result.lastSyncInfo || null);
      });
    });
  },

  async saveLastSyncInfo(info) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ lastSyncInfo: info }, () => resolve(info));
    });
  },

  async clearAllData() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.StorageManager = StorageManager;
  globalThis.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_SETTINGS,
    StorageManager
  };
}
