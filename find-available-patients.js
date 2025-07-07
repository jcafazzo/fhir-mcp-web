const puppeteer = require('puppeteer');

async function findAvailablePatients() {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log('PAGE LOG:', msg.text());
  });
  
  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  try {
    console.log('🚀 Finding Available Patients');
    console.log('============================');
    
    // Navigate to the site
    await page.goto('https://fhir-mcp.netlify.app/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query for all patients
    const queryInput = await page.$('input[type="text"]');
    if (queryInput) {
      await queryInput.click({ clickCount: 3 });
      await queryInput.type('show all patients');
      
      const submitButton = await page.$('button[aria-label="Send message"]');
      if (submitButton) {
        await submitButton.click();
        console.log('📤 Querying for all patients...');
        
        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Get all messages
        const messages = await page.$$eval('.message', elements => 
          elements.map(el => el.textContent.trim())
        );
        
        // Find the response with patient list
        const patientListMessage = messages.find(msg => 
          msg.includes('patients.') && msg.includes('ID:')
        );
        
        if (patientListMessage) {
          console.log('📝 Available Patients:');
          console.log('=====================');
          
          // Extract patient names and IDs
          const patientRegex = /\\*\\*([^*]+)\\*\\*[\\s\\S]*?- ID: ([a-zA-Z0-9-]+)/g;
          const patients = [];
          let match;
          
          while ((match = patientRegex.exec(patientListMessage)) !== null) {
            patients.push({
              name: match[1].trim(),
              id: match[2].trim()
            });
          }
          
          if (patients.length > 0) {
            patients.forEach((patient, i) => {
              console.log(`${i + 1}. ${patient.name} (ID: ${patient.id})`);
            });
            
            // Test clinical summary with the first patient
            const firstPatient = patients[0];
            console.log(`\\n🧪 Testing clinical summary with: ${firstPatient.name}`);
            
            // Clear and enter new query
            await queryInput.click({ clickCount: 3 });
            await queryInput.type(`give me a clinical summary for ${firstPatient.name}`);
            await submitButton.click();
            
            // Wait for response
            await new Promise(resolve => setTimeout(resolve, 8000));
            
            // Get the latest messages
            const newMessages = await page.$$eval('.message', elements => 
              elements.map(el => el.textContent.trim()).slice(-2)
            );
            
            console.log('📋 Clinical Summary Test Results:');
            newMessages.forEach((msg, i) => {
              console.log(`${i + 1}. ${msg.substring(0, 200)}...`);
            });
          } else {
            console.log('❌ Could not parse patient list');
            console.log('Raw response:', patientListMessage.substring(0, 500));
          }
        } else {
          console.log('❌ No patient list found in response');
          console.log('All messages:');
          messages.forEach((msg, i) => {
            console.log(`${i + 1}. ${msg.substring(0, 200)}...`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    console.log('✅ Test completed');
  }
}

// Run the test
findAvailablePatients().catch(console.error);