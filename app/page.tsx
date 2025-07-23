import React from 'react';
import Script from 'next/script';

export default function Page() {
  return (
    <>
      <div className="logo-container">
        <img src="https://utdrojtjfwjcvuzmkooj.supabase.co/storage/v1/object/public/content//CMDr.png" alt="Light Logo" className="logo light-logo" />
        <img src="https://utdrojtjfwjcvuzmkooj.supabase.co/storage/v1/object/public/content//CMDr%202.png" alt="Dark Logo" className="logo dark-logo" />
      </div>
      <div className="theme-switch-wrapper">
        <label className="theme-switch" htmlFor="checkbox">
          <input type="checkbox" id="checkbox" />
          <div className="slider round"></div>
        </label>
      </div>
      <div className="container">
        <main className="content">
          <h1>What would you like to do?</h1>
          <div className="input-group">
            <input type="text" id="initial-command-input" placeholder="Enter your initial command..." />
            <button id="start-session-button">Start</button>
          </div>
          <button id="quick-search-button" style={{ display: 'none' }}>Quick Search</button>
          <div className="loader-wrapper" style={{ display: 'none' }}>
            <div className="loader"></div>
          </div>
          <div id="results-container" className="hidden"></div>
        </main>
      </div>
      <Script src="/experiment.js" />
    </>
  );
}
