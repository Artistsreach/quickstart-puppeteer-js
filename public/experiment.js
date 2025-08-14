const initialCommandInput = document.getElementById('initial-command-input');
const startSessionButton = document.getElementById('start-session-button');
const quickSearchButton = document.getElementById('quick-search-button');
const resultsContainer = document.getElementById('results-container');
const themeSwitch = document.getElementById('checkbox');
const loaderWrapper = document.querySelector('.loader-wrapper');
const logo = document.getElementById('logo');
const automationPlan = document.getElementById('automation-plan');

initialCommandInput.addEventListener('input', () => {
    updateLogoAndPlan();
});

async function updateLogoAndPlan() {
    const prompt = initialCommandInput.value;
    if (prompt.length < 3) {
        logo.style.display = 'none';
        automationPlan.innerHTML = '';
        return;
    }

    try {
        const response = await fetch('/api/logo-and-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });
        const result = await response.json();
        if (result.plan) {
            automationPlan.innerHTML = result.plan;
            automationPlan.style.display = 'block';
        } else {
            automationPlan.innerHTML = '';
            automationPlan.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching logo and plan:', error);
    }
}

// Typing animation
const placeholderIdeas = [
    "Automate a marketing campaign",
    "Build a mobile app",
    "Create a t-shirt design",
    "Write a blog post",
    "Generate a sales report",
    "Scrape a website for data",
    "Create a social media content calendar",
    "Design a logo",
    "Build a personal website",
    "Automate customer support responses",
    "Create a video tutorial",
    "Develop a custom Slack bot",
    "Analyze stock market data",
    "Generate a workout plan",
    "Create a recipe book",
];

let currentIdeaIndex = 0;
let currentCharIndex = 0;
let isDeleting = false;
let typingSpeed = 100;
let deletingSpeed = 50;
let pauseDuration = 2000;

function type() {
    const currentText = placeholderIdeas[currentIdeaIndex];
    if (isDeleting) {
        // Deleting
        initialCommandInput.placeholder = currentText.substring(0, currentCharIndex - 1);
        currentCharIndex--;
        if (currentCharIndex === 0) {
            isDeleting = false;
            currentIdeaIndex = (currentIdeaIndex + 1) % placeholderIdeas.length;
            setTimeout(type, 500); // Pause before typing next
        } else {
            setTimeout(type, deletingSpeed);
        }
    } else {
        // Typing
        initialCommandInput.placeholder = currentText.substring(0, currentCharIndex + 1);
        currentCharIndex++;
        if (currentCharIndex === currentText.length) {
            isDeleting = true;
            setTimeout(type, pauseDuration); // Pause at the end
        } else {
            setTimeout(type, typingSpeed);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(type, 500); // Start after a short delay
});


themeSwitch.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
});

quickSearchButton.style.display = 'inline-block';

quickSearchButton.addEventListener('click', async () => {
    const prompt = initialCommandInput.value;
    if (!prompt) {
        alert('Please enter a search query.');
        return;
    }

    loaderWrapper.style.display = 'block';
    quickSearchButton.disabled = true;
    resultsContainer.innerHTML = '';

    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: prompt }),
        });
        const result = await response.json();
        if (result.success) {
            displayResults(result.data);
        } else {
            alert('Search failed.');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        loaderWrapper.style.display = 'none';
        quickSearchButton.disabled = false;
    }
});

function displayResults(results) {
    resultsContainer.innerHTML = '';
    if (results && results.length > 0) {
        resultsContainer.classList.remove('hidden');
        results.forEach(item => {
            const resultElement = document.createElement('div');
            resultElement.innerHTML = `
                <h3><a href="${item.url}" target="_blank">${item.title}</a></h3>
                <p>${item.description}</p>
                <hr>
            `;
            resultsContainer.appendChild(resultElement);
        });
    } else {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '<p>No results found.</p>';
    }
}

const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeSwitch.checked = true;
} else {
    document.body.classList.remove('dark-mode');
    themeSwitch.checked = false;
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
