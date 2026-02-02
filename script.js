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

// Lottie Animation Logic can be added here if interaction is needed
// For now, the Lottie player handles the animation automatically.
