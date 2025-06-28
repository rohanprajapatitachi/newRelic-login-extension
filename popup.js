document.addEventListener('DOMContentLoaded', function() {
  // Tab management
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) {
          content.classList.add('active');
        }
      });
      
      // Load tab-specific data
      loadTabData(targetTab);
    });
  });

  // Login tab elements
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const saveCredentialsBtn = document.getElementById('saveCredentialsBtn');
  const autoLoginBtn = document.getElementById('autoLoginBtn');
  const statusDiv = document.getElementById('status');

  // Sessions tab elements
  const sessionStatus = document.getElementById('sessionStatus');
  const extractSessionBtn = document.getElementById('extractSessionBtn');
  const applySessionBtn = document.getElementById('applySessionBtn');
  const sessionStatusMsg = document.getElementById('sessionStatusMsg');

  // Export/Import tab elements
  const exportSessionBtn = document.getElementById('exportSessionBtn');
  const importSessionBtn = document.getElementById('importSessionBtn');
  const sessionDataTextarea = document.getElementById('sessionData');
  const importFromTextBtn = document.getElementById('importFromTextBtn');
  const exportStatus = document.getElementById('exportStatus');

  // Debug tab elements
  const testLoginBtn = document.getElementById('testLoginBtn');
  const checkCurrentTabBtn = document.getElementById('checkCurrentTabBtn');
  const clearStorageBtn = document.getElementById('clearStorageBtn');
  const debugInfo = document.getElementById('debugInfo');
  const debugStatus = document.getElementById('debugStatus');

  // Event listeners
  saveCredentialsBtn.addEventListener('click', saveCredentials);
  autoLoginBtn.addEventListener('click', toggleAutoLogin);
  extractSessionBtn.addEventListener('click', extractSession);
  applySessionBtn.addEventListener('click', applySession);
  exportSessionBtn.addEventListener('click', exportSession);
  importSessionBtn.addEventListener('click', importSession);
  importFromTextBtn.addEventListener('click', importFromText);
  testLoginBtn.addEventListener('click', testAutoLogin);
  checkCurrentTabBtn.addEventListener('click', checkCurrentTab);
  clearStorageBtn.addEventListener('click', clearStorage);

  // Load initial data
  loadTabData('login');
});

async function loadTabData(tabName) {
  switch (tabName) {
    case 'login':
      await loadLoginData();
      break;
    case 'sessions':
      await loadSessionData();
      break;
    case 'export':
      await loadExportData();
      break;
    case 'debug':
      await loadDebugData();
      break;
  }
}

async function loadLoginData() {
  try {
    const result = await chrome.storage.local.get(['newrelic_credentials', 'newrelic_auto_login']);
    const credentials = result.newrelic_credentials;
    const autoLogin = result.newrelic_auto_login;

    if (credentials) {
      document.getElementById('email').value = credentials.email;
      document.getElementById('password').value = credentials.password;
    }

    const autoLoginBtn = document.getElementById('autoLoginBtn');
    if (autoLogin) {
      autoLoginBtn.textContent = 'Disable Auto-Login';
      autoLoginBtn.style.backgroundColor = '#dc3545';
    } else {
      autoLoginBtn.textContent = 'Enable Auto-Login';
      autoLoginBtn.style.backgroundColor = '#007cba';
    }
  } catch (error) {
    console.error('Error loading login data:', error);
  }
}

async function loadSessionData() {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'checkSessionStatus' });
    const sessionStatus = document.getElementById('sessionStatus');
    
    if (result.isLoggedIn) {
      sessionStatus.innerHTML = `
        <strong>Status:</strong> Logged in<br>
        <strong>Session Cookies:</strong> ${result.sessionCount}<br>
        <strong>Auto-Login:</strong> ${result.autoLoginEnabled ? 'Enabled' : 'Disabled'}<br>
        <strong>Stored Session:</strong> ${result.hasStoredSession ? 'Available' : 'None'}
      `;
    } else {
      sessionStatus.innerHTML = `
        <strong>Status:</strong> Not logged in<br>
        <strong>Auto-Login:</strong> ${result.autoLoginEnabled ? 'Enabled' : 'Disabled'}<br>
        <strong>Stored Session:</strong> ${result.hasStoredSession ? 'Available' : 'None'}
      `;
    }
  } catch (error) {
    console.error('Error loading session data:', error);
  }
}

async function loadExportData() {
  // This tab doesn't need initial data loading
}

async function loadDebugData() {
  try {
    const result = await chrome.storage.local.get(['newrelic_credentials', 'newrelic_auto_login', 'newrelic_session_data']);
    const sessionStatus = await chrome.runtime.sendMessage({ action: 'checkSessionStatus' });
    
    debugInfo.innerHTML = `
      <strong>Stored Credentials:</strong> ${result.newrelic_credentials ? 'Yes' : 'No'}<br>
      <strong>Auto-Login Enabled:</strong> ${result.newrelic_auto_login ? 'Yes' : 'No'}<br>
      <strong>Stored Session:</strong> ${result.newrelic_session_data ? 'Yes' : 'No'}<br>
      <strong>Current Login Status:</strong> ${sessionStatus.isLoggedIn ? 'Logged In' : 'Not Logged In'}<br>
      <strong>Session Cookies:</strong> ${sessionStatus.sessionCount || 0}<br>
      <strong>Extension Version:</strong> 1.0
    `;
  } catch (error) {
    debugInfo.innerHTML = `Error loading debug data: ${error.message}`;
  }
}

async function saveCredentials() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  
  if (!email || !password) {
    showStatus('Please enter both email and password', 'error');
    return;
  }

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'saveCredentials',
      email: email,
      password: password
    });

    if (result.success) {
      showStatus(result.message, 'success');
    } else {
      showStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function toggleAutoLogin() {
  try {
    const result = await chrome.storage.local.get(['newrelic_auto_login']);
    const currentState = result.newrelic_auto_login || false;
    const newState = !currentState;

    const response = await chrome.runtime.sendMessage({
      action: 'enableAutoLogin',
      enabled: newState
    });

    if (response.success) {
      showStatus(response.message, 'success');
      
      const autoLoginBtn = document.getElementById('autoLoginBtn');
      if (newState) {
        autoLoginBtn.textContent = 'Disable Auto-Login';
        autoLoginBtn.style.backgroundColor = '#dc3545';
      } else {
        autoLoginBtn.textContent = 'Enable Auto-Login';
        autoLoginBtn.style.backgroundColor = '#007cba';
      }
    } else {
      showStatus(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function extractSession() {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'extractSession' });
    
    if (result.success) {
      showSessionStatus(result.message, 'success');
      await loadSessionData(); // Refresh session data
    } else {
      showSessionStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    showSessionStatus(`Error: ${error.message}`, 'error');
  }
}

async function applySession() {
  try {
    const result = await chrome.storage.local.get(['newrelic_session_data']);
    const sessionData = result.newrelic_session_data;
    
    if (!sessionData) {
      showSessionStatus('No stored session found', 'error');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'applySession',
      sessionData: sessionData
    });

    if (response.success) {
      showSessionStatus(response.message, 'success');
      await loadSessionData(); // Refresh session data
    } else {
      showSessionStatus(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    showSessionStatus(`Error: ${error.message}`, 'error');
  }
}

async function exportSession() {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'exportSession' });
    
    if (result.success) {
      // Create and download file
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newrelic_session_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showExportStatus('Session exported successfully!', 'success');
    } else {
      showExportStatus(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    showExportStatus(`Error: ${error.message}`, 'error');
  }
}

async function importSession() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const text = await file.text();
        const response = await chrome.runtime.sendMessage({
          action: 'importSession',
          sessionData: text
        });

        if (response.success) {
          showExportStatus(response.message, 'success');
          await loadSessionData(); // Refresh session data
        } else {
          showExportStatus(`Error: ${response.error}`, 'error');
        }
      } catch (error) {
        showExportStatus(`Error reading file: ${error.message}`, 'error');
      }
    }
  };
  
  input.click();
}

async function importFromText() {
  const sessionData = document.getElementById('sessionData').value.trim();
  
  if (!sessionData) {
    showExportStatus('Please enter session data', 'error');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'importSession',
      sessionData: sessionData
    });

    if (response.success) {
      showExportStatus(response.message, 'success');
      document.getElementById('sessionData').value = '';
      await loadSessionData(); // Refresh session data
    } else {
      showExportStatus(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    showExportStatus(`Error: ${error.message}`, 'error');
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

function showSessionStatus(message, type) {
  const statusDiv = document.getElementById('sessionStatusMsg');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

function showExportStatus(message, type) {
  const statusDiv = document.getElementById('exportStatus');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

async function testAutoLogin() {
  try {
    showDebugStatus('Testing auto-login...', 'info');
    
    const response = await chrome.runtime.sendMessage({ action: 'autoLogin' });
    
    if (response.success) {
      showDebugStatus(response.message, 'success');
    } else {
      showDebugStatus(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    showDebugStatus(`Error: ${error.message}`, 'error');
  }
}

async function checkCurrentTab() {
  try {
    showDebugStatus('Checking current tab...', 'info');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url && tab.url.includes('newrelic.com')) {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
      
      if (response) {
        showDebugStatus(`Current tab: ${response.url}<br>Title: ${response.title}<br>Has login form: ${response.hasLoginForm}<br>Current step: ${response.currentStep}`, 'success');
      } else {
        showDebugStatus('No response from content script', 'error');
      }
    } else {
      showDebugStatus(`Current tab is not New Relic: ${tab.url}`, 'info');
    }
  } catch (error) {
    showDebugStatus(`Error: ${error.message}`, 'error');
  }
}

async function clearStorage() {
  try {
    await chrome.storage.local.clear();
    showDebugStatus('All stored data cleared successfully', 'success');
    await loadDebugData(); // Refresh debug info
  } catch (error) {
    showDebugStatus(`Error clearing storage: ${error.message}`, 'error');
  }
}

function showDebugStatus(message, type) {
  const statusDiv = document.getElementById('debugStatus');
  statusDiv.innerHTML = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 10000);
} 