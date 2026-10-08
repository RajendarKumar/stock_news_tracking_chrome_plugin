/**
 * Background Service Worker (Manifest V3)
 * Handles background news polling, Chrome alarms, desktop notifications, and badge updates.
 */

try {
  importScripts('../shared/stock-lookup.js', '../shared/storage.js', 'rss-parser.js');
} catch (e) {
  console.error('[Stock News Tracker] Error importing scripts in service worker:', e);
}

const ALARM_NAME = 'FETCH_NEWS_ALARM';

// Initialize extension on install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Stock News Tracker] Extension installed/updated:', details.reason);

  const settings = await StorageManager.getSettings();
  setupAlarm(settings.refreshInterval);

  // Perform initial news fetch
  await fetchAllNews(false);
});

// Alarm listener for periodic background checks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Stock News Tracker] Alarm triggered: fetching latest news');
    await fetchAllNews(true); // check for notifications
  }
});

// Configure periodic alarm
function setupAlarm(intervalMinutes) {
  chrome.alarms.clear(ALARM_NAME, () => {
    const period = Math.max(5, intervalMinutes || 30);
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: period
    });
    console.log(`[Stock News Tracker] Alarm scheduled every ${period} minutes`);
  });
}

/**
 * Fetches news for all tracked portfolio stocks
 */
async function fetchAllNews(triggerNotifications = false) {
  try {
    const stocks = await StorageManager.getStocks();
    const settings = await StorageManager.getSettings();
    const cachedNews = await StorageManager.getCachedNews();
    const readSet = await StorageManager.getReadArticleIds();

    // Get list of previously notified article IDs from storage
    const notifiedIds = await new Promise((resolve) => {
      chrome.storage.local.get(['notifiedArticleIds'], (res) => {
        resolve(new Set(res.notifiedArticleIds || []));
      });
    });

    const updatedNewsMap = { ...cachedNews };
    const newlyDiscoveredArticles = [];

    // Fetch news for each stock in parallel (in batches of 5 to avoid throttling)
    const BATCH_SIZE = 5;
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const batch = stocks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (stock) => {
          try {
            const feedUrl = buildNewsFeedUrl(stock.symbol, stock.name, settings.region);
            const response = await fetch(feedUrl, { cache: 'no-cache' });
            if (!response.ok) return;

            const xmlText = await response.text();
            const articles = parseRssFeed(xmlText, stock.symbol);
            const maxCount = settings.maxArticlesPerStock || 10;
            const topArticles = articles.slice(0, maxCount);

            updatedNewsMap[stock.symbol] = topArticles;

            // Check for new articles
            for (const item of topArticles) {
              if (!notifiedIds.has(item.id) && !readSet.has(item.id)) {
                newlyDiscoveredArticles.push({ stock, article: item });
              }
            }
          } catch (err) {
            console.error(`[Stock News Tracker] Error fetching news for ${stock.symbol}:`, err);
          }
        })
      );
    }

    // Save updated news cache
    await StorageManager.saveCachedNews(updatedNewsMap);

    // Update unread badge counter
    await updateBadge(updatedNewsMap, readSet);

    // Trigger desktop notifications if enabled
    if (triggerNotifications && settings.notificationsEnabled && newlyDiscoveredArticles.length > 0) {
      notifyUserAboutNewArticles(newlyDiscoveredArticles, notifiedIds);
    }

    return updatedNewsMap;
  } catch (error) {
    console.error('[Stock News Tracker] Error in fetchAllNews:', error);
    return null;
  }
}

/**
 * Updates extension action badge with unread count
 */
async function updateBadge(newsMap, readSet) {
  let unreadCount = 0;
  for (const sym in newsMap) {
    const list = newsMap[sym] || [];
    for (const art of list) {
      if (!readSet.has(art.id)) {
        unreadCount++;
      }
    }
  }

  const badgeText = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : '';
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: '#2563EB' }); // Professional royal blue
}

/**
 * Triggers desktop notification for fresh high-priority news
 */
async function notifyUserAboutNewArticles(newItems, notifiedIds) {
  // Sort by newest timestamp
  newItems.sort((a, b) => (b.article.timestamp || 0) - (a.article.timestamp || 0));

  // Limit notifications per batch to avoid spamming the user
  const toNotify = newItems.slice(0, 3);

  for (const { stock, article } of toNotify) {
    notifiedIds.add(article.id);
    const notificationId = `news-${encodeURIComponent(article.link || article.id)}`;

    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: `[${stock.symbol}] ${article.title}`,
      message: `${article.source} • ${article.snippet ? article.snippet.slice(0, 100) : 'Tap to read article'}`,
      priority: 2
    });
  }

  // Update notified IDs in storage
  chrome.storage.local.set({ notifiedArticleIds: Array.from(notifiedIds).slice(-200) });
}

// Open article when user clicks desktop notification
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('news-')) {
    const rawUrl = notificationId.replace('news-', '');
    try {
      const targetUrl = decodeURIComponent(rawUrl);
      chrome.tabs.create({ url: targetUrl });
    } catch (e) {
      console.error('[Stock News Tracker] Failed to open notification URL:', e);
    }
  }
});

// Runtime message listener for communication with popup & content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_ALL_NEWS') {
    fetchAllNews(false).then((result) => sendResponse({ success: true, news: result }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'FETCH_STOCK_NEWS') {
    (async () => {
      const settings = await StorageManager.getSettings();
      const feedUrl = buildNewsFeedUrl(request.symbol, request.name, settings.region);
      const res = await fetch(feedUrl);
      const xml = await res.text();
      const articles = parseRssFeed(xml, request.symbol);
      sendResponse({ success: true, articles });
    })();
    return true;
  }

  if (request.action === 'SAVE_BROKER_STOCKS') {
    (async () => {
      const updated = await StorageManager.upsertStocksFromBroker(request.stocks, request.broker || 'Zerodha Kite', true);
      // Immediately trigger fresh news fetch for these stocks
      await fetchAllNews(false);
      sendResponse({ success: true, count: updated.length, stocks: updated });
    })();
    return true;
  }

  if (request.action === 'FIND_KITE_TAB') {
    chrome.tabs.query({ url: '*://kite.zerodha.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ found: true, tab: tabs[0] });
      } else {
        sendResponse({ found: false });
      }
    });
    return true;
  }

  if (request.action === 'UPDATE_SETTINGS') {
    StorageManager.saveSettings(request.settings).then((updated) => {
      if (request.settings.refreshInterval) {
        setupAlarm(request.settings.refreshInterval);
      }
      sendResponse({ success: true, settings: updated });
    });
    return true;
  }

  if (request.action === 'UPDATE_BADGE') {
    (async () => {
      const cached = await StorageManager.getCachedNews();
      const readSet = await StorageManager.getReadArticleIds();
      await updateBadge(cached, readSet);
      sendResponse({ success: true });
    })();
    return true;
  }
});

