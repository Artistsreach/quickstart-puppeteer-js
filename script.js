const createSessionButton = document.getElementById('create-session');
const listSessionsButton = document.getElementById('list-sessions');
const getSessionButton = document.getElementById('get-session');
const endSessionButton = document.getElementById('end-session');
const sessionIdInput = document.getElementById('session-id-input');
const commandInput = document.getElementById('command-input');
const commandButton = document.getElementById('command-button');
const subsequentCommandInput = document.getElementById('subsequent-command-input');
const subsequentCommandButton = document.getElementById('subsequent-command-button');
const outputElement = document.getElementById('output');
const liveViewFrame = document.getElementById('live-view-iframe');
const replayLinkElement = document.getElementById('replay-link');

let currentSessionId = null;

createSessionButton.addEventListener('click', async () => {
    outputElement.textContent = 'Creating session...';
    liveViewFrame.src = 'about:blank';
    try {
        const response = await fetch('/api/sessions', { method: 'POST' });
        const result = await response.json();
        outputElement.textContent = JSON.stringify(result, null, 2);
        if (result.id) {
            sessionIdInput.value = result.id;
            const debugUrlResponse = await fetch(`/api/sessions/${result.id}/debug`);
            const debugUrlResult = await debugUrlResponse.json();
            if (debugUrlResult.debuggerFullscreenUrl) {
                liveViewFrame.src = debugUrlResult.debuggerFullscreenUrl;
            }
        }
    } catch (error) {
        outputElement.textContent = `Error: ${error.message}`;
    }
});

listSessionsButton.addEventListener('click', async () => {
    outputElement.textContent = 'Listing sessions...';
    liveViewFrame.src = 'about:blank';
    try {
        const response = await fetch('/api/sessions');
        const result = await response.json();
        outputElement.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
        outputElement.textContent = `Error: ${error.message}`;
    }
});

getSessionButton.addEventListener('click', async () => {
    const sessionId = sessionIdInput.value;
    if (!sessionId) {
        outputElement.textContent = 'Please enter a session ID.';
        return;
    }
    outputElement.textContent = `Getting session ${sessionId}...`;
    liveViewFrame.src = 'about:blank';
    try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const result = await response.json();
        outputElement.textContent = JSON.stringify(result, null, 2);
        if (result.id) {
            const debugUrlResponse = await fetch(`/api/sessions/${result.id}/debug`);
            const debugUrlResult = await debugUrlResponse.json();
            if (debugUrlResult.debuggerFullscreenUrl) {
                liveViewFrame.src = debugUrlResult.debuggerFullscreenUrl;
            }
        }
    } catch (error) {
        outputElement.textContent = `Error: ${error.message}`;
    }
});

endSessionButton.addEventListener('click', async () => {
    const sessionId = sessionIdInput.value;
    if (!sessionId) {
        outputElement.textContent = 'Please enter a session ID to end.';
        return;
    }
    outputElement.textContent = `Ending session ${sessionId}...`;
    try {
        const response = await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
        const result = await response.json();
        outputElement.textContent = JSON.stringify(result, null, 2);
        liveViewFrame.src = 'about:blank';
    } catch (error) {
        outputElement.textContent = `Error: ${error.message}`;
    }
});

async function executeCommand(prompt, sessionId) {
    outputElement.textContent = `Executing: "${prompt}"...`;
    try {
        const response = await fetch('/api/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, sessionId }),
        });
        const result = await response.json();
        outputElement.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
        outputElement.textContent = `Error: ${error.message}`;
    }
}

commandButton.addEventListener('click', async () => {
    const prompt = commandInput.value;
    if (!prompt) {
        outputElement.textContent = 'Please enter a command.';
        return;
    }

    if (currentSessionId) {
        executeCommand(prompt, currentSessionId);
    } else {
        outputElement.textContent = 'Creating session...';
        liveViewFrame.src = 'about:blank';
        try {
            const response = await fetch('/api/sessions', { method: 'POST' });
            const result = await response.json();
            if (result.id) {
                currentSessionId = result.id;
                sessionIdInput.value = result.id;
                const debugUrlResponse = await fetch(`/api/sessions/${result.id}/debug`);
                const debugUrlResult = await debugUrlResponse.json();
                if (debugUrlResult.debuggerFullscreenUrl) {
                    liveViewFrame.src = debugUrlResult.debuggerFullscreenUrl;
                }
                await executeCommand(prompt, result.id);
            } else {
                outputElement.textContent = JSON.stringify(result, null, 2);
            }
        } catch (error) {
            outputElement.textContent = `Error: ${error.message}`;
        }
    }
});

subsequentCommandButton.addEventListener('click', async () => {
    const prompt = subsequentCommandInput.value;
    if (!prompt) {
        outputElement.textContent = 'Please enter a command.';
        return;
    }
    if (!currentSessionId) {
        outputElement.textContent = 'Please start a new session first.';
        return;
    }
    executeCommand(prompt, currentSessionId);
});
