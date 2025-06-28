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
  try {
    // Navigate to New Relic login page
    const tab = await chrome.tabs.create({
      url: 'https://one.newrelic.com/catalogs/software?account=3352868&state=830c1da7-c969-9db7-4d42-a6e68226aa9d',
      active: false
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Inject login script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: performLogin,
      args: [email, password]
    });

    // Wait for login to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if login was successful
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: checkLoginSuccess
    });

    if (result[0].result) {
      // Close the tab after successful login
      await chrome.tabs.remove(tab.id);
      return { success: true };
    } else {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: 'Login failed - please check credentials' };
    }
  } catch (error) {
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
    // Wait for login form to be available
    const checkForm = setInterval(() => {
      const emailInput = document.querySelector('input[type="email"], input[name="email"], #email');
      const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password');
      const loginButton = document.querySelector('button[type="submit"], input[type="submit"], .login-button');

      if (emailInput && passwordInput && loginButton) {
        clearInterval(checkForm);
        
        // Fill in credentials
        emailInput.value = email;
        passwordInput.value = password;
        
        // Trigger input events
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Click login button
        setTimeout(() => {
          loginButton.click();
          resolve(true);
        }, 1000);
      }
    }, 500);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkForm);
      resolve(false);
    }, 30000);
  });
}

// Function to check if login was successful
function checkLoginSuccess() {
  // Check for various indicators of successful login
  const indicators = [
    document.querySelector('.dashboard'),
    document.querySelector('.user-menu'),
    document.querySelector('[data-testid="user-menu"]'),
    document.querySelector('.nav-user'),
    document.querySelector('.account-menu'),
    document.location.href.includes('dashboard'),
    document.location.href.includes('account')
  ];

  return indicators.some(indicator => indicator !== null);
} 