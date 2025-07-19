const initialCommandInput = document.getElementById('initial-command-input');
const startSessionButton = document.getElementById('start-session-button');
const themeSwitch = document.getElementById('checkbox');
const loaderWrapper = document.querySelector('.loader-wrapper');

themeSwitch.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
});

const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.body.classList.add(currentTheme === 'dark' ? 'dark-mode' : '');
    if (currentTheme === 'dark') {
        themeSwitch.checked = true;
    }
}

startSessionButton.addEventListener('click', async () => {
    const prompt = initialCommandInput.value;
    if (!prompt) {
        alert('Please enter an initial command.');
        return;
    }

    loaderWrapper.style.display = 'block';
    startSessionButton.disabled = true;

    try {
        const response = await fetch('/api/sessions', { method: 'POST' });
        const result = await response.json();
        if (result.id) {
            const encodedPrompt = encodeURIComponent(prompt);
            window.location.href = `chat.html?sessionId=${result.id}&prompt=${encodedPrompt}`;
        } else {
            alert('Failed to create session.');
            loaderWrapper.style.display = 'none';
            startSessionButton.disabled = false;
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
        loaderWrapper.style.display = 'none';
        startSessionButton.disabled = false;
    }
});
