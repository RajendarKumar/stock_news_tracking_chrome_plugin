# Stock News Tracker (Chrome Extension - Manifest V3)

A Google Chrome Extension that tracks real-time financial news for companies you own in your share market portfolio and any other companies on your watchlist, with **100% manual, user-controlled sync** from your broker (**Zerodha Kite**).

---

## ✨ Features

- 🔒 **100% User-Controlled Manual Sync (Zero Auto-Sync)**:
  - **No background scripts running on Kite**: The extension never injects scripts or monitors your browsing on Zerodha Kite.
  - **Zero touch during login or trading**: Orders, funds, logins, passwords, and 2FA are completely untouched and isolated.
  - **On-Demand Sync**: When *you* choose to sync holdings, simply click **`⚡ Sync Holdings`** from the extension popup.
  - Reads only visible stock symbols from your holdings table and immediately disconnects.

- ⭐ **Track Companies Other Than Holdings (Watchlist & Research)**:
  - Track news for **any company**, even if you do not hold shares.
  - Quick-add suggestions for top Indian stocks (Reliance, TCS, Infosys, Tata Motors, HDFC Bank, Zomato, etc.).
  - Category filters: Filter your feed by **All Companies**, **🏢 Holdings Only**, or **⭐ Watchlist Only**.
  - Syncing holdings from Kite **never deletes or alters** your custom watchlist companies.

- 📰 **Real-Time Financial News (No API Keys Required)**:
  - Fetches live financial headlines and analysis using Google News RSS & Yahoo Finance editions.
  - Automatically matches stock tickers (`INFY`, `RELIANCE`, `TCS`, `HDFCBANK`, etc.) with their full corporate names for pinpoint news relevance from major publishers (*The Economic Times, Livemint, Business Standard, CNBC-TV18, Moneycontrol, Reuters*).
  - DOM-independent RSS/XML parser compatible with modern Chrome Manifest V3 Service Workers.

- 🔔 **Unread Badges & Desktop Notifications**:
  - Configurable Chrome Alarms (every 5m, 15m, 30m, 1h, or 2h) check for new articles in the background.
  - Displays unread article count badge directly on the Chrome toolbar icon.
  - Fires desktop notifications when high-priority breaking news arrives for your holdings and watchlist companies.

- 📊 **Sleek Popup Dashboard**:
  - Category filter pills: `All Companies` | `🏢 Holdings` | `⭐ Watchlist`.
  - Horizontal stock filter pills (`All`, `RELIANCE`, `INFY`, `TCS`, etc.).
  - Instant search bar to filter headlines, keywords, and publishers.
  - Mark articles as read, bookmark/save articles for later, and open stories directly in new tabs.

- ⚙️ **Full Options & Holdings Manager**:
  - Complete portfolio table with category (`Holding` vs `Watchlist`), quantity, and source.
  - Backup & restore your portfolio using JSON export/import.
  - Live RSS feed tester for testing any company ticker on the fly.

---

## 🚀 How to Install in Google Chrome

1. Open **Google Chrome** and navigate to:
   ```text
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle in the top-right corner.
3. If you have previously loaded the unpacked extension, click the **Reload icon (🔄)** on the **Stock News Tracker** card. Otherwise, click **"Load unpacked"** and select this directory:
   ```text
   /Users/rajendar/code/plugin/stock_news_tracking
   ```
4. Pin the extension to your Chrome toolbar by clicking the puzzle icon 🧩 in Chrome's top-right corner and clicking the pin icon 📌 next to **Stock News Tracker**.

---

## 📖 How to Use

### 1. Tracking Companies (Without Broker Sync)
- Open the extension popup from your toolbar.
- Switch to the **💼 Companies** tab.
- Click any quick-add chip (e.g. `TATAMOTORS`, `ZOMATO`) or enter any NSE/BSE symbol in the **"+ Track Any Company"** box.
- The latest news for that company will begin loading immediately!

### 2. Syncing Holdings from Zerodha Kite (On-Demand Only)
- In Chrome, open [https://kite.zerodha.com](https://kite.zerodha.com) and log into your account.
- Navigate to your **Holdings** page ([kite.zerodha.com/holdings](https://kite.zerodha.com/holdings)).
- Click the **Stock News Tracker** icon in your Chrome toolbar.
- Click **`⚡ Sync Holdings`**.
- The extension reads the stock symbols from your holdings table, labels them as `🏢 Holding`, and starts tracking news for them alongside your other watchlist companies.

---

## ⚙️ Settings

Open the **Options page** by clicking the gear icon in the popup footer or right-clicking the extension icon → **Options**.

| Setting | Options | Default |
|---------|---------|---------|
| **Background News Check Interval** | Every 5 minutes (High frequency), 15 minutes (Active trading), 30 minutes (Recommended), 1 hour, 2 hours | 30 minutes |
| **Desktop Notifications** | On / Off | On |
| **News Region** | India (IN) / US & Global | India (IN) |
| **Max Articles Per Stock** | Numeric limit per company | 10 |

### Backup & Restore
- **Export**: Download your entire portfolio (holdings + watchlist) as a JSON file.
- **Import**: Upload a previously exported JSON file to restore your portfolio.
- **Reset Everything**: Clears all data (stocks, news cache, settings) and restores defaults.

### Live Feed Tester
Enter any stock ticker in the **Live Feed Tester** section to preview the Google News RSS results in real time — useful for verifying that a ticker returns relevant articles before tracking it.

---

## 🔒 Privacy & Security Guarantee

- **Zero Automatic Broker Access**: No code is injected automatically when you visit or log into `kite.zerodha.com`.
- **Zero Access to Sensitive Data**: The extension never reads or touches your password, TOTP, account funds, margin, or order book.
- **Client-Side Only**: All holdings and preferences remain stored strictly inside your local browser storage (`chrome.storage.local`).
