const puppeteer = require('puppeteer');

async function debugSmartMode() {
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for faster execution
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
  
  // Capture all page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.error('PAGE ERROR:', error.message);
  });

  try {
    console.log('🚀 Starting Smart Mode Debug Test');
    console.log('===============================');
    
    // Navigate to the site
    await page.goto('https://fhir-mcp.netlify.app/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find Smart Mode button
    const smartModeButton = await page.$('button[class*="smart"]');
    if (!smartModeButton) {
      throw new Error('Smart Mode button not found');
    }
    
    // Check initial state
    const initialState = await smartModeButton.evaluate(el => el.textContent);
    console.log('📊 Initial Smart Mode state:', initialState);
    
    // Enable Smart Mode
    await smartModeButton.click();
    console.log('🔄 Smart Mode button clicked');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check new state
    const newState = await smartModeButton.evaluate(el => el.textContent);
    console.log('📊 Smart Mode state after click:', newState);
    
    // Get the current smart mode implementation from the page
    const smartModeLogic = await page.evaluate(() => {
      // Check if the functions exist
      const functions = {
        hasSmartMode: typeof window.smartMode !== 'undefined',
        hasEnhancedPatterns: typeof window.enhancedPatterns !== 'undefined',
        hasProcessQuery: typeof window.processQuery !== 'undefined',
        hasEnhanceQuery: typeof window.enhanceQuery !== 'undefined'
      };
      
      // Try to get the actual smart mode patterns
      let patterns = null;
      if (window.enhancedPatterns) {
        patterns = window.enhancedPatterns;
      }
      
      // Try to get the smart mode state
      let smartModeState = null;
      if (window.smartMode !== undefined) {
        smartModeState = window.smartMode;
      }
      
      return {
        functions,
        patterns,
        smartModeState,
        localStorage: localStorage.getItem('smartMode')
      };
    });
    
    console.log('🧠 Smart Mode Implementation Analysis:');
    console.log('Functions available:', smartModeLogic.functions);
    console.log('Smart Mode state:', smartModeLogic.smartModeState);
    console.log('Enhanced patterns:', smartModeLogic.patterns);
    console.log('LocalStorage smartMode:', smartModeLogic.localStorage);
    
    // Test the query processing
    const queryInput = await page.$('input[type="text"]');
    if (!queryInput) {
      throw new Error('Query input not found');
    }
    
    const testQuery = 'give me a clinical summary for Milan Beatty';
    await queryInput.click({ clickCount: 3 });
    await queryInput.type(testQuery);
    
    console.log('💬 Test query entered:', testQuery);
    
    // Check what happens when we process this query
    const queryProcessingResult = await page.evaluate((query) => {
      // Try to call the enhance query function if it exists
      if (typeof window.enhanceQuery === 'function') {
        try {
          const enhanced = window.enhanceQuery(query);
          return {
            original: query,
            enhanced: enhanced,
            wasEnhanced: enhanced !== query
          };
        } catch (e) {
          return {
            original: query,
            error: e.message
          };
        }
      }
      return {
        original: query,
        error: 'enhanceQuery function not found'
      };
    }, testQuery);
    
    console.log('🔍 Query Processing Result:', queryProcessingResult);
    
    // Check pattern matching
    const patternMatching = await page.evaluate((query) => {
      if (window.enhancedPatterns) {
        const matches = [];
        for (const pattern of window.enhancedPatterns) {
          if (pattern.pattern.test(query)) {
            matches.push({
              pattern: pattern.pattern.toString(),
              action: pattern.action,
              description: pattern.description
            });
          }
        }
        return matches;
      }
      return [];
    }, testQuery);
    
    console.log('🎯 Pattern Matching Results:');
    if (patternMatching.length > 0) {
      patternMatching.forEach((match, i) => {
        console.log(`  ${i + 1}. Pattern: ${match.pattern}`);
        console.log(`     Action: ${match.action}`);
        console.log(`     Description: ${match.description}`);
      });
    } else {
      console.log('  ❌ No patterns matched the query');
    }
    
    // Try to submit and see what happens
    const submitButton = await page.$('button[aria-label="Send message"]');
    if (submitButton) {
      await submitButton.click();
      console.log('📤 Submit button clicked');
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for any new messages
      const messages = await page.$$eval('.message', elements => 
        elements.map(el => el.textContent.trim()).slice(-3)
      );
      
      console.log('📝 Recent messages:');
      messages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.substring(0, 100)}...`);
      });
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    console.log('=============');
    
    if (!smartModeLogic.functions.hasEnhanceQuery) {
      console.log('❌ enhanceQuery function is missing');
    }
    
    if (!smartModeLogic.functions.hasEnhancedPatterns) {
      console.log('❌ enhancedPatterns array is missing');
    }
    
    if (patternMatching.length === 0) {
      console.log('❌ No patterns matched the test query');
      console.log('   This suggests the clinical summary pattern is not working');
    }
    
    if (queryProcessingResult.error) {
      console.log('❌ Query processing error:', queryProcessingResult.error);
    }
    
    console.log('\n📋 CONSOLE LOGS:');
    consoleLogs.forEach(log => console.log('  ', log));
    
    if (pageErrors.length > 0) {
      console.log('\n❌ PAGE ERRORS:');
      pageErrors.forEach(error => console.log('  ', error));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    console.log('✅ Test completed');
  }
}

// Run the debug test
debugSmartMode().catch(console.error);