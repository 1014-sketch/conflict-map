// server.js - バックエンドサーバー（Node.js + Express）
// RSSフィードから紛争ニュースを取得（APIキー不要）

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { DOMParser } = require('@xmldom/xmldom');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // 静的ファイル配信

// RSSフィードソース
const RSS_SOURCES = [
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
];

// 位置情報マッピング（抜粋）
const LOCATIONS = {
    'Ukraine': { lat: 48.3794, lng: 31.1656 },
    'Gaza': { lat: 31.5, lng: 34.45 },
    'Israel': { lat: 31.0461, lng: 34.8516 },
    'Palestine': { lat: 31.9522, lng: 35.2332 },
    'Sudan': { lat: 15.5007, lng: 32.5599 },
    'Myanmar': { lat: 21.9162, lng: 95.9560 },
    'Yemen': { lat: 15.5527, lng: 48.5164 },
    'Syria': { lat: 34.8021, lng: 38.9968 },
    'Taiwan': { lat: 23.6978, lng: 120.9605 },
    'Iran': { lat: 32.4279, lng: 53.6880 },
    'Venezuela': { lat: 10.4806, lng: -66.9036 },
    'Colombia': { lat: 4.5709, lng: -74.2973 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'Russia': { lat: 55.7558, lng: 37.6173 }
};

// 紛争関連キーワード
const CONFLICT_KEYWORDS = ['war', 'conflict', 'attack', 'killed', 'violence', 'protest', 'crisis', 'military', 'strike', 'bombing'];

// 深刻度判定
function calculateSeverity(content) {
    let score = 0;
    const deathMatch = content.match(/(\d+)\s*(killed|dead|death)/);
    if (deathMatch) {
        const num = parseInt(deathMatch[1]);
        if (num >= 100) score += 10;
        else if (num >= 50) score += 8;
        else if (num >= 20) score += 6;
        else score += 3;
    }
    if (content.match(/massacre|genocide/)) score += 3;
    if (content.match(/bombing|airstrike/)) score += 2;
    if (content.match(/attack|war/)) score += 1;
    
    if (score >= 8) return 'critical';
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
}

// カテゴリ判定
function determineCategory(content) {
    if (content.includes('protest')) return 'protest';
    if (content.includes('humanitarian')) return 'humanitarian';
    if (content.includes('diplomatic')) return 'diplomatic';
    return 'conflict';
}

// RSSフィード取得
async function fetchRSS(url) {
    try {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch ${url}:`, error.message);
        return null;
    }
}

// XMLパース
function parseRSSFeed(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const items = xml.getElementsByTagName('item');
    
    const articles = [];
    for (let i = 0; i < Math.min(items.length, 20); i++) {
        const item = items[i];
        articles.push({
            title: item.getElementsByTagName('title')[0]?.textContent || '',
            link: item.getElementsByTagName('link')[0]?.textContent || '',
            description: item.getElementsByTagName('description')[0]?.textContent || '',
            pubDate: item.getElementsByTagName('pubDate')[0]?.textContent || ''
        });
    }
    return articles;
}

// メインエンドポイント
app.get('/api/events', async (req, res) => {
    try {
        console.log('📡 Fetching events...');
        
        const allArticles = [];
        for (const source of RSS_SOURCES) {
            const xmlData = await fetchRSS(source.url);
            if (xmlData) {
                const articles = parseRSSFeed(xmlData);
                articles.forEach(a => a.source = source.name);
                allArticles.push(...articles);
                console.log(`✅ ${source.name}: ${articles.length} articles`);
            }
        }
        
        const events = [];
        allArticles.forEach(article => {
            const content = (article.title + ' ' + article.description).toLowerCase();
            
            if (!CONFLICT_KEYWORDS.some(kw => content.includes(kw))) return;
            
            let locationName = null, coords = null;
            for (const [loc, coord] of Object.entries(LOCATIONS)) {
                if (content.includes(loc.toLowerCase())) {
                    locationName = loc;
                    coords = coord;
                    break;
                }
            }
            
            if (!coords) return;
            
            events.push({
                id: events.length + 1,
                title: article.title.substring(0, 100),
                location: locationName,
                lat: coords.lat,
                lng: coords.lng,
                severity: calculateSeverity(content),
                description: article.description.replace(/<[^>]*>/g, '').substring(0, 200),
                date: article.pubDate ? new Date(article.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                category: determineCategory(content),
                sources: 1,
                articleUrl: article.link,
                sourceName: article.source
            });
        });
        
        console.log(`🌍 Processed ${events.length} events`);
        res.json({ success: true, count: events.length, events, lastUpdated: new Date().toISOString() });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(PORT, () => {
    console.log(`🌍 Server running on http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/events`);
    console.log(`💡 Open http://localhost:${PORT}/index.html`);
});
