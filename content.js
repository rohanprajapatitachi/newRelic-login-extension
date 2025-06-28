// Content script for New Relic pages
console.log('New Relic Cookie Extractor content script loaded');

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookies') {
    const cookies = document.cookie;
    sendResponse({ cookies: cookies });
  }
});

// Monitor for login success
let loginCheckInterval;

function startLoginMonitoring() {
  loginCheckInterval = setInterval(() => {
    // Check if we're logged in by looking for user-specific elements
    const userElements = document.querySelectorAll('.user-menu, .nav-user, .account-menu, [data-testid="user-menu"]');
    
    if (userElements.length > 0) {
      clearInterval(loginCheckInterval);
      chrome.runtime.sendMessage({ action: 'loginSuccess' });
    }
  }, 2000);
}

// Start monitoring when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startLoginMonitoring);
} else {
  startLoginMonitoring();
} 