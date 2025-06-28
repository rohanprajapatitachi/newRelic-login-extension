// Content script for New Relic login page
console.log('New Relic Session Manager content script loaded');

// Check if we're on the login page
if (window.location.href.includes('login.newrelic.com')) {
  console.log('On New Relic login page, monitoring for form...');
  
  // Monitor for login form and notify background script
  let formCheckInterval = setInterval(() => {
    // Look for the email input field (first step of New Relic login)
    const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="username"], #email, #username');
    const nextButton = document.querySelector('button:contains("Next"), button[type="submit"], input[type="submit"], button');
    
    console.log('Checking for login form elements...');
    console.log('Email input found:', !!emailInput);
    console.log('Next button found:', !!nextButton);
    
    if (emailInput && nextButton) {
      console.log('Login form detected on page - Step 1 (Email)');
      clearInterval(formCheckInterval);
      
      // Notify background script that login form is ready
      chrome.runtime.sendMessage({ 
        action: 'loginFormReady',
        url: window.location.href,
        step: 'email'
      });
    }
  }, 1000);
  
  // Stop checking after 30 seconds
  setTimeout(() => {
    clearInterval(formCheckInterval);
    console.log('Form check timeout - no login form found');
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
      isLoggedIn: !window.location.href.includes('login.newrelic.com'),
      currentStep: getCurrentLoginStep()
    };
    sendResponse(pageInfo);
  }
});

// Function to determine current login step
function getCurrentLoginStep() {
  const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="username"], #email, #username');
  const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password');
  
  if (emailInput && !passwordInput) {
    return 'email';
  } else if (passwordInput) {
    return 'password';
  } else {
    return 'unknown';
  }
}

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

// Also monitor for URL changes within the login page (for two-step process)
let lastUrl = window.location.href;
const urlCheckInterval = setInterval(() => {
  if (window.location.href !== lastUrl) {
    console.log('URL changed within login page:', window.location.href);
    lastUrl = window.location.href;
    
    // Check if we're now on password step
    setTimeout(() => {
      const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password');
      if (passwordInput) {
        console.log('Password step detected');
        chrome.runtime.sendMessage({ 
          action: 'loginFormReady',
          url: window.location.href,
          step: 'password'
        });
      }
    }, 1000);
  }
}, 1000);

// Stop URL monitoring after 5 minutes
setTimeout(() => {
  clearInterval(urlCheckInterval);
}, 300000); 