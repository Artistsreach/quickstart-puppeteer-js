const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const endSessionButton = document.getElementById('end-session-button');
const liveViewFrame = document.getElementById('live-view-iframe');
const chatContainer = document.querySelector('.chat-container');
const chatToggleTab = document.querySelector('.chat-toggle-tab');
const suggestedStepsContainer = document.getElementById('suggested-steps');
let isThinking = false;
let originalPrompt = '';

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

// No engine toggle; always use Puppeteer backend

const urlParams = new URLSearchParams(window.location.search);
let sessionId = urlParams.get('sessionId');
const initialPromptParam = urlParams.get('prompt');

(async () => {
    if (sessionId) {
        // Existing flow when session already exists
        fetch('/api/start', { method: 'POST' });
        loadLiveView();
        if (initialPromptParam) {
            const decodedPrompt = decodeURIComponent(initialPromptParam);
            originalPrompt = decodedPrompt;
            await sendInitialPrompt(decodedPrompt);
        }
        return;
    }

    // New flow: if no sessionId but prompt is provided, create a session and start
    if (!sessionId && initialPromptParam) {
        try {
            const response = await fetch('/api/sessions', { method: 'POST' });
            const result = await response.json();
            if (result && result.id) {
                sessionId = result.id;
                // Update URL to include sessionId for consistency and future reloads
                const params = new URLSearchParams(window.location.search);
                params.set('sessionId', sessionId);
                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

                // Initialize live view and start flow
                fetch('/api/start', { method: 'POST' });
                loadLiveView();
                const decodedPrompt = decodeURIComponent(initialPromptParam);
                originalPrompt = decodedPrompt;
                await sendInitialPrompt(decodedPrompt);
            } else {
                appendMessage('assistant', 'Error: Failed to create a browser session.');
            }
        } catch (error) {
            appendMessage('assistant', `Error creating session: ${error.message}`);
        }
    }
})();

async function sendInitialPrompt(prompt) {
    isThinking = true;
    appendMessage('user', prompt);
    const thinkingMessage = appendMessage('assistant', 'Thinking...', true);

    try {
        const suggestionsResponse = await fetch('/api/suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, sessionId }),
        });
        const suggestionsResult = await suggestionsResponse.json();
        if (thinkingMessage) {
            thinkingMessage.innerHTML = marked.parse(suggestionsResult.intentMap.userIntent);
            thinkingMessage.classList.remove('thinking');
        }
        if (suggestionsResult.intentMap) {
            appendAutomationRecommendation(suggestionsResult.intentMap);
        }
    } catch (error) {
        if (thinkingMessage) {
            thinkingMessage.innerHTML = marked.parse(`Error: ${error.message}`);
            thinkingMessage.classList.remove('thinking');
        } else {
            appendMessage('assistant', `Error: ${error.message}`);
        }
    }

    try {
        const simpleResp = await fetch('/api/simple-command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, sessionId, maxSteps: 8 }),
        });
        const simpleResult = await simpleResp.json();
        if (thinkingMessage) {
            thinkingMessage.innerHTML = marked.parse(simpleResult.message || 'Completed.');
            thinkingMessage.classList.remove('thinking');
        } else {
            appendMessage('assistant', simpleResult.message || 'Completed.');
        }
        appendSteps(simpleResult.steps);

        // Optionally refresh suggestions using the original goal to keep UI parity
        const newSuggestionsResponse = await fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: originalPrompt || prompt, sessionId }),
        });
        const newSuggestionsResult = await newSuggestionsResponse.json();
        if (newSuggestionsResult.intentMap) {
            appendAutomationRecommendation(newSuggestionsResult.intentMap);
        }
    } catch (error) {
        console.error('Error executing simple command:', error);
        if (thinkingMessage) {
            thinkingMessage.innerHTML = marked.parse(`Error: ${error.message}`);
            thinkingMessage.classList.remove('thinking');
        }
    } finally {
        isThinking = false;
    }
}

async function loadLiveView() {
    try {
        const debugUrlResponse = await fetch(`/api/sessions/${sessionId}/debug`);
        const debugUrlResult = await debugUrlResponse.json();
        if (debugUrlResult && debugUrlResult.debuggerFullscreenUrl) {
            liveViewFrame.src = debugUrlResult.debuggerFullscreenUrl;
        } else {
            // Fallback to direct session page if API key not configured or no url returned
            liveViewFrame.src = `https://www.browserbase.com/sessions/${sessionId}`;
        }
    } catch (error) {
        console.error('Error loading live view:', error);
        // Fallback to direct session page
        liveViewFrame.src = `https://www.browserbase.com/sessions/${sessionId}`;
    }
}

async function sendMessage() {
    const prompt = chatInput.value;
    if (!prompt || isThinking) return;

    if (!originalPrompt) {
        originalPrompt = prompt;
    }

    isThinking = true;
    appendMessage('user', prompt);
    chatInput.value = '';
    const thinkingMessage = appendMessage('assistant', 'Thinking...', true);

    try {
        const suggestionsResponse = await fetch('/api/suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, sessionId }),
        });
        const suggestionsResult = await suggestionsResponse.json();
        if (thinkingMessage) {
            thinkingMessage.innerHTML = marked.parse(suggestionsResult.intentMap.userIntent);
            thinkingMessage.classList.remove('thinking');
        }
        if (suggestionsResult.intentMap) {
            appendAutomationRecommendation(suggestionsResult.intentMap);
        }
    } catch (error) {
        if (thinkingMessage) {
            thinkingMessage.innerHTML = marked.parse(`Error: ${error.message}`);
            thinkingMessage.classList.remove('thinking');
        } else {
            appendMessage('assistant', `Error: ${error.message}`);
        }
    }

    try {
        const simpleResp = await fetch('/api/simple-command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, sessionId, maxSteps: 8 }),
        });
        const simpleResult = await simpleResp.json();
        if (thinkingMessage) {
            thinkingMessage.innerHTML = marked.parse(simpleResult.message || 'Completed.');
            thinkingMessage.classList.remove('thinking');
        } else {
            appendMessage('assistant', simpleResult.message || 'Completed.');
        }
        appendSteps(simpleResult.steps);
        const newSuggestionsResponse = await fetch('/api/suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: originalPrompt || prompt, sessionId }),
        });
        const newSuggestionsResult = await newSuggestionsResponse.json();
        if (newSuggestionsResult.intentMap) {
            appendAutomationRecommendation(newSuggestionsResult.intentMap);
        }
    } catch (error) {
        console.error('Error executing simple command:', error);
    } finally {
        isThinking = false;
    }
}

function appendMessage(sender, text, thinking = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    if (thinking) {
        messageElement.classList.add('thinking');
    }
    messageElement.innerHTML = marked.parse(text);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageElement;
}

function appendAutomationRecommendation(intentMap) {
    suggestedStepsContainer.innerHTML = '';
    if (intentMap.suggestedNextSteps && intentMap.suggestedNextSteps.length > 0) {
        intentMap.suggestedNextSteps.forEach(step => {
            const button = document.createElement('button');
            button.textContent = step;
            button.addEventListener('click', () => {
                chatInput.value = step;
                sendMessage();
            });
            suggestedStepsContainer.appendChild(button);
        });
    }
}

function appendSteps(steps) {
    if (!Array.isArray(steps)) return;
    steps.forEach((s) => {
        const payload = {
            step: s.step,
            action: s.action,
            error: s.error || undefined,
        };
        const md = '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
        appendMessage('assistant', md);
    });
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
