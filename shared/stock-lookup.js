/**
 * Stock Symbol to Company Name Mapping and News Query Builder
 * Supports Indian stock market (NSE / BSE) tickers and global stocks.
 */

const POPULAR_STOCKS_MAP = {
  // Nifty 50 & Heavyweights
  "RELIANCE": "Reliance Industries",
  "TCS": "Tata Consultancy Services",
  "HDFCBANK": "HDFC Bank",
  "INFY": "Infosys",
  "ICICIBANK": "ICICI Bank",
  "HINDUNILVR": "Hindustan Unilever",
  "ITC": "ITC Limited",
  "SBIN": "State Bank of India",
  "BHARTIARTL": "Bharti Airtel",
  "KOTAKBANK": "Kotak Mahindra Bank",
  "LT": "Larsen & Toubro",
  "AXISBANK": "Axis Bank",
  "TATAMOTORS": "Tata Motors",
  "TATASTEEL": "Tata Steel",
  "MARUTI": "Maruti Suzuki",
  "BAJFINANCE": "Bajaj Finance",
  "BAJAJFINSV": "Bajaj Finserv",
  "ASIANPAINT": "Asian Paints",
  "TITAN": "Titan Company",
  "SUNPHARMA": "Sun Pharma",
  "WIPRO": "Wipro",
  "HCLTECH": "HCL Technologies",
  "POWERGRID": "Power Grid Corporation",
  "NTPC": "NTPC Limited",
  "ONGC": "ONGC",
  "COALINDIA": "Coal India",
  "ADANIENT": "Adani Enterprises",
  "ADANIPORTS": "Adani Ports",
  "ULTRACEMCO": "UltraTech Cement",
  "M&M": "Mahindra & Mahindra",
  "NESTLEIND": "Nestle India",
  "JSWSTEEL": "JSW Steel",
  "GRASIM": "Grasim Industries",
  "TECHM": "Tech Mahindra",
  "CIPLA": "Cipla",
  "DRREDDY": "Dr. Reddy's Laboratories",
  "HDFCLIFE": "HDFC Life Insurance",
  "SBILIFE": "SBI Life Insurance",
  "BPCL": "Bharat Petroleum",
  "HEROMOTOCO": "Hero MotoCorp",
  "EICHERMOT": "Eicher Motors",
  "DIVISLAB": "Divi's Laboratories",
  "APOLLOHOSP": "Apollo Hospitals",
  "BRITANNIA": "Britannia Industries",
  "INDUSINDBK": "IndusInd Bank",
  "SHRIRAMFIN": "Shriram Finance",
  "LTIM": "LTIMindtree",
  "TRENT": "Trent Limited",
  "BEL": "Bharat Electronics",

  // High interest & Next 50
  "ZOMATO": "Zomato",
  "JIOFIN": "Jio Financial Services",
  "HAL": "Hindustan Aeronautics",
  "TATAPOWER": "Tata Power",
  "VEDL": "Vedanta",
  "IRFC": "Indian Railway Finance Corporation",
  "RVNL": "Rail Vikas Nigam",
  "IRCTC": "IRCTC",
  "BSE": "BSE Limited",
  "CDSL": "CDSL",
  "PAYTM": "Paytm (One97 Communications)",
  "NYKAA": "FSN E-Commerce (Nykaa)",
  "DMART": "Avenue Supermarts (DMart)",
  "POLYCAB": "Polycab India",
  "PERSISTENT": "Persistent Systems",
  "COFORGE": "Coforge",
  "KPITTECH": "KPIT Technologies",
  "TATAELXSI": "Tata Elxsi",
  "SUZLON": "Suzlon Energy",
  "YESBANK": "Yes Bank",
  "IDEA": "Vodafone Idea",
  "PFC": "Power Finance Corporation",
  "RECLTD": "REC Limited",
  "NHPC": "NHPC Limited",
  "SJVN": "SJVN",
  "BHEL": "Bharat Heavy Electricals",
  "SAIL": "Steel Authority of India",
  "NMDC": "NMDC",
  "IOB": "Indian Overseas Bank",
  "PNB": "Punjab National Bank",
  "BANKBARODA": "Bank of Baroda",
  "CANBK": "Canara Bank",
  "IDFCFIRSTB": "IDFC FIRST Bank",
  "FEDERALBNK": "Federal Bank",
  "AUCTION": "AU Small Finance Bank",
  "AUBANK": "AU Small Finance Bank",
  "MOTHERSON": "Samvardhana Motherson",
  "CHOLAFIN": "Cholamandalam Investment",
  "MUTHOOTFIN": "Muthoot Finance",
  "MANAPPURAM": "Manappuram Finance",
  "DLF": "DLF Limited",
  "GODREJPROP": "Godrej Properties",
  "OBEROIRLTY": "Oberoi Realty",
  "LODHA": "Macrotech Developers (Lodha)",
  "PRESTIGE": "Prestige Estates",
  "DIXON": "Dixon Technologies",
  "KALYANKJIL": "Kalyan Jewellers",
  "MAZDOCK": "Mazagon Dock Shipbuilders",
  "COCHINSHIP": "Cochin Shipyard",
  "GRSE": "Garden Reach Shipbuilders",
  "BDL": "Bharat Dynamics",
  "IREDA": "Indian Renewable Energy Development Agency"
};

/**
 * Clean broker symbol by removing exchange prefixes, series, or special tags
 * e.g. "NSE:INFY-EQ" -> "INFY", "RELIANCE-BE" -> "RELIANCE"
 */
function cleanStockSymbol(rawSymbol) {
  if (!rawSymbol || typeof rawSymbol !== 'string') return '';
  let sym = rawSymbol.trim().toUpperCase();

  // Strip exchange prefix like "NSE:" or "BSE:"
  if (sym.includes(':')) {
    sym = sym.split(':')[1];
  }

  // Strip series like "-EQ", "-BE", "-BZ", "-SM"
  sym = sym.replace(/-EQ$/i, '')
           .replace(/-BE$/i, '')
           .replace(/-BZ$/i, '')
           .replace(/-SM$/i, '')
           .replace(/-BL$/i, '')
           .replace(/-IL$/i, '');

  return sym.trim();
}

/**
 * Resolves company full name from stock symbol.
 * If not found in dictionary, fallback to provided custom name or the clean symbol.
 */
function resolveCompanyName(symbol, customName = '') {
  const clean = cleanStockSymbol(symbol);
  if (customName && customName.trim().length > 0 && customName.trim().toUpperCase() !== clean) {
    return customName.trim();
  }
  if (POPULAR_STOCKS_MAP[clean]) {
    return POPULAR_STOCKS_MAP[clean];
  }
  return clean;
}

/**
 * Builds an optimized Google News RSS search URL for a stock
 */
function buildNewsFeedUrl(symbol, companyName = '', region = 'IN') {
  const cleanSym = cleanStockSymbol(symbol);
  const name = resolveCompanyName(cleanSym, companyName);

  let query = '';
  if (name && name !== cleanSym) {
    // If company name is available and distinct, search by company name and stock
    query = `"${name}" (stock OR shares OR results OR business)`;
  } else {
    // Fallback: search by symbol with financial context keywords
    query = `"${cleanSym}" share OR stock news`;
  }

  const encodedQuery = encodeURIComponent(query);
  
  if (region === 'US') {
    return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
  }
  
  // Default to Indian financial news edition
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
}

if (typeof globalThis !== 'undefined') {
  globalThis.POPULAR_STOCKS_MAP = POPULAR_STOCKS_MAP;
  globalThis.cleanStockSymbol = cleanStockSymbol;
  globalThis.resolveCompanyName = resolveCompanyName;
  globalThis.buildNewsFeedUrl = buildNewsFeedUrl;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    POPULAR_STOCKS_MAP,
    cleanStockSymbol,
    resolveCompanyName,
    buildNewsFeedUrl
  };
}
