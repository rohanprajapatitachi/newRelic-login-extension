document.addEventListener('DOMContentLoaded', function() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const extractBtn = document.getElementById('extractBtn');
  const statusDiv = document.getElementById('status');
  const cookieSection = document.getElementById('cookieSection');
  const cookieDisplay = document.getElementById('cookieDisplay');
  const copyBtn = document.getElementById('copyBtn');
  const exportBtn = document.getElementById('exportBtn');

  // Check if already logged in
  checkLoginStatus();

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!email || !password) {
      showStatus('Please enter both email and password', 'error');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    showStatus('Attempting to login...', 'info');

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'login',
        email: email,
        password: password
      });

      if (result.success) {
        showStatus('Login successful! Extracting cookies...', 'success');
        await extractCookies();
      } else {
        showStatus(`Login failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login & Extract Cookies';
    }
  });

  extractBtn.addEventListener('click', async () => {
    await extractCookies();
  });

  copyBtn.addEventListener('click', () => {
    const cookieText = cookieDisplay.textContent;
    navigator.clipboard.writeText(cookieText).then(() => {
      showStatus('Cookies copied to clipboard!', 'success');
    }).catch(() => {
      showStatus('Failed to copy to clipboard', 'error');
    });
  });

  exportBtn.addEventListener('click', () => {
    const cookieText = cookieDisplay.textContent;
    const csvContent = convertToCSV(cookieText);
    downloadCSV(csvContent, 'newrelic_cookies.csv');
    showStatus('Cookies exported to CSV file!', 'success');
  });

  async function checkLoginStatus() {
    try {
      const result = await chrome.runtime.sendMessage({ action: 'checkStatus' });
      if (result.isLoggedIn) {
        extractBtn.style.display = 'block';
        showStatus('Already logged in. You can extract cookies.', 'info');
      }
    } catch (error) {
      console.log('Status check failed:', error);
    }
  }

  async function extractCookies() {
    try {
      const result = await chrome.runtime.sendMessage({ action: 'extractCookies' });
      if (result.success) {
        displayCookies(result.cookies);
        showStatus('Cookies extracted successfully!', 'success');
      } else {
        showStatus(`Failed to extract cookies: ${result.error}`, 'error');
      }
    } catch (error) {
      showStatus(`Error extracting cookies: ${error.message}`, 'error');
    }
  }

  function displayCookies(cookies) {
    cookieSection.style.display = 'block';
    
    // Format cookies for display
    const cookieText = cookies.map(cookie => 
      `${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}`
    ).join('\n');
    
    cookieDisplay.textContent = cookieText;
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  function convertToCSV(cookieText) {
    const lines = cookieText.split('\n');
    const csvLines = ['Name,Value,Domain,Path'];
    
    lines.forEach(line => {
      if (line.includes('=')) {
        const parts = line.split(';');
        const nameValue = parts[0].split('=');
        const domain = parts[1]?.replace(' Domain=', '') || '';
        const path = parts[2]?.replace(' Path=', '') || '';
        
        csvLines.push(`"${nameValue[0]}","${nameValue[1]}","${domain}","${path}"`);
      }
    });
    
    return csvLines.join('\n');
  }

  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}); 