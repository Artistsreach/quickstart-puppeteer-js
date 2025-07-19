const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const endSessionButton = document.getElementById('end-session-button');
const liveViewFrame = document.getElementById('live-view-iframe');
const chatContainer = document.querySelector('.chat-container');
const chatToggleTab = document.querySelector('.chat-toggle-tab');
let isThinking = false;

chatToggleTab.addEventListener('click', () => {
    chatContainer.classList.toggle('hidden');
    const icon = chatToggleTab.querySelector('i');
    if (chatContainer.classList.contains('hidden')) {
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    } else {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
    }
});

const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.body.classList.add(currentTheme === 'dark' ? 'dark-mode' : '');
}

const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');

if (sessionId) {
    loadLiveView();
    const initialPrompt = urlParams.get('prompt');
    if (initialPrompt) {
        const decodedPrompt = decodeURIComponent(initialPrompt);
        sendInitialPrompt(decodedPrompt);
    }
}

async function sendInitialPrompt(prompt) {
    isThinking = true;
    appendMessage('user', prompt);

    try {
        // First, get a quick response
        const quickResponse = await fetch('/api/quick-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });
        const quickResult = await quickResponse.json();
        appendMessage('assistant', quickResult.message);

        // Then, execute the command
        const commandResponse = await fetch('/api/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, sessionId }),
        });
        const commandResult = await commandResponse.json();
        appendMessage('assistant', commandResult.message);
    } catch (error) {
        appendMessage('assistant', `Error: ${error.message}`);
    } finally {
        isThinking = false;
    }
}

async function loadLiveView() {
    try {
        const debugUrlResponse = await fetch(`/api/sessions/${sessionId}/debug`);
        const debugUrlResult = await debugUrlResponse.json();
        if (debugUrlResult.debuggerFullscreenUrl) {
            liveViewFrame.src = debugUrlResult.debuggerFullscreenUrl;
        }
    } catch (error) {
        console.error('Error loading live view:', error);
    }
}

async function sendMessage() {
    const prompt = chatInput.value;
    if (!prompt || isThinking) return;

    isThinking = true;
    appendMessage('user', prompt);
    chatInput.value = '';

    try {
        // First, get a quick response
        const quickResponse = await fetch('/api/quick-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });
        const quickResult = await quickResponse.json();
        appendMessage('assistant', quickResult.message);

        // Then, execute the command
        const commandResponse = await fetch('/api/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, sessionId }),
        });
        const commandResult = await commandResponse.json();
        appendMessage('assistant', commandResult.message);
    } catch (error) {
        appendMessage('assistant', `Error: ${error.message}`);
    } finally {
        isThinking = false;
    }
}

function appendMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    messageElement.innerHTML = marked.parse(text);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

endSessionButton.addEventListener('click', async () => {
    if (!sessionId) {
        alert('No active session to end.');
        return;
    }
    try {
        const response = await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
        const result = await response.json();
        appendMessage('assistant', 'Session ended.');
        liveViewFrame.src = 'about:blank';
    } catch (error) {
        appendMessage('assistant', `Error ending session: ${error.message}`);
    }
});
