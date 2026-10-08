/**
 * Lightweight, DOM-independent RSS/XML Parser
 * Works seamlessly in both Chrome MV3 Service Worker and DOM contexts.
 */

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTagContent(xmlChunk, tagName) {
  // Handles <tagName>...</tagName> and CDATA sections
  const regex = new RegExp(`<${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlChunk.match(regex);
  if (!match) return '';

  let content = match[1].trim();
  // Check for CDATA
  const cdataMatch = content.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  if (cdataMatch) {
    content = cdataMatch[1];
  }
  return decodeHtmlEntities(content);
}

function extractTagAttribute(xmlChunk, tagName, attributeName) {
  const regex = new RegExp(`<${tagName}\\s+[^>]*?${attributeName}=["']([^"']+)["'][^>]*>`, 'i');
  const match = xmlChunk.match(regex);
  return match ? match[1] : '';
}

function parseRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function parseRssFeed(xmlText, symbol = '') {
  if (!xmlText) return [];

  const items = [];
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    let title = extractTagContent(itemXml, 'title');
    const link = extractTagContent(itemXml, 'link');
    const guid = extractTagContent(itemXml, 'guid') || link;
    const pubDate = extractTagContent(itemXml, 'pubDate');
    const descriptionRaw = extractTagContent(itemXml, 'description');
    let source = extractTagContent(itemXml, 'source');
    const sourceUrl = extractTagAttribute(itemXml, 'source', 'url');

    // Clean source from title if format is "Headline - Source Name"
    if (!source && title.includes(' - ')) {
      const parts = title.split(' - ');
      source = parts[parts.length - 1].trim();
    }

    // Clean description to snippet text
    const cleanSnippet = stripHtml(descriptionRaw);

    if (title && (link || guid)) {
      items.push({
        id: guid || link || `${symbol}-${Date.now()}-${Math.random()}`,
        symbol: symbol.toUpperCase(),
        title: title.trim(),
        link: link.trim(),
        pubDate: pubDate.trim(),
        timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
        relativeTime: parseRelativeTime(pubDate),
        source: source || 'News',
        sourceUrl: sourceUrl || '',
        snippet: cleanSnippet.slice(0, 240) + (cleanSnippet.length > 240 ? '...' : '')
      });
    }
  }

  // Sort newest first
  items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return items;
}

if (typeof globalThis !== 'undefined') {
  globalThis.parseRssFeed = parseRssFeed;
  globalThis.decodeHtmlEntities = decodeHtmlEntities;
  globalThis.stripHtml = stripHtml;
  globalThis.parseRelativeTime = parseRelativeTime;
}

// Support both ES module and script import/CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseRssFeed,
    decodeHtmlEntities,
    stripHtml,
    parseRelativeTime
  };
}
