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
app.use(express.static('.'));

// RSSフィードソース
const RSS_SOURCES = [
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'CNN World', url: 'http://rss.cnn.com/rss/cnn_world.rss' },
    { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
    { name: 'ABC News', url: 'https://abcnews.go.com/abcnews/internationalheadlines' }
];

// 位置情報マッピング（主要地点のみ）
const LOCATIONS = {
    'Ukraine': { lat: 48.3794, lng: 31.1656 },
    'Kyiv': { lat: 50.4501, lng: 30.5234 },
    'Russia': { lat: 55.7558, lng: 37.6173 },
    'Moscow': { lat: 55.7558, lng: 37.6173 },
    'Gaza': { lat: 31.5, lng: 34.45 },
    'Israel': { lat: 31.0461, lng: 34.8516 },
    'Palestine': { lat: 31.9522, lng: 35.2332 },
    'West Bank': { lat: 31.9, lng: 35.2 },
    'Iran': { lat: 32.4279, lng: 53.6880 },
    'Tehran': { lat: 35.6892, lng: 51.3890 },
    'Iraq': { lat: 33.2232, lng: 43.6793 },
    'Syria': { lat: 34.8021, lng: 38.9968 },
    'Lebanon': { lat: 33.8547, lng: 35.8623 },
    'Yemen': { lat: 15.5527, lng: 48.5164 },
    'Sudan': { lat: 15.5007, lng: 32.5599 },
    'Ethiopia': { lat: 9.1450, lng: 40.4897 },
    'Somalia': { lat: 5.1521, lng: 46.1996 },
    'Myanmar': { lat: 21.9162, lng: 95.9560 },
    'Afghanistan': { lat: 33.9391, lng: 67.7100 },
    'Pakistan': { lat: 30.3753, lng: 69.3451 },
    'India': { lat: 20.5937, lng: 78.9629 },
    'Kashmir': { lat: 34.0837, lng: 74.7973 },
    'China': { lat: 35.8617, lng: 104.1954 },
    'Taiwan': { lat: 23.6978, lng: 120.9605 },
    'North Korea': { lat: 40.3399, lng: 127.5101 },
    'South Korea': { lat: 37.5665, lng: 126.9780 },
    'Venezuela': { lat: 10.4806, lng: -66.9036 },
    'Colombia': { lat: 4.5709, lng: -74.2973 },
    'Haiti': { lat: 18.9712, lng: -72.2852 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'London': { lat: 51.5074, lng: -0.1278 },
    'Berlin': { lat: 52.5200, lng: 13.4050 }
};

// 紛争関連キーワード（拡充 + 活用形）
const CONFLICT_KEYWORDS = [
    // 戦争・紛争
    'war', 'warfare', 'conflict', 'battle', 'combat', 'fighting', 'clashes',
    // 攻撃（活用形含む）
    'attack', 'attacks', 'attacked', 'attacking',
    'strike', 'strikes', 'struck', 'striking',
    'assault', 'raid', 'offensive',
    'bombing', 'bombed', 'airstrike', 'airstrikes',
    'shelling', 'gunfire', 'shooting', 'shot',
    'missile', 'missiles', 'rocket', 'rockets',
    'explosion', 'blast', 'artillery',
    // 報復・反撃
    'retaliate', 'retaliation', 'retaliatory', 'revenge',
    'counterattack', 'counter-attack', 'responds', 'response',
    // 死傷（活用形含む）
    'killed', 'kill', 'killing',
    'death', 'deaths', 'dead', 'die', 'died', 'dying',
    'casualties', 'fatalities', 'wounded', 'injured',
    'victims', 'massacre', 'slaughter', 'genocide',
    // 軍事
    'military', 'troops', 'soldiers', 'forces', 'army',
    'militia', 'rebels', 'insurgents', 'fighters',
    'terrorists', 'terrorism', 'militants',
    // 暴力
    'violence', 'violent', 'unrest', 'turmoil', 'chaos', 'brutality',
    // 抗議
    'protest', 'protests', 'demonstration', 'rally', 'uprising', 'riot',
    // 危機
    'crisis', 'emergency', 'tension', 'tensions', 'escalation', 'threat',
    // クーデター
    'coup', 'overthrow', 'revolution', 'rebellion',
    // 侵略
    'invasion', 'invade', 'occupation', 'siege', 'blockade',
    // 人道
    'humanitarian', 'refugee', 'refugees', 'displaced', 'famine'
];

// 高リスク国家ペア
const HIGH_RISK_PAIRS = [
    ['israel', 'iran'],
    ['israel', 'palestine'],
    ['israel', 'gaza'],
    ['russia', 'ukraine'],
    ['china', 'taiwan'],
    ['north korea', 'south korea'],
    ['india', 'pakistan']
];

// 現在進行形の証拠
const CURRENT_INDICATORS = [
    'today', 'now', 'breaking', 'just now', 'moments ago',
    'ongoing', 'continues', 'latest', 'this morning', 'tonight',
    'earlier today', 'live', 'update', 'developing'
];

// 除外ワード（これがあったら信頼度低下）
const INVALIDATORS = [
    // 仮定
    'could', 'would', 'might', 'may', 'if', 'potential', 'possible',
    'warns of', 'risk of', 'threat of', 'fear of',
    // レポート・統計
    'report says', 'study', 'statistics', 'analysis', 'data shows',
    'according to report', 'survey',
    // 過去
    'last year', 'last month', 'years ago', 'decades ago',
    'in 19', 'in 20', 'previous', 'formerly', 'historic',
    // 予測
    'predicts', 'forecast', 'expects', 'anticipates',
    // 式典（強化）
    'memorial', 'ceremony', 'anniversary', 'commemorate',
    'remembrance', 'tribute', 'honors', 'marks', 'observes'
];

// 深刻度判定（改善版）
function calculateSeverity(content, title) {
    let score = 0;
    
    // 🚫 除外チェック（最優先）
    for (const invalidator of INVALIDATORS) {
        if (content.includes(invalidator)) {
            return null; // 完全除外
        }
    }
    
    // 🔥 高リスク国家ペア検出
    let pairFound = false;
    for (const [country1, country2] of HIGH_RISK_PAIRS) {
        if (content.includes(country1) && content.includes(country2)) {
            score += 7; // 国家ペアボーナス
            pairFound = true;
            break;
        }
    }
    
    // 📰 タイトル重視（タイトルにキーワードがあれば重要度UP）
    const titleLower = title.toLowerCase();
    let titleBonus = 0;
    
    if (titleLower.match(/breaking|urgent|major|massive/)) titleBonus += 2;
    if (titleLower.match(/war|attack|strike|killed/)) titleBonus += 1;
    
    score += titleBonus;
    
    // 💀 死傷者数（現在進行形の証拠があるときのみ）
    const deathMatch = content.match(/(\d+)\s*(killed|dead|death|casualties|wounded|injured)/);
    if (deathMatch) {
        // 現在進行形の証拠があるか？
        const hasCurrent = CURRENT_INDICATORS.some(ind => content.includes(ind));
        
        const num = parseInt(deathMatch[1]);
        let deathScore = 0;
        
        if (num >= 100) deathScore = 10;
        else if (num >= 50) deathScore = 8;
        else if (num >= 20) deathScore = 6;
        else if (num >= 10) deathScore = 4;
        else if (num >= 5) deathScore = 3;
        else deathScore = 2;
        
        // 現在進行形の証拠がない場合は半減
        if (!hasCurrent) {
            deathScore = Math.floor(deathScore / 2);
        }
        
        score += deathScore;
    }
    
    // 🔥 重大キーワード
    if (content.match(/massacre|genocide|ethnic cleansing|mass killing/)) score += 3;
    if (content.match(/nuclear|atomic/)) score += 5;
    if (content.match(/bombing|airstrike|missile|rocket|explosion/)) score += 2;
    if (content.match(/civilian|children|hospital|school/)) score += 2;
    if (content.match(/invasion|invade|occupation/)) score += 3;
    if (content.match(/coup|overthrow/)) score += 5;
    
    // ⚔️ 一般的な軍事用語（控えめに）
    if (content.match(/attack|assault|raid/)) score += 1;
    if (content.match(/war|warfare|combat/)) score += 2;
    
    // 🎯 深刻度を決定
    if (score >= 10) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    if (score >= 1) return 'low';
    
    return null; // スコア0は除外
}

// カテゴリ判定
function determineCategory(content) {
    if (content.match(/protest|demonstration|rally|uprising/)) return 'protest';
    if (content.match(/humanitarian|refugee|displaced|famine/)) return 'humanitarian';
    if (content.match(/diplomatic|talks|negotiation|summit/)) return 'diplomatic';
    if (content.match(/political|election|government/)) return 'political';
    return 'conflict';
}

// RSSフィード取得
async function fetchRSS(url) {
    try {
        const response = await axios.get(url, { 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch ${url}:`, error.message);
        return null;
    }
}

// XMLパース
function parseRSSFeed(xmlText) {
    try {
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
    } catch (error) {
        console.error('XML parse error:', error);
        return [];
    }
}

// メインエンドポイント
app.get('/api/events', async (req, res) => {
    try {
        console.log('📡 Fetching events from multiple sources...');
        
        const allArticles = [];
        let successfulSources = 0;
        
        for (const source of RSS_SOURCES) {
            const xmlData = await fetchRSS(source.url);
            if (xmlData) {
                const articles = parseRSSFeed(xmlData);
                if (articles.length > 0) {
                    articles.forEach(a => a.source = source.name);
                    allArticles.push(...articles);
                    successfulSources++;
                    console.log(`✅ ${source.name}: ${articles.length} articles`);
                }
            }
        }
        
        console.log(`📰 Total: ${allArticles.length} articles from ${successfulSources} sources`);
        
        const events = [];
        let filteredByKeyword = 0;
        let filteredByLocation = 0;
        let filteredByInvalidator = 0;
        let filteredByLowScore = 0;
        
        allArticles.forEach(article => {
            const content = (article.title + ' ' + article.description).toLowerCase();
            
            // キーワードフィルター
            if (!CONFLICT_KEYWORDS.some(kw => content.includes(kw))) {
                filteredByKeyword++;
                return;
            }
            
            // 位置情報抽出
            let locationName = null, coords = null;
            for (const [loc, coord] of Object.entries(LOCATIONS)) {
                if (content.includes(loc.toLowerCase())) {
                    locationName = loc;
                    coords = coord;
                    break;
                }
            }
            
            if (!coords) {
                filteredByLocation++;
                return;
            }
            
            // 深刻度判定（除外ワードチェック含む）
            const severity = calculateSeverity(content, article.title);
            if (severity === null) {
                // 除外ワードで弾かれたか、スコアが低すぎた
                if (INVALIDATORS.some(inv => content.includes(inv))) {
                    filteredByInvalidator++;
                } else {
                    filteredByLowScore++;
                }
                return;
            }
            
            events.push({
                id: events.length + 1,
                title: article.title.substring(0, 100),
                location: locationName,
                lat: coords.lat,
                lng: coords.lng,
                severity: severity,
                description: article.description.replace(/<[^>]*>/g, '').substring(0, 200),
                date: article.pubDate ? new Date(article.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                category: determineCategory(content),
                sources: 1,
                articleUrl: article.link,
                sourceName: article.source
            });
        });
        
        console.log(`\n📊 Filtering Summary:`);
        console.log(`   Total articles: ${allArticles.length}`);
        console.log(`   ❌ No conflict keywords: ${filteredByKeyword}`);
        console.log(`   ❌ No location: ${filteredByLocation}`);
        console.log(`   ❌ Invalidator words: ${filteredByInvalidator}`);
        console.log(`   ❌ Score too low: ${filteredByLowScore}`);
        console.log(`   ✅ Valid events: ${events.length}`);
        console.log(`🌍 Processed ${events.length} conflict events\n`);
        
        res.json({ 
            success: true, 
            count: events.length, 
            events, 
            lastUpdated: new Date().toISOString() 
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🌍 Server running on http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/events`);
    console.log(`💡 Open http://localhost:${PORT}/index.html`);
});
