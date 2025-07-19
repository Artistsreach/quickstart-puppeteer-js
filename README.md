<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="logo/dark.svg"/>
        <img alt="Browserbase logo" src="logo/light.svg" width="300" />
    </picture>
</p>

<p align="center">
    <a href="https://docs.browserbase.com">Documentation</a>
    <span>&nbsp;·&nbsp;</span>
    <a href="https://www.browserbase.com/playground">Playground</a>
</p>
<br/>

## Puppeteer with Browserbase
A web browser for your AI. Browserbase is the developer platform to reliably run, manage, and monitor headless browsers.

Get complete control over browsers and leverage Browserbase's
[Infrastructure](https://docs.browserbase.com/under-the-hood), [Stealth Mode](https://docs.browserbase.com/features/stealth-mode), and
[Session Debugger](https://docs.browserbase.com/features/sessions) to power your automation, test suites,
and LLM data retrievals.

**Get started in under one minute** with Puppeteer.

## Features
- **Multi-turn Browser Automation**: The application now supports multi-turn browser automation, allowing you to send a sequence of commands to the same browser session.
- **Persistent Sessions**: The application now uses persistent sessions, which remain active between commands, allowing for complex, multi-step workflows.
- **Real-time Debugging**: A live view of the browser is streamed to the frontend, allowing you to see the agent's actions in real-time.
- **Session Management**: The application includes basic session management features, allowing you to create, list, get, and end Browserbase sessions.
- **Command Execution**: You can send commands to the agent, which will be executed in the browser.
- **Data Extraction**: The application includes an example of how to use the agent to extract data from a webpage.

## Setup

### 1. Install dependencies and launch TypeScript in watch mode:

```bash
npm install
tsc -w
```


### 2. Get your Browserbase API Key and Project ID:

- [Create an account](https://www.browserbase.com/sign-up) or [log in to Browserbase](https://www.browserbase.com/sign-in)
- Copy your API Key and Project ID [from your Settings page](https://www.browserbase.com/settings)

### 3. Run the script:

```bash
BROWSERBASE_PROJECT_ID=xxx BROWSERBASE_API_KEY=xxxx node dist/server.js
```


## Further reading

- [See how to leverage the Session Debugger for faster development](https://docs.browserbase.com/guides/browser-remote-control#accelerate-your-local-development-with-remote-debugging)
- [Learn more about Browserbase infrastructure](https://docs.browserbase.com/under-the-hood)
- [Explore the Sessions API](https://docs.browserbase.com/api-reference/list-all-sessions)
