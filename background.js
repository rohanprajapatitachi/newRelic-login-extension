chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    handleLogin(request.email, request.password).then(sendResponse);
    return true; // Keep the message channel open for async response
  } else if (request.action === 'extractCookies') {
    extractCookies().then(sendResponse);
    return true;
  } else if (request.action === 'checkStatus') {
    checkLoginStatus().then(sendResponse);
    return true;
  }
});

async function handleLogin(email, password) {
  let tab = null;
  try {
    // Navigate to New Relic login page (not dashboard)
    tab = await chrome.tabs.create({
      url: 'https://login.newrelic.com/login',
      active: false
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Inject login script
    const loginResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: performLogin,
      args: [email, password]
    });

    console.log('Login script result:', loginResult);

    if (!loginResult[0].result) {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: 'Login form not found or login failed' };
    }

    // Wait for login to complete and page to redirect
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Check if login was successful
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: checkLoginSuccess
    });

    console.log('Login success check result:', result);

    if (result[0].result) {
      // Close the tab after successful login
      await chrome.tabs.remove(tab.id);
      return { success: true };
    } else {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: 'Login failed - please check credentials' };
    }
  } catch (error) {
    console.error('Login error:', error);
    if (tab) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (e) {
        console.error('Error closing tab:', e);
      }
    }
    return { success: false, error: error.message };
  }
}

async function extractCookies() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: '.newrelic.com'
    });

    // Filter important cookies
    const importantCookies = cookies.filter(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('token') ||
      cookie.name.includes('csrf') ||
      cookie.name.includes('user') ||
      cookie.name.includes('login')
    );

    return {
      success: true,
      cookies: importantCookies
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkLoginStatus() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: '.newrelic.com'
    });

    const hasAuthCookie = cookies.some(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('token')
    );

    return { isLoggedIn: hasAuthCookie };
  } catch (error) {
    return { isLoggedIn: false };
  }
}

// Function to be injected into the page for login
function performLogin(email, password) {
  return new Promise((resolve) => {
    console.log('Starting login process...');
    
    // Wait for login form to be available
    const checkForm = setInterval(() => {
      console.log('Checking for login form...');
      
      // More comprehensive selectors for New Relic login form
      const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="username"], #email, #username, [data-testid="email-input"]');
      const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password, [data-testid="password-input"]');
      const loginButton = document.querySelector('button[type="submit"], input[type="submit"], .login-button, [data-testid="login-button"], button:contains("Sign In"), button:contains("Log In")');

      console.log('Found elements:', { emailInput: !!emailInput, passwordInput: !!passwordInput, loginButton: !!loginButton });

      if (emailInput && passwordInput && loginButton) {
        clearInterval(checkForm);
        
        console.log('Login form found, filling credentials...');
        
        // Fill in credentials
        emailInput.value = email;
        passwordInput.value = password;
        
        // Trigger input events to activate any validation
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Wait a bit then click login button
        setTimeout(() => {
          console.log('Clicking login button...');
          loginButton.click();
          resolve(true);
        }, 2000);
      }
    }, 1000);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkForm);
      console.log('Login form not found within timeout');
      resolve(false);
    }, 30000);
  });
}

// Function to check if login was successful
function checkLoginSuccess() {
  console.log('Checking login success...');
  console.log('Current URL:', window.location.href);
  
  // Check for various indicators of successful login
  const indicators = [
    document.querySelector('.dashboard'),
    document.querySelector('.user-menu'),
    document.querySelector('[data-testid="user-menu"]'),
    document.querySelector('.nav-user'),
    document.querySelector('.account-menu'),
    document.querySelector('.user-avatar'),
    document.querySelector('[data-testid="user-avatar"]'),
    document.location.href.includes('dashboard'),
    document.location.href.includes('account'),
    document.location.href.includes('one.newrelic.com'),
    !document.location.href.includes('login.newrelic.com')
  ];

  const result = indicators.some(indicator => indicator !== null);
  console.log('Login success indicators:', indicators);
  console.log('Login success result:', result);
  
  return result;
} 