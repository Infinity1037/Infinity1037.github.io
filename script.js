(function() {
// ==================== Firebase 配置 ====================
const firebaseConfig = {
    apiKey: "AIzaSyAo5yc2z-Q6YV5nbfTLBOcB1yR8IvaC-S0",
    authDomain: "shared-cat.firebaseapp.com",
    databaseURL: "https://shared-cat-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "shared-cat",
    storageBucket: "shared-cat.firebasestorage.app",
    messagingSenderId: "35653587925",
    appId: "1:35653587925:web:7b88608731f410bfd8e35c"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const catRef = database.ref('catV2');
const authRef = database.ref('auth');
const msgRef = database.ref('messages');
const fortuneRef = database.ref('dailyFortune');
const actionsRef = database.ref('recentActions');
const whisperRef = database.ref('whisper');
const presenceRef = database.ref('presence');

// ==================== 授权码验证 ====================
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let appInitialized = false;

async function verifyAuth(code) {
    const authInput = document.getElementById('auth-input');
    const authBtn = document.getElementById('auth-btn');
    const authError = document.getElementById('auth-error');

    if (!code.trim()) {
        authError.textContent = '还没输入暗号哦~';
        authInput.classList.add('shake');
        setTimeout(() => authInput.classList.remove('shake'), 400);
        return;
    }

    authBtn.disabled = true;
    authBtn.textContent = '确认中...';
    authError.textContent = '';

    try {
        const inputHash = await sha256(code.trim());
        const snapshot = await authRef.child('codeHash').once('value');
        const storedHash = snapshot.val();

        if (!storedHash) {
            // 数据库还没有授权码，自动设置当前输入为授权码
            await authRef.set({ codeHash: inputHash });
            authSuccess();
            return;
        }

        if (inputHash === storedHash) {
            authSuccess();
        } else {
            authError.textContent = '暗号不对哦，再想想~';
            authInput.classList.add('shake');
            setTimeout(() => authInput.classList.remove('shake'), 400);
            authInput.value = '';
            authInput.focus();
            if (navigator.vibrate) navigator.vibrate(100);
        }
    } catch (e) {
        console.error('Auth error:', e);
        authError.textContent = '网络有点卡，再试试~';
    } finally {
        authBtn.disabled = false;
        authBtn.textContent = '进入猫窝';
    }
}

function authSuccess() {
    const authScreen = document.getElementById('auth-screen');
    authScreen.style.opacity = '0';
    setTimeout(() => {
        authScreen.style.display = 'none';
        document.getElementById('loading-screen').style.display = 'flex';
        if (!appInitialized) {
            appInitialized = true;
            initApp();
        }
    }, 400);
}

// ==================== 游戏设置 ====================
const MAX_STAT = 100;
const DECAY_PER_HOUR = { hunger: 6, mood: 4, energy: 3 };
const FEED_EFFECT = { hunger: 20, mood: 8 };
const PET_EFFECT = { mood: 12, energy: 5 };
const PLAY_EFFECT = { energy: 15, mood: 10, hunger: -5 };
const WARNING_THRESHOLD = 30; // 低于30%显示警告

// 多种食物
const FOODS = [
    { id: 'fish', icon: '🐟', name: '小鱼干', effect: { hunger: 20, mood: 8 }, levelReq: 1, daily: Infinity, responses: ['好吃~', '真香！', '还要还要', '满足~'] },
    { id: 'milk', icon: '🥛', name: '牛奶', effect: { hunger: 10, energy: 15 }, levelReq: 1, daily: Infinity, responses: ['咕嘟咕嘟~', '好喝！', '奶味十足', '暖暖的~'] },
    { id: 'cake', icon: '🍰', name: '蛋糕', effect: { hunger: 5, mood: 20 }, levelReq: 3, daily: 3, responses: ['甜甜的！', '好幸福~', '最爱蛋糕', '还想吃！'] },
    { id: 'chicken', icon: '🍗', name: '鸡腿', effect: { hunger: 30, mood: 5, energy: 5 }, levelReq: 5, daily: Infinity, responses: ['大餐！', '好满足', '吃饱啦', '超级香！'] },
    { id: 'premium', icon: '🍣', name: '寿司', effect: { hunger: 15, mood: 15, energy: 10 }, levelReq: 7, daily: 2, responses: ['高级货！', '太奢侈了', '幸福满满', '人间美味！'] },
];
let foodUsedToday = {}; // { foodId: count }

// 猫咪对话
const SPEECHES = {
    hungry: ['肚子饿了...', '想吃小鱼干~', '喂喂我嘛', '好饿呀~'],
    sad: ['陪我玩~', '好无聊啊', '摸摸我', '想你了~'],
    tired: ['好困...', '想睡觉', 'zzZ', '眼皮好重'],
    happy: ['好开心！', '喵~♡', '最喜欢你们了', '幸福~'],
    normal: ['你好呀~', '喵~', '今天不错', '嘿嘿'],
    morning: ['早安~', '新的一天！', '伸个懒腰~', '阳光真好'],
    afternoon: ['午后犯困~', '想晒太阳', '下午茶时间', '打个哈欠~'],
    evening: ['晚上好~', '月亮出来了', '今天辛苦了', '陪我看星星'],
    night: ['该睡觉了...', '晚安~', 'zzZ...', '做个好梦'],
    sleep: ['zzZ...', '呼噜噜...', '...', '（在做梦）']
};

const FEED_RESPONSES = ['好吃~', '真香！', '还要还要', '满足~', '谢谢~', '太棒了！'];
const PET_RESPONSES = ['舒服~', '喵~', '再摸摸', '开心！', '嘿嘿', '好舒服'];
const PLAY_RESPONSES = ['好好玩！', '再来再来！', '接住了！', '太开心了~', '嗷呜~', '冲呀！'];
const LONG_PRESS_RESPONSES = ['超喜欢你！', '不要走~', '你是最好的！', '永远在一起♡', '幸福满满~'];

// ==================== 状态 ====================
let catState = {
    hunger: 80,
    mood: 70,
    energy: 60,
    lastUpdate: Date.now(),
    totalFeeds: 0,
    totalPets: 0,
    totalPlays: 0,
    streak: 0,
    lastVisitDate: ''
};

let isSleeping = false;

// ==================== DOM 缓存 ====================
const DOM = {};
function cacheDOM() {
    DOM.time = document.getElementById('time');
    DOM.date = document.getElementById('date');
    DOM.greeting = document.getElementById('greeting');
    DOM.catSpeech = document.getElementById('cat-speech');
    DOM.meowBubble = document.getElementById('meow-bubble');
    DOM.cat = document.getElementById('cat');
    DOM.eyesNormal = document.getElementById('eyes-normal');
    DOM.eyesHappy = document.getElementById('eyes-happy');
    DOM.eyesSad = document.getElementById('eyes-sad');
    DOM.totalFeeds = document.getElementById('total-feeds');
    DOM.totalPets = document.getElementById('total-pets');
    DOM.hungerFill = document.getElementById('hunger-fill');
    DOM.hungerNum = document.getElementById('hunger-num');
    DOM.hungerRow = document.getElementById('hunger-row');
    DOM.moodFill = document.getElementById('mood-fill');
    DOM.moodNum = document.getElementById('mood-num');
    DOM.moodRow = document.getElementById('mood-row');
    DOM.energyFill = document.getElementById('energy-fill');
    DOM.energyNum = document.getElementById('energy-num');
    DOM.energyRow = document.getElementById('energy-row');
    DOM.loadingScreen = document.getElementById('loading-screen');
    DOM.loadingText = document.getElementById('loading-text');
    DOM.retryBtn = document.getElementById('retry-btn');
    DOM.mainContent = document.getElementById('main-content');
    DOM.feedBtn = document.getElementById('feed-btn');
    DOM.petBtn = document.getElementById('pet-btn');
    DOM.playBtn = document.getElementById('play-btn');
    DOM.weatherLayer = document.getElementById('weather-layer');
    DOM.themeColor = document.getElementById('theme-color');
    DOM.eyesSleep = document.getElementById('eyes-sleep');
    DOM.totalPlays = document.getElementById('total-plays');
    DOM.catLevel = document.getElementById('cat-level');
    DOM.streakCount = document.getElementById('streak-count');
    DOM.streakRow = document.getElementById('streak-row');
    DOM.fishPond = document.getElementById('fish-pond');
    DOM.fortuneCard = document.getElementById('fortune-card');
    DOM.fortuneText = document.getElementById('fortune-text');
    DOM.fortuneContainer = document.getElementById('fortune-container');
    DOM.badgesRow = document.getElementById('badges-row');
    DOM.eventPopup = document.getElementById('event-popup');
    DOM.eventIcon = document.getElementById('event-icon');
    DOM.eventText = document.getElementById('event-text');
}

// 主题色对应表
const THEME_COLORS = {
    'theme-morning': '#fcb69f',
    'theme-afternoon': '#667eea',
    'theme-evening': '#26d0ce',
    'theme-night': '#302b63'
};

// 属性最低值保护
const MIN_STAT = 5;

// ==================== 时间更新 ====================
let lastSecond = -1;
function updateTime() {
    const now = new Date();
    const hours = now.getHours();
    const seconds = now.getSeconds();

    // 时间跳动效果
    if (seconds !== lastSecond) {
        lastSecond = seconds;
        DOM.time.classList.add('tick');
        setTimeout(() => DOM.time.classList.remove('tick'), 100);
    }

    DOM.time.textContent =
        `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    DOM.date.textContent =
        now.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });

    let theme;
    if (hours >= 5 && hours < 12) {
        DOM.greeting.textContent = '早上好';
        theme = 'theme-morning';
    } else if (hours >= 12 && hours < 18) {
        DOM.greeting.textContent = '下午好';
        theme = 'theme-afternoon';
    } else if (hours >= 18 && hours < 22) {
        DOM.greeting.textContent = '晚上好';
        theme = 'theme-evening';
    } else {
        DOM.greeting.textContent = '夜深了';
        theme = 'theme-night';
    }
    
    const themeClasses = ['theme-morning', 'theme-afternoon', 'theme-evening', 'theme-night'];
    if (!document.body.classList.contains(theme)) {
        themeClasses.forEach(t => document.body.classList.remove(t));
        document.body.classList.add(theme);
        // 动态更新状态栏颜色
        if (DOM.themeColor) {
            DOM.themeColor.content = THEME_COLORS[theme];
        }
    }
}

// ==================== 每日运势抽签 ====================
const FORTUNES = [
    { level: '大吉', color: '#ff6b6b', msg: '今天超级幸运！猫咪会特别开心', bonus: { mood: 15, energy: 10 } },
    { level: '大吉', color: '#ff6b6b', msg: '万事如意，好运连连', bonus: { hunger: 15, mood: 10 } },
    { level: '中吉', color: '#ffa502', msg: '今天运气不错哦~', bonus: { mood: 10, energy: 5 } },
    { level: '中吉', color: '#ffa502', msg: '会有小惊喜发生', bonus: { hunger: 10, mood: 5 } },
    { level: '小吉', color: '#2ed573', msg: '平稳顺利的一天', bonus: { mood: 5 } },
    { level: '小吉', color: '#2ed573', msg: '适合陪猫咪玩耍', bonus: { energy: 8 } },
    { level: '吉', color: '#7bed9f', msg: '安安静静也很好', bonus: { mood: 3 } },
    { level: '上吉', color: '#ff6b6b', msg: '福气满满的一天！', bonus: { mood: 12, energy: 6 } },
];

let fortuneDrawn = false;

function initFortune() {
    const today = new Date().toISOString().slice(0, 10);
    
    // 先检查本地是否已抽过
    const localDrawn = localStorage.getItem('fortune_date') === today;
    
    // 监听今日运势
    fortuneRef.child(today).on('value', (snapshot) => {
        const fortune = snapshot.val();
        if (fortune) {
            // 服务器已有今日运势
            showFortuneResult(fortune);
            fortuneDrawn = true;
            
            // 如果本地没抽过，应用 bonus
            if (!localDrawn && fortune.bonus) {
                if (fortune.bonus.hunger) catState.hunger = Math.min(MAX_STAT, catState.hunger + fortune.bonus.hunger);
                if (fortune.bonus.mood) catState.mood = Math.min(MAX_STAT, catState.mood + fortune.bonus.mood);
                if (fortune.bonus.energy) catState.energy = Math.min(MAX_STAT, catState.energy + fortune.bonus.energy);
                saveCatState();
                updateDisplay();
                localStorage.setItem('fortune_date', today);
                localStorage.setItem('fortune_data', JSON.stringify(fortune));
            }
        } else {
            // 服务器还没有今日运势，显示未抽状态
            fortuneDrawn = false;
            DOM.fortuneText.textContent = '点击抽签';
            DOM.fortuneCard.classList.remove('revealed');
        }
    });
}

function drawFortune() {
    if (fortuneDrawn) return;
    fortuneDrawn = true;

    const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    const today = new Date().toISOString().slice(0, 10);
    
    // 使用 transaction 保证并发安全：只在当日运势为空时写入
    fortuneRef.child(today).transaction((current) => {
        if (current === null) {
            // 服务器还没有今日运势，写入
            return fortune;
        }
        // 已有运势，返回当前值不变
        return current;
    }, (error, committed, snapshot) => {
        if (error) {
            console.error('Fortune transaction error:', error);
            fortuneDrawn = false;
            return;
        }
        
        const finalFortune = snapshot.val();
        if (!finalFortune) {
            fortuneDrawn = false;
            return;
        }
        
        // 本地记录
        localStorage.setItem('fortune_date', today);
        localStorage.setItem('fortune_data', JSON.stringify(finalFortune));

        // 应用加成
        if (finalFortune.bonus) {
            if (finalFortune.bonus.hunger) catState.hunger = Math.min(MAX_STAT, catState.hunger + finalFortune.bonus.hunger);
            if (finalFortune.bonus.mood) catState.mood = Math.min(MAX_STAT, catState.mood + finalFortune.bonus.mood);
            if (finalFortune.bonus.energy) catState.energy = Math.min(MAX_STAT, catState.energy + finalFortune.bonus.energy);
        }
        saveCatState();
        updateDisplay();

        // 动画翻转
        DOM.fortuneCard.classList.add('flipping');
        setTimeout(() => {
            showFortuneResult(finalFortune);
            DOM.fortuneCard.classList.remove('flipping');
            DOM.fortuneCard.classList.add('revealed');
        }, 400);

        if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    });
}

function showFortuneResult(fortune) {
    if (!fortune || !fortune.level) return;
    DOM.fortuneText.innerHTML = `<span class="fortune-level" style="color:${fortune.color}">${fortune.level}</span> ${fortune.msg}`;
    DOM.fortuneCard.classList.add('revealed');
    // 更新主屏迷你运势
    const mini = document.getElementById('fortune-mini');
    if (mini) mini.textContent = fortune.level;
}

// ==================== 接鱼小游戏 ====================
const FISH_TYPES = ['🐟', '🐠', '🦐', '🦀', '🐙', '🐬'];
let fishTimer = null;
let activeFishCount = 0;
const MAX_FISH = 2;

function spawnFish() {
    if (isSleeping || activeFishCount >= MAX_FISH) return;
    if (!DOM.fishPond) return;

    activeFishCount++;
    const fish = document.createElement('div');
    fish.className = 'swim-fish';
    fish.textContent = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)];

    // 随机位置（在猫咪区域内）
    const fromLeft = Math.random() > 0.5;
    fish.style.top = (20 + Math.random() * 60) + '%';
    fish.classList.add(fromLeft ? 'from-left' : 'from-right');

    fish.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        catchFish(fish, e);
    });

    DOM.fishPond.appendChild(fish);

    // 游走后自动消失
    setTimeout(() => {
        if (fish.parentNode && !fish.classList.contains('caught')) {
            fish.classList.add('fish-gone');
            setTimeout(() => {
                if (!fish.classList.contains('caught')) {
                    fish.remove();
                    activeFishCount--;
                }
            }, 300);
        }
    }, 4000 + Math.random() * 2000);
}

function catchFish(fish, e) {
    if (fish.classList.contains('caught')) return;
    fish.classList.add('caught');
    activeFishCount--;

    catState.hunger = Math.min(MAX_STAT, catState.hunger + 8);
    catState.mood = Math.min(MAX_STAT, catState.mood + 3);
    catState.lastUpdate = Date.now();
    catState.totalFeeds = (catState.totalFeeds || 0) + 1;

    showBubble('抓到鱼了!');
    catBounce();
    updateDisplay();
    createParticles(e.clientX, e.clientY, '🐟');
    if (navigator.vibrate) navigator.vibrate(15);
    saveToLocalStorage();
    trackQuest('fish');
    trackQuest('feed');

    catRef.update({
        hunger: catState.hunger,
        mood: catState.mood,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        totalFeeds: firebase.database.ServerValue.increment(1)
    });

    fish.style.transform = 'scale(1.5)';
    fish.style.opacity = '0';
    setTimeout(() => fish.remove(), 300);
}

function startFishGame() {
    // 每 8-15 秒生成一条鱼
    function scheduleNext() {
        const delay = 8000 + Math.random() * 7000;
        fishTimer = setTimeout(() => {
            spawnFish();
            scheduleNext();
        }, delay);
    }
    scheduleNext();
}

// ==================== 成就徽章 ====================
const ACHIEVEMENTS = [
    { id: 'first_feed', icon: '🍼', name: '第一口', check: s => s.totalFeeds >= 1 },
    { id: 'feed_10', icon: '🍜', name: '小食家', check: s => s.totalFeeds >= 10 },
    { id: 'feed_50', icon: '🍳', name: '大厨师', check: s => s.totalFeeds >= 50 },
    { id: 'feed_200', icon: '👨‍🍳', name: '美食家', check: s => s.totalFeeds >= 200 },
    { id: 'pet_10', icon: '🧶', name: '摸摸达人', check: s => s.totalPets >= 10 },
    { id: 'pet_50', icon: '💕', name: '拚猫专家', check: s => s.totalPets >= 50 },
    { id: 'play_10', icon: '⚽', name: '玩伴', check: s => (s.totalPlays || 0) >= 10 },
    { id: 'play_50', icon: '🏆', name: '玩耆大师', check: s => (s.totalPlays || 0) >= 50 },
    { id: 'streak_3', icon: '📅', name: '三日之约', check: s => (s.streak || 0) >= 3 },
    { id: 'streak_7', icon: '🌟', name: '一周达人', check: s => (s.streak || 0) >= 7 },
    { id: 'streak_30', icon: '👑', name: '月度之星', check: s => (s.streak || 0) >= 30 },
    { id: 'level_5', icon: '🎖️', name: '成长中', check: s => getCatLevel() >= 5 },
    { id: 'level_10', icon: '💎', name: '满级猫咪', check: s => getCatLevel() >= 10 },
    { id: 'all_high', icon: '🌈', name: '完美状态', check: s => s.hunger >= 90 && s.mood >= 90 && s.energy >= 90 },
];

let lastBadgeHtml = '';
let unlockedBadges = new Set();
let badgeInitDone = false;

function updateBadges() {
    if (!DOM.badgesRow) return;
    let html = '';
    let count = 0;
    ACHIEVEMENTS.forEach(a => {
        if (a.check(catState)) {
            html += `<span class="badge unlocked" title="${a.name}">${a.icon}</span>`;
            count++;
            if (!unlockedBadges.has(a.id)) {
                if (badgeInitDone) {
                    showBadgeUnlock(a);
                }
                unlockedBadges.add(a.id);
            }
        }
    });
    badgeInitDone = true;
    if (count === 0) {
        html = '<span class="badge-hint">还没有徽章，继续加油~</span>';
    }
    if (html !== lastBadgeHtml) {
        lastBadgeHtml = html;
        DOM.badgesRow.innerHTML = html;
    }
}

function showBadgeUnlock(achievement) {
    const popup = document.getElementById('badge-popup');
    if (!popup) return;
    popup.querySelector('.badge-popup-icon').textContent = achievement.icon;
    popup.querySelector('.badge-popup-name').textContent = achievement.name;
    popup.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 30]);
    setTimeout(() => popup.classList.remove('show'), 3500);
}

// ==================== 随机事件 ====================
const RANDOM_EVENTS = [
    { icon: '🦋', text: '猫咪发现了一只蝴蝶！', bonus: { mood: 8 } },
    { icon: '🌞', text: '晒到了温暖的阳光~', bonus: { energy: 10 } },
    { icon: '🍀', text: '找到了一片四叶草！', bonus: { mood: 12 } },
    { icon: '🐟', text: '有鱼主动跳到碗里了~', bonus: { hunger: 15 } },
    { icon: '🌈', text: '看到了彩虹！', bonus: { mood: 10, energy: 5 } },
    { icon: '🌙', text: '月光很美，心情很好', bonus: { mood: 6 } },
    { icon: '🎂', text: '收到了神秘礼物！', bonus: { hunger: 10, mood: 10, energy: 10 } },
    { icon: '💤', text: '美美地打了个盹~', bonus: { energy: 12 } },
    { icon: '🎶', text: '听到了好听的音乐~', bonus: { mood: 7 } },
    { icon: '🌺', text: '闻到了花香~', bonus: { mood: 5, energy: 3 } },
];

let eventCooldown = false;

function triggerRandomEvent() {
    if (eventCooldown || isSleeping) return;

    // 15% 概率触发
    if (Math.random() > 0.15) return;

    eventCooldown = true;
    setTimeout(() => { eventCooldown = false; }, 60000);

    const evt = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];

    const updates = { lastUpdate: firebase.database.ServerValue.TIMESTAMP };
    if (evt.bonus.hunger) {
        catState.hunger = Math.min(MAX_STAT, catState.hunger + evt.bonus.hunger);
        updates.hunger = catState.hunger;
    }
    if (evt.bonus.mood) {
        catState.mood = Math.min(MAX_STAT, catState.mood + evt.bonus.mood);
        updates.mood = catState.mood;
    }
    if (evt.bonus.energy) {
        catState.energy = Math.min(MAX_STAT, catState.energy + evt.bonus.energy);
        updates.energy = catState.energy;
    }
    catState.lastUpdate = Date.now();

    updateDisplay();
    saveToLocalStorage();
    catRef.update(updates);

    DOM.eventIcon.textContent = evt.icon;
    DOM.eventText.textContent = evt.text;
    DOM.eventPopup.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

    setTimeout(() => {
        DOM.eventPopup.classList.remove('show');
    }, 3000);
}

// ==================== 每日任务 ====================
const QUEST_TEMPLATES = [
    { id: 'feed3', desc: '喂食 3 次', icon: '🐟', target: 3, type: 'feed', reward: { mood: 10 } },
    { id: 'feed5', desc: '喂食 5 次', icon: '🐟', target: 5, type: 'feed', reward: { hunger: 15 } },
    { id: 'pet3', desc: '抚摸 3 次', icon: '🖐️', target: 3, type: 'pet', reward: { energy: 10 } },
    { id: 'pet5', desc: '抚摸 5 次', icon: '🖐️', target: 5, type: 'pet', reward: { mood: 15 } },
    { id: 'play2', desc: '玩耍 2 次', icon: '🎾', target: 2, type: 'play', reward: { energy: 10 } },
    { id: 'play4', desc: '玩耍 4 次', icon: '🎾', target: 4, type: 'play', reward: { mood: 12, energy: 8 } },
    { id: 'fish1', desc: '抓到 1 条鱼', icon: '🐠', target: 1, type: 'fish', reward: { hunger: 15 } },
    { id: 'all3', desc: '总互动 6 次', icon: '⭐', target: 6, type: 'all', reward: { hunger: 10, mood: 10, energy: 10 } },
];

let dailyQuests = [];
let questProgress = {};

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

function getDailyQuests() {
    const today = new Date().toISOString().slice(0, 10);
    const seed = parseInt(today.replace(/-/g, ''));
    const rng = seededRandom(seed);

    // 从模板中按种子选 3 个不重复任务
    const shuffled = [...QUEST_TEMPLATES].sort(() => rng() - 0.5);
    return shuffled.slice(0, 3);
}

function initQuests() {
    const today = new Date().toISOString().slice(0, 10);
    const savedDate = localStorage.getItem('quest_date');

    if (savedDate === today) {
        try { questProgress = JSON.parse(localStorage.getItem('quest_progress') || '{}'); } catch(e) { questProgress = {}; }
    } else {
        questProgress = {};
        localStorage.setItem('quest_date', today);
        localStorage.setItem('quest_progress', '{}');
    }

    dailyQuests = getDailyQuests();
    renderQuests();
}

function trackQuest(type) {
    const key = 'today_' + type;
    questProgress[key] = (questProgress[key] || 0) + 1;
    // 'all' 类型为总和
    questProgress['today_all'] = (questProgress['today_feed'] || 0) + (questProgress['today_pet'] || 0) + (questProgress['today_play'] || 0) + (questProgress['today_fish'] || 0);
    localStorage.setItem('quest_progress', JSON.stringify(questProgress));
    renderQuests();
}

function claimQuestReward(questId) {
    if (questProgress['claimed_' + questId]) return;
    const quest = dailyQuests.find(q => q.id === questId);
    if (!quest) return;

    const progress = questProgress['today_' + quest.type] || 0;
    if (progress < quest.target) return;

    questProgress['claimed_' + questId] = true;
    localStorage.setItem('quest_progress', JSON.stringify(questProgress));

    const r = quest.reward;
    const updates = { lastUpdate: firebase.database.ServerValue.TIMESTAMP };
    if (r.hunger) { catState.hunger = Math.min(MAX_STAT, catState.hunger + r.hunger); updates.hunger = catState.hunger; }
    if (r.mood) { catState.mood = Math.min(MAX_STAT, catState.mood + r.mood); updates.mood = catState.mood; }
    if (r.energy) { catState.energy = Math.min(MAX_STAT, catState.energy + r.energy); updates.energy = catState.energy; }
    catState.lastUpdate = Date.now();

    catRef.update(updates);
    saveToLocalStorage();
    updateDisplay();
    showBubble('任务奖励领取成功！');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
    renderQuests();
}

function renderQuests() {
    const container = document.getElementById('quest-list');
    if (!container) return;
    container.innerHTML = '';

    dailyQuests.forEach(quest => {
        const progress = Math.min(questProgress['today_' + quest.type] || 0, quest.target);
        const done = progress >= quest.target;
        const claimed = !!questProgress['claimed_' + quest.id];

        const el = document.createElement('div');
        el.className = 'quest-item' + (claimed ? ' claimed' : done ? ' done' : '');

        const barPct = Math.min(100, (progress / quest.target) * 100);
        el.innerHTML = `
            <span class="quest-icon">${quest.icon}</span>
            <div class="quest-info">
                <div class="quest-desc">${quest.desc}</div>
                <div class="quest-bar"><div class="quest-bar-fill" style="width:${barPct}%"></div></div>
            </div>
            <span class="quest-status">${claimed ? '✅' : done ? '🎁' : progress + '/' + quest.target}</span>
        `;

        if (done && !claimed) {
            el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                claimQuestReward(quest.id);
            });
        }

        container.appendChild(el);
    });

    // 更新主屏任务迷你预览
    const qMini = document.getElementById('quest-mini');
    if (qMini) {
        const done = dailyQuests.filter(q => (questProgress['today_' + q.type] || 0) >= q.target).length;
        qMini.textContent = done + '/' + dailyQuests.length;
    }
}

// ==================== 双人互动提示 ====================
const sessionId = (() => {
    let id = localStorage.getItem('cat_session_id');
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('cat_session_id', id); }
    return id;
})();
const ACTION_LABELS = { feed: '喂了猫咪', pet: '摸了猫咪', play: '和猫咪玩耍了' };

function pushAction(type) {
    actionsRef.push({
        type: type,
        sid: sessionId,
        time: firebase.database.ServerValue.TIMESTAMP
    });
    // 只保留最近 10 条
    actionsRef.orderByChild('time').limitToFirst(1).once('value', (snap) => {
        snap.forEach(child => {
            actionsRef.once('value', s => {
                if (s.numChildren() > 10) child.ref.remove();
            });
        });
    });
    // 双人连击检测
    setTimeout(() => checkDuoCombo(), 1500);
}

let actionListenerReady = false;

function initActionListener() {
    // 只监听新增的操作（忽略已有数据）
    actionsRef.orderByChild('time').limitToLast(1).on('value', () => {
        if (!actionListenerReady) {
            actionListenerReady = true;
            return;
        }
    });

    actionsRef.orderByChild('time').limitToLast(1).on('child_added', (snap) => {
        if (!actionListenerReady) return;
        const data = snap.val();
        if (!data || data.sid === sessionId) return;

        const label = ACTION_LABELS[data.type];
        if (!label) return;

        showActionToast('有人' + label + ' ~');
    });
}

function showActionToast(text) {
    const toast = document.getElementById('action-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);

    // 对方操作时在猫咪区域显示爱心涟漪
    showPartnerTouch();
}

function showPartnerTouch() {
    const cat = document.querySelector('.cat-static');
    if (!cat) return;
    const rect = cat.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 + (Math.random() - 0.5) * 40;
    const cy = rect.top + rect.height / 2 + (Math.random() - 0.5) * 30;

    // 涟漪圈
    const ripple = document.createElement('div');
    ripple.className = 'partner-ripple';
    ripple.style.left = cx + 'px';
    ripple.style.top = cy + 'px';
    document.getElementById('particle-layer').appendChild(ripple);
    setTimeout(() => ripple.remove(), 1000);

    // 爱心标记
    const heart = document.createElement('div');
    heart.className = 'partner-heart';
    heart.textContent = '💗';
    heart.style.left = cx + 'px';
    heart.style.top = cy + 'px';
    document.getElementById('particle-layer').appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
}

// ==================== 留言板 ====================
function initMsgBoard() {
    // 实时监听最近 15 条留言，直接渲染到面板内
    msgRef.orderByChild('time').limitToLast(15).on('value', (snapshot) => {
        const list = document.getElementById('msg-list');
        if (!list) return;
        list.innerHTML = '';
        const msgs = [];
        snapshot.forEach(child => msgs.push(child.val()));
        if (msgs.length === 0) {
            list.innerHTML = '<div class="msg-empty">还没有留言~</div>';
            return;
        }
        msgs.reverse().forEach(msg => {
            const el = document.createElement('div');
            el.className = 'msg-item';
            const date = new Date(msg.time);
            const timeStr = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
            const textDiv = document.createElement('div');
            textDiv.className = 'msg-item-text';
            textDiv.textContent = msg.text;
            const timeDiv = document.createElement('div');
            timeDiv.className = 'msg-item-time';
            timeDiv.textContent = timeStr;
            el.appendChild(textDiv);
            el.appendChild(timeDiv);
            list.appendChild(el);
        });
        // 更新主屏快捷卡片预览
        const mini = document.getElementById('msg-mini');
        if (mini && msgs.length > 0) mini.textContent = msgs[0].text.slice(0, 6) + (msgs[0].text.length > 6 ? '…' : '');
    });
}

// ==================== 移动端滚动锁定 ====================
let scrollLockCount = 0;
function lockScroll() {
    scrollLockCount++;
    if (scrollLockCount === 1) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = -window.scrollY + 'px';
        document.body.dataset.scrollY = window.scrollY;
    }
}
function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
        const scrollY = parseInt(document.body.dataset.scrollY || '0');
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
    }
}

let lastMsgTime = 0;
const MSG_COOLDOWN = 5000;

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    const now = Date.now();
    if (now - lastMsgTime < MSG_COOLDOWN) return;
    lastMsgTime = now;

    msgRef.push({
        text: text,
        time: firebase.database.ServerValue.TIMESTAMP
    });

    // 清理旧留言，只保留最新 20 条
    msgRef.orderByChild('time').once('value', (snapshot) => {
        const count = snapshot.numChildren();
        if (count > 20) {
            let deleteCount = count - 20;
            snapshot.forEach((child) => {
                if (deleteCount-- > 0) child.ref.remove();
            });
        }
    });

    input.value = '';
    showBubble('留言成功~');
    if (navigator.vibrate) navigator.vibrate(15);
}

// ==================== TA在线指示器 ====================
function initPresence() {
    const myRef = presenceRef.child(sessionId);
    const connRef = database.ref('.info/connected');

    connRef.on('value', (snap) => {
        if (snap.val() === true) {
            myRef.set({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
            myRef.onDisconnect().set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
    });

    // 监听所有在线状态
    presenceRef.on('value', (snap) => {
        const data = snap.val();
        if (!data) return;
        let otherOnline = false;
        Object.keys(data).forEach(key => {
            if (key !== sessionId && data[key].online) {
                otherOnline = true;
            }
        });
        updateOnlineIndicator(otherOnline);
    });
}

let partnerWasOnline = false;

function updateOnlineIndicator(isOnline) {
    const el = document.getElementById('partner-status');
    if (!el) return;

    if (isOnline) {
        el.innerHTML = '<span class="partner-dot online"></span> TA也在看猫咪~';
        el.classList.add('online');
        if (!partnerWasOnline) {
            partnerWasOnline = true;
            showBubble('有人来看我啦！');
        }
    } else {
        el.innerHTML = '<span class="partner-dot"></span> TA不在';
        el.classList.remove('online');
        partnerWasOnline = false;
    }
}

// ==================== 悄悄话信箱 ====================
function sendWhisper() {
    const input = document.getElementById('whisper-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    whisperRef.push({
        text: text,
        from: sessionId,
        time: firebase.database.ServerValue.TIMESTAMP,
        read: false
    });

    input.value = '';
    showBubble('悄悄话已寄出~');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

    // 清理旧悄悄话，只保留最近 10 条
    whisperRef.orderByChild('time').once('value', (snap) => {
        const count = snap.numChildren();
        if (count > 10) {
            let deleteCount = count - 10;
            snap.forEach((child) => {
                if (deleteCount-- > 0) child.ref.remove();
            });
        }
    });
}

function checkWhispers() {
    whisperRef.orderByChild('read').equalTo(false).once('value', (snap) => {
        const data = snap.val();
        if (!data) return;
        const keys = Object.keys(data);
        for (const key of keys) {
            const w = data[key];
            if (w.from !== sessionId) {
                showWhisperPopup(w.text, key);
                return;
            }
        }
    });
}

function showWhisperPopup(text, key) {
    const popup = document.getElementById('whisper-popup');
    const textEl = document.getElementById('whisper-popup-text');
    if (!popup || !textEl) return;
    textEl.textContent = text;
    popup.classList.add('show');
    lockScroll();
    pushOverlayState();

    whisperRef.child(key).update({ read: true });

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

function closeWhisperPopup() {
    const popup = document.getElementById('whisper-popup');
    if (popup) popup.classList.remove('show');
    unlockScroll();
}

// ==================== 猫咪显示 ====================
function checkSleepMode() {
    const hours = new Date().getHours();
    const wasSleeping = isSleeping;
    isSleeping = (hours >= 23 || hours < 5);
    // 刚进入睡眠 → 启动梦话
    if (isSleeping && !wasSleeping) startDreamTalk();
}

// ==================== 猫咪梦话 ====================
const DREAM_TALKS = [
    '💤 梦到小鱼干了...', '💤 呼噜...好大的毛线球...', '💤 喵...别跑...蝴蝶...',
    '💤 嗯...肚子好饱...', '💤 zzZ...飞起来了...', '💤 呼...梦到你了...',
    '💤 喵呜...好暖和...', '💤 嗯嗯...罐头...再来一个...', '💤 zzz...星星好亮...',
    '💤 呼噜...不要摸...还想睡...', '💤 梦到两个人一起撸我...',
    '💤 喵...好大的沙发...', '💤 嗯...尾巴...别踩...',
];

let dreamInterval = null;

function startDreamTalk() {
    if (dreamInterval) return;
    dreamInterval = setInterval(() => {
        if (!isSleeping) {
            clearInterval(dreamInterval);
            dreamInterval = null;
            return;
        }
        if (Math.random() < 0.4) {
            showBubble(DREAM_TALKS[Math.floor(Math.random() * DREAM_TALKS.length)]);
        }
    }, 12000);
    // 首次延迟 3 秒
    setTimeout(() => {
        if (isSleeping) showBubble(DREAM_TALKS[Math.floor(Math.random() * DREAM_TALKS.length)]);
    }, 3000);
}

function getCatLevel() {
    const total = (catState.totalFeeds || 0) + (catState.totalPets || 0) + (catState.totalPlays || 0);
    if (total >= 1000) return 10;
    if (total >= 500) return 9;
    if (total >= 300) return 8;
    if (total >= 200) return 7;
    if (total >= 120) return 6;
    if (total >= 70) return 5;
    if (total >= 40) return 4;
    if (total >= 20) return 3;
    if (total >= 8) return 2;
    return 1;
}

function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    
    catRef.transaction((current) => {
        if (!current) return;
        const currentLastVisit = current.lastVisitDate || '';
        
        if (currentLastVisit === today) {
            // 今天已经访问过，不更新
            return;
        }
        
        const newState = { ...current };
        if (currentLastVisit === yesterday) {
            newState.streak = (current.streak || 0) + 1;
        } else {
            newState.streak = 1;
        }
        newState.lastVisitDate = today;
        return newState;
    }, (error, committed, snapshot) => {
        if (error) {
            console.error('Streak transaction error:', error);
            return;
        }
        if (committed && snapshot) {
            const data = snapshot.val();
            if (data) {
                catState.streak = data.streak || 0;
                catState.lastVisitDate = data.lastVisitDate || '';
                updateDisplay();
            }
        }
    });
}

function updateDisplay() {
    // 更新属性条和数值
    updateStat('hunger', catState.hunger);
    updateStat('mood', catState.mood);
    updateStat('energy', catState.energy);

    // 检查睡眠模式
    checkSleepMode();

    // 更新眼睛表情
    DOM.eyesNormal.style.display = 'none';
    DOM.eyesHappy.style.display = 'none';
    DOM.eyesSad.style.display = 'none';
    DOM.eyesSleep.style.display = 'none';

    // 更新猫咪状态样式
    DOM.cat.classList.remove('sad', 'happy', 'sleeping');

    if (isSleeping) {
        DOM.eyesSleep.style.display = 'block';
        DOM.cat.classList.add('sleeping');
    } else if (catState.mood >= 70) {
        DOM.eyesHappy.style.display = 'block';
        DOM.cat.classList.add('happy');
    } else if (catState.mood < 30 || catState.hunger < 30) {
        DOM.eyesSad.style.display = 'block';
        DOM.cat.classList.add('sad');
    } else {
        DOM.eyesNormal.style.display = 'block';
    }

    // 更新统计
    DOM.totalFeeds.textContent = catState.totalFeeds;
    DOM.totalPets.textContent = catState.totalPets;
    DOM.totalPlays.textContent = catState.totalPlays || 0;

    // 更新等级
    DOM.catLevel.textContent = getCatLevel();

    // 更新连续签到
    DOM.streakCount.textContent = catState.streak || 0;
    const streakMini = document.getElementById('streak-mini');
    if (streakMini) streakMini.textContent = catState.streak || 0;

    // 睡眠模式禁用按钮
    const actionBtns = [DOM.feedBtn, DOM.petBtn, DOM.playBtn];
    actionBtns.forEach(btn => {
        if (btn) {
            btn.disabled = isSleeping;
            btn.style.opacity = isSleeping ? '0.4' : '';
        }
    });

    // 更新徽章
    updateBadges();
}

// 数字动画
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start) + "%";
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function updateStat(stat, value) {
    const fill = DOM[`${stat}Fill`];
    const num = DOM[`${stat}Num`];
    const row = DOM[`${stat}Row`];
    const currentVal = parseInt(num.textContent) || 0;

    fill.style.width = `${value}%`;

    // 只有数值变化较大时才动画，避免频繁跳动
    if (Math.abs(value - currentVal) > 1) {
        animateValue(num, currentVal, value, 500);
        // 数值变化时添加脉冲效果
        num.classList.add('pulse');
        setTimeout(() => num.classList.remove('pulse'), 300);
    } else {
        num.textContent = `${Math.round(value)}%`;
    }

    // 低属性警告
    if (value < WARNING_THRESHOLD) {
        row.classList.add('warning');
        fill.classList.add('low');
    } else {
        row.classList.remove('warning');
        fill.classList.remove('low');
    }
}

function updateSpeech() {
    let speeches;
    const hours = new Date().getHours();

    // 睡眠模式优先
    if (isSleeping) {
        speeches = SPEECHES.sleep;
    } else if (catState.hunger < 30) {
        speeches = SPEECHES.hungry;
    } else if (catState.mood < 30) {
        speeches = SPEECHES.sad;
    } else if (catState.energy < 30) {
        speeches = SPEECHES.tired;
    } else if (catState.mood >= 70) {
        speeches = SPEECHES.happy;
    } else {
        // 时段对话和普通对话混合
        if (hours >= 5 && hours < 12) {
            speeches = [...SPEECHES.normal, ...SPEECHES.morning];
        } else if (hours >= 12 && hours < 18) {
            speeches = [...SPEECHES.normal, ...SPEECHES.afternoon];
        } else if (hours >= 18 && hours < 23) {
            speeches = [...SPEECHES.normal, ...SPEECHES.evening];
        } else {
            speeches = [...SPEECHES.normal, ...SPEECHES.night];
        }
    }
    
    // 对话切换动画
    DOM.catSpeech.classList.add('changing');
    setTimeout(() => {
        DOM.catSpeech.textContent = speeches[Math.floor(Math.random() * speeches.length)];
        DOM.catSpeech.classList.remove('changing');
    }, 300);
}

function showBubble(text) {
    DOM.meowBubble.textContent = text;
    DOM.meowBubble.classList.add('show');
    setTimeout(() => DOM.meowBubble.classList.remove('show'), 1500);
}

function catBounce() {
    DOM.cat.classList.add('tapped');
    setTimeout(() => DOM.cat.classList.remove('tapped'), 300);
    if (navigator.vibrate) navigator.vibrate(30);
}

// ==================== 粒子特效 ====================
let particleLayer = null;
let activeParticles = 0;
const MAX_PARTICLES = 36;

function createParticles(x, y, emoji) {
    if (!particleLayer) {
        particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;
    }
    if (activeParticles >= MAX_PARTICLES) return;
    for (let i = 0; i < 6; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.textContent = emoji;

        // 随机发散方向
        const angle = Math.random() * Math.PI * 2;
        const velocity = 50 + Math.random() * 50;
        const tx = Math.cos(angle) * velocity + 'px';
        const ty = Math.sin(angle) * velocity + 'px';

        p.style.setProperty('--tx', tx);
        p.style.setProperty('--ty', ty);
        p.style.left = x + 'px';
        p.style.top = y + 'px';

        activeParticles++;
        particleLayer.appendChild(p);

        // 动画结束后移除
        setTimeout(() => { p.remove(); activeParticles--; }, 1000);
    }
}

function showComboNumber(count, x, y) {
    if (!particleLayer) {
        particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;
    }
    const el = document.createElement('div');
    el.className = 'combo-number';
    el.textContent = count + ' combo!';
    el.style.left = x + 'px';
    el.style.top = (y - 30) + 'px';
    particleLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

// ==================== 喂食、抚摸、玩耍 ====================
let lastFeedTime = 0;
let lastPetTime = 0;
let lastPlayTime = 0;
const COOLDOWN = 300;

// 食物菜单
function toggleFoodMenu() {
    if (isSleeping) { showBubble('猫咪在睡觉，别吵它~'); return; }
    const menu = document.getElementById('food-menu');
    if (!menu) return;
    const isOpen = menu.classList.contains('show');
    if (isOpen) {
        menu.classList.remove('show');
        return;
    }
    // 重置每日食物用量（新的一天）
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('food_date') !== today) {
        foodUsedToday = {};
        localStorage.setItem('food_date', today);
        localStorage.setItem('food_used', '{}');
    } else {
        try { foodUsedToday = JSON.parse(localStorage.getItem('food_used') || '{}'); } catch(e) { foodUsedToday = {}; }
    }
    // 渲染食物列表
    const level = getCatLevel();
    menu.innerHTML = '';
    FOODS.forEach(food => {
        const locked = level < food.levelReq;
        const used = foodUsedToday[food.id] || 0;
        const limitReached = used >= food.daily;
        const item = document.createElement('div');
        item.className = 'food-item' + (locked ? ' locked' : '') + (limitReached ? ' limit' : '');
        if (locked) {
            item.innerHTML = `<span class="food-icon">🔒</span><span class="food-name">Lv.${food.levelReq} 解锁</span>`;
        } else {
            const limitText = food.daily < Infinity ? ` <span class="food-limit">${food.daily - used}/${food.daily}</span>` : '';
            item.innerHTML = `<span class="food-icon">${food.icon}</span><span class="food-name">${food.name}${limitText}</span>`;
            if (!limitReached) {
                item.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    feedCatWith(food.id, e);
                    menu.classList.remove('show');
                });
            }
        }
        menu.appendChild(item);
    });
    menu.classList.add('show');
}

function feedCatWith(foodId, e) {
    const food = FOODS.find(f => f.id === foodId);
    if (!food) return;
    const now = Date.now();
    if (now - lastFeedTime < COOLDOWN) return;
    lastFeedTime = now;

    // 记录每日用量
    foodUsedToday[foodId] = (foodUsedToday[foodId] || 0) + 1;
    localStorage.setItem('food_used', JSON.stringify(foodUsedToday));

    DOM.feedBtn.classList.add('cooldown');
    setTimeout(() => DOM.feedBtn.classList.remove('cooldown'), COOLDOWN);

    const eff = food.effect;
    if (eff.hunger) catState.hunger = Math.min(MAX_STAT, catState.hunger + eff.hunger);
    if (eff.mood) catState.mood = Math.min(MAX_STAT, catState.mood + eff.mood);
    if (eff.energy) catState.energy = Math.min(MAX_STAT, catState.energy + eff.energy);
    catState.lastUpdate = now;
    catState.totalFeeds = (catState.totalFeeds || 0) + 1;

    showBubble(food.responses[Math.floor(Math.random() * food.responses.length)]);
    catBounce();
    updateDisplay();
    updateSpeech();
    saveToLocalStorage();
    if (e) createParticles(e.clientX, e.clientY, food.icon);
    trackQuest('feed');

    const updates = { lastUpdate: firebase.database.ServerValue.TIMESTAMP, totalFeeds: firebase.database.ServerValue.increment(1) };
    if (eff.hunger) updates.hunger = catState.hunger;
    if (eff.mood) updates.mood = catState.mood;
    if (eff.energy) updates.energy = catState.energy;
    catRef.update(updates);
    pushAction('feed');
}

function petCat() {
    if (isSleeping) { showBubble('嘳，让它再睡会儿~'); return; }
    const now = Date.now();
    if (now - lastPetTime < COOLDOWN) return;
    lastPetTime = now;

    DOM.petBtn.classList.add('cooldown');
    setTimeout(() => DOM.petBtn.classList.remove('cooldown'), COOLDOWN);

    catState.mood = Math.min(MAX_STAT, catState.mood + PET_EFFECT.mood);
    catState.energy = Math.min(MAX_STAT, catState.energy + PET_EFFECT.energy);
    catState.lastUpdate = now;
    catState.totalPets = (catState.totalPets || 0) + 1;

    showBubble(PET_RESPONSES[Math.floor(Math.random() * PET_RESPONSES.length)]);
    catBounce();
    updateDisplay();
    updateSpeech();
    saveToLocalStorage();
    trackQuest('pet');

    catRef.update({
        mood: catState.mood,
        energy: catState.energy,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        totalPets: firebase.database.ServerValue.increment(1)
    });
    pushAction('pet');
}

function playCat() {
    if (isSleeping) { showBubble('猫咪正在做美梦~'); return; }
    const now = Date.now();
    if (now - lastPlayTime < COOLDOWN) return;
    lastPlayTime = now;

    DOM.playBtn.classList.add('cooldown');
    setTimeout(() => DOM.playBtn.classList.remove('cooldown'), COOLDOWN);

    catState.energy = Math.min(MAX_STAT, catState.energy + PLAY_EFFECT.energy);
    catState.mood = Math.min(MAX_STAT, catState.mood + PLAY_EFFECT.mood);
    catState.hunger = Math.max(MIN_STAT, catState.hunger + PLAY_EFFECT.hunger);
    catState.lastUpdate = now;
    catState.totalPlays = (catState.totalPlays || 0) + 1;

    showBubble(PLAY_RESPONSES[Math.floor(Math.random() * PLAY_RESPONSES.length)]);
    catBounce();
    updateDisplay();
    updateSpeech();
    saveToLocalStorage();
    trackQuest('play');

    catRef.update({
        energy: catState.energy,
        mood: catState.mood,
        hunger: catState.hunger,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        totalPlays: firebase.database.ServerValue.increment(1)
    });
    pushAction('play');
}

// ==================== Firebase 同步 ====================
function showMainContent() {
    DOM.loadingScreen.style.opacity = '0';
    setTimeout(() => {
        DOM.loadingScreen.style.display = 'none';
        DOM.mainContent.style.opacity = '1';
        DOM.mainContent.classList.add('loaded');
    }, 400);
}

let isFirstLoad = true;

function initFirebase() {
    // 移除旧 listener，防止重试时重复绑定
    catRef.off('value');

    const timeout = setTimeout(() => {
        DOM.loadingText.textContent = '连接超时';
        DOM.retryBtn.style.display = 'block';
        loadFromLocalStorage();
    }, 8000);

    catRef.on('value', (snapshot) => {
        clearTimeout(timeout);
        const data = snapshot.val();
        if (data && data.lastUpdate) {
            const now = Date.now();
            const lastUpdate = Number(data.lastUpdate) || now;
            const hoursPassed = Math.max(0, (now - lastUpdate) / 3600000);

            let hunger = Number(data.hunger);
            let mood = Number(data.mood);
            let energy = Number(data.energy);

            if (isNaN(hunger)) hunger = 80;
            if (isNaN(mood)) mood = 70;
            if (isNaN(energy)) energy = 60;

            hunger = Math.max(MIN_STAT, Math.min(100, hunger - hoursPassed * DECAY_PER_HOUR.hunger));
            mood = Math.max(MIN_STAT, Math.min(100, mood - hoursPassed * DECAY_PER_HOUR.mood));
            energy = Math.max(MIN_STAT, Math.min(100, energy - hoursPassed * DECAY_PER_HOUR.energy));

            catState = {
                hunger: hunger,
                mood: mood,
                energy: energy,
                lastUpdate: now,
                totalFeeds: Number(data.totalFeeds) || 0,
                totalPets: Number(data.totalPets) || 0,
                totalPlays: Number(data.totalPlays) || 0,
                streak: Number(data.streak) || 0,
                lastVisitDate: data.lastVisitDate || ''
            };

            saveToLocalStorage();
            updateDisplay();
            updateSpeech();

            // 只在首次加载时执行
            if (isFirstLoad) {
                isFirstLoad = false;
                updateStreak();
                showMainContent();
            }
        } else {
            catState = {
                hunger: 80,
                mood: 70,
                energy: 60,
                lastUpdate: Date.now(),
                totalFeeds: 0,
                totalPets: 0,
                totalPlays: 0,
                streak: 0,
                lastVisitDate: ''
            };
            saveCatState();
            saveToLocalStorage();
            updateDisplay();
            updateSpeech();

            if (isFirstLoad) {
                isFirstLoad = false;
                updateStreak();
                showMainContent();
            }
        }
    }, (error) => {
        clearTimeout(timeout);
        DOM.loadingText.textContent = '连接失败';
        DOM.retryBtn.style.display = 'block';
        console.error(error);
        loadFromLocalStorage();
    });
}

// 本地缓存支持
function saveToLocalStorage() {
    try {
        localStorage.setItem('catState', JSON.stringify(catState));
    } catch (e) { }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('catState');
        if (saved) {
            catState = JSON.parse(saved);
            updateDisplay();
            updateSpeech();
            showMainContent();
            DOM.loadingText.textContent = '离线模式';
        }
    } catch (e) { }
}

function saveCatState() {
    catRef.update({
        hunger: catState.hunger,
        mood: catState.mood,
        energy: catState.energy,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        streak: catState.streak || 0,
        lastVisitDate: catState.lastVisitDate || ''
    });
    saveToLocalStorage();
}

// ==================== 本地定时衰减 ====================
function localDecay() {
    const now = Date.now();
    const secondsPassed = (now - catState.lastUpdate) / 1000;
    if (secondsPassed < 60) return;

    const hoursPassed = secondsPassed / 3600;
    catState.hunger = Math.max(MIN_STAT, catState.hunger - hoursPassed * DECAY_PER_HOUR.hunger);
    catState.mood = Math.max(MIN_STAT, catState.mood - hoursPassed * DECAY_PER_HOUR.mood);
    catState.energy = Math.max(MIN_STAT, catState.energy - hoursPassed * DECAY_PER_HOUR.energy);
    catState.lastUpdate = now;

    updateDisplay();
    updateSpeech();
    saveToLocalStorage();
}

// ==================== 可爱浮动装饰 ====================
function initCuteFloats() {
    const emojis = ['💕', '✨', '🌸', '💗', '⭐', '🩷', '🫧', '💫'];
    const layer = document.getElementById('weather-layer');
    if (!layer) return;

    function spawnFloat() {
        if (document.hidden) return;
        const el = document.createElement('div');
        el.className = 'cute-float';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left = (Math.random() * 100) + '%';
        el.style.fontSize = (10 + Math.random() * 8) + 'px';
        el.style.animationDuration = (15 + Math.random() * 20) + 's';
        el.style.animationDelay = (Math.random() * 2) + 's';
        layer.appendChild(el);
        setTimeout(() => el.remove(), 37000);
    }

    // 初始生成几个
    for (let i = 0; i < 4; i++) setTimeout(() => spawnFloat(), i * 2000);
    // 持续生成
    setInterval(spawnFloat, 6000);
}

// ==================== 猫咪小日记 ====================
const DIARY_TEMPLATES = {
    feed_many: ['今天吃了好多好吃的，肚子圆滚滚~', '被喂了好多次，幸福肥预警！', '今天的伙食太棒了！'],
    feed_few: ['今天只吃了一点点...', '好像有人忘记喂我了...'],
    pet_many: ['被摸了好多下，毛都顺了~', '今天被撸得好舒服，打了好多呼噜~'],
    pet_few: ['今天只被摸了一下就走了...', '想被多摸摸...'],
    play_many: ['今天玩疯了！累并快乐着~', '和人类玩了好久，开心！'],
    happy: ['今天心情超好！想翻肚皮~', '好开心的一天，喵~'],
    sad: ['今天有点不开心...需要抱抱', '心情不太好，想被哄哄~'],
    sleepy: ['好困好困...要去梦里抓蝴蝶了', '今天很累，早点睡吧~'],
    full: ['吃饱饱了，什么都不想做~', '肚子好饱，躺平了~'],
    duo: ['今天两个人都来看我了！双倍快乐！', '两个铲屎官都在，被宠爱的感觉~'],
    normal: ['平平淡淡的一天，也很好~', '今天和往常一样，安安静静的~', '嗯...普普通通的一天~'],
};

function generateDiary() {
    const entries = [];
    const feeds = catState.totalFeeds || 0;
    const pets = catState.totalPets || 0;
    const plays = catState.totalPlays || 0;

    // 根据今日任务进度判断
    const todayFeeds = parseInt(localStorage.getItem('quest_progress') ? (JSON.parse(localStorage.getItem('quest_progress')).today_feed || 0) : 0);
    const todayPets = parseInt(localStorage.getItem('quest_progress') ? (JSON.parse(localStorage.getItem('quest_progress')).today_pet || 0) : 0);

    if (todayFeeds >= 3) entries.push(...DIARY_TEMPLATES.feed_many);
    else if (todayFeeds >= 1) entries.push(...DIARY_TEMPLATES.feed_few);

    if (todayPets >= 3) entries.push(...DIARY_TEMPLATES.pet_many);
    else if (todayPets >= 1) entries.push(...DIARY_TEMPLATES.pet_few);

    if (catState.mood >= 80) entries.push(...DIARY_TEMPLATES.happy);
    else if (catState.mood < 30) entries.push(...DIARY_TEMPLATES.sad);

    if (catState.energy < 30) entries.push(...DIARY_TEMPLATES.sleepy);
    if (catState.hunger >= 90) entries.push(...DIARY_TEMPLATES.full);

    if (entries.length === 0) entries.push(...DIARY_TEMPLATES.normal);

    // 基于日期种子选一条
    const seed = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')) + entries.length;
    return entries[seed % entries.length];
}

function initDiary() {
    const el = document.getElementById('cat-diary');
    if (!el) return;
    // 延迟生成，等 Firebase 数据加载完
    setTimeout(() => {
        el.textContent = '📖 ' + generateDiary();
    }, 3000);
}

// ==================== 情侣功能 ====================
const LOVE_START = new Date('2025-12-05T00:00:00');
const LOVE_MILESTONES = [7, 30, 50, 100, 200, 365, 500, 520, 730, 999, 1000, 1314];

const LOVE_QUOTES = [
    '今天也想你了~', '你是我最甜的心事', '有你的日子都是晴天',
    '想和你一起慢慢变老', '世界那么大，我只想和你在一起',
    '遇见你，是所有故事的开始', '每天醒来第一个想到的人是你',
    '你笑起来真好看', '能和你在一起就是最大的幸运',
    '我不要短暂的温存，只要你一世的陪伴',
    '你是我见过最可爱的人', '陪你到世界之巅',
    '喜欢你已经超过两分钟了，不能撤回了',
    '我想做你床边的闹钟，负责叫你起床',
    '你是限量版的快乐', '想把所有的温柔都给你',
    '心里有你 生活就有了光', '今天也要开开心心鸭',
    '你是我的例外也是我的偏爱', '往后余生 风雪是你 平淡是你',
    '全世界都在催我长大 只有你宠我像个小孩',
    '我这一生 除了故乡 就是你', '每天最期待的事就是和你说晚安',
    '你眼中有星河万顷 我溺于你目光之中',
    '想牵你的手 从心动到古稀', '你是我藏在骨子里的温柔',
    '月亮不睡我不睡 我是你的小宝贝', '山水万程 皆要好运',
    '你的眼睛里有星辰和大海', '我见过银河 但只爱这一颗星',
    '春风十里不如你', '我喜欢你 像风走了八千里',
    '世间美好与你环环相扣', '我与春风皆过客 你携秋水揽星河',
    '人海十万里 我只想要你', '我想和你互相浪费 一起虚度短的沉默',
    '你是我翻山越岭后看到的彩虹', '承蒙你出现 够我喜欢好多年',
    '如果你是月亮 我就是你旁边那颗最亮的星',
    '不是除了你我就没人要了 而是除了你我谁都不想要',
    '落日归山海 山海藏深意', '晚风踏月来 替我与你说一句晚安',
    '想把整个秋天的温柔都揉进你的怀里',
    '今天的月亮好圆 好想咬一口 然后问你甜不甜',
];

// 打字机效果
function typewriterQuote(text) {
    const el = document.getElementById('quote-text');
    const cursor = document.querySelector('.quote-cursor');
    if (!el) return;
    el.textContent = '';
    if (cursor) cursor.style.display = '';
    let i = 0;
    const timer = setInterval(() => {
        if (i < text.length) {
            el.textContent += text[i];
            i++;
        } else {
            clearInterval(timer);
            // 打完后隐藏光标
            setTimeout(() => { if (cursor) cursor.style.display = 'none'; }, 2000);
        }
    }, 80);
}

// 根据时间段选择装饰 emoji
function getQuoteDeco() {
    const h = new Date().getHours();
    if (h >= 5 && h < 8) return '🌅';
    if (h >= 8 && h < 12) return '☀️';
    if (h >= 12 && h < 14) return '🌤️';
    if (h >= 14 && h < 18) return '🌸';
    if (h >= 18 && h < 20) return '🌇';
    if (h >= 20 && h < 23) return '🌙';
    return '✨';
}

function initLoveDays() {
    const el = document.getElementById('love-days');
    const panelEl = document.getElementById('love-days-panel');
    const quoteEl = document.getElementById('love-quote-panel');
    if (!el) return;

    const now = new Date();
    const diff = Math.floor((now - LOVE_START) / 86400000) + 1;
    if (diff < 1) { el.textContent = '0'; return; }
    el.textContent = diff;
    if (panelEl) panelEl.textContent = diff;

    // 里程碑检查
    if (LOVE_MILESTONES.includes(diff)) {
        showBubble('在一起第 ' + diff + ' 天啦！');
        setTimeout(() => {
            const cat = document.querySelector('.cat-static');
            if (cat) {
                for (let i = 0; i < 8; i++) {
                    const rect = cat.getBoundingClientRect();
                    setTimeout(() => createParticles(
                        rect.left + rect.width / 2 + (Math.random() - 0.5) * 60,
                        rect.top + rect.height / 2 + (Math.random() - 0.5) * 40,
                        '❤️'
                    ), i * 120);
                }
            }
        }, 500);
    }

    // 每日情话（基于日期种子）
    const seed = parseInt(now.toISOString().slice(0, 10).replace(/-/g, ''));
    const idx = seed % LOVE_QUOTES.length;
    if (quoteEl) quoteEl.textContent = LOVE_QUOTES[idx];

    // 主屏打字机情话
    const decoEl = document.querySelector('.quote-deco');
    if (decoEl) decoEl.textContent = getQuoteDeco();
    setTimeout(() => typewriterQuote(LOVE_QUOTES[idx]), 1500);
}

// 双人连击彩蛋
let lastDuoCheckTime = 0;

function checkDuoCombo() {
    const now = Date.now();
    if (now - lastDuoCheckTime < 5000) return;
    lastDuoCheckTime = now;

    actionsRef.orderByChild('time').limitToLast(2).once('value', (snap) => {
        const actions = [];
        snap.forEach(child => actions.push(child.val()));
        if (actions.length < 2) return;

        const a = actions[0], b = actions[1];
        if (!a || !b) return;
        // 两个不同 session，且时间差 < 30 秒
        if (a.sid !== b.sid && Math.abs((a.time || 0) - (b.time || 0)) < 30000) {
            triggerDuoEffect();
        }
    });
}

let duoEffectCooldown = false;

function triggerDuoEffect() {
    if (duoEffectCooldown) return;
    duoEffectCooldown = true;
    setTimeout(() => { duoEffectCooldown = false; }, 60000);

    showBubble('你们都在！双倍快乐！');
    if (navigator.vibrate) navigator.vibrate([30, 60, 30, 60, 30]);

    // 爱心爆炸特效
    const cat = document.querySelector('.cat-static');
    if (!cat) return;
    const rect = cat.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hearts = ['❤️', '💕', '💗', '💖', '💘'];
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            createParticles(
                cx + (Math.random() - 0.5) * 80,
                cy + (Math.random() - 0.5) * 60,
                hearts[Math.floor(Math.random() * hearts.length)]
            );
        }, i * 80);
    }

    // 双人奖励：所有属性 +5
    catState.hunger = Math.min(MAX_STAT, catState.hunger + 5);
    catState.mood = Math.min(MAX_STAT, catState.mood + 5);
    catState.energy = Math.min(MAX_STAT, catState.energy + 5);
    catState.lastUpdate = Date.now();
    updateDisplay();
    saveToLocalStorage();
    catRef.update({
        hunger: catState.hunger,
        mood: catState.mood,
        energy: catState.energy,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP
    });
}

// ==================== 摇一摇撸猫 ====================
let lastShakeTime = 0;
let shakeThreshold = 20;

function initShake() {
    if (!window.DeviceMotionEvent) return;
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastAccTime = 0;

    window.addEventListener('devicemotion', (e) => {
        const acc = e.accelerationIncludingGravity;
        if (!acc) return;
        const now = Date.now();
        if (now - lastAccTime < 100) return;
        lastAccTime = now;

        const dx = Math.abs(acc.x - lastX);
        const dy = Math.abs(acc.y - lastY);
        const dz = Math.abs(acc.z - lastZ);
        lastX = acc.x; lastY = acc.y; lastZ = acc.z;

        if ((dx + dy + dz) > shakeThreshold && now - lastShakeTime > 2000) {
            lastShakeTime = now;
            shakePet();
        }
    });
}

function shakePet() {
    if (isSleeping) { showBubble('嘘…猫咪在睡觉'); return; }
    const PURR = ['咕噜咕噜~', '呼噜呼噜…', '好舒服喵~', '再摇摇嘛~', '被摇晕啦~'];
    showBubble(PURR[Math.floor(Math.random() * PURR.length)]);
    catBounce();

    catState.mood = Math.min(MAX_STAT, catState.mood + 3);
    catState.lastUpdate = Date.now();
    updateDisplay();
    saveToLocalStorage();
    catRef.update({ mood: catState.mood, lastUpdate: firebase.database.ServerValue.TIMESTAMP });

    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
}

// ==================== 额外功能 ====================
// 猫咪眨眼
function blinkCat() {
    const eyes = document.querySelectorAll('.eye');
    eyes.forEach(eye => eye.classList.add('blink'));
    setTimeout(() => {
        eyes.forEach(eye => eye.classList.remove('blink'));
    }, 200);

    // 随机下一次眨眼时间 (3-8秒)
    setTimeout(blinkCat, Math.random() * 5000 + 3000);
}

// 动态天气
let lastWeatherMode = null;
function updateWeather(hours) {
    if (!DOM.weatherLayer) return;
    const mode = (hours >= 6 && hours < 18) ? 'day' : 'night';
    if (mode === lastWeatherMode) return;
    lastWeatherMode = mode;
    // 只移除天气元素（cloud/star），保留 cute-float 装饰粒子
    DOM.weatherLayer.querySelectorAll('.cloud, .star, .holiday-particle').forEach(el => el.remove());

    if (mode === 'day') {
        // 白天：云朵
        for (let i = 0; i < 4; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            cloud.style.top = (5 + Math.random() * 40) + '%';
            cloud.style.animationDuration = (25 + Math.random() * 25) + 's';
            cloud.style.animationDelay = -(Math.random() * 20) + 's';
            cloud.style.transform = `scale(${0.6 + Math.random() * 0.6})`;
            DOM.weatherLayer.appendChild(cloud);
        }
    } else {
        // 晚上：星星
        for (let i = 0; i < 40; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 70 + '%';
            star.style.width = star.style.height = (2 + Math.random() * 3) + 'px';
            star.style.animationDelay = Math.random() * 3 + 's';
            DOM.weatherLayer.appendChild(star);
        }
    }
}

// ==================== 猫咪装扮 ====================
const ACCESSORIES = [
    { id: 'none', icon: '❌', name: '无', levelReq: 1, css: '' },
    { id: 'ribbon', icon: '🎀', name: '蝴蝶结', levelReq: 1, css: 'acc-ribbon' },
    { id: 'crown', icon: '👑', name: '皇冠', levelReq: 3, css: 'acc-crown' },
    { id: 'glasses', icon: '🕶️', name: '墨镜', levelReq: 4, css: 'acc-glasses' },
    { id: 'flower', icon: '🌸', name: '小花', levelReq: 5, css: 'acc-flower' },
    { id: 'hat', icon: '🎩', name: '礼帽', levelReq: 6, css: 'acc-hat' },
    { id: 'scarf', icon: '🧣', name: '围巾', levelReq: 7, css: 'acc-scarf' },
    { id: 'halo', icon: '😇', name: '光环', levelReq: 8, css: 'acc-halo' },
    { id: 'star', icon: '⭐', name: '星星', levelReq: 10, css: 'acc-star' },
];

let currentAccessory = 'none';

function initAccessory() {
    // 从 Firebase 或本地读取当前装扮
    const saved = localStorage.getItem('cat_accessory');
    if (saved) {
        currentAccessory = saved;
        applyAccessory(currentAccessory);
    }
    // 同步 Firebase
    catRef.child('accessory').on('value', (snap) => {
        const val = snap.val();
        if (val && val !== currentAccessory) {
            currentAccessory = val;
            localStorage.setItem('cat_accessory', val);
            applyAccessory(val);
        }
    });
}

function applyAccessory(accId) {
    const el = document.getElementById('cat-accessory');
    if (!el) return;
    const acc = ACCESSORIES.find(a => a.id === accId);
    if (!acc || acc.id === 'none') {
        el.className = 'cat-accessory';
        el.textContent = '';
        return;
    }
    el.className = 'cat-accessory ' + acc.css;
    el.textContent = acc.icon;
}

function toggleAccessoryPanel() {
    let panel = document.getElementById('accessory-panel');
    if (panel) {
        panel.remove();
        return;
    }
    panel = document.createElement('div');
    panel.id = 'accessory-panel';
    panel.className = 'accessory-panel show';

    const level = getCatLevel();
    ACCESSORIES.forEach(acc => {
        const locked = level < acc.levelReq;
        const active = currentAccessory === acc.id;
        const item = document.createElement('div');
        item.className = 'acc-item' + (locked ? ' locked' : '') + (active ? ' active' : '');
        if (locked) {
            item.innerHTML = '<span class="acc-icon">🔒</span><span class="acc-name">Lv.' + acc.levelReq + '</span>';
        } else {
            item.innerHTML = '<span class="acc-icon">' + acc.icon + '</span><span class="acc-name">' + acc.name + '</span>';
            item.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectAccessory(acc.id);
                panel.remove();
            });
        }
        panel.appendChild(item);
    });

    const wrapper = document.querySelector('.cat-wrapper');
    if (wrapper) wrapper.appendChild(panel);
}

function selectAccessory(accId) {
    currentAccessory = accId;
    localStorage.setItem('cat_accessory', accId);
    applyAccessory(accId);
    catRef.child('accessory').set(accId);
    showBubble(accId === 'none' ? '素颜也好看~' : '新装扮！');
    if (navigator.vibrate) navigator.vibrate(15);
}

// ==================== 节日系统 ====================
// 固定公历节日（每年相同）
const SOLAR_HOLIDAYS = [
    { name: '元旦', m: 1, d: 1, range: 2, particles: ['🎉', '🎊', '✨'], greeting: '新年快乐！', icon: '🎊' },
    { name: '情人节', m: 2, d: 14, range: 1, particles: ['💕', '💗', '🌹', '💘'], greeting: '情人节快乐，宝贝~', icon: '💕' },
    { name: '妇女节', m: 3, d: 8, range: 1, particles: ['🌷', '💐', '✨'], greeting: '女神节快乐~', icon: '🌷' },
    { name: '白色情人节', m: 3, d: 14, range: 1, particles: ['🤍', '🌸', '💌'], greeting: '白色情人节~', icon: '💌' },
    { name: '愚人节', m: 4, d: 1, range: 1, particles: ['🤡', '😜', '🎭'], greeting: '今天可不能骗我哦~', icon: '🤡' },
    { name: '劳动节', m: 5, d: 1, range: 1, particles: ['🌻', '💪', '✨'], greeting: '劳动节快乐！', icon: '💪' },
    { name: '520', m: 5, d: 20, range: 1, particles: ['❤️', '💕', '💗', '💖'], greeting: '520，我爱你~', icon: '❤️' },
    { name: '儿童节', m: 6, d: 1, range: 1, particles: ['🎈', '🎁', '⭐', '🍭'], greeting: '永远做个小孩~', icon: '🎈' },
    { name: '国庆节', m: 10, d: 1, range: 3, particles: ['🇨🇳', '🎆', '🏮', '✨'], greeting: '国庆节快乐！', icon: '🇨🇳' },
    { name: '万圣节', m: 10, d: 31, range: 2, particles: ['🎃', '👻', '🦇', '�️'], greeting: '万圣节快乐！', icon: '🎃' },
    { name: '平安夜', m: 12, d: 24, range: 1, particles: ['🍎', '🌟', '❄️'], greeting: '平安夜，送你一个苹果~', icon: '🍎' },
    { name: '圣诞节', m: 12, d: 25, range: 3, particles: ['🎄', '🎅', '❄️', '⭐', '🎁'], greeting: '圣诞快乐！', icon: '🎄' },
    { name: '恋爱纪念日', m: 12, d: 5, range: 1, particles: ['💕', '💖', '✨', '🎀'], greeting: '纪念日快乐！我们又一年啦~', icon: '💍' },
];

// 农历节日（预计算公历日期，覆盖 2025-2028）
const LUNAR_HOLIDAYS = {
    2025: [
        { name: '除夕', m: 1, d: 28, range: 1, particles: ['🧨', '🎆', '🏮', '🧧'], greeting: '除夕快乐，年夜饭吃了吗~', icon: '🧨' },
        { name: '春节', m: 1, d: 29, range: 6, particles: ['🧧', '🎆', '🏮', '🐍'], greeting: '新春快乐！蛇年大吉！', icon: '🧧' },
        { name: '元宵节', m: 2, d: 12, range: 1, particles: ['🏮', '🎑', '✨', '🧨'], greeting: '元宵节快乐~', icon: '🏮' },
        { name: '龙抬头', m: 3, d: 29, range: 1, particles: ['🐉', '✨', '🌾'], greeting: '二月二龙抬头~', icon: '🐉' },
        { name: '清明节', m: 4, d: 4, range: 1, particles: ['🌿', '🍃', '🌸'], greeting: '清明时节~', icon: '🌿' },
        { name: '端午节', m: 5, d: 31, range: 1, particles: ['🐲', '�', '🌿'], greeting: '端午安康~', icon: '🐲' },
        { name: '七夕', m: 8, d: 29, range: 1, particles: ['💫', '🌟', '💕', '🎋'], greeting: '七夕快乐，我的宝贝~', icon: '🎋' },
        { name: '中元节', m: 9, d: 7, range: 1, particles: ['🏮', '🌕', '🪷'], greeting: '中元节~', icon: '🏮' },
        { name: '中秋节', m: 10, d: 6, range: 2, particles: ['🥮', '🌕', '🏮', '🐇'], greeting: '中秋快乐！吃月饼了吗~', icon: '🥮' },
        { name: '重阳节', m: 10, d: 29, range: 1, particles: ['🌺', '🍂', '🏔️'], greeting: '重阳安康~', icon: '🌺' },
    ],
    2026: [
        { name: '除夕', m: 2, d: 16, range: 1, particles: ['🧨', '🎆', '🏮', '🧧'], greeting: '除夕快乐，年夜饭吃了吗~', icon: '🧨' },
        { name: '春节', m: 2, d: 17, range: 6, particles: ['�', '�', '🏮', '🐴'], greeting: '新春快乐！马年大吉！', icon: '🧧' },
        { name: '元宵节', m: 3, d: 3, range: 1, particles: ['🏮', '🎑', '✨', '🧨'], greeting: '元宵节快乐~', icon: '🏮' },
        { name: '龙抬头', m: 3, d: 18, range: 1, particles: ['🐉', '✨', '🌾'], greeting: '二月二龙抬头~', icon: '🐉' },
        { name: '清明节', m: 4, d: 5, range: 1, particles: ['🌿', '🍃', '🌸'], greeting: '清明时节~', icon: '🌿' },
        { name: '端午节', m: 6, d: 19, range: 1, particles: ['🐲', '🎐', '🌿'], greeting: '端午安康~', icon: '🐲' },
        { name: '七夕', m: 8, d: 19, range: 1, particles: ['💫', '🌟', '💕', '🎋'], greeting: '七夕快乐，我的宝贝~', icon: '🎋' },
        { name: '中秋节', m: 9, d: 25, range: 2, particles: ['🥮', '🌕', '🏮', '🐇'], greeting: '中秋快乐！吃月饼了吗~', icon: '🥮' },
        { name: '重阳节', m: 10, d: 18, range: 1, particles: ['🌺', '🍂', '🏔️'], greeting: '重阳安康~', icon: '🌺' },
    ],
    2027: [
        { name: '除夕', m: 2, d: 5, range: 1, particles: ['🧨', '�', '🏮', '�'], greeting: '除夕快乐~', icon: '🧨' },
        { name: '春节', m: 2, d: 6, range: 6, particles: ['🧧', '🎆', '🏮', '🐏'], greeting: '新春快乐！羊年大吉！', icon: '🧧' },
        { name: '元宵节', m: 2, d: 20, range: 1, particles: ['🏮', '🎑', '✨'], greeting: '元宵节快乐~', icon: '🏮' },
        { name: '清明节', m: 4, d: 5, range: 1, particles: ['🌿', '🍃', '🌸'], greeting: '清明时节~', icon: '🌿' },
        { name: '端午节', m: 6, d: 8, range: 1, particles: ['🐲', '🎐', '🌿'], greeting: '端午安康~', icon: '🐲' },
        { name: '七夕', m: 8, d: 8, range: 1, particles: ['💫', '🌟', '💕', '🎋'], greeting: '七夕快乐，我的宝贝~', icon: '🎋' },
        { name: '中秋节', m: 9, d: 15, range: 2, particles: ['🥮', '�', '🏮', '🐇'], greeting: '中秋快乐！', icon: '🥮' },
        { name: '重阳节', m: 10, d: 8, range: 1, particles: ['🌺', '🍂', '🏔️'], greeting: '重阳安康~', icon: '🌺' },
    ],
    2028: [
        { name: '除夕', m: 1, d: 25, range: 1, particles: ['🧨', '🎆', '🏮', '🧧'], greeting: '除夕快乐~', icon: '🧨' },
        { name: '春节', m: 1, d: 26, range: 6, particles: ['🧧', '🎆', '🏮', '🐵'], greeting: '新春快乐！', icon: '🧧' },
        { name: '元宵节', m: 2, d: 9, range: 1, particles: ['🏮', '🎑', '✨'], greeting: '元宵节快乐~', icon: '🏮' },
        { name: '清明节', m: 4, d: 4, range: 1, particles: ['🌿', '🍃', '🌸'], greeting: '清明时节~', icon: '🌿' },
        { name: '端午节', m: 5, d: 28, range: 1, particles: ['🐲', '🎐', '🌿'], greeting: '端午安康~', icon: '🐲' },
        { name: '七夕', m: 7, d: 27, range: 1, particles: ['💫', '🌟', '💕', '🎋'], greeting: '七夕快乐~', icon: '🎋' },
        { name: '中秋节', m: 9, d: 3, range: 2, particles: ['🥮', '🌕', '🏮', '🐇'], greeting: '中秋快乐！', icon: '🥮' },
        { name: '重阳节', m: 9, d: 26, range: 1, particles: ['🌺', '🍂', '🏔️'], greeting: '重阳安康~', icon: '🌺' },
    ],
};

function getAllHolidays() {
    const year = new Date().getFullYear();
    const list = [];

    // 公历节日
    SOLAR_HOLIDAYS.forEach(h => {
        list.push({ ...h, date: new Date(year, h.m - 1, h.d) });
    });

    // 农历节日（当年）
    const lunar = LUNAR_HOLIDAYS[year];
    if (lunar) {
        lunar.forEach(h => {
            list.push({ ...h, date: new Date(year, h.m - 1, h.d) });
        });
    }
    // 下一年的农历节日（跨年用，如今年12月要倒计时到明年春节）
    const lunarNext = LUNAR_HOLIDAYS[year + 1];
    if (lunarNext) {
        lunarNext.forEach(h => {
            list.push({ ...h, date: new Date(year + 1, h.m - 1, h.d) });
        });
    }
    // 下一年的公历节日（跨年用）
    SOLAR_HOLIDAYS.forEach(h => {
        list.push({ ...h, date: new Date(year + 1, h.m - 1, h.d) });
    });

    return list;
}

let currentHoliday = null;
let holidayDecorated = false;

function checkHoliday() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = getAllHolidays();

    for (const h of list) {
        const start = new Date(h.date);
        const end = new Date(h.date);
        end.setDate(end.getDate() + (h.range || 1) - 1);
        if (today >= start && today <= end) return h;
    }
    return null;
}

function getNextHoliday() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = getAllHolidays();

    // 排序并找第一个在今天之后的
    list.sort((a, b) => a.date - b.date);
    for (const h of list) {
        if (h.date > today) {
            const diff = Math.ceil((h.date - today) / 86400000);
            return { ...h, daysLeft: diff };
        }
    }
    return null;
}

function initHolidayCountdown() {
    const el = document.getElementById('holiday-countdown-panel');
    if (!el) return;

    // 当天节日
    const todayH = checkHoliday();
    if (todayH) {
        el.innerHTML = '<span class="hc-icon">' + todayH.icon + '</span> 今天是<b>' + todayH.name + '</b>！';
        el.classList.add('today');
    } else {
        const next = getNextHoliday();
        if (next) {
            el.innerHTML = '<span class="hc-icon">' + next.icon + '</span> 距<b>' + next.name + '</b>还有 <b>' + next.daysLeft + '</b> 天';
        }
    }
}

function applyHolidayTheme() {
    currentHoliday = checkHoliday();

    // 节日倒计时（无论今天是否节日都显示）
    initHolidayCountdown();

    if (!currentHoliday || holidayDecorated) return;
    holidayDecorated = true;

    // 显示节日问候
    showBubble(currentHoliday.greeting);

    // 在 weather-layer 上撒节日装饰粒子
    if (!DOM.weatherLayer) return;
    const emojis = currentHoliday.particles;
    for (let i = 0; i < 15; i++) {
        const el = document.createElement('div');
        el.className = 'holiday-particle';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left = Math.random() * 100 + '%';
        el.style.animationDelay = (Math.random() * 8) + 's';
        el.style.animationDuration = (6 + Math.random() * 6) + 's';
        el.style.fontSize = (14 + Math.random() * 10) + 'px';
        DOM.weatherLayer.appendChild(el);
    }
}

// ==================== 初始化 ====================
function initApp() {
    // 缓存 DOM 元素
    cacheDOM();
    
    updateTime();
    setInterval(updateTime, 1000);

    initFortune();
    DOM.fortuneCard.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        drawFortune();
    });

    setInterval(updateSpeech, 15000);

    // 接鱼小游戏
    startFishGame();

    // 本地定时衰减（每60秒）
    setInterval(localDecay, 60000);

    // 随机事件（每30秒检查一次）
    setInterval(triggerRandomEvent, 30000);
    // 进入时60秒后触发第一次
    setTimeout(triggerRandomEvent, 60000);

    // 启动额外功能
    initShake();
    blinkCat();
    initCuteFloats();
    // 初始调用一次天气 (传入当前小时)
    const nowHour = new Date().getHours();
    updateWeather(nowHour);
    // 每小时更新一次天气
    setInterval(() => updateWeather(new Date().getHours()), 3600000);

    // 节日主题
    applyHolidayTheme();

    // 情侣功能
    initLoveDays();

    // 猫咪小日记
    initDiary();

    // 猫咪装扮
    document.getElementById('accessory-btn').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAccessoryPanel();
    });
    document.addEventListener('pointerdown', (e) => {
        const panel = document.getElementById('accessory-panel');
        if (panel && !e.target.closest('#accessory-panel') && !e.target.closest('#accessory-btn')) {
            panel.remove();
        }
    });

    initFirebase();
    initAccessory();

    // 每日任务
    initQuests();

    // 双人互动提示
    initActionListener();

    // 在线状态
    initPresence();

    // 留言板
    initMsgBoard();
    document.getElementById('msg-send').addEventListener('click', sendMessage);
    document.getElementById('msg-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // 悄悄话
    document.getElementById('whisper-send').addEventListener('click', sendWhisper);
    document.getElementById('whisper-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendWhisper(); }
    });
    document.getElementById('whisper-popup-close').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        closeWhisperPopup();
    });

    // 侧边功能导航
    initBottomNav();
    // 延迟 2 秒检查是否有未读悄悄话
    setTimeout(checkWhispers, 2000);

    // 事件绑定
    DOM.feedBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFoodMenu();
    });

    // 点击其他区域关闭食物菜单
    document.addEventListener('pointerdown', (e) => {
        const menu = document.getElementById('food-menu');
        if (menu && menu.classList.contains('show') && !e.target.closest('#feed-btn') && !e.target.closest('#food-menu')) {
            menu.classList.remove('show');
        }
    });

    DOM.petBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        petCat();
        createParticles(e.clientX, e.clientY, '💖');
    });

    DOM.playBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        playCat();
        createParticles(e.clientX, e.clientY, '🎾');
    });

    // 猫咪点击：连续戳猫 combo + 长按彩蛋
    let longPressTimer = null;
    let isLongPress = false;
    let comboCount = 0;
    let comboTimer = null;

    const COMBO_REACTIONS = [
        { min: 1, msg: '喵~', emoji: '⭐' },
        { min: 3, msg: '喵喵喵！', emoji: '✨' },
        { min: 6, msg: '别戳啦！！', emoji: '💢' },
        { min: 10, msg: '好痒好痒！！', emoji: '😹' },
        { min: 15, msg: '要被戳穿啦！', emoji: '🌟' },
        { min: 20, msg: '投降投降！！', emoji: '🏳️' },
        { min: 30, msg: '戳猫大师！！', emoji: '👑' },
    ];

    function getComboReaction(count) {
        let reaction = COMBO_REACTIONS[0];
        for (const r of COMBO_REACTIONS) {
            if (count >= r.min) reaction = r;
        }
        return reaction;
    }

    DOM.cat.addEventListener('pointerdown', (e) => {
        isLongPress = false;
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            showBubble(LONG_PRESS_RESPONSES[Math.floor(Math.random() * LONG_PRESS_RESPONSES.length)]);
            catRef.transaction((current) => {
                if (!current) return null;
                const newState = { ...current, mood: Math.min(MAX_STAT, current.mood + 5) };
                catState.mood = newState.mood;
                return newState;
            }, (error) => { if (error) console.error('Long press error:', error); });
            updateDisplay();
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
            for (let i = 0; i < 3; i++) {
                setTimeout(() => createParticles(e.clientX + (Math.random() - 0.5) * 40, e.clientY + (Math.random() - 0.5) * 40, '❤️'), i * 150);
            }
        }, 600);
    });

    DOM.cat.addEventListener('pointerup', (e) => {
        clearTimeout(longPressTimer);
        if (!isLongPress) {
            comboCount++;
            clearTimeout(comboTimer);
            comboTimer = setTimeout(() => { comboCount = 0; }, 1500);

            const reaction = getComboReaction(comboCount);
            showBubble(reaction.msg);
            catBounce();
            createParticles(e.clientX, e.clientY, reaction.emoji);

            // combo >= 10 时显示 combo 数
            if (comboCount >= 10) {
                showComboNumber(comboCount, e.clientX, e.clientY);
            }

            // combo >= 20 时奖励心情
            if (comboCount === 20 || comboCount === 30) {
                catState.mood = Math.min(MAX_STAT, catState.mood + 3);
                updateDisplay();
                saveToLocalStorage();
                catRef.update({ mood: catState.mood, lastUpdate: firebase.database.ServerValue.TIMESTAMP });
            }

            if (navigator.vibrate) navigator.vibrate(8 + Math.min(comboCount * 2, 30));
        }
    });

    DOM.cat.addEventListener('pointerleave', () => {
        clearTimeout(longPressTimer);
    });
    
    // 重试按钮
    DOM.retryBtn.addEventListener('click', () => {
        DOM.retryBtn.style.display = 'none';
        DOM.loadingText.textContent = '正在重连';
        initFirebase();
    });
}

// ==================== 底部功能面板 ====================
let activePanel = null;

function openPanel(panelId) {
    if (activePanel) closePanel(activePanel);
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.add('show');
    activePanel = panelId;
    lockScroll();
    pushOverlayState();

    // 高亮对应导航按钮
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === panelId);
    });

    // 自动聚焦面板内输入框
    const input = panel.querySelector('.panel-input');
    if (input) setTimeout(() => input.focus(), 400);

    if (navigator.vibrate) navigator.vibrate(10);
}

function closePanel(panelId) {
    const panel = document.getElementById(panelId || activePanel);
    if (panel) {
        panel.classList.remove('show');
        // 收起键盘
        const input = panel.querySelector('.panel-input');
        if (input) input.blur();
        // 重置滑动状态
        const sheet = panel.querySelector('.panel-sheet');
        if (sheet) sheet.style.transform = '';
    }
    if (activePanel) unlockScroll();
    activePanel = null;

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
}

function initBottomNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const panelId = btn.dataset.panel;
            if (activePanel === panelId) {
                closePanel(panelId);
            } else {
                openPanel(panelId);
            }
            if (navigator.vibrate) navigator.vibrate(8);
        });
    });

    // 快捷卡片点击打开面板
    document.querySelectorAll('.quick-card').forEach(card => {
        card.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const panelId = card.dataset.panel;
            if (panelId) openPanel(panelId);
            if (navigator.vibrate) navigator.vibrate(8);
        });
    });

    // 点击面板背景关闭
    document.querySelectorAll('.panel-overlay').forEach(overlay => {
        overlay.addEventListener('pointerdown', (e) => {
            if (e.target === overlay) closePanel();
        });
    });

    // 关闭按钮
    document.querySelectorAll('.panel-close').forEach(btn => {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closePanel();
        });
    });

    // 右滑手势关闭面板
    initPanelSwipe();
}

// 面板右滑手势关闭
function initPanelSwipe() {
    let startX = 0, startY = 0, swiping = false, sheet = null;

    document.querySelectorAll('.panel-sheet').forEach(el => {
        el.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            swiping = false;
            sheet = el;
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            if (!sheet) return;
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;

            // 只在水平滑动且向右时启用
            if (!swiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5 && dx > 0) {
                swiping = true;
            }

            if (swiping) {
                e.preventDefault();
                const offset = Math.max(0, dx);
                sheet.style.transform = 'translateX(' + offset + 'px)';
                sheet.style.transition = 'none';
            }
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            if (!sheet || !swiping) return;
            const dx = e.changedTouches[0].clientX - startX;
            sheet.style.transition = '';

            if (dx > 80) {
                closePanel();
                if (navigator.vibrate) navigator.vibrate(10);
            } else {
                sheet.style.transform = '';
            }
            swiping = false;
            sheet = null;
        }, { passive: true });
    });
}

// ==================== 触摸振动工具 ====================
function vibrate(pattern) {
    if (navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch(e) {}
    }
}

// ==================== 页面可见性优化 ====================
function initVisibilityOptimization() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.body.classList.add('page-hidden');
        } else {
            document.body.classList.remove('page-hidden');
        }
    });
}

// ==================== iOS 键盘适配 ====================
function initKeyboardAdaptation() {
    if (!('visualViewport' in window)) return;

    window.visualViewport.addEventListener('resize', () => {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardHeight = windowHeight - viewportHeight;

        if (keyboardHeight > 100) {
            document.documentElement.style.setProperty('--keyboard-height', keyboardHeight + 'px');
            document.body.classList.add('keyboard-open');
        } else {
            document.documentElement.style.setProperty('--keyboard-height', '0px');
            document.body.classList.remove('keyboard-open');
        }
    });
}

// ==================== 返回键/手势关闭弹窗 ====================
function initBackHandler() {
    window.addEventListener('popstate', () => {
        const whisperPopup = document.getElementById('whisper-popup');
        if (whisperPopup && whisperPopup.classList.contains('show')) {
            closeWhisperPopup(); return;
        }
        if (activePanel) {
            closePanel(); return;
        }
    });
}

function pushOverlayState() {
    history.pushState({ overlay: true }, '');
}

// ==================== 页面启动 ====================
document.addEventListener('DOMContentLoaded', function () {
    // 设置初始主题（让授权页也有背景色）
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) document.body.classList.add('theme-morning');
    else if (hours >= 12 && hours < 18) document.body.classList.add('theme-afternoon');
    else if (hours >= 18 && hours < 22) document.body.classList.add('theme-evening');
    else document.body.classList.add('theme-night');

    const authInput = document.getElementById('auth-input');
    const authBtn = document.getElementById('auth-btn');

    authBtn.addEventListener('click', () => {
        verifyAuth(authInput.value);
    });

    authInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verifyAuth(authInput.value);
        }
    });

    // 自动聚焦输入框（移动端延迟更长避免键盘闪烁）
    setTimeout(() => authInput.focus(), 500);

    // 移动端专属优化
    initVisibilityOptimization();
    initKeyboardAdaptation();
    initBackHandler();
});
})();
