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

    // Optional: Dynamic Greeting based on time (if user wants "Morning" all day, we can keep static, 
    // but usually "Good Morning" sites might want to be smart. 
    // Since user specifically asked for a "Morning" website, I'll keep the static "早上好" 
    // in HTML but let's add a subtle check to change it if they really want, 
    // for now I will strictly follow "Good Morning Website" as the theme).
    // If we wanted to be smart:
    /*
    const hour = now.getHours();
    const greetingElement = document.getElementById('greeting');
    if (hour < 12) greetingElement.textContent = "早上好";
    else if (hour < 18) greetingElement.textContent = "下午好";
    else greetingElement.textContent = "晚上好";
    */
}

// Update immediately and then every second
updateTime();
setInterval(updateTime, 1000);
