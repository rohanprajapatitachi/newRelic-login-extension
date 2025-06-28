// Session storage keys
const STORAGE_KEYS = {
  CREDENTIALS: 'newrelic_credentials',
  SESSION_DATA: 'newrelic_session_data',
  AUTO_LOGIN: 'newrelic_auto_login'
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  switch (request.action) {
    case 'saveCredentials':
      saveCredentials(request.email, request.password).then(sendResponse);
      return true;
      
    case 'enableAutoLogin':
      enableAutoLogin(request.enabled).then(sendResponse);
      return true;
      
    case 'extractSession':
      extractSession().then(sendResponse);
      return true;
      
    case 'applySession':
      applySession(request.sessionData).then(sendResponse);
      return true;
      
    case 'exportSession':
      exportSession().then(sendResponse);
      return true;
      
    case 'importSession':
      importSession(request.sessionData).then(sendResponse);
      return true;
      
    case 'checkSessionStatus':
      checkSessionStatus().then(sendResponse);
      return true;
      
    case 'autoLogin':
      handleAutoLogin().then(sendResponse);
      return true;
      
    case 'loginFormReady':
      handleLoginFormReady(sender.tab.id).then(sendResponse);
      return true;
      
    case 'loginSuccess':
      handleLoginSuccess().then(sendResponse);
      return true;
  }
});

// Listen for tab updates to detect New Relic login page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('login.newrelic.com')) {
    console.log('New Relic login page detected:', tab.url);
    
    // Check if auto-login is enabled
    chrome.storage.local.get([STORAGE_KEYS.AUTO_LOGIN], (result) => {
      if (result[STORAGE_KEYS.AUTO_LOGIN]) {
        console.log('Auto-login enabled, will trigger when form is ready...');
      }
    });
  }
});

// Save credentials to storage
async function saveCredentials(email, password) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CREDENTIALS]: { email, password }
    });
    return { success: true, message: 'Credentials saved successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Enable/disable auto-login
async function enableAutoLogin(enabled) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTO_LOGIN]: enabled
    });
    return { success: true, message: `Auto-login ${enabled ? 'enabled' : 'disabled'}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Extract current session cookies
async function extractSession() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: '.newrelic.com'
    });

    // Filter important session cookies
    const sessionCookies = cookies.filter(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('token') ||
      cookie.name.includes('csrf') ||
      cookie.name.includes('user') ||
      cookie.name.includes('login') ||
      cookie.name.includes('_gd_session') ||
      cookie.name.includes('golden_gate_session')
    );

    const sessionData = {
      timestamp: Date.now(),
      cookies: sessionCookies,
      userAgent: navigator.userAgent
    };

    // Save to storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.SESSION_DATA]: sessionData
    });

    return {
      success: true,
      sessionData: sessionData,
      message: `Extracted ${sessionCookies.length} session cookies`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Apply stored session to current browser
async function applySession(sessionData) {
  try {
    if (!sessionData || !sessionData.cookies) {
      return { success: false, error: 'Invalid session data' };
    }

    let appliedCount = 0;
    for (const cookie of sessionData.cookies) {
      try {
        await chrome.cookies.set({
          url: `https://${cookie.domain}${cookie.path}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate
        });
        appliedCount++;
      } catch (cookieError) {
        console.warn('Failed to set cookie:', cookie.name, cookieError);
      }
    }

    return {
      success: true,
      message: `Applied ${appliedCount} session cookies`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Export session data
async function exportSession() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SESSION_DATA]);
    const sessionData = result[STORAGE_KEYS.SESSION_DATA];
    
    if (!sessionData) {
      return { success: false, error: 'No session data found' };
    }

    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      sessionData: sessionData
    };

    return {
      success: true,
      data: JSON.stringify(exportData, null, 2)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Import session data
async function importSession(sessionData) {
  try {
    let data;
    if (typeof sessionData === 'string') {
      data = JSON.parse(sessionData);
    } else {
      data = sessionData;
    }

    if (data.sessionData && data.sessionData.cookies) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SESSION_DATA]: data.sessionData
      });
      return { success: true, message: 'Session imported successfully' };
    } else {
      return { success: false, error: 'Invalid session data format' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check current session status
async function checkSessionStatus() {
  try {
    const cookies = await chrome.cookies.getAll({
      domain: '.newrelic.com'
    });

    const hasSession = cookies.some(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('token')
    );

    const result = await chrome.storage.local.get([STORAGE_KEYS.SESSION_DATA, STORAGE_KEYS.AUTO_LOGIN]);
    
    return {
      isLoggedIn: hasSession,
      hasStoredSession: !!result[STORAGE_KEYS.SESSION_DATA],
      autoLoginEnabled: result[STORAGE_KEYS.AUTO_LOGIN] || false,
      sessionCount: cookies.length
    };
  } catch (error) {
    return { isLoggedIn: false, error: error.message };
  }
}

// Handle login form ready notification
async function handleLoginFormReady(tabId) {
  try {
    // Check if auto-login is enabled
    const result = await chrome.storage.local.get([STORAGE_KEYS.AUTO_LOGIN]);
    if (!result[STORAGE_KEYS.AUTO_LOGIN]) {
      console.log('Auto-login not enabled');
      return { success: false, message: 'Auto-login not enabled' };
    }

    // Get stored credentials
    const credResult = await chrome.storage.local.get([STORAGE_KEYS.CREDENTIALS]);
    const credentials = credResult[STORAGE_KEYS.CREDENTIALS];
    
    if (!credentials) {
      console.log('No stored credentials found');
      return { success: false, message: 'No stored credentials found' };
    }

    console.log('Starting auto-login process...');
    
    // Inject login script
    const loginResult = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: performAutoLogin,
      args: [credentials.email, credentials.password]
    });

    if (loginResult[0].result) {
      console.log('Auto-login script executed successfully');
      return { success: true, message: 'Auto-login process started' };
    } else {
      console.log('Auto-login script failed');
      return { success: false, message: 'Auto-login failed' };
    }
  } catch (error) {
    console.error('Error in handleLoginFormReady:', error);
    return { success: false, error: error.message };
  }
}

// Handle successful login
async function handleLoginSuccess() {
  try {
    console.log('Login successful, extracting session...');
    
    // Wait a bit for cookies to be set
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract session
    const result = await extractSession();
    
    if (result.success) {
      console.log('Session extracted successfully:', result.message);
      return { success: true, message: 'Login successful and session extracted' };
    } else {
      console.log('Failed to extract session:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error in handleLoginSuccess:', error);
    return { success: false, error: error.message };
  }
}

// Handle automatic login (legacy function)
async function handleAutoLogin() {
  try {
    // Get stored credentials
    const result = await chrome.storage.local.get([STORAGE_KEYS.CREDENTIALS]);
    const credentials = result[STORAGE_KEYS.CREDENTIALS];
    
    if (!credentials) {
      return { success: false, error: 'No stored credentials found' };
    }

    // Find the New Relic login tab
    const tabs = await chrome.tabs.query({
      url: 'https://login.newrelic.com/*'
    });

    if (tabs.length === 0) {
      return { success: false, error: 'No New Relic login tab found' };
    }

    const tab = tabs[0];
    
    // Inject login script
    const loginResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: performAutoLogin,
      args: [credentials.email, credentials.password]
    });

    if (loginResult[0].result) {
      return { success: true, message: 'Auto-login process started' };
    } else {
      return { success: false, error: 'Auto-login failed' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Function to be injected for automatic login
function performAutoLogin(email, password) {
  return new Promise((resolve) => {
    console.log('Performing auto-login for New Relic...');
    console.log('Current URL:', window.location.href);
    
    let step = 1; // 1 = email step, 2 = password step
    
    const performStep = () => {
      if (step === 1) {
        // Step 1: Find email input and fill it
        const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="username"], #email, #username');
        const nextButton = document.querySelector('button:contains("Next"), button[type="submit"], input[type="submit"], button');
        
        console.log('Step 1 - Email input found:', !!emailInput);
        console.log('Step 1 - Next button found:', !!nextButton);
        
        if (emailInput && nextButton) {
          // Fill email
          emailInput.value = email;
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log('Email filled, clicking Next...');
          
          // Click Next button
          setTimeout(() => {
            nextButton.click();
            step = 2;
            
            // Wait for password step to load
            setTimeout(() => {
              performStep();
            }, 2000);
          }, 1000);
        } else {
          console.log('Email step elements not found');
          resolve(false);
        }
      } else if (step === 2) {
        // Step 2: Find password input and fill it
        const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password');
        const loginButton = document.querySelector('button[type="submit"], input[type="submit"], button:contains("Sign In"), button:contains("Log In")');
        
        console.log('Step 2 - Password input found:', !!passwordInput);
        console.log('Step 2 - Login button found:', !!loginButton);
        
        if (passwordInput && loginButton) {
          // Fill password
          passwordInput.value = password;
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log('Password filled, clicking login...');
          
          // Click login button
          setTimeout(() => {
            loginButton.click();
            console.log('Login button clicked');
            resolve(true);
          }, 1000);
        } else {
          console.log('Password step elements not found');
          resolve(false);
        }
      }
    };
    
    // Start the process
    setTimeout(performStep, 1000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      console.log('Auto-login timeout');
      resolve(false);
    }, 30000);
  });
} 