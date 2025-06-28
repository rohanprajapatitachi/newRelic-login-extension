// Content script for New Relic login page
console.log('New Relic Session Manager content script loaded');

// Check if we're on the login page
if (window.location.href.includes('login.newrelic.com')) {
  console.log('On New Relic login page, monitoring for form...');
  
  // Monitor for login form and notify background script
  let formCheckInterval = setInterval(() => {
    const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="username"], #email, #username');
    const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password');
    const nextButton = document.querySelector('button:contains("Next"), button[type="submit"], input[type="submit"]');
    
    if (emailInput && passwordInput && nextButton) {
      console.log('Login form detected on page');
      clearInterval(formCheckInterval);
      
      // Notify background script that login form is ready
      chrome.runtime.sendMessage({ 
        action: 'loginFormReady',
        url: window.location.href
      });
    }
  }, 1000);
  
  // Stop checking after 30 seconds
  setTimeout(() => {
    clearInterval(formCheckInterval);
  }, 30000);
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  if (request.action === 'getPageInfo') {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      hasLoginForm: !!document.querySelector('input[type="email"], input[name="email"]'),
      isLoggedIn: !window.location.href.includes('login.newrelic.com')
    };
    sendResponse(pageInfo);
  }
});

// Monitor for successful login (redirect away from login page)
let loginSuccessCheck = setInterval(() => {
  if (!window.location.href.includes('login.newrelic.com')) {
    console.log('Login successful - redirected away from login page');
    clearInterval(loginSuccessCheck);
    
    // Notify background script of successful login
    chrome.runtime.sendMessage({ 
      action: 'loginSuccess',
      newUrl: window.location.href
    });
  }
}, 2000);

// Stop monitoring after 5 minutes
setTimeout(() => {
  clearInterval(loginSuccessCheck);
}, 300000); 