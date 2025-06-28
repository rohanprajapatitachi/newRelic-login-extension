// Fixed Background Script with Proper Selectors
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
      
    case 'performManualLogin':
      performManualLogin().then(sendResponse);
      return true;
      
    case 'loginFormReady':
      handleLoginFormReady(sender.tab.id, request.step).then(sendResponse);
      return true;
      
    case 'loginSuccess':
      handleLoginSuccess().then(sendResponse);
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
          function: performAutoLoginFixed,
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
      function: performAutoLoginFixed,
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

// FIXED auto-login function with proper selectors
function performAutoLoginFixed(email, password, currentStep = 'unknown') {
  return new Promise((resolve) => {
    console.log('=== NEW RELIC AUTO-LOGIN STARTING ===');
    console.log('URL:', window.location.href);
    console.log('Current step:', currentStep);
    
    let step = currentStep === 'password' ? 2 : 1;
    let attempts = 0;
    const maxAttempts = 5;
    
    const performStep = () => {
      attempts++;
      console.log(`=== ATTEMPT ${attempts}, STEP ${step} ===`);
      
      if (attempts > maxAttempts) {
        console.log('❌ Max attempts reached');
        resolve(false);
        return;
      }
      
      if (step === 1) {
        console.log('🔍 Looking for email input...');
        
        // Email selectors in order of preference
        const emailSelectors = [
          'input[type="email"]',
          'input[name="email"]', 
          'input[name="username"]',
          '#email',
          '#username',
          'input[autocomplete="email"]',
          'input[autocomplete="username"]'
        ];
        
        let emailInput = null;
        for (const selector of emailSelectors) {
          emailInput = document.querySelector(selector);
          if (emailInput) {
            console.log(`✅ Found email input with selector: ${selector}`);
            break;
          }
        }
        
        if (!emailInput) {
          console.log('❌ No email input found, retrying...');
          setTimeout(performStep, 2000);
          return;
        }
        
        // Find submit/next button
        console.log('🔍 Looking for next button...');
        let nextButton = null;
        
        // Try submit buttons first
        const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
        if (submitButtons.length > 0) {
          nextButton = submitButtons[0];
          console.log('✅ Found submit button');
        }
        
        // If no submit button, look for buttons with text
        if (!nextButton) {
          const allButtons = document.querySelectorAll('button');
          for (const btn of allButtons) {
            const text = btn.textContent.toLowerCase().trim();
            if (text.includes('next') || text.includes('continue') || text.includes('sign') || text.includes('log')) {
              nextButton = btn;
              console.log(`✅ Found button with text: "${text}"`);
              break;
            }
          }
        }
        
        if (!nextButton) {
          console.log('❌ No next button found, retrying...');
          setTimeout(performStep, 2000);
          return;
        }
        
        // Fill email and submit
        console.log('📝 Filling email field...');
        emailInput.focus();
        emailInput.value = '';
        emailInput.value = email;
        
        // Trigger events
        ['input', 'change', 'blur'].forEach(eventType => {
          emailInput.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        console.log('✅ Email filled:', email);
        console.log('🖱️ Clicking next button...');
        
        setTimeout(() => {
          nextButton.click();
          console.log('✅ Next button clicked, waiting for password step...');
          step = 2;
          setTimeout(performStep, 3000);
        }, 1000);
        
      } else if (step === 2) {
        console.log('🔍 Looking for password input...');
        
        const passwordSelectors = [
          'input[type="password"]',
          'input[name="password"]',
          '#password',
          'input[autocomplete="current-password"]'
        ];
        
        let passwordInput = null;
        for (const selector of passwordSelectors) {
          passwordInput = document.querySelector(selector);
          if (passwordInput) {
            console.log(`✅ Found password input with selector: ${selector}`);
            break;
          }
        }
        
        if (!passwordInput) {
          console.log('❌ No password input found, retrying...');
          setTimeout(performStep, 2000);
          return;
        }
        
        // Find login button
        console.log('🔍 Looking for login button...');
        let loginButton = null;
        
        // Try submit buttons first
        const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
        if (submitButtons.length > 0) {
          loginButton = submitButtons[0];
          console.log('✅ Found submit button');
        }
        
        // If no submit button, look for buttons with text
        if (!loginButton) {
          const allButtons = document.querySelectorAll('button');
          for (const btn of allButtons) {
            const text = btn.textContent.toLowerCase().trim();
            if (text.includes('sign') || text.includes('log') || text.includes('submit')) {
              loginButton = btn;
              console.log(`✅ Found login button with text: "${text}"`);
              break;
            }
          }
        }
        
        if (!loginButton) {
          console.log('❌ No login button found, retrying...');
          setTimeout(performStep, 2000);
          return;
        }
        
        // Fill password and submit
        console.log('🔐 Filling password field...');
        passwordInput.focus();
        passwordInput.value = '';
        passwordInput.value = password;
        
        // Trigger events
        ['input', 'change', 'blur'].forEach(eventType => {
          passwordInput.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        console.log('✅ Password filled');
        console.log('🖱️ Clicking login button...');
        
        setTimeout(() => {
          loginButton.click();
          console.log('✅ Login button clicked!');
          console.log('=== AUTO-LOGIN COMPLETED ===');
          resolve(true);
        }, 1000);
      }
    };
    
    // Start the process
    console.log('⏱️ Starting login process in 1 second...');
    setTimeout(performStep, 1000);
    
    // Overall timeout
    setTimeout(() => {
      console.log('⏰ Auto-login timeout after 60 seconds');
      resolve(false);
    }, 60000);
  });
}