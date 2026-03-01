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

// 位置情報マッピング
const LOCATIONS = {
    // ヨーロッパ
    'Ukraine': { lat: 48.3794, lng: 31.1656 },
    'Kyiv': { lat: 50.4501, lng: 30.5234 },
    'Kiev': { lat: 50.4501, lng: 30.5234 },
    'Donetsk': { lat: 48.0159, lng: 37.8029 },
    'Kharkiv': { lat: 49.9935, lng: 36.2304 },
    'Mariupol': { lat: 47.0951, lng: 37.5434 },
    'Russia': { lat: 55.7558, lng: 37.6173 },
    'Moscow': { lat: 55.7558, lng: 37.6173 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'France': { lat: 46.2276, lng: 2.2137 },
    'Germany': { lat: 51.1657, lng: 10.4515 },
    'Berlin': { lat: 52.5200, lng: 13.4050 },
    'UK': { lat: 55.3781, lng: -3.4360 },
    'Britain': { lat: 55.3781, lng: -3.4360 },
    'London': { lat: 51.5074, lng: -0.1278 },
    'Poland': { lat: 51.9194, lng: 19.1451 },
    'Warsaw': { lat: 52.2297, lng: 21.0122 },
    'Spain': { lat: 40.4168, lng: -3.7038 },
    'Madrid': { lat: 40.4168, lng: -3.7038 },
    'Italy': { lat: 41.8719, lng: 12.5674 },
    'Rome': { lat: 41.9028, lng: 12.4964 },
    'Greece': { lat: 39.0742, lng: 21.8243 },
    'Athens': { lat: 37.9838, lng: 23.7275 },
    'Turkey': { lat: 38.9637, lng: 35.2433 },
    'Istanbul': { lat: 41.0082, lng: 28.9784 },
    'Ankara': { lat: 39.9334, lng: 32.8597 },
    
    // 中東
    'Gaza': { lat: 31.5, lng: 34.45 },
    'Israel': { lat: 31.0461, lng: 34.8516 },
    'Tel Aviv': { lat: 32.0853, lng: 34.7818 },
    'Jerusalem': { lat: 31.7683, lng: 35.2137 },
    'Palestine': { lat: 31.9522, lng: 35.2332 },
    'West Bank': { lat: 31.9, lng: 35.2 },
    'Rafah': { lat: 31.2858, lng: 34.2458 },
    'Iran': { lat: 32.4279, lng: 53.6880 },
    'Tehran': { lat: 35.6892, lng: 51.3890 },
    'Iraq': { lat: 33.2232, lng: 43.6793 },
    'Baghdad': { lat: 33.3152, lng: 44.3661 },
    'Mosul': { lat: 36.3350, lng: 43.1189 },
    'Syria': { lat: 34.8021, lng: 38.9968 },
    'Damascus': { lat: 33.5138, lng: 36.2765 },
    'Aleppo': { lat: 36.2021, lng: 37.1343 },
    'Lebanon': { lat: 33.8547, lng: 35.8623 },
    'Beirut': { lat: 33.8886, lng: 35.4955 },
    'Yemen': { lat: 15.5527, lng: 48.5164 },
    'Sanaa': { lat: 15.3694, lng: 44.1910 },
    'Aden': { lat: 12.7855, lng: 45.0187 },
    'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
    'Riyadh': { lat: 24.7136, lng: 46.6753 },
    'Qatar': { lat: 25.3548, lng: 51.1839 },
    'Doha': { lat: 25.2854, lng: 51.5310 },
    'UAE': { lat: 23.4241, lng: 53.8478 },
    'Dubai': { lat: 25.2048, lng: 55.2708 },
    'Kuwait': { lat: 29.3117, lng: 47.4818 },
    'Jordan': { lat: 30.5852, lng: 36.2384 },
    'Amman': { lat: 31.9454, lng: 35.9284 },
    
    // アフリカ
    'Sudan': { lat: 15.5007, lng: 32.5599 },
    'Khartoum': { lat: 15.5007, lng: 32.5599 },
    'Darfur': { lat: 12.8628, lng: 24.8867 },
    'Ethiopia': { lat: 9.1450, lng: 40.4897 },
    'Addis Ababa': { lat: 9.0320, lng: 38.7469 },
    'Somalia': { lat: 5.1521, lng: 46.1996 },
    'Mogadishu': { lat: 2.0469, lng: 45.3182 },
    'Libya': { lat: 26.3351, lng: 17.2283 },
    'Tripoli': { lat: 32.8872, lng: 13.1913 },
    'Mali': { lat: 17.5707, lng: -3.9962 },
    'Bamako': { lat: 12.6392, lng: -8.0029 },
    'Nigeria': { lat: 9.0820, lng: 8.6753 },
    'Abuja': { lat: 9.0765, lng: 7.3986 },
    'Lagos': { lat: 6.5244, lng: 3.3792 },
    'Kenya': { lat: -0.0236, lng: 37.9062 },
    'Nairobi': { lat: -1.2921, lng: 36.8219 },
    'Congo': { lat: -4.0383, lng: 21.7587 },
    'Kinshasa': { lat: -4.4419, lng: 15.2663 },
    'Zimbabwe': { lat: -19.0154, lng: 29.1549 },
    'Harare': { lat: -17.8252, lng: 31.0335 },
    'South Africa': { lat: -30.5595, lng: 22.9375 },
    'Johannesburg': { lat: -26.2041, lng: 28.0473 },
    'Cape Town': { lat: -33.9249, lng: 18.4241 },
    'Egypt': { lat: 26.8206, lng: 30.8025 },
    'Cairo': { lat: 30.0444, lng: 31.2357 },
    'Tunisia': { lat: 33.8869, lng: 9.5375 },
    'Algeria': { lat: 28.0339, lng: 1.6596 },
    'Morocco': { lat: 31.7917, lng: -7.0926 },
    
    // アジア
    'Myanmar': { lat: 21.9162, lng: 95.9560 },
    'Yangon': { lat: 16.8661, lng: 96.1951 },
    'Afghanistan': { lat: 33.9391, lng: 67.7100 },
    'Kabul': { lat: 34.5553, lng: 69.2075 },
    'Kandahar': { lat: 31.6080, lng: 65.7372 },
    'Pakistan': { lat: 30.3753, lng: 69.3451 },
    'Islamabad': { lat: 33.6844, lng: 73.0479 },
    'Karachi': { lat: 24.8607, lng: 67.0011 },
    'India': { lat: 20.5937, lng: 78.9629 },
    'New Delhi': { lat: 28.6139, lng: 77.2090 },
    'Mumbai': { lat: 19.0760, lng: 72.8777 },
    'Kashmir': { lat: 34.0837, lng: 74.7973 },
    'China': { lat: 35.8617, lng: 104.1954 },
    'Beijing': { lat: 39.9042, lng: 116.4074 },
    'Taiwan': { lat: 23.6978, lng: 120.9605 },
    'Taipei': { lat: 25.0330, lng: 121.5654 },
    'North Korea': { lat: 40.3399, lng: 127.5101 },
    'Pyongyang': { lat: 39.0392, lng: 125.7625 },
    'South Korea': { lat: 37.5665, lng: 126.9780 },
    'Seoul': { lat: 37.5665, lng: 126.9780 },
    'Japan': { lat: 36.2048, lng: 138.2529 },
    'Tokyo': { lat: 35.6762, lng: 139.6503 },
    'Philippines': { lat: 12.8797, lng: 121.7740 },
    'Manila': { lat: 14.5995, lng: 120.9842 },
    'Indonesia': { lat: -0.7893, lng: 113.9213 },
    'Jakarta': { lat: -6.2088, lng: 106.8456 },
    'Thailand': { lat: 15.8700, lng: 100.9925 },
    'Bangkok': { lat: 13.7563, lng: 100.5018 },
    'Vietnam': { lat: 14.0583, lng: 108.2772 },
    'Hanoi': { lat: 21.0285, lng: 105.8542 },
    
    // 南北アメリカ
    'Venezuela': { lat: 10.4806, lng: -66.9036 },
    'Caracas': { lat: 10.4806, lng: -66.9036 },
    'Colombia': { lat: 4.5709, lng: -74.2973 },
    'Bogota': { lat: 4.7110, lng: -74.0721 },
    'Brazil': { lat: -14.2350, lng: -51.9253 },
    'Brasilia': { lat: -15.8267, lng: -47.9218 },
    'Sao Paulo': { lat: -23.5505, lng: -46.6333 },
    'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
    'Ecuador': { lat: -1.8312, lng: -78.1834 },
    'Peru': { lat: -9.1900, lng: -75.0152 },
    'Lima': { lat: -12.0464, lng: -77.0428 },
    'Chile': { lat: -35.6751, lng: -71.5430 },
    'Santiago': { lat: -33.4489, lng: -70.6693 },
    'Argentina': { lat: -38.4161, lng: -63.6167 },
    'Buenos Aires': { lat: -34.6037, lng: -58.3816 },
    'Mexico': { lat: 23.6345, lng: -102.5528 },
    'Mexico City': { lat: 19.4326, lng: -99.1332 },
    'Honduras': { lat: 15.2000, lng: -86.2419 },
    'Haiti': { lat: 18.9712, lng: -72.2852 },
    'Port-au-Prince': { lat: 18.5944, lng: -72.3074 },
    'Cuba': { lat: 21.5218, lng: -77.7812 },
    'Havana': { lat: 23.1136, lng: -82.3666 },
    'United States': { lat: 37.0902, lng: -95.7129 },
    'USA': { lat: 37.0902, lng: -95.7129 },
    'Washington': { lat: 38.9072, lng: -77.0369 },
    'New York': { lat: 40.7128, lng: -74.0060 },
    'Canada': { lat: 56.1304, lng: -106.3468 },
    'Ottawa': { lat: 45.4215, lng: -75.6972 },
    'Toronto': { lat: 43.6532, lng: -79.3832 },
    
    // オセアニア
    'Australia': { lat: -25.2744, lng: 133.7751 },
    'Sydney': { lat: -33.8688, lng: 151.2093 },
    'Melbourne': { lat: -37.8136, lng: 144.9631 },
    'New Zealand': { lat: -40.9006, lng: 174.8860 },
    'Auckland': { lat: -36.8485, lng: 174.7633 }
};

// 紛争関連キーワード
const CONFLICT_KEYWORDS = [
    'war', 'warfare', 'conflict', 'battle', 'combat', 'fighting', 'clashes',
    'hostilities', 'confrontation', 'armed conflict', 'armed', 'skirmish',
    'attack', 'attacks', 'attacked', 'assault', 'raid', 'offensive', 
    'strike', 'strikes', 'bombing', 'airstrike', 'airstrikes', 'shelling', 
    'gunfire', 'shooting', 'shot', 'missile', 'missiles', 'rocket', 'rockets',
    'explosion', 'blast', 'fire', 'artillery', 'drone strike', 'ambush',
    'killed', 'kill', 'killing', 'death', 'deaths', 'dead', 'die', 'died',
    'casualties', 'casualty', 'fatalities', 'wounded', 'injured', 'hurt',
    'victims', 'toll', 'massacre', 'slaughter', 'genocide', 'ethnic cleansing',
    'mass killing', 'execution', 'executed', 'assassinated', 'murdered',
    'military', 'troops', 'soldiers', 'forces', 'army', 'militia',
    'rebels', 'insurgents', 'fighters', 'guerrilla', 'combatants',
    'terrorists', 'terrorism', 'extremist', 'extremists', 'militant', 'militants',
    'paramilitary', 'armed forces', 'armed groups',
    'violence', 'violent', 'unrest', 'turmoil', 'instability',
    'chaos', 'bloodshed', 'brutality', 'atrocities', 'crackdown',
    'protest', 'protests', 'protester', 'protesters', 'demonstration', 
    'demonstrations', 'rally', 'uprising', 'riot', 'riots', 'civil unrest',
    'crisis', 'emergency', 'tension', 'tensions', 'standoff',
    'dispute', 'escalation', 'escalate', 'threat', 'threatens',
    'coup', 'overthrow', 'regime change', 'revolution', 'rebellion',
    'insurgency', 'mutiny', 'revolt',
    'siege', 'blockade', 'invasion', 'invade', 'occupation', 'occupy',
    'incursion', 'aggression',
    'humanitarian', 'refugee', 'refugees', 'displaced', 'evacuation',
    'evacuate', 'famine', 'starvation', 'aid', 'relief', 'shelter'
];

// 主要国リスト（国家間紛争検出用）
const MAJOR_COUNTRIES = [
    'israel', 'iran', 'russia', 'ukraine', 'china', 'taiwan', 
    'usa', 'united states', 'north korea', 'south korea',
    'india', 'pakistan', 'syria', 'turkey', 'saudi arabia'
];

// 深刻度判定（改善版）
function calculateSeverity(content) {
    let score = 0;
    
    // 🚫 除外: 式典・記念行事
    if (content.match(/memorial|ceremony|anniversary|commemorate|remembrance|tribute|honor|marks|marked|observ/)) {
        return null; // 除外
    }
    
    // 🚫 除外: 歴史的事件（年号や過去の表現）
    if (content.match(/\d{4}|years? ago|decades? ago|century|historic|history/)) {
        return null; // 除外
    }
    
    // 死傷者数
    const deathMatch = content.match(/(\d+)\s*(killed|dead|death|casualties|fatalities|wounded|injured)/);
    if (deathMatch) {
        const num = parseInt(deathMatch[1]);
        if (num >= 100) score += 10;
        else if (num >= 50) score += 8;
        else if (num >= 20) score += 6;
        else if (num >= 10) score += 4;
        else if (num >= 5) score += 3;
        else score += 2;
    }
    
    // 🔥 国家間紛争検出（新規）
    let countryCount = 0;
    MAJOR_COUNTRIES.forEach(country => {
        if (content.includes(country)) countryCount++;
    });
    
    // 2カ国以上言及 + 軍事行動 = 国際紛争
    if (countryCount >= 2 && content.match(/strike|attack|invade|bomb|war|conflict/)) {
        score += 6; // 国際紛争ボーナス（大幅増）
    }
    
    // 重大キーワード
    if (content.match(/massacre|genocide|ethnic cleansing|mass killing|slaughter/)) score += 3;
    if (content.match(/nuclear|atomic/)) score += 5; // 核兵器
    if (content.match(/bombing|airstrike|missile|rocket|explosion/)) score += 2;
    if (content.match(/civilian|children|hospital|school|refugee/)) score += 2;
    if (content.match(/attack|assault|raid/)) score += 1;
    if (content.match(/coup|overthrow|revolution/)) score += 5;
    if (content.match(/famine|starvation/)) score += 4;
    if (content.match(/war|warfare|combat|battle/)) score += 2;
    
    // 深刻度を決定（厳格化）
    if (score >= 8) return 'critical';
    if (score >= 5) return 'high';      // 5点から高（厳格化）
    if (score >= 3) return 'medium';    // 3点から中（厳格化）
    return 'low';
}

// カテゴリ判定
function determineCategory(content) {
    if (content.match(/protest|demonstration|rally|uprising/)) return 'protest';
    if (content.match(/humanitarian|refugee|displaced|aid|relief/)) return 'humanitarian';
    if (content.match(/diplomatic|talks|negotiation|summit/)) return 'diplomatic';
    if (content.match(/political|election|government|regime/)) return 'political';
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
        let filteredByMemorial = 0;
        let filteredByHistory = 0;
        let filteredByKeyword = 0;
        let filteredByLocation = 0;
        
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
            
            // 深刻度判定（式典・歴史的事件は null が返る）
            const severity = calculateSeverity(content);
            if (severity === null) {
                if (content.match(/memorial|ceremony|anniversary/)) {
                    filteredByMemorial++;
                } else {
                    filteredByHistory++;
                }
                return; // 除外
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
        console.log(`   ❌ Memorial/ceremony: ${filteredByMemorial}`);
        console.log(`   ❌ Historical event: ${filteredByHistory}`);
        console.log(`   ✅ Valid events: ${events.length}`);
        console.log(`🌍 Processed ${events.length} conflict events\n`);
        
        res.json({ success: true, count: events.length, events, lastUpdated: new Date().toISOString() });
        
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
