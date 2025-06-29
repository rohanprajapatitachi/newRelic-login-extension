// Fixed Background Script with Proper Selectors
const STORAGE_KEYS = {
  CREDENTIALS: 'newrelic_credentials',
  SESSION_DATA: 'newrelic_session_data',
  AUTO_LOGIN: 'newrelic_auto_login'
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'login') {
    chrome.tabs.create({ url: 'https://login.newrelic.com/', active: false }, (tab) => {
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (email, password) => {
            const emailInput = document.querySelector('input[type="email"], input[name="email"], #email, input[autocomplete="username"]');
            const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password, input[autocomplete="current-password"]');
            const loginBtn = Array.from(document.querySelectorAll('button, input[type="submit"]'))
              .find(btn => btn.textContent.trim().toLowerCase().includes('log in') || btn.type === 'submit');
            if (emailInput && passwordInput && loginBtn) {
              emailInput.value = email;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              passwordInput.value = password;
              passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
              setTimeout(() => loginBtn.click(), 500);
              return true;
            }
            return false;
          },
          args: [msg.email, msg.password]
        }, async (results) => {
          setTimeout(async () => {
            const cookies = await chrome.cookies.getAll({ domain: '.newrelic.com' });
            await chrome.storage.local.set({ sessionCookies: cookies });
            sendResponse({ success: true });
            chrome.tabs.remove(tab.id);
          }, 5000);
        });
      }, 3000);
    });
    return true;
  }
  if (msg.action === 'exportSession') {
    chrome.storage.local.get('sessionCookies', (data) => {
      if (data.sessionCookies) {
        sendResponse({ success: true, data: JSON.stringify(data.sessionCookies, null, 2) });
      } else {
        sendResponse({ success: false, error: 'No session found' });
      }
    });
    return true;
  }
  if (msg.action === 'importSession') {
    try {
      const cookies = JSON.parse(msg.data);
      cookies.forEach(cookie => {
        chrome.cookies.set({
          url: `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate
        });
      });
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
});

// Enhanced tab monitoring for New Relic pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('login.newrelic.com')) {
      console.log('New Relic login page detected:', tab.url);
    } else if (tab.url.includes('one.newrelic.com') || tab.url.includes('newrelic.com')) {
      console.log('New Relic main site detected - login may be successful');
    }
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

// Enhanced session extraction with more cookie types
async function extractSession() {
  try {
    const domains = ['.newrelic.com', 'newrelic.com', 'one.newrelic.com', 'login.newrelic.com'];
    let allCookies = [];

    // Get cookies from all New Relic domains
    for (const domain of domains) {
      try {
        const cookies = await chrome.cookies.getAll({ domain: domain });
        allCookies = allCookies.concat(cookies);
      } catch (error) {
        console.warn(`Failed to get cookies for domain ${domain}:`, error);
      }
    }

    // Filter important session cookies
    const sessionCookies = allCookies.filter(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('token') ||
      cookie.name.includes('csrf') ||
      cookie.name.includes('user') ||
      cookie.name.includes('login') ||
      cookie.name.includes('_gd_session') ||
      cookie.name.includes('golden_gate_session') ||
      cookie.name.includes('JSESSIONID') ||
      cookie.name.includes('remember') ||
      cookie.name.includes('nreum') ||
      cookie.name.includes('nr_') ||
      cookie.name.startsWith('_')
    );

    const sessionData = {
      timestamp: Date.now(),
      cookies: sessionCookies,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      domains: domains
    };

    // Save to storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.SESSION_DATA]: sessionData
    });

    return {
      success: true,
      sessionData: sessionData,
      message: `Extracted ${sessionCookies.length} session cookies from ${domains.length} domains`
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
    const errors = [];

    for (const cookie of sessionData.cookies) {
      try {
        const protocol = cookie.secure ? 'https://' : 'http://';
        const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
        const url = `${protocol}${domain}${cookie.path}`;

        await chrome.cookies.set({
          url: url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'lax',
          expirationDate: cookie.expirationDate
        });
        appliedCount++;
      } catch (cookieError) {
        console.warn('Failed to set cookie:', cookie.name, cookieError);
        errors.push(`${cookie.name}: ${cookieError.message}`);
      }
    }

    return {
      success: true,
      message: `Applied ${appliedCount} session cookies`,
      errors: errors.length > 0 ? errors : null
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
      version: '1.1',
      timestamp: Date.now(),
      sessionData: sessionData,
      source: 'New Relic Session Manager'
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

// Enhanced session status check
async function checkSessionStatus() {
  try {
    const domains = ['.newrelic.com', 'newrelic.com', 'one.newrelic.com'];
    let allCookies = [];

    for (const domain of domains) {
      try {
        const cookies = await chrome.cookies.getAll({ domain: domain });
        allCookies = allCookies.concat(cookies);
      } catch (error) {
        console.warn(`Failed to check cookies for ${domain}`);
      }
    }

    const hasSession = allCookies.some(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('token') ||
      cookie.name.includes('golden_gate_session')
    );

    const result = await chrome.storage.local.get([STORAGE_KEYS.SESSION_DATA, STORAGE_KEYS.AUTO_LOGIN]);
    
    return {
      isLoggedIn: hasSession,
      hasStoredSession: !!result[STORAGE_KEYS.SESSION_DATA],
      autoLoginEnabled: result[STORAGE_KEYS.AUTO_LOGIN] || false,
      sessionCount: allCookies.length,
      domains: domains
    };
  } catch (error) {
    return { isLoggedIn: false, error: error.message };
  }
}

// Manual login trigger
async function performManualLogin() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.CREDENTIALS]);
    const credentials = result[STORAGE_KEYS.CREDENTIALS];
    
    if (!credentials) {
      return { success: false, error: 'No stored credentials found' };
    }

    // Open New Relic login page or find existing tab
    let tab;
    const tabs = await chrome.tabs.query({ url: 'https://login.newrelic.com/*' });
    
    if (tabs.length > 0) {
      tab = tabs[0];
      await chrome.tabs.update(tab.id, { active: true });
    } else {
      tab = await chrome.tabs.create({ url: 'https://login.newrelic.com/' });
    }

    // Wait for page to load, then trigger login
    setTimeout(async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: performAutoLogin,
          args: [credentials.email, credentials.password]
        });
      } catch (error) {
        console.error('Failed to execute login script:', error);
      }
    }, 3000);

    return { success: true, message: 'Manual login initiated' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle login form ready notification
async function handleLoginFormReady(tabId, step) {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.AUTO_LOGIN]);
    if (!result[STORAGE_KEYS.AUTO_LOGIN]) {
      return { success: false, message: 'Auto-login not enabled' };
    }

    const credResult = await chrome.storage.local.get([STORAGE_KEYS.CREDENTIALS]);
    const credentials = credResult[STORAGE_KEYS.CREDENTIALS];
    
    if (!credentials) {
      return { success: false, message: 'No stored credentials found' };
    }

    console.log(`Starting auto-login process for step: ${step}...`);
    
    const loginResult = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: performAutoLogin,
      args: [credentials.email, credentials.password, step]
    });

    if (loginResult[0].result) {
      return { success: true, message: 'Auto-login process started' };
    } else {
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
    
    // Wait for cookies to be set
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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

// Debug function to inspect page elements
function debugPageElements() {
  console.log('=== DEBUGGING PAGE ELEMENTS ===');
  console.log('Current URL:', window.location.href);
  console.log('Page title:', document.title);
  
  // Check for email inputs
  const emailInputs = document.querySelectorAll('input[type="email"], input[name="email"], input[name="username"], #email, #username');
  console.log('Email inputs found:', emailInputs.length);
  emailInputs.forEach((input, index) => {
    console.log(`Email input ${index + 1}:`, {
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      visible: input.offsetParent !== null
    });
  });
  
  // Check for password inputs
  const passwordInputs = document.querySelectorAll('input[type="password"], input[name="password"], #password');
  console.log('Password inputs found:', passwordInputs.length);
  passwordInputs.forEach((input, index) => {
    console.log(`Password input ${index + 1}:`, {
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      visible: input.offsetParent !== null
    });
  });
  
  // Check for buttons
  const buttons = document.querySelectorAll('button, input[type="submit"]');
  console.log('Buttons found:', buttons.length);
  buttons.forEach((button, index) => {
    console.log(`Button ${index + 1}:`, {
      type: button.type,
      text: button.textContent.trim(),
      visible: button.offsetParent !== null
    });
  });
  
  // Check for forms
  const forms = document.querySelectorAll('form');
  console.log('Forms found:', forms.length);
  forms.forEach((form, index) => {
    console.log(`Form ${index + 1}:`, {
      action: form.action,
      method: form.method,
      inputs: form.querySelectorAll('input').length
    });
  });
  
  console.log('=== END DEBUG ===');
  return {
    emailInputs: emailInputs.length,
    passwordInputs: passwordInputs.length,
    buttons: buttons.length,
    forms: forms.length
  };
}

// Debug page function
async function debugPage(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: debugPageElements
    });
    
    return {
      success: true,
      debugInfo: result[0].result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Enhanced auto-login function with better error handling
function performAutoLogin(email, password) {
  return new Promise((resolve) => {
    console.log('Performing auto-login for New Relic...');
    // Try up to 5 times, every 2 seconds
    let attempts = 0;
    const maxAttempts = 5;

    const tryLogin = () => {
      attempts++;
      // Find email and password fields
      const emailInput = document.querySelector('input[type="email"], input[name="email"], #email, input[autocomplete="username"]');
      const passwordInput = document.querySelector('input[type="password"], input[name="password"], #password, input[autocomplete="current-password"]');
      const loginButton = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        .find(btn => btn.textContent.trim().toLowerCase().includes('log in') || btn.type === 'submit');

      console.log('Email input:', !!emailInput, 'Password input:', !!passwordInput, 'Login button:', !!loginButton);

      if (emailInput && passwordInput && loginButton) {
        // Fill both fields
        emailInput.focus();
        emailInput.value = email;
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));

        passwordInput.focus();
        passwordInput.value = password;
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

        setTimeout(() => {
          loginButton.click();
          console.log('Clicked login button');
          resolve(true);
        }, 500);
      } else if (attempts < maxAttempts) {
        setTimeout(tryLogin, 2000);
      } else {
        console.log('Could not find all login fields after several attempts');
        resolve(false);
      }
    };

    tryLogin();
    setTimeout(() => resolve(false), 20000); // 20s overall timeout
  });
}

document.getElementById('loginBtn').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  document.getElementById('status').textContent = 'Logging in...';
  chrome.runtime.sendMessage({ action: 'login', email, password }, (resp) => {
    document.getElementById('status').textContent = resp.success ? 'Logged in! Session extracted.' : 'Login failed: ' + resp.error;
  });
};

document.getElementById('exportBtn').onclick = async () => {
  chrome.runtime.sendMessage({ action: 'exportSession' }, (resp) => {
    if (resp.success) {
      document.getElementById('sessionData').value = resp.data;
      document.getElementById('status').textContent = 'Session exported!';
    } else {
      document.getElementById('status').textContent = 'Export failed: ' + resp.error;
    }
  });
};

document.getElementById('importBtn').onclick = () => {
  document.getElementById('importFile').click();
};

document.getElementById('importFile').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    chrome.runtime.sendMessage({ action: 'importSession', data: reader.result }, (resp) => {
      document.getElementById('status').textContent = resp.success ? 'Session imported!' : 'Import failed: ' + resp.error;
    });
  };
  reader.readAsText(file);
};