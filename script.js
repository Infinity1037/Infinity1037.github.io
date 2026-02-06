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
    DOM.msgBoard = document.getElementById('msg-board');
    DOM.msgLatest = document.getElementById('msg-latest');
    DOM.msgContent = document.getElementById('msg-content');
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
        `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    DOM.date.textContent =
        now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

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
    
    if (document.body.className !== theme) {
        document.body.className = theme;
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
    const saved = localStorage.getItem('fortune_date');
    if (saved === today) {
        const data = JSON.parse(localStorage.getItem('fortune_data') || '{}');
        // 刷新页面后只恢复显示，不重复应用 bonus（bonus 仅在首次抽取时生效，这是预期行为）
        showFortuneResult(data);
        fortuneDrawn = true;
    }
}

function drawFortune() {
    if (fortuneDrawn) return;
    fortuneDrawn = true;

    const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('fortune_date', today);
    localStorage.setItem('fortune_data', JSON.stringify(fortune));

    // 应用加成
    if (fortune.bonus.hunger) catState.hunger = Math.min(MAX_STAT, catState.hunger + fortune.bonus.hunger);
    if (fortune.bonus.mood) catState.mood = Math.min(MAX_STAT, catState.mood + fortune.bonus.mood);
    if (fortune.bonus.energy) catState.energy = Math.min(MAX_STAT, catState.energy + fortune.bonus.energy);
    saveCatState();
    updateDisplay();

    // 动画翻转
    DOM.fortuneCard.classList.add('flipping');
    setTimeout(() => {
        showFortuneResult(fortune);
        DOM.fortuneCard.classList.remove('flipping');
        DOM.fortuneCard.classList.add('revealed');
    }, 400);

    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
}

function showFortuneResult(fortune) {
    if (!fortune || !fortune.level) return;
    DOM.fortuneText.innerHTML = `<span class="fortune-level" style="color:${fortune.color}">${fortune.level}</span> ${fortune.msg}`;
    DOM.fortuneCard.classList.add('revealed');
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

    // 喂食效果（比按钮少一点）
    catState.hunger = Math.min(MAX_STAT, catState.hunger + 8);
    catState.mood = Math.min(MAX_STAT, catState.mood + 3);
    catState.totalFeeds++;
    catState.lastUpdate = Date.now();
    saveCatState();
    updateDisplay();

    showBubble('抓到鱼了!');
    catBounce();
    createParticles(e.clientX, e.clientY, '🐟');
    if (navigator.vibrate) navigator.vibrate(15);

    // 捕获动画
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
function updateBadges() {
    if (!DOM.badgesRow) return;
    let html = '';
    let count = 0;
    ACHIEVEMENTS.forEach(a => {
        if (a.check(catState)) {
            html += `<span class="badge unlocked" title="${a.name}">${a.icon}</span>`;
            count++;
        }
    });
    if (count === 0) {
        html = '<span class="badge-hint">还没有徽章，继续加油~</span>';
    }
    if (html !== lastBadgeHtml) {
        lastBadgeHtml = html;
        DOM.badgesRow.innerHTML = html;
    }
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

    // 应用加成
    if (evt.bonus.hunger) catState.hunger = Math.min(MAX_STAT, catState.hunger + evt.bonus.hunger);
    if (evt.bonus.mood) catState.mood = Math.min(MAX_STAT, catState.mood + evt.bonus.mood);
    if (evt.bonus.energy) catState.energy = Math.min(MAX_STAT, catState.energy + evt.bonus.energy);
    catState.lastUpdate = Date.now();
    saveCatState();
    updateDisplay();

    // 显示弹窗
    DOM.eventIcon.textContent = evt.icon;
    DOM.eventText.textContent = evt.text;
    DOM.eventPopup.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

    setTimeout(() => {
        DOM.eventPopup.classList.remove('show');
    }, 3000);
}

// ==================== 留言板 ====================
function initMsgBoard() {
    // 实时监听最新留言
    msgRef.orderByChild('time').limitToLast(1).on('value', (snapshot) => {
        if (!DOM.msgContent) return;
        const data = snapshot.val();
        if (data) {
            const key = Object.keys(data)[0];
            const msg = data[key];
            DOM.msgContent.textContent = msg.text;
        } else {
            DOM.msgContent.textContent = '还没有留言，点击说点什么~';
        }
    });
}

function openMsgOverlay() {
    const overlay = document.getElementById('msg-overlay');
    const input = document.getElementById('msg-input');
    overlay.classList.add('show');
    setTimeout(() => input.focus(), 250);
}

function closeMsgOverlay() {
    const overlay = document.getElementById('msg-overlay');
    const input = document.getElementById('msg-input');
    overlay.classList.remove('show');
    input.value = '';
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
        time: Date.now()
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

    closeMsgOverlay();
    showBubble('留言成功~');
    if (navigator.vibrate) navigator.vibrate(15);
}

// ==================== 猫咪显示 ====================
function checkSleepMode() {
    const hours = new Date().getHours();
    isSleeping = (hours >= 23 || hours < 5);
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
    if (catState.lastVisitDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (catState.lastVisitDate === yesterday) {
        catState.streak = (catState.streak || 0) + 1;
    } else if (catState.lastVisitDate !== today) {
        catState.streak = 1;
    }
    catState.lastVisitDate = today;
    saveCatState();
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
function createParticles(x, y, emoji) {
    if (!particleLayer) {
        particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;
    }
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

        particleLayer.appendChild(p);

        // 动画结束后移除
        setTimeout(() => p.remove(), 1000);
    }
}

// ==================== 喂食、抚摸、玩耍 ====================
let lastFeedTime = 0;
let lastPetTime = 0;
let lastPlayTime = 0;
const COOLDOWN = 300;

function feedCat() {
    if (isSleeping) { showBubble('猫咪在睡觉，别吵它~'); return; }
    const now = Date.now();
    if (now - lastFeedTime < COOLDOWN) return;
    lastFeedTime = now;

    // 按钮冷却效果
    DOM.feedBtn.classList.add('cooldown');
    setTimeout(() => DOM.feedBtn.classList.remove('cooldown'), COOLDOWN);

    catState.hunger = Math.min(MAX_STAT, catState.hunger + FEED_EFFECT.hunger);
    catState.mood = Math.min(MAX_STAT, catState.mood + FEED_EFFECT.mood);
    catState.lastUpdate = now;
    catState.totalFeeds++;

    showBubble(FEED_RESPONSES[Math.floor(Math.random() * FEED_RESPONSES.length)]);
    catBounce();
    updateDisplay();
    updateSpeech();
    saveCatState();
}

function petCat() {
    if (isSleeping) { showBubble('嗓，让它再睡会儿~'); return; }
    const now = Date.now();
    if (now - lastPetTime < COOLDOWN) return;
    lastPetTime = now;

    // 按钮冷却效果
    DOM.petBtn.classList.add('cooldown');
    setTimeout(() => DOM.petBtn.classList.remove('cooldown'), COOLDOWN);

    catState.mood = Math.min(MAX_STAT, catState.mood + PET_EFFECT.mood);
    catState.energy = Math.min(MAX_STAT, catState.energy + PET_EFFECT.energy);
    catState.lastUpdate = now;
    catState.totalPets++;

    showBubble(PET_RESPONSES[Math.floor(Math.random() * PET_RESPONSES.length)]);
    catBounce();
    updateDisplay();
    updateSpeech();
    saveCatState();
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
    saveCatState();
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

function initFirebase() {
    // 设置超时
    const timeout = setTimeout(() => {
        DOM.loadingText.textContent = '连接超时';
        DOM.retryBtn.style.display = 'block';
        // 尝试使用本地缓存
        loadFromLocalStorage();
    }, 8000);

    catRef.on('value', (snapshot) => {
        clearTimeout(timeout);
        const data = snapshot.val();
        if (data && data.lastUpdate) {
            const now = Date.now();
            const lastUpdate = Number(data.lastUpdate) || now;
            const hoursPassed = Math.max(0, (now - lastUpdate) / 3600000);

            // 计算衰减后的值，确保不为NaN
            let hunger = Number(data.hunger);
            let mood = Number(data.mood);
            let energy = Number(data.energy);

            // 如果是NaN，使用默认值
            if (isNaN(hunger)) hunger = 80;
            if (isNaN(mood)) mood = 70;
            if (isNaN(energy)) energy = 60;

            // 应用衰减，但保持最低值
            hunger = Math.max(MIN_STAT, Math.min(100, hunger - hoursPassed * DECAY_PER_HOUR.hunger));
            mood = Math.max(MIN_STAT, Math.min(100, mood - hoursPassed * DECAY_PER_HOUR.mood));
            energy = Math.max(MIN_STAT, Math.min(100, energy - hoursPassed * DECAY_PER_HOUR.energy));

            const remoteState = {
                hunger: hunger,
                mood: mood,
                energy: energy,
                lastUpdate: lastUpdate,
                totalFeeds: Number(data.totalFeeds) || 0,
                totalPets: Number(data.totalPets) || 0,
                totalPlays: Number(data.totalPlays) || 0,
                streak: Number(data.streak) || 0,
                lastVisitDate: data.lastVisitDate || ''
            };

            catState = remoteState;

            // 保存到本地缓存
            saveToLocalStorage();
            updateStreak();
            updateDisplay();
            updateSpeech();
            showMainContent();
        } else {
            // 数据不存在或无效，使用默认值并保存
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
            updateStreak();
            updateDisplay();
            updateSpeech();
            showMainContent();
        }
    }, (error) => {
        clearTimeout(timeout);
        DOM.loadingText.textContent = '连接失败';
        DOM.retryBtn.style.display = 'block';
        console.error(error);
        // 尝试使用本地缓存
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
        totalFeeds: catState.totalFeeds,
        totalPets: catState.totalPets,
        totalPlays: catState.totalPlays || 0,
        streak: catState.streak || 0,
        lastVisitDate: catState.lastVisitDate || ''
    });
    saveToLocalStorage();
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
    DOM.weatherLayer.innerHTML = '';

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

    // 随机事件（每30秒检查一次）
    setInterval(triggerRandomEvent, 30000);
    // 进入时60秒后触发第一次
    setTimeout(triggerRandomEvent, 60000);

    // 启动额外功能
    blinkCat();
    // 初始调用一次天气 (传入当前小时)
    const nowHour = new Date().getHours();
    updateWeather(nowHour);
    // 每小时更新一次天气
    setInterval(() => updateWeather(new Date().getHours()), 3600000);

    initFirebase();

    // 留言板
    initMsgBoard();
    DOM.msgLatest.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        openMsgOverlay();
    });
    document.getElementById('msg-send').addEventListener('click', sendMessage);
    document.getElementById('msg-cancel').addEventListener('click', closeMsgOverlay);
    document.getElementById('msg-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });
    document.getElementById('msg-overlay').addEventListener('pointerdown', (e) => {
        if (e.target.id === 'msg-overlay') closeMsgOverlay();
    });

    // 事件绑定
    DOM.feedBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        feedCat();
        createParticles(e.clientX, e.clientY, '🐟');
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

    // 猫咪点击 + 长按彩蛋
    let longPressTimer = null;
    let isLongPress = false;

    DOM.cat.addEventListener('pointerdown', (e) => {
        isLongPress = false;
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            showBubble(LONG_PRESS_RESPONSES[Math.floor(Math.random() * LONG_PRESS_RESPONSES.length)]);
            catState.mood = Math.min(MAX_STAT, catState.mood + 5);
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
            showBubble('喵~');
            catBounce();
            createParticles(e.clientX, e.clientY, '⭐');
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

// ==================== 页面启动 ====================
document.addEventListener('DOMContentLoaded', function () {
    // 设置初始主题（让授权页也有背景色）
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) document.body.className = 'theme-morning';
    else if (hours >= 12 && hours < 18) document.body.className = 'theme-afternoon';
    else if (hours >= 18 && hours < 22) document.body.className = 'theme-evening';
    else document.body.className = 'theme-night';

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

    // 自动聚焦输入框
    setTimeout(() => authInput.focus(), 300);
});
})();
