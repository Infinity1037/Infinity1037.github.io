// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAo5yc2z-Q6YV5nbfTLBOcB1yR8IvaC-S0",
    authDomain: "shared-cat.firebaseapp.com",
    databaseURL: "https://shared-cat-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "shared-cat",
    storageBucket: "shared-cat.firebasestorage.app",
    messagingSenderId: "35653587925",
    appId: "1:35653587925:web:7b88608731f410bfd8e35c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const catRef = database.ref('cat');

function updateTime() {
    const now = new Date();
    const hours = now.getHours();
    
    // Update Time
    const timeElement = document.getElementById('time');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    timeElement.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;

    // Update Date
    const dateElement = document.getElementById('date');
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateElement.textContent = now.toLocaleDateString('zh-CN', options);
    
    // Update Greeting based on time
    const greetingElement = document.getElementById('greeting');
    let greetingText = '';
    let themeClass = '';
    
    if (hours >= 5 && hours < 12) {
        greetingText = '早上好';
        themeClass = 'theme-morning';
    } else if (hours >= 12 && hours < 18) {
        greetingText = '下午好';
        themeClass = 'theme-afternoon';
    } else if (hours >= 18 && hours < 22) {
        greetingText = '晚上好';
        themeClass = 'theme-evening';
    } else {
        greetingText = '夜深了';
        themeClass = 'theme-night';
    }
    greetingElement.textContent = greetingText;
    
    // Update background theme
    document.body.className = themeClass;
}

// Daily Quotes
const quotes = [
    { text: '生活不是等待风暴过去，而是学会在雨中跳舞', author: '维维安·格林' },
    { text: '每一个不曾起舞的日子，都是对生命的辜负', author: '尼采' },
    { text: '愿你眼里有光，心中有爱', author: '' },
    { text: '保持热爱，奔赴山海', author: '' },
    { text: '星光不问赶路人，时光不负有心人', author: '' },
    { text: '愿你被这个世界温柔以待', author: '' },
    { text: '今天的努力，是幸运的伏笔', author: '' },
    { text: '心若向阳，无畏悲伤', author: '' },
    { text: '慢慢来，比较快', author: '' },
    { text: '一切都是最好的安排', author: '' }
];

function updateQuote() {
    const quoteElement = document.getElementById('quote');
    const authorElement = document.getElementById('quote-author');
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const quote = quotes[randomIndex];
    quoteElement.textContent = quote.text;
    authorElement.textContent = quote.author ? `—— ${quote.author}` : '';
}

// Update immediately and then every second
updateTime();
setInterval(updateTime, 1000);
updateQuote();

// Change quote every hour
setInterval(updateQuote, 3600000);

// Cat Interaction
const cat = document.getElementById('cat');
const catEyes = cat.querySelector('.cat-eyes');
const catEyesClosed = cat.querySelector('.cat-eyes-closed');
const meowBubble = cat.querySelector('.meow-bubble');

let isInteracting = false;

function interactWithCat() {
    if (isInteracting) return;
    isInteracting = true;
    
    // Blink animation
    catEyes.style.display = 'none';
    catEyesClosed.style.display = 'block';
    
    // Add bounce animation
    cat.classList.add('tapped');
    
    // Show meow bubble
    meowBubble.classList.add('show');
    
    // Restore after animation
    setTimeout(() => {
        catEyes.style.display = 'block';
        catEyesClosed.style.display = 'none';
        cat.classList.remove('tapped');
    }, 200);
    
    // Hide bubble after 1.5 seconds
    setTimeout(() => {
        meowBubble.classList.remove('show');
        isInteracting = false;
    }, 1500);
}

// Cat Care System (Firebase Realtime Database - Shared across all users)
const MAX_MOOD = 100;
const MOOD_DECAY_RATE = 5; // mood points lost per hour
const FEED_BOOST = 20;
const PET_BOOST = 10;

let catState = {
    mood: 80,
    lastFed: Date.now(),
    lastInteraction: Date.now(),
    isLocked: false
};

// Listen to Firebase data changes (real-time sync)
function initFirebaseListener() {
    catRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Calculate mood decay based on time passed
            const hoursPassed = (Date.now() - data.lastInteraction) / (1000 * 60 * 60);
            const decayedMood = Math.max(0, data.mood - hoursPassed * MOOD_DECAY_RATE);
            
            catState = {
                mood: decayedMood,
                lastFed: data.lastFed,
                lastInteraction: data.lastInteraction,
                isLocked: data.isLocked || false
            };
            updateCatDisplay();
        } else {
            // Initialize with default values if no data exists
            saveCatState();
        }
    });
}

// Save cat state to Firebase (syncs to all users)
function saveCatState() {
    catRef.set({
        mood: catState.mood,
        lastFed: catState.lastFed,
        lastInteraction: catState.lastInteraction,
        isLocked: false
    });
}

// Get mood status text and color
function getMoodStatus(mood) {
    if (mood >= 70) return { text: '开心', class: 'high' };
    if (mood >= 40) return { text: '一般', class: 'medium' };
    return { text: '难过', class: 'low' };
}

// Update cat display (mood bar, status, eyes)
function updateCatDisplay() {
    const moodFill = document.getElementById('mood-fill');
    const catStatus = document.getElementById('cat-status');
    const catEyes = document.querySelector('.cat-eyes');
    const catEyesHappy = document.querySelector('.cat-eyes-happy');
    const catEyesSad = document.querySelector('.cat-eyes-sad');
    
    // Update mood bar
    moodFill.style.width = `${catState.mood}%`;
    const moodStatus = getMoodStatus(catState.mood);
    moodFill.className = `mood-fill ${moodStatus.class}`;
    
    // Update status text
    catStatus.textContent = `心情: ${moodStatus.text}`;
    
    // Update eyes based on mood
    catEyes.style.display = 'none';
    catEyesHappy.style.display = 'none';
    catEyesSad.style.display = 'none';
    
    if (catState.mood >= 70) {
        catEyesHappy.style.display = 'block';
    } else if (catState.mood >= 40) {
        catEyes.style.display = 'block';
    } else {
        catEyesSad.style.display = 'block';
    }
}

// Feed the cat
function feedCat() {
    if (isInteracting || catState.isLocked) return;
    
    // Set lock to prevent concurrent updates
    catRef.child('isLocked').set(true);
    isInteracting = true;
    
    const newMood = Math.min(MAX_MOOD, catState.mood + FEED_BOOST);
    const now = Date.now();
    
    catRef.set({
        mood: newMood,
        lastFed: now,
        lastInteraction: now,
        isLocked: false
    });
    
    // Show feeding animation
    const meowBubble = document.querySelector('.meow-bubble');
    const originalText = meowBubble.textContent;
    meowBubble.textContent = '好吃~';
    meowBubble.classList.add('show');
    
    // Bounce animation
    const cat = document.getElementById('cat');
    cat.classList.add('tapped');
    
    setTimeout(() => {
        cat.classList.remove('tapped');
        meowBubble.classList.remove('show');
        meowBubble.textContent = originalText;
        isInteracting = false;
    }, 1500);
    
    // Vibrate on mobile
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// Pet the cat
function petCat() {
    if (isInteracting || catState.isLocked) return;
    
    // Set lock to prevent concurrent updates
    catRef.child('isLocked').set(true);
    
    const newMood = Math.min(MAX_MOOD, catState.mood + PET_BOOST);
    const now = Date.now();
    
    catRef.set({
        mood: newMood,
        lastFed: catState.lastFed,
        lastInteraction: now,
        isLocked: false
    });
    
    // Reuse existing interact function for animation
    interactWithCat();
    
    // Vibrate on mobile
    if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
    }
}

// Initialize cat care system
initFirebaseListener();

// Set up action buttons
document.getElementById('feed-btn').addEventListener('click', feedCat);
document.getElementById('feed-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    feedCat();
});

document.getElementById('pet-btn').addEventListener('click', petCat);
document.getElementById('pet-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    petCat();
});
