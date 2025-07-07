const puppeteer = require('puppeteer');

async function testPatternMatching() {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Capture all console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const logEntry = `${msg.type()}: ${msg.text()}`;
    consoleLogs.push(logEntry);
    console.log('PAGE LOG:', logEntry);
  });
  
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.error('PAGE ERROR:', error.message);
  });

  try {
    console.log('🚀 Testing Pattern Matching for Clinical Summary');
    console.log('================================================');
    
    // Navigate to the site
    await page.goto('https://fhir-mcp.netlify.app/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Enable Smart Mode
    const smartModeButton = await page.$('button[class*="smart"]');
    if (smartModeButton) {
      await smartModeButton.click();
      console.log('🔄 Smart Mode enabled');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test the actual pattern matching logic
    const testResult = await page.evaluate(() => {
      const chatBot = window.chatBot;
      if (!chatBot) {
        return { error: 'chatBot not found' };
      }
      
      // Test query
      const query = 'give me a clinical summary for Milan Beatty';
      
      // Check if Smart Mode is enabled
      const smartModeEnabled = chatBot.smartMode;
      
      // Check if processQueryWithLLM method exists
      const hasProcessQueryWithLLM = typeof chatBot.processQueryWithLLM === 'function';
      
      // Check what the pattern matching logic would do
      const lowerQuery = query.toLowerCase();
      const containsSummary = lowerQuery.includes('clinical summary') || lowerQuery.includes('summary');
      
      // Try to extract patient name
      const nameMatch = query.match(/(?:of|for)\\s+([a-zA-Z\\s]+?)(?:\\s*$|\\s*\\?)/i);
      const patientName = nameMatch ? nameMatch[1].trim() : null;
      
      // Try to extract patient name with different pattern
      const patientNamePattern = /(?:patient\\s+)?([A-Z][a-z]+\\s+[A-Z][a-z]+)/;
      const patientNameMatch = query.match(patientNamePattern);
      const detectedPatientName = patientNameMatch ? patientNameMatch[1] : null;
      
      return {
        query,
        smartModeEnabled,
        hasProcessQueryWithLLM,
        containsSummary,
        nameMatch: nameMatch ? nameMatch[0] : null,
        patientName,
        detectedPatientName,
        queryLower: lowerQuery
      };
    });
    
    console.log('🧪 Pattern Matching Test Results:');
    console.log('================================');
    console.log('Query:', testResult.query);
    console.log('Smart Mode Enabled:', testResult.smartModeEnabled);
    console.log('Has processQueryWithLLM:', testResult.hasProcessQueryWithLLM);
    console.log('Contains "summary":', testResult.containsSummary);
    console.log('Name match:', testResult.nameMatch);
    console.log('Extracted patient name:', testResult.patientName);
    console.log('Detected patient name:', testResult.detectedPatientName);
    console.log('Query lower:', testResult.queryLower);
    
    // Now test by actually submitting the query
    const queryInput = await page.$('input[type="text"]');
    if (queryInput) {
      await queryInput.click({ clickCount: 3 });
      await queryInput.type('give me a clinical summary for Milan Beatty');
      
      const submitButton = await page.$('button[aria-label="Send message"]');
      if (submitButton) {
        await submitButton.click();
        console.log('📤 Query submitted, waiting for response...');
        
        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check the response
        const messages = await page.$$eval('.message', elements => 
          elements.map(el => el.textContent.trim()).slice(-3)
        );
        
        console.log('📝 Recent messages:');
        messages.forEach((msg, i) => {
          console.log(`  ${i + 1}. ${msg.substring(0, 150)}...`);
        });
        
        // Check if the response indicates that pattern matching worked
        const lastMessage = messages[messages.length - 1];
        const foundPatient = lastMessage.includes('Milan Beatty') || 
                            lastMessage.includes('Patient:') ||
                            lastMessage.includes('Clinical Summary');
        
        console.log('🎯 Pattern matching success:', foundPatient);
        
        if (!foundPatient) {
          console.log('❌ Pattern matching failed - clinical summary pattern not working');
        } else {
          console.log('✅ Pattern matching worked - clinical summary pattern detected');
        }
      }
    }
    
    console.log('\\n📋 All Console Logs:');
    consoleLogs.forEach(log => console.log('  ', log));
    
    if (pageErrors.length > 0) {
      console.log('\\n❌ Page Errors:');
      pageErrors.forEach(error => console.log('  ', error));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    console.log('✅ Test completed');
  }
}

// Run the test
testPatternMatching().catch(console.error);