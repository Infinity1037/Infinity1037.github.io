function updateTime() {
    const now = new Date();
    
    // Update Time
    const timeElement = document.getElementById('time');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}:${seconds}`;

    // Update Date
    const dateElement = document.getElementById('date');
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateElement.textContent = now.toLocaleDateString('zh-CN', options);
}

// Update immediately and then every second
updateTime();
setInterval(updateTime, 1000);

// Cute Cat Logic
const cat = document.getElementById('cat-container');
const catImg = document.getElementById('cat-gif');
let isResting = false;

// Pusheen GIF running state URL (Local)
const runningURL = "images/pusheen-running.gif";
// Pusheen GIF resting/sitting state URL (Local)
const sittingURL = "images/pusheen-sitting.gif";

// Set initial random position
let currentX = Math.random() * (window.innerWidth - 100);
let currentY = Math.random() * (window.innerHeight - 100);
cat.style.left = `${currentX}px`;
cat.style.top = `${currentY}px`;

function moveCatRandomly() {
    if (isResting) return;

    // Ensure we are using running GIF
    // Use .includes() because src is absolute path
    if (!catImg.src.includes("pusheen-running.gif")) {
        catImg.src = runningURL;
    }

    // Pick a random target within window bounds (padding 100px)
    const targetX = Math.random() * (window.innerWidth - 100);
    const targetY = Math.random() * (window.innerHeight - 100);
    
    // Calculate distance and duration based on speed
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = 100; // pixels per second (Slower for cuteness)
    const duration = distance / speed;

    // Determine direction
    // Pusheen GIF is typically running to the RIGHT by default.
    // If dx > 0 (moving right), we keep scaleX(1).
    // If dx < 0 (moving left), we flip to scaleX(-1).
    if (dx > 0) {
        cat.style.transform = "scaleX(1)"; 
    } else {
        cat.style.transform = "scaleX(-1)";
    }

    // Apply Transition
    cat.style.transition = `left ${duration}s linear, top ${duration}s linear`;
    
    // Move
    cat.style.left = `${targetX}px`;
    cat.style.top = `${targetY}px`;

    // Update current position references
    currentX = targetX;
    currentY = targetY;

    // Schedule next move or rest
    setTimeout(() => {
        // Stop Movement
        
        // Random Rest
        isResting = true;
        
        // Switch to sitting GIF if available, or just stay
        catImg.src = sittingURL;

        setTimeout(() => {
            isResting = false;
            moveCatRandomly();
        }, 2000 + Math.random() * 3000); // Rest for 2-5 seconds

    }, duration * 1000);
}

// Start moving
moveCatRandomly();

// Handle Window Resize (Keep cat in bounds)
window.addEventListener('resize', () => {
    // If cat is outside new bounds, bring it back
    const maxX = window.innerWidth - 100;
    const maxY = window.innerHeight - 100;
    
    let newX = currentX;
    let newY = currentY;
    
    if (currentX > maxX) newX = maxX;
    if (currentY > maxY) newY = maxY;
    
    if (newX !== currentX || newY !== currentY) {
        cat.style.left = `${newX}px`;
        cat.style.top = `${newY}px`;
        currentX = newX;
        currentY = newY;
    }
});
