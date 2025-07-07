const puppeteer = require('puppeteer');

async function testSmartMode() {
  const browser = await puppeteer.launch({ 
    headless: false, // Set to false to see the browser
    devtools: true // Open devtools to see console
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('PAGE LOG:', msg.text());
  });
  
  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  try {
    // 1. Navigate to the site
    console.log('1. Navigating to https://fhir-mcp.netlify.app/');
    await page.goto('https://fhir-mcp.netlify.app/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // 2. Take screenshot of initial state
    console.log('2. Taking screenshot of initial state');
    await page.screenshot({ 
      path: 'screenshot-1-initial.png',
      fullPage: true 
    });
    
    // Wait for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Click the Smart Mode button
    console.log('3. Looking for Smart Mode button');
    
    // Try different selectors to find the Smart Mode button
    const smartModeSelectors = [
      'button:has-text("Smart Mode")',
      'button[aria-label*="Smart Mode"]',
      '.smart-mode-button',
      'button[class*="smart"]',
      'button'
    ];
    
    let smartModeButton = null;
    for (const selector of smartModeSelectors) {
      try {
        const buttons = await page.$$(selector);
        for (const button of buttons) {
          const text = await button.evaluate(el => el.textContent);
          if (text && text.includes('Smart Mode')) {
            smartModeButton = button;
            console.log(`Found Smart Mode button with selector: ${selector}`);
            break;
          }
        }
        if (smartModeButton) break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!smartModeButton) {
      throw new Error('Could not find Smart Mode button');
    }
    
    // Get button state before clicking
    const initialState = await smartModeButton.evaluate(el => {
      return {
        text: el.textContent,
        classList: Array.from(el.classList),
        ariaPressed: el.getAttribute('aria-pressed')
      };
    });
    console.log('Initial button state:', initialState);
    
    await smartModeButton.click();
    console.log('Clicked Smart Mode button');
    
    // Wait for any UI updates
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Take screenshot after enabling Smart Mode
    console.log('4. Taking screenshot after enabling Smart Mode');
    await page.screenshot({ 
      path: 'screenshot-2-smart-mode-on.png',
      fullPage: true 
    });
    
    // Verify Smart Mode is ON
    const afterState = await smartModeButton.evaluate(el => {
      return {
        text: el.textContent,
        classList: Array.from(el.classList),
        ariaPressed: el.getAttribute('aria-pressed')
      };
    });
    console.log('Button state after click:', afterState);
    
    // 5. Find the query input and enter the test query
    console.log('5. Looking for query input');
    
    const inputSelectors = [
      'textarea[placeholder*="Type your query"]',
      'textarea',
      'input[type="text"]',
      '.query-input',
      '[class*="textarea"]'
    ];
    
    let queryInput = null;
    for (const selector of inputSelectors) {
      try {
        queryInput = await page.$(selector);
        if (queryInput) {
          console.log(`Found query input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!queryInput) {
      throw new Error('Could not find query input');
    }
    
    // Clear any existing text and type the query
    await queryInput.click({ clickCount: 3 }); // Triple click to select all
    await queryInput.type('give me a clinical summary for Milan Beatty');
    console.log('Entered query: "give me a clinical summary for Milan Beatty"');
    
    // Find and click the submit button
    console.log('Looking for submit button');
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      'button[aria-label*="Send"]',
      '.send-button',
      'button svg',
      'button'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        const buttons = await page.$$(selector);
        for (const button of buttons) {
          const parent = await button.evaluateHandle(el => {
            // If this is an SVG, get its parent button
            return el.tagName === 'svg' ? el.closest('button') : el;
          });
          
          const isSubmit = await parent.evaluate(el => {
            if (!el || el.tagName !== 'BUTTON') return false;
            // Check if it's likely a submit button
            const text = el.textContent || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            const type = el.getAttribute('type');
            const hasSvg = el.querySelector('svg') !== null;
            
            return type === 'submit' || 
                   text.includes('Send') || 
                   ariaLabel.includes('Send') ||
                   (hasSvg && !text.includes('Smart Mode'));
          });
          
          if (isSubmit) {
            submitButton = parent;
            console.log(`Found submit button with selector: ${selector}`);
            break;
          }
        }
        if (submitButton) break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!submitButton) {
      throw new Error('Could not find submit button');
    }
    
    // Click submit
    await submitButton.click();
    console.log('Clicked submit button');
    
    // Wait for response
    console.log('Waiting for response...');
    
    // Try to wait for specific response elements to appear
    try {
      await page.waitForSelector('.response, .message, [class*="response"], [class*="message"]', { timeout: 10000 });
      console.log('Response element appeared');
    } catch (e) {
      console.log('No response element found, continuing...');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Additional wait
    
    // 6. Take screenshot of the result
    console.log('6. Taking screenshot of result');
    await page.screenshot({ 
      path: 'screenshot-3-query-result.png',
      fullPage: true 
    });
    
    // 7. Check for any specific elements that might indicate the response
    const responseSelectors = [
      '.response',
      '.message',
      '[class*="response"]',
      '[class*="message"]',
      'div[role="log"]',
      '.chat-message',
      '[class*="chat"]'
    ];
    
    for (const selector of responseSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} response elements with selector: ${selector}`);
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const text = await elements[i].evaluate(el => el.textContent);
            console.log(`Response ${i + 1}: ${text.substring(0, 200)}...`);
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Check localStorage for debug info
    const debugInfo = await page.evaluate(() => {
      const smartMode = localStorage.getItem('smartMode');
      const enhancedPatterns = localStorage.getItem('enhancedPatterns');
      return {
        smartMode,
        enhancedPatterns,
        allLocalStorage: Object.keys(localStorage).reduce((obj, key) => {
          obj[key] = localStorage.getItem(key);
          return obj;
        }, {})
      };
    });
    console.log('LocalStorage debug info:', debugInfo);
    
    // Get any console errors
    console.log('\n8. Checking for console errors...');
    
    // Wait a bit more to catch any delayed errors
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ 
      path: 'screenshot-error.png',
      fullPage: true 
    });
  } finally {
    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for inspection. Close manually when done.');
    // await browser.close();
  }
}

// Run the test
testSmartMode().catch(console.error);