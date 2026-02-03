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

// ==================== 游戏设置 ====================
const MAX_STAT = 100;
const DECAY_PER_HOUR = { hunger: 6, mood: 4, energy: 3 };
const FEED_EFFECT = { hunger: 20, mood: 8 };
const PET_EFFECT = { mood: 12, energy: 5 };
const WARNING_THRESHOLD = 30; // 低于30%显示警告

// 猫咪对话
const SPEECHES = {
    hungry: ['肚子饿了...', '想吃小鱼干~', '喂喂我嘛', '好饿呀~'],
    sad: ['陪我玩~', '好无聊啊', '摸摸我', '想你了~'],
    tired: ['好困...', '想睡觉', 'zzZ', '眼皮好重'],
    happy: ['好开心！', '喵~♡', '最喜欢你们了', '幸福~'],
    normal: ['你好呀~', '喵~', '今天不错', '嘿嘿']
};

const FEED_RESPONSES = ['好吃~', '真香！', '还要还要', '满足~', '谢谢~', '太棒了！'];
const PET_RESPONSES = ['舒服~', '喵~', '再摸摸', '开心！', '嘿嘿', '好舒服'];

// ==================== 状态 ====================
let catState = {
    hunger: 80,
    mood: 70,
    energy: 60,
    lastUpdate: Date.now(),
    totalFeeds: 0,
    totalPets: 0
};

// ==================== 时间更新 ====================
function updateTime() {
    const now = new Date();
    const hours = now.getHours();

    document.getElementById('time').textContent =
        `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    document.getElementById('date').textContent =
        now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    let theme;
    if (hours >= 5 && hours < 12) {
        document.getElementById('greeting').textContent = '早上好';
        theme = 'theme-morning';
    } else if (hours >= 12 && hours < 18) {
        document.getElementById('greeting').textContent = '下午好';
        theme = 'theme-afternoon';
    } else if (hours >= 18 && hours < 22) {
        document.getElementById('greeting').textContent = '晚上好';
        theme = 'theme-evening';
    } else {
        document.getElementById('greeting').textContent = '夜深了';
        theme = 'theme-night';
    }
    document.body.className = theme;
}

// ==================== 名言 ====================
const quotes = [
    { text: '生活不是等待风暴过去，而是学会在雨中跳舞', author: '维维安·格林' },
    { text: '每一个不曾起舞的日子，都是对生命的辜负', author: '尼采' },
    { text: '愿你眼里有光，心中有爱', author: '' },
    { text: '保持热爱，奔赴山海', author: '' },
    { text: '星光不问赶路人，时光不负有心人', author: '' },
    { text: '愿你被这个世界温柔以待', author: '' },
    { text: '今天的努力，是幸运的伏笔', author: '' },
    { text: '慢慢来，比较快', author: '' }
];

function updateQuote() {
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quote').textContent = q.text;
    document.getElementById('quote-author').textContent = q.author ? `—— ${q.author}` : '';
}

// ==================== 猫咪显示 ====================
function updateDisplay() {
    // 更新属性条和数值
    updateStat('hunger', catState.hunger);
    updateStat('mood', catState.mood);
    updateStat('energy', catState.energy);

    // 更新眼睛表情
    document.getElementById('eyes-normal').style.display = 'none';
    document.getElementById('eyes-happy').style.display = 'none';
    document.getElementById('eyes-sad').style.display = 'none';

    if (catState.mood >= 70) {
        document.getElementById('eyes-happy').style.display = 'block';
    } else if (catState.mood < 30 || catState.hunger < 30) {
        document.getElementById('eyes-sad').style.display = 'block';
    } else {
        document.getElementById('eyes-normal').style.display = 'block';
    }

    // 更新统计
    document.getElementById('total-feeds').textContent = catState.totalFeeds;
    document.getElementById('total-pets').textContent = catState.totalPets;
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
    const fill = document.getElementById(`${stat}-fill`);
    const num = document.getElementById(`${stat}-num`);
    const row = document.getElementById(`${stat}-row`);
    const currentVal = parseInt(num.textContent) || 0;

    fill.style.width = `${value}%`;

    // 只有数值变化较大时才动画，避免频繁跳动
    if (Math.abs(value - currentVal) > 1) {
        animateValue(num, currentVal, value, 500);
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
    if (catState.hunger < 30) {
        speeches = SPEECHES.hungry;
    } else if (catState.mood < 30) {
        speeches = SPEECHES.sad;
    } else if (catState.energy < 30) {
        speeches = SPEECHES.tired;
    } else if (catState.mood >= 70) {
        speeches = SPEECHES.happy;
    } else {
        speeches = SPEECHES.normal;
    }
    document.getElementById('cat-speech').textContent = speeches[Math.floor(Math.random() * speeches.length)];
}

function showBubble(text) {
    const bubble = document.getElementById('meow-bubble');
    bubble.textContent = text;
    bubble.classList.add('show');
    setTimeout(() => bubble.classList.remove('show'), 1500);
}

function catBounce() {
    const cat = document.getElementById('cat');
    cat.classList.add('tapped');
    setTimeout(() => cat.classList.remove('tapped'), 300);
    if (navigator.vibrate) navigator.vibrate(30);
}

// ==================== 粒子特效 ====================
function createParticles(x, y, emoji) {
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

        document.body.appendChild(p);

        // 动画结束后移除
        setTimeout(() => p.remove(), 1000);
    }
}

// ==================== 喂食和抚摸 ====================
let lastFeedTime = 0;
let lastPetTime = 0;
const COOLDOWN = 300;

function feedCat() {
    const now = Date.now();
    if (now - lastFeedTime < COOLDOWN) return;
    lastFeedTime = now;

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
    const now = Date.now();
    if (now - lastPetTime < COOLDOWN) return;
    lastPetTime = now;

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

// ==================== Firebase 同步 ====================
function initFirebase() {
    const loadingScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('main-content');

    catRef.on('value', (snapshot) => {
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

            // 应用衰减
            hunger = Math.max(0, Math.min(100, hunger - hoursPassed * DECAY_PER_HOUR.hunger));
            mood = Math.max(0, Math.min(100, mood - hoursPassed * DECAY_PER_HOUR.mood));
            energy = Math.max(0, Math.min(100, energy - hoursPassed * DECAY_PER_HOUR.energy));

            catState = {
                hunger: hunger,
                mood: mood,
                energy: energy,
                lastUpdate: lastUpdate,
                totalFeeds: Number(data.totalFeeds) || 0,
                totalPets: Number(data.totalPets) || 0
            };

            updateDisplay();
            updateSpeech();

            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                mainContent.style.opacity = '1';
                mainContent.classList.add('loaded');
            }, 400);
        } else {
            // 数据不存在或无效，使用默认值并保存
            catState = {
                hunger: 80,
                mood: 70,
                energy: 60,
                lastUpdate: Date.now(),
                totalFeeds: 0,
                totalPets: 0
            };
            saveCatState();
            updateDisplay();
            updateSpeech();

            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                mainContent.style.opacity = '1';
                mainContent.classList.add('loaded');
            }, 400);
        }
    }, (error) => {
        document.querySelector('.loading-text').textContent = '连接失败';
        console.error(error);
    });
}

function saveCatState() {
    catRef.set({
        hunger: catState.hunger,
        mood: catState.mood,
        energy: catState.energy,
        lastUpdate: catState.lastUpdate,
        totalFeeds: catState.totalFeeds,
        totalPets: catState.totalPets
    });
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
function updateWeather(hours) {
    const layer = document.getElementById('weather-layer');
    if (!layer) return;
    layer.innerHTML = ''; // 清空现有元素

    if (hours >= 6 && hours < 18) {
        // 白天：云朵
        for (let i = 0; i < 4; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            cloud.style.top = (5 + Math.random() * 40) + '%';
            cloud.style.animationDuration = (25 + Math.random() * 25) + 's';
            cloud.style.animationDelay = -(Math.random() * 20) + 's';
            cloud.style.transform = `scale(${0.6 + Math.random() * 0.6})`;
            layer.appendChild(cloud);
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
            layer.appendChild(star);
        }
    }
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function () {
    updateTime();
    setInterval(updateTime, 1000);

    updateQuote();
    setInterval(updateQuote, 3600000);

    setInterval(updateSpeech, 15000);

    // 启动额外功能
    blinkCat();
    // 初始调用一次天气 (传入当前小时)
    const nowHour = new Date().getHours();
    updateWeather(nowHour);
    // 每小时更新一次天气
    setInterval(() => updateWeather(new Date().getHours()), 3600000);

    initFirebase();

    // 事件绑定
    const feedBtn = document.getElementById('feed-btn');
    const petBtn = document.getElementById('pet-btn');
    const catEl = document.getElementById('cat');

    feedBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        feedCat();
        createParticles(e.clientX, e.clientY, '🐟');
    });

    petBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        petCat();
        createParticles(e.clientX, e.clientY, '💖');
    });

    catEl.addEventListener('pointerdown', (e) => {
        showBubble('喵~');
        catBounce();
        createParticles(e.clientX, e.clientY, '⭐');
    });
});
