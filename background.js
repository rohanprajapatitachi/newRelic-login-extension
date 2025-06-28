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
      
    case 'debugPage':
      debugPage(sender.tab.id).then(sendResponse);
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
function performAutoLogin(email, password, currentStep = 'unknown') {
  return new Promise((resolve) => {
    console.log('Performing auto-login for New Relic...');
    console.log('Current URL:', window.location.href);
    console.log('Current step:', currentStep);
    
    let step = currentStep === 'password' ? 2 : 1;
    let attempts = 0;
    const maxAttempts = 5;
    
    const performStep = () => {
      attempts++;
      console.log(`Attempt ${attempts}, Step ${step}`);
      
      if (attempts > maxAttempts) {
        console.log('Max attempts reached');
        resolve(false);
        return;
      }
      
      if (step === 1) {
        // Step 1: Email input
        const emailSelectors = [
          'input[type="email"]',
          'input[name="email"]', 
          'input[name="username"]',
          '#email',
          '#username',
          'input[placeholder*="email" i]',
          'input[placeholder*="username" i]'
        ];
        
        const buttonSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:contains("Next")',
          'button:contains("Continue")',
          'button:contains("Sign In")',
          'button',
          '[role="button"]'
        ];
        
        let emailInput = null;
        let nextButton = null;
        
        // Find email input
        for (const selector of emailSelectors) {
          emailInput = document.querySelector(selector);
          if (emailInput) break;
        }
        
        // Find submit button
        for (const selector of buttonSelectors) {
          const buttons = document.querySelectorAll(selector);
          for (const btn of buttons) {
            if (btn.textContent.toLowerCase().includes('next') || 
                btn.textContent.toLowerCase().includes('continue') ||
                btn.textContent.toLowerCase().includes('sign') ||
                btn.type === 'submit') {
              nextButton = btn;
              break;
            }
          }
          if (nextButton) break;
        }
        
        console.log('Step 1 - Email input found:', !!emailInput);
        console.log('Step 1 - Next button found:', !!nextButton);
        
        if (emailInput && nextButton) {
          // Fill email
          emailInput.focus();
          emailInput.value = '';
          emailInput.value = email;
          
          // Trigger events
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
          emailInput.dispatchEvent(new Event('blur', { bubbles: true }));
          
          console.log('Email filled:', email);
          
          // Click next button
          setTimeout(() => {
            nextButton.click();
            console.log('Next button clicked');
            step = 2;
            
            // Wait for password step
            setTimeout(() => {
              performStep();
            }, 3000);
          }, 1000);
        } else {
          console.log('Email step elements not found, retrying...');
          setTimeout(performStep, 2000);
        }
      } else if (step === 2) {
        // Step 2: Password input - More comprehensive detection
        console.log('Step 2 - Looking for password field...');
        
        // Wait a bit more for the password field to appear
        setTimeout(() => {
          const passwordSelectors = [
            'input[type="password"]',
            'input[name="password"]',
            '#password',
            'input[placeholder*="password" i]',
            'input[autocomplete="current-password"]',
            'input[data-testid*="password"]'
          ];
          
          const loginSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:contains("Sign In")',
            'button:contains("Log In")',
            'button:contains("Login")',
            'button:contains("Submit")',
            'button'
          ];
          
          let passwordInput = null;
          let loginButton = null;
          
          // Find password input
          for (const selector of passwordSelectors) {
            passwordInput = document.querySelector(selector);
            if (passwordInput) {
              console.log('Password input found with selector:', selector);
              break;
            }
          }
          
          // Find login button
          for (const selector of loginSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
              const buttonText = btn.textContent.toLowerCase();
              if (buttonText.includes('sign') ||
                  buttonText.includes('log') ||
                  buttonText.includes('submit') ||
                  btn.type === 'submit') {
                loginButton = btn;
                console.log('Login button found with text:', btn.textContent);
                break;
              }
            }
            if (loginButton) break;
          }
          
          console.log('Step 2 - Password input found:', !!passwordInput);
          console.log('Step 2 - Login button found:', !!loginButton);
          
          if (passwordInput && loginButton) {
            // Fill password
            passwordInput.focus();
            passwordInput.value = '';
            passwordInput.value = password;
            
            // Trigger events
            passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
            passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
            passwordInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            console.log('Password filled');
            
            // Click login button
            setTimeout(() => {
              loginButton.click();
              console.log('Login button clicked');
              resolve(true);
            }, 1000);
          } else {
            console.log('Password step elements not found, retrying...');
            setTimeout(performStep, 2000);
          }
        }, 2000); // Wait 2 seconds for password field to appear
      }
    };
    
    // Start the process
    setTimeout(performStep, 1000);
    
    // Overall timeout
    setTimeout(() => {
      console.log('Auto-login timeout after 60 seconds');
      resolve(false);
    }, 60000);
  });
}