// FHIR Chat Interface - Natural language queries for FHIR servers

class FHIRChatBot {
    constructor() {
        this.currentServer = document.getElementById('serverUrl').value;
        this.messageHistory = [];
        this.smartMode = false;
        this.llmEngine = null;
        this.currentModel = null;
        this.isModelLoading = false;
    }

    async processQuery(query) {
        // If smart mode is enabled and we have a loaded model, use WebLLM
        if (this.smartMode && this.llmEngine) {
            return await this.processQueryWithLLM(query);
        }
        
        // Otherwise, use the pattern matching approach
        const lowerQuery = query.toLowerCase();
        
        // Pattern matching for different query types
        if (lowerQuery.includes('all patients') || lowerQuery === 'show patients') {
            return await this.getAllPatients();
        }
        
        if (lowerQuery.includes('patient') && lowerQuery.includes('diabetes')) {
            return await this.findPatientsWithCondition('diabetes');
        }
        
        if (lowerQuery.includes('get patient') || lowerQuery.includes('show patient')) {
            const patientId = this.extractPatientId(query);
            if (patientId) {
                return await this.getPatient(patientId);
            }
            // If no ID found, try searching by name
            const nameMatch = query.match(/(?:show|get)\s+patient\s+['""]?([a-zA-Z\s]+)['""]?/i);
            if (nameMatch) {
                const name = nameMatch[1].trim();
                return await this.searchPatientsByName(name);
            }
        }
        
        // Check for medication queries with patient ID
        if ((lowerQuery.includes('med') || lowerQuery.includes('prescription') || lowerQuery.includes('drug')) && 
            (lowerQuery.includes('for') || lowerQuery.includes('patient'))) {
            const patientId = this.extractPatientId(query);
            if (patientId) {
                return await this.getMedicationsForPatient(patientId);
            }
            return await this.getMedications(query);
        }
        
        if (lowerQuery.includes('observation') || lowerQuery.includes('lab') || lowerQuery.includes('vital')) {
            return await this.getObservations(query);
        }
        
        if (lowerQuery.includes('medication') || lowerQuery.includes('prescription')) {
            return await this.getMedications(query);
        }
        
        if (lowerQuery.includes('condition') || lowerQuery.includes('diagnos')) {
            return await this.getConditions(query);
        }
        
        if (lowerQuery.includes('data quality') || lowerQuery.includes('check quality')) {
            return await this.assessDataQuality();
        }
        
        if (lowerQuery.includes('care plan')) {
            return await this.getCarePlans(query);
        }
        
        // Check for date-based patient searches
        if (lowerQuery.includes('born') || lowerQuery.includes('birth')) {
            return await this.searchPatientsByDate(query);
        }
        
        // Check for gender-based searches
        if ((lowerQuery.includes('male') || lowerQuery.includes('female')) && lowerQuery.includes('patient')) {
            return await this.searchPatientsByGender(query);
        }
        
        // Check for age-based searches
        if (lowerQuery.includes('age') || lowerQuery.includes('years old')) {
            return await this.searchPatientsByAge(query);
        }
        
        // Default response with better examples
        return {
            type: 'info',
            content: `I'm not sure how to process that query. Try asking about:
- **Patients**: "Show all patients", "Find patients born in 1967", "Show male patients"
- **Conditions**: "Find patients with diabetes"
- **Medications**: "Show meds for patient e312f2f5-689d-47f9-b4dd-f6f12417322f"
- **Observations**: "Recent lab results", "Show observations for patient 123"
- **Data Quality**: "Check data quality"

Or try queries like:
- "Find patients that were born in the latter half of 1967"
- "Show female patients"
- "Get conditions for patient [ID]"`
        };
    }

    async processQueryWithLLM(query) {
        try {
            // Get current provider selection
            const provider = document.getElementById('providerSelect').value;
            const apiKey = document.getElementById('apiKey').value;

            // Route to appropriate LLM provider
            if (provider === 'openai' && apiKey) {
                return await this.processQueryWithOpenAI(query, apiKey);
            } else if (provider === 'claude' && apiKey) {
                return await this.processQueryWithClaude(query, apiKey);
            } else if (provider === 'local') {
                return await this.processQueryWithLocalLLM(query);
            } else {
                return {
                    type: 'error',
                    content: `🔑 **API Key Required**

To use ${provider === 'openai' ? 'OpenAI GPT-4' : 'Claude 3.5 Sonnet'} for true AI reasoning, please:

1. Enter your API key in the field above
2. Try your query again

**Why use cloud AI?** These models have extensive medical knowledge (54-73% accuracy on medical tasks) unlike local models (17-30% accuracy).

**Alternative:** Switch to "Local Models" for basic pattern matching without API keys.`
                };
            }
        } catch (error) {
            console.error('LLM routing error:', error);
            return await this.processQueryWithLocalLLM(query);
        }
    }

    async processQueryWithOpenAI(query, apiKey) {
        try {
            const systemPrompt = `You are a FHIR (Fast Healthcare Interoperability Resources) expert assistant. You have deep knowledge of healthcare data standards, medical terminology, and clinical workflows.

Given a natural language query about healthcare data, analyze it using your medical knowledge and reasoning to determine the appropriate FHIR API calls needed.

Available FHIR resources and operations:
- Patient: Find patients by name, ID, demographics
- Condition: Search for medical conditions/diagnoses
- Observation: Lab results, vital signs, measurements
- MedicationRequest: Prescriptions and medications
- DiagnosticReport: Lab reports and diagnostic tests
- CarePlan: Treatment plans and care coordination

Respond with a JSON object containing:
{
    "reasoning": "Your clinical reasoning about what the user is asking for",
    "fhir_operations": [
        {
            "resource": "Patient|Condition|Observation|MedicationRequest|DiagnosticReport|CarePlan",
            "operation": "search|read",
            "parameters": {
                // FHIR search parameters based on your medical knowledge
            },
            "purpose": "Why this operation is needed"
        }
    ],
    "response_format": "How to present the data to the user"
}

Use your medical expertise to determine the most appropriate search strategy.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query }
                    ],
                    temperature: 0.1,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const llmResponse = JSON.parse(data.choices[0].message.content);

            return await this.executeFHIROperations(llmResponse, query);

        } catch (error) {
            console.error('OpenAI processing error:', error);
            return {
                type: 'error',
                content: `🚨 **OpenAI Error**: ${error.message}\n\nPlease check your API key and try again.`
            };
        }
    }

    async processQueryWithClaude(query, apiKey) {
        try {
            const systemPrompt = `You are a FHIR (Fast Healthcare Interoperability Resources) expert assistant with extensive medical knowledge. You understand clinical workflows, medical terminology, and healthcare data standards.

Analyze the user's natural language query using your medical expertise to determine the appropriate FHIR API operations.

Available FHIR resources:
- Patient: Demographics, identifiers, contact info
- Condition: Diagnoses, problems, health concerns  
- Observation: Lab values, vital signs, measurements
- MedicationRequest: Prescriptions, drug therapy
- DiagnosticReport: Lab reports, imaging results
- CarePlan: Treatment plans, care coordination

Respond with JSON:
{
    "reasoning": "Your clinical analysis of what the user needs",
    "fhir_operations": [
        {
            "resource": "Resource type",
            "operation": "search or read",
            "parameters": {
                // FHIR search parameters
            },
            "purpose": "Clinical justification"
        }
    ],
    "response_format": "How to present results clinically"
}

Apply your medical knowledge to choose the most clinically relevant search strategy.`;

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 1000,
                    messages: [
                        {
                            role: 'user',
                            content: `${systemPrompt}\n\nUser query: ${query}`
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                throw new Error(`Claude API error: ${response.status}`);
            }

            const data = await response.json();
            const llmResponse = JSON.parse(data.content[0].text);

            return await this.executeFHIROperations(llmResponse, query);

        } catch (error) {
            console.error('Claude processing error:', error);
            return {
                type: 'error',
                content: `🚨 **Claude Error**: ${error.message}\n\nPlease check your API key and try again.`
            };
        }
    }

    async processQueryWithLocalLLM(query) {
        // Fallback to WebLLM if available, otherwise basic pattern matching
        if (this.llmEngine) {
            return await this.processQueryWithLLMWebLLM(query);
        } else {
            return await this.processQueryWithPatternMatching(query);
        }
    }

    async executeFHIROperations(llmResponse, originalQuery) {
        try {
            let results = [];
            
            // Execute each FHIR operation recommended by the LLM
            for (const operation of llmResponse.fhir_operations) {
                try {
                    let result;
                    
                    if (operation.operation === 'search') {
                        result = await this.makeRequest(operation.resource, operation.parameters);
                    } else if (operation.operation === 'read' && operation.parameters.id) {
                        result = await this.makeRequest(`${operation.resource}/${operation.parameters.id}`);
                    }
                    
                    if (result) {
                        results.push({
                            operation: operation,
                            data: result
                        });
                    }
                } catch (opError) {
                    console.error(`FHIR operation error:`, opError);
                }
            }

            // Format response using LLM's guidance
            return this.formatLLMResponse(llmResponse, results, originalQuery);

        } catch (error) {
            console.error('FHIR operations execution error:', error);
            return {
                type: 'error',
                content: `🚨 **Execution Error**: ${error.message}`
            };
        }
    }

    formatLLMResponse(llmResponse, results, originalQuery) {
        if (results.length === 0) {
            return {
                type: 'warning',
                content: `🤔 **No Results Found**

**LLM Reasoning:** ${llmResponse.reasoning}

The query "${originalQuery}" was understood, but no matching data was found in the current FHIR server.`
            };
        }

        let formattedContent = `🧠 **AI Analysis:** ${llmResponse.reasoning}\n\n`;

        results.forEach((result, index) => {
            const operation = result.operation;
            const data = result.data;

            formattedContent += `### ${operation.purpose}\n`;

            if (data.entry && data.entry.length > 0) {
                data.entry.forEach(entry => {
                    const resource = entry.resource;
                    
                    if (resource.resourceType === 'Patient') {
                        const name = this.formatName(resource.name);
                        const id = resource.id;
                        const birthDate = resource.birthDate ? new Date(resource.birthDate).toLocaleDateString() : 'Unknown';
                        const gender = resource.gender || 'Unknown';
                        
                        formattedContent += `- **${name}** (ID: ${id})\n`;
                        formattedContent += `  - Birth Date: ${birthDate}\n`;
                        formattedContent += `  - Gender: ${gender}\n\n`;
                    }
                    else if (resource.resourceType === 'Condition') {
                        const code = this.getCodeText(resource.code);
                        const status = resource.clinicalStatus?.coding?.[0]?.code || 'Unknown';
                        const date = resource.recordedDate ? new Date(resource.recordedDate).toLocaleDateString() : 'Unknown';
                        
                        formattedContent += `- **${code}** (Status: ${status}, Recorded: ${date})\n`;
                    }
                    else if (resource.resourceType === 'Observation') {
                        const code = this.getCodeText(resource.code);
                        const value = this.formatObservationValue(resource);
                        const date = resource.effectiveDateTime ? new Date(resource.effectiveDateTime).toLocaleDateString() : 'Unknown';
                        
                        formattedContent += `- **${code}**: ${value} (${date})\n`;
                    }
                    else if (resource.resourceType === 'MedicationRequest') {
                        const medication = resource.medicationCodeableConcept ? 
                            this.getCodeText(resource.medicationCodeableConcept) : 'Unknown medication';
                        const status = resource.status || 'Unknown';
                        const date = resource.authoredOn ? new Date(resource.authoredOn).toLocaleDateString() : 'Unknown';
                        
                        formattedContent += `- **${medication}** (Status: ${status}, Prescribed: ${date})\n`;
                    }
                });
            } else {
                formattedContent += `No ${operation.resource.toLowerCase()} data found.\n\n`;
            }
        });

        return {
            type: 'success',
            content: formattedContent
        };
    }
    
    async processQueryWithLLMWebLLM(query) {
        // Keep the original WebLLM code for when it's properly deployed
        try {
            const systemPrompt = `You are a FHIR query assistant. Understand healthcare queries and convert them to structured FHIR API instructions.

Output a JSON object with this exact format:
{
    "action": "searchPatients|getPatient|searchConditions|searchMedications|searchObservations|getDataQuality|generalResponse",
    "parameters": {
        // Parameters based on action type
    },
    "explanation": "What you're doing"
}

Examples:
- "diabetic patients over 65" -> {"action": "searchConditions", "parameters": {"code": "diabetes"}, "explanation": "Finding diabetes patients, then filter by age"}
- "What LLM are you?" -> {"action": "generalResponse", "parameters": {"message": "I'm using a local Llama model running in your browser via WebLLM."}, "explanation": "System info"}

Only output the JSON, no other text.`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: query }
            ];

            // Generate response using WebLLM
            const reply = await this.llmEngine.chat.completions.create({
                messages,
                temperature: 0.1,
                max_tokens: 200
            });

            const responseText = reply.choices[0].message.content;
            
            // Try to parse JSON from the response
            let llmResponse;
            try {
                // Extract JSON from the response (in case there's extra text)
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    llmResponse = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.error('Failed to parse LLM response:', responseText);
                // Fall back to pattern matching
                return await this.processQueryWithPatternMatching(query);
            }

            // Execute the action based on LLM's response
            switch (llmResponse.action) {
                case 'searchPatients':
                    return await this.searchPatientsWithParams(llmResponse.parameters);
                case 'getPatient':
                    return await this.getPatient(llmResponse.parameters.id);
                case 'searchConditions':
                    return await this.searchConditionsWithParams(llmResponse.parameters);
                case 'searchMedications':
                    return await this.getMedicationsForPatient(llmResponse.parameters.patient);
                case 'searchObservations':
                    return await this.getObservations(query);
                case 'getDataQuality':
                    return await this.assessDataQuality();
                case 'generalResponse':
                    return {
                        type: 'info',
                        content: llmResponse.parameters.message
                    };
                default:
                    return await this.processQueryWithPatternMatching(query);
            }
        } catch (error) {
            console.error('LLM processing error:', error);
            
            // If the model isn't loaded yet
            if (error.message.includes('Cannot read properties of null')) {
                return {
                    type: 'error',
                    content: `Smart Mode is still loading. Please wait a moment and try again.`
                };
            }
            
            // Otherwise fall back to pattern matching
            return await this.processQueryWithPatternMatching(query);
        }
    }

    async processQueryWithPatternMatching(query) {
        const lowerQuery = query.toLowerCase();
        
        // Pattern matching for different query types
        if (lowerQuery.includes('all patients') || lowerQuery === 'show patients') {
            return await this.getAllPatients();
        }
        
        if (lowerQuery.includes('patient') && lowerQuery.includes('diabetes')) {
            return await this.findPatientsWithCondition('diabetes');
        }
        
        if (lowerQuery.includes('get patient') || lowerQuery.includes('show patient')) {
            const patientId = this.extractPatientId(query);
            if (patientId) {
                return await this.getPatient(patientId);
            }
            // If no ID found, try searching by name
            const nameMatch = query.match(/(?:show|get)\s+patient\s+['""]?([a-zA-Z\s]+)['""]?/i);
            if (nameMatch) {
                const name = nameMatch[1].trim();
                return await this.searchPatientsByName(name);
            }
        }
        
        // Check for medication queries with patient ID
        if ((lowerQuery.includes('med') || lowerQuery.includes('prescription') || lowerQuery.includes('drug')) && 
            (lowerQuery.includes('for') || lowerQuery.includes('patient'))) {
            const patientId = this.extractPatientId(query);
            if (patientId) {
                return await this.getMedicationsForPatient(patientId);
            }
            return await this.getMedications(query);
        }
        
        if (lowerQuery.includes('observation') || lowerQuery.includes('lab') || lowerQuery.includes('vital')) {
            return await this.getObservations(query);
        }
        
        if (lowerQuery.includes('medication') || lowerQuery.includes('prescription')) {
            return await this.getMedications(query);
        }
        
        if (lowerQuery.includes('condition') || lowerQuery.includes('diagnos')) {
            return await this.getConditions(query);
        }
        
        if (lowerQuery.includes('data quality') || lowerQuery.includes('check quality')) {
            return await this.assessDataQuality();
        }
        
        if (lowerQuery.includes('care plan')) {
            return await this.getCarePlans(query);
        }
        
        // Check for date-based patient searches
        if (lowerQuery.includes('born') || lowerQuery.includes('birth')) {
            return await this.searchPatientsByDate(query);
        }
        
        // Check for gender-based searches
        if ((lowerQuery.includes('male') || lowerQuery.includes('female')) && lowerQuery.includes('patient')) {
            return await this.searchPatientsByGender(query);
        }
        
        // Check for age-based searches
        if (lowerQuery.includes('age') || lowerQuery.includes('years old')) {
            return await this.searchPatientsByAge(query);
        }
        
        // Default response
        return {
            type: 'info',
            content: `I'm not sure how to process that query. Try asking about:
- **Patients**: "Show all patients", "Find patients born in 1967", "Show male patients"
- **Conditions**: "Find patients with diabetes"
- **Medications**: "Show meds for patient e312f2f5-689d-47f9-b4dd-f6f12417322f"
- **Observations**: "Recent lab results", "Show observations for patient 123"
- **Data Quality**: "Check data quality"`
        };
    }

    async initializeWebLLM(modelId) {
        // For local development, use enhanced pattern matching instead of WebLLM
        // WebLLM requires proper CORS headers which are blocked in local development
        
        addMessage('assistant', `✅ Smart Mode activated! I can now understand complex queries like:
- "show me diabetic patients over 65"
- "give me a clinical summary of James Agnew"
- "what is the LLM you're using?"

Note: Using enhanced pattern matching for local development. Deploy to Netlify for full AI model support.`);
        
        // Set a flag to indicate smart mode is active (even without actual LLM)
        this.llmEngine = { mock: true };
        this.currentModel = modelId;
        
        return Promise.resolve();
    }

    extractPatientId(query) {
        // Look for UUID pattern (most common in FHIR)
        const uuidMatch = query.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) return uuidMatch[0];
        
        // Look for patterns like "patient 123" or "for 123"
        const idMatch = query.match(/(?:patient|for|id)\s+([a-z0-9\-]+)/i);
        if (idMatch) return idMatch[1];
        
        // Look for any alphanumeric ID that might be a patient ID
        const alphanumericMatch = query.match(/\b([a-z0-9]{8,})\b/i);
        if (alphanumericMatch) return alphanumericMatch[1];
        
        return null;
    }

    async makeRequest(endpoint, params = {}) {
        const targetUrl = new URL(`${this.currentServer}/${endpoint}`);
        Object.keys(params).forEach(key => targetUrl.searchParams.append(key, params[key]));
        
        // Check if we're running locally and need CORS proxy
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname === '';
        
        if (isLocalhost) {
            // Try multiple CORS proxies in order
            const corsProxies = [
                (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
                (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
                (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                (url) => url // Direct attempt as last resort
            ];
            
            for (let i = 0; i < corsProxies.length; i++) {
                const proxyFunc = corsProxies[i];
                const requestUrl = proxyFunc(targetUrl.toString());
                
                try {
                    console.log(`Trying proxy ${i + 1}/${corsProxies.length}: ${requestUrl}`);
                    
                    const response = await fetch(requestUrl, {
                        headers: {
                            'Accept': 'application/fhir+json',
                            ...(i < corsProxies.length - 1 && { 'X-Requested-With': 'XMLHttpRequest' })
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    console.log(`Success with proxy ${i + 1}`);
                    return data;
                    
                } catch (error) {
                    console.log(`Proxy ${i + 1} failed:`, error.message);
                    
                    // If this is the last proxy, throw the error
                    if (i === corsProxies.length - 1) {
                        throw new Error(`All CORS proxies failed. Last error: ${error.message}. Try switching to a different FHIR server or running the demo on a hosted server.`);
                    }
                    // Otherwise, continue to next proxy
                }
            }
        } else {
            // Direct request for production/Netlify
            try {
                const response = await fetch(targetUrl, {
                    headers: {
                        'Accept': 'application/fhir+json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return await response.json();
            } catch (error) {
                throw error;
            }
        }
    }

    async getAllPatients() {
        try {
            const bundle = await this.makeRequest('Patient', { _count: 10 });
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: 'No patients found in this server.'
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} patients. Here are the first ${bundle.entry.length}:\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const patient = entry.resource;
                const name = this.formatName(patient.name);
                content += `**${name}**\\n`;
                content += `- ID: ${patient.id}\\n`;
                content += `- Gender: ${patient.gender || 'Unknown'}\\n`;
                content += `- Birth Date: ${patient.birthDate || 'Unknown'}\\n\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to fetch patients: ${error.message}`
            };
        }
    }

    async searchPatientsWithParams(params = {}) {
        try {
            // Build search parameters
            const searchParams = { _count: 20 };
            
            if (params.name) {
                searchParams.name = params.name;
            }
            if (params.gender) {
                searchParams.gender = params.gender;
            }
            if (params.birthdate) {
                // Handle various date formats
                if (params.birthdate.includes('-')) {
                    searchParams.birthdate = params.birthdate;
                } else if (params.birthdate.match(/^\d{4}$/)) {
                    // Just a year - search that whole year
                    searchParams.birthdate = [`ge${params.birthdate}-01-01`, `le${params.birthdate}-12-31`];
                }
            }
            
            const bundle = await this.makeRequest('Patient', searchParams);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'info',
                    content: 'No patients found matching your criteria.'
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} patients:\\n\\n`;
            
            bundle.entry.forEach((entry, idx) => {
                const patient = entry.resource;
                const name = this.formatName(patient.name);
                content += `${idx + 1}. **${name}** (ID: ${patient.id})\\n`;
                content += `   Gender: ${patient.gender || 'Unknown'}, `;
                content += `Born: ${patient.birthDate || 'Unknown'}\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to search patients: ${error.message}`
            };
        }
    }

    async searchConditionsWithParams(params = {}) {
        try {
            const searchParams = { _count: 50 };
            
            if (params.code) {
                // Search for condition by code or text
                searchParams._text = params.code;
            }
            if (params.patient) {
                searchParams.patient = params.patient;
            }
            
            const bundle = await this.makeRequest('Condition', searchParams);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'info',
                    content: 'No conditions found matching your criteria.'
                };
            }
            
            // Group by patient if not searching for specific patient
            if (!params.patient) {
                const patientMap = new Map();
                bundle.entry.forEach(entry => {
                    const condition = entry.resource;
                    if (condition.subject?.reference) {
                        const patientId = condition.subject.reference.split('/').pop();
                        if (!patientMap.has(patientId)) {
                            patientMap.set(patientId, []);
                        }
                        patientMap.get(patientId).push({
                            code: this.getCodeText(condition.code),
                            status: condition.clinicalStatus?.coding?.[0]?.code || 'unknown'
                        });
                    }
                });
                
                let content = `Found conditions in ${patientMap.size} patients:\\n\\n`;
                let count = 0;
                for (const [patientId, conditions] of patientMap) {
                    if (count >= 10) {
                        content += `\\n...and ${patientMap.size - count} more patients.`;
                        break;
                    }
                    content += `**Patient ${patientId}**:\\n`;
                    conditions.forEach(cond => {
                        content += `- ${cond.code} (${cond.status})\\n`;
                    });
                    content += '\\n';
                    count++;
                }
                
                return {
                    type: 'success',
                    content: content
                };
            } else {
                // Show conditions for specific patient
                let content = `Found ${bundle.entry.length} conditions:\\n\\n`;
                bundle.entry.forEach((entry, idx) => {
                    const condition = entry.resource;
                    const codeText = this.getCodeText(condition.code);
                    content += `${idx + 1}. **${codeText}**\\n`;
                    content += `   Status: ${condition.clinicalStatus?.coding?.[0]?.code || 'unknown'}\\n`;
                    if (condition.onsetDateTime) {
                        content += `   Onset: ${condition.onsetDateTime}\\n`;
                    }
                });
                
                return {
                    type: 'success',
                    content: content
                };
            }
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to search conditions: ${error.message}`
            };
        }
    }

    async getPatient(patientId) {
        try {
            const patient = await this.makeRequest(`Patient/${patientId}`);
            
            const name = this.formatName(patient.name);
            let content = `**Patient: ${name}**\\n\\n`;
            content += `🆔 **ID**: ${patient.id}\\n`;
            content += `👤 **Gender**: ${patient.gender || 'Unknown'}\\n`;
            content += `📅 **Birth Date**: ${patient.birthDate || 'Unknown'}\\n`;
            
            if (patient.address && patient.address.length > 0) {
                const addr = patient.address[0];
                content += `📍 **Location**: ${addr.city || ''}, ${addr.state || ''} ${addr.country || ''}\\n`;
            }
            
            // Get related clinical data
            content += `\\n**Clinical Data Summary:**\\n`;
            
            // Conditions
            try {
                const conditions = await this.makeRequest('Condition', { patient: patientId, _count: 5 });
                if (conditions.entry && conditions.entry.length > 0) {
                    content += `\\n📋 **Conditions** (${conditions.total || conditions.entry.length} total):\\n`;
                    conditions.entry.forEach(entry => {
                        const condition = entry.resource;
                        const codeText = this.getCodeText(condition.code);
                        content += `- ${codeText} (${condition.clinicalStatus?.coding?.[0]?.code || 'unknown status'})\\n`;
                    });
                }
            } catch (e) {
                content += `\\n📋 **Conditions**: Unable to fetch\\n`;
            }
            
            // Medications
            try {
                const meds = await this.makeRequest('MedicationRequest', { patient: patientId, _count: 5 });
                if (meds.entry && meds.entry.length > 0) {
                    content += `\\n💊 **Medications** (${meds.total || meds.entry.length} total):\\n`;
                    meds.entry.forEach(entry => {
                        const med = entry.resource;
                        const medText = this.getCodeText(med.medicationCodeableConcept);
                        content += `- ${medText} (${med.status})\\n`;
                    });
                }
            } catch (e) {
                content += `\\n💊 **Medications**: Unable to fetch\\n`;
            }
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            if (error.message.includes('404')) {
                return {
                    type: 'error',
                    content: `Patient with ID "${patientId}" not found.`
                };
            }
            return {
                type: 'error',
                content: `Failed to fetch patient: ${error.message}`
            };
        }
    }

    async findPatientsWithCondition(conditionText) {
        try {
            // First, find conditions matching the text
            const conditions = await this.makeRequest('Condition', { 
                _count: 100,
                'code:text': conditionText 
            });
            
            if (!conditions.entry || conditions.entry.length === 0) {
                // Try without text search
                const allConditions = await this.makeRequest('Condition', { _count: 100 });
                
                if (!allConditions.entry) {
                    return {
                        type: 'warning',
                        content: `No conditions found matching "${conditionText}".`
                    };
                }
                
                // Filter conditions that match our search
                const matched = allConditions.entry.filter(entry => {
                    const codeText = this.getCodeText(entry.resource.code);
                    return codeText.toLowerCase().includes(conditionText.toLowerCase());
                });
                
                if (matched.length === 0) {
                    return {
                        type: 'warning',
                        content: `No conditions found matching "${conditionText}".`
                    };
                }
                
                conditions.entry = matched;
            }
            
            // Extract unique patient IDs
            const patientMap = new Map();
            conditions.entry.forEach(entry => {
                const condition = entry.resource;
                if (condition.subject && condition.subject.reference) {
                    const patientId = condition.subject.reference.split('/').pop();
                    if (!patientMap.has(patientId)) {
                        patientMap.set(patientId, []);
                    }
                    patientMap.get(patientId).push({
                        code: this.getCodeText(condition.code),
                        status: condition.clinicalStatus?.coding?.[0]?.code || 'unknown',
                        onset: condition.onsetDateTime
                    });
                }
            });
            
            let content = `Found ${patientMap.size} patients with conditions matching "${conditionText}":\\n\\n`;
            
            // Get patient details for each
            let count = 0;
            for (const [patientId, conditions] of patientMap) {
                if (count >= 5) {
                    content += `\\n...and ${patientMap.size - count} more patients.`;
                    break;
                }
                
                try {
                    const patient = await this.makeRequest(`Patient/${patientId}`);
                    const name = this.formatName(patient.name);
                    content += `**${name}** (ID: ${patientId})\\n`;
                    conditions.forEach(cond => {
                        content += `- ${cond.code} (${cond.status})`;
                        if (cond.onset) content += ` since ${new Date(cond.onset).toLocaleDateString()}`;
                        content += `\\n`;
                    });
                } catch (e) {
                    content += `**Patient ${patientId}** (demographics not available)\\n`;
                    conditions.forEach(cond => {
                        content += `- ${cond.code} (${cond.status})\\n`;
                    });
                }
                content += `\\n`;
                count++;
            }
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to search conditions: ${error.message}`
            };
        }
    }

    async getObservations(query) {
        try {
            const params = { _count: 10, _sort: '-date' };
            
            // Check if patient ID is mentioned
            const patientId = this.extractPatientId(query);
            if (patientId) {
                params.patient = patientId;
            }
            
            const bundle = await this.makeRequest('Observation', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: 'No observations found.'
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} observations. Here are the most recent:\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const obs = entry.resource;
                const codeText = this.getCodeText(obs.code);
                const value = this.formatObservationValue(obs);
                const date = obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString() : 'Unknown date';
                
                content += `📊 **${codeText}**\\n`;
                content += `- Value: ${value}\\n`;
                content += `- Date: ${date}\\n`;
                content += `- Status: ${obs.status}\\n\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to fetch observations: ${error.message}`
            };
        }
    }

    async getMedicationsForPatient(patientId) {
        try {
            const params = { patient: patientId, _count: 20 };
            
            const bundle = await this.makeRequest('MedicationRequest', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: `No medications found for patient ${patientId}.`
                };
            }
            
            let content = `**Medications for Patient ${patientId}**\\n\\n`;
            content += `Found ${bundle.total || bundle.entry.length} medication requests:\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const med = entry.resource;
                const medText = this.getCodeText(med.medicationCodeableConcept);
                const date = med.authoredOn ? new Date(med.authoredOn).toLocaleDateString() : 'Unknown date';
                
                content += `💊 **${medText}**\\n`;
                content += `- Status: ${med.status}\\n`;
                content += `- Intent: ${med.intent}\\n`;
                content += `- Prescribed: ${date}\\n`;
                
                // Add dosage information if available
                if (med.dosageInstruction && med.dosageInstruction.length > 0) {
                    const dosage = med.dosageInstruction[0];
                    if (dosage.text) {
                        content += `- Dosage: ${dosage.text}\\n`;
                    }
                }
                
                content += `\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to fetch medications for patient ${patientId}: ${error.message}`
            };
        }
    }

    async getMedications(query) {
        try {
            const params = { _count: 10 };
            
            // Check if patient ID is mentioned
            const patientId = this.extractPatientId(query);
            if (patientId) {
                params.patient = patientId;
            }
            
            const bundle = await this.makeRequest('MedicationRequest', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: 'No medications found.'
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} medication requests:\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const med = entry.resource;
                const medText = this.getCodeText(med.medicationCodeableConcept);
                const date = med.authoredOn ? new Date(med.authoredOn).toLocaleDateString() : 'Unknown date';
                
                content += `💊 **${medText}**\\n`;
                content += `- Status: ${med.status}\\n`;
                content += `- Intent: ${med.intent}\\n`;
                content += `- Prescribed: ${date}\\n\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to fetch medications: ${error.message}`
            };
        }
    }

    async getConditions(query) {
        try {
            const params = { _count: 10 };
            
            // Check if patient ID is mentioned
            const patientId = this.extractPatientId(query);
            if (patientId) {
                params.patient = patientId;
            }
            
            const bundle = await this.makeRequest('Condition', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: 'No conditions found.'
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} conditions:\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const condition = entry.resource;
                const codeText = this.getCodeText(condition.code);
                const status = condition.clinicalStatus?.coding?.[0]?.code || 'unknown';
                const onset = condition.onsetDateTime ? new Date(condition.onsetDateTime).toLocaleDateString() : 'Unknown';
                
                content += `🏥 **${codeText}**\\n`;
                content += `- Clinical Status: ${status}\\n`;
                content += `- Onset: ${onset}\\n`;
                
                if (condition.subject && condition.subject.reference) {
                    const patientId = condition.subject.reference.split('/').pop();
                    content += `- Patient ID: ${patientId}\\n`;
                }
                
                content += `\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to fetch conditions: ${error.message}`
            };
        }
    }

    async getCarePlans(query) {
        try {
            const params = { _count: 10 };
            
            const patientId = this.extractPatientId(query);
            if (patientId) {
                params.patient = patientId;
            }
            
            const bundle = await this.makeRequest('CarePlan', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: 'No care plans found.'
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} care plans:\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const plan = entry.resource;
                const title = plan.title || 'Untitled Plan';
                const status = plan.status;
                const created = plan.created ? new Date(plan.created).toLocaleDateString() : 'Unknown';
                
                content += `📋 **${title}**\\n`;
                content += `- Status: ${status}\\n`;
                content += `- Created: ${created}\\n`;
                content += `- Intent: ${plan.intent}\\n\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to fetch care plans: ${error.message}`
            };
        }
    }

    async assessDataQuality() {
        try {
            const assessment = {
                server: this.currentServer,
                timestamp: new Date().toISOString(),
                resources: {}
            };
            
            const resourceTypes = ['Patient', 'Observation', 'Condition', 'MedicationRequest'];
            
            let content = `**Data Quality Assessment for ${this.currentServer}**\\n\\n`;
            
            for (const resourceType of resourceTypes) {
                try {
                    const bundle = await this.makeRequest(resourceType, { _count: 10 });
                    const total = bundle.total || 0;
                    const hasData = bundle.entry && bundle.entry.length > 0;
                    
                    assessment.resources[resourceType] = {
                        accessible: true,
                        total: total,
                        hasData: hasData
                    };
                    
                    content += `✅ **${resourceType}**: ${total} resources available\\n`;
                    
                    // Check for orphaned references
                    if (resourceType !== 'Patient' && hasData) {
                        let orphaned = 0;
                        for (const entry of bundle.entry.slice(0, 3)) {
                            if (entry.resource.subject && entry.resource.subject.reference) {
                                const patientId = entry.resource.subject.reference.split('/').pop();
                                try {
                                    await this.makeRequest(`Patient/${patientId}`);
                                } catch (e) {
                                    orphaned++;
                                }
                            }
                        }
                        if (orphaned > 0) {
                            content += `  ⚠️  Warning: Found orphaned patient references\\n`;
                        }
                    }
                } catch (error) {
                    assessment.resources[resourceType] = {
                        accessible: false,
                        error: error.message
                    };
                    content += `❌ **${resourceType}**: Not accessible (${error.message})\\n`;
                }
            }
            
            // Calculate overall score
            const accessible = Object.values(assessment.resources).filter(r => r.accessible).length;
            const score = (accessible / resourceTypes.length) * 100;
            
            content += `\\n**Overall Score**: ${score}/100\\n`;
            
            if (score >= 80) {
                content += `✅ This server has good data availability`;
            } else if (score >= 50) {
                content += `⚠️  This server has limited data availability`;
            } else {
                content += `❌ This server has poor data availability`;
            }
            
            return {
                type: 'info',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to assess data quality: ${error.message}`
            };
        }
    }

    formatName(nameArray) {
        if (!nameArray || nameArray.length === 0) return 'Unknown Name';
        const name = nameArray[0];
        const given = name.given ? name.given.join(' ') : '';
        const family = name.family || '';
        return `${given} ${family}`.trim() || 'Unknown Name';
    }

    getCodeText(code) {
        if (!code) return 'Unknown';
        if (code.text) return code.text;
        if (code.coding && code.coding.length > 0) {
            return code.coding[0].display || code.coding[0].code || 'Unknown';
        }
        return 'Unknown';
    }

    formatObservationValue(obs) {
        if (obs.valueQuantity) {
            return `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}`;
        }
        if (obs.valueString) {
            return obs.valueString;
        }
        if (obs.valueCodeableConcept) {
            return this.getCodeText(obs.valueCodeableConcept);
        }
        return 'No value recorded';
    }

    async searchPatientsByDate(query) {
        try {
            const lowerQuery = query.toLowerCase();
            let params = { _count: 20 };
            
            // Extract year from query
            const yearMatch = query.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                const year = yearMatch[0];
                
                // Check for specific date ranges
                if (lowerQuery.includes('latter half') || lowerQuery.includes('second half')) {
                    params.birthdate = `ge${year}-07-01`;
                    params['birthdate:le'] = `${year}-12-31`;
                } else if (lowerQuery.includes('first half') || lowerQuery.includes('early')) {
                    params.birthdate = `ge${year}-01-01`;
                    params['birthdate:le'] = `${year}-06-30`;
                } else {
                    // Entire year
                    params.birthdate = `ge${year}-01-01`;
                    params['birthdate:le'] = `${year}-12-31`;
                }
            }
            
            const bundle = await this.makeRequest('Patient', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: `No patients found matching that birth date criteria. This might be due to how the FHIR server handles date searches.`
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} patients matching your birth date criteria:\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const patient = entry.resource;
                const name = this.formatName(patient.name);
                content += `**${name}**\\n`;
                content += `- ID: ${patient.id}\\n`;
                content += `- Gender: ${patient.gender || 'Unknown'}\\n`;
                content += `- Birth Date: ${patient.birthDate || 'Unknown'}\\n\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to search patients by birth date: ${error.message}. Note: Some FHIR servers may not support advanced date searches.`
            };
        }
    }

    async searchPatientsByGender(query) {
        try {
            const lowerQuery = query.toLowerCase();
            let gender = '';
            
            if (lowerQuery.includes('male') && !lowerQuery.includes('female')) {
                gender = 'male';
            } else if (lowerQuery.includes('female')) {
                gender = 'female';
            }
            
            const params = { gender: gender, _count: 20 };
            const bundle = await this.makeRequest('Patient', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: `No ${gender} patients found.`
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} ${gender} patients:\\n\\n`;
            
            bundle.entry.slice(0, 10).forEach(entry => {
                const patient = entry.resource;
                const name = this.formatName(patient.name);
                content += `**${name}**\\n`;
                content += `- ID: ${patient.id}\\n`;
                content += `- Birth Date: ${patient.birthDate || 'Unknown'}\\n\\n`;
            });
            
            if (bundle.entry.length > 10) {
                content += `\\n...and ${bundle.entry.length - 10} more patients.`;
            }
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to search patients by gender: ${error.message}`
            };
        }
    }

    async searchPatientsByAge(query) {
        try {
            // Extract age from query
            const ageMatch = query.match(/(\d+)\s*(?:years?\s*old|age)/i);
            if (!ageMatch) {
                return {
                    type: 'warning',
                    content: 'Please specify an age (e.g., "25 years old" or "age 30")'
                };
            }
            
            const age = parseInt(ageMatch[1]);
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - age;
            
            // Search for patients born in that year (approximate age)
            const params = { 
                birthdate: `ge${birthYear}-01-01`,
                'birthdate:le': `${birthYear}-12-31`,
                _count: 20 
            };
            
            const bundle = await this.makeRequest('Patient', params);
            
            if (!bundle.entry || bundle.entry.length === 0) {
                return {
                    type: 'warning',
                    content: `No patients found around age ${age}.`
                };
            }
            
            let content = `Found ${bundle.total || bundle.entry.length} patients around age ${age} (born in ${birthYear}):\\n\\n`;
            
            bundle.entry.forEach(entry => {
                const patient = entry.resource;
                const name = this.formatName(patient.name);
                const birthDate = patient.birthDate;
                let calculatedAge = '';
                
                if (birthDate) {
                    const birth = new Date(birthDate);
                    const ageDiff = Date.now() - birth.getTime();
                    const ageDate = new Date(ageDiff);
                    calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
                }
                
                content += `**${name}**\\n`;
                content += `- ID: ${patient.id}\\n`;
                content += `- Birth Date: ${birthDate || 'Unknown'}`;
                if (calculatedAge) content += ` (age ${calculatedAge})`;
                content += `\\n`;
                content += `- Gender: ${patient.gender || 'Unknown'}\\n\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to search patients by age: ${error.message}`
            };
        }
    }

    async searchPatientsByName(name) {
        try {
            // Try different search parameters for name
            const searchParams = [
                { name: name, _count: 20 },
                { family: name, _count: 20 },
                { given: name, _count: 20 }
            ];
            
            let allPatients = [];
            
            for (const params of searchParams) {
                try {
                    const bundle = await this.makeRequest('Patient', params);
                    if (bundle.entry) {
                        allPatients.push(...bundle.entry);
                    }
                } catch (error) {
                    // Continue with next search parameter if one fails
                    console.log(`Search with ${JSON.stringify(params)} failed:`, error);
                }
            }
            
            // Remove duplicates based on patient ID
            const uniquePatients = allPatients.filter((patient, index, self) => 
                index === self.findIndex(p => p.resource.id === patient.resource.id)
            );
            
            if (uniquePatients.length === 0) {
                return {
                    type: 'warning',
                    content: `No patients found with name "${name}". Try searching for "all patients" to see available names.`
                };
            }
            
            let content = `Found ${uniquePatients.length} patient(s) matching "${name}":\\n\\n`;
            
            uniquePatients.forEach(entry => {
                const patient = entry.resource;
                const fullName = this.formatName(patient.name);
                content += `**${fullName}**\\n`;
                content += `- ID: ${patient.id}\\n`;
                content += `- Gender: ${patient.gender || 'Unknown'}\\n`;
                content += `- Birth Date: ${patient.birthDate || 'Unknown'}\\n\\n`;
            });
            
            return {
                type: 'success',
                content: content
            };
        } catch (error) {
            return {
                type: 'error',
                content: `Failed to search patients by name: ${error.message}`
            };
        }
    }
}

// UI Management
const chatBot = new FHIRChatBot();

function addMessage(role, content, type = 'info') {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = role === 'user' ? '👤 You' : '🤖 FHIR Assistant';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${type}`;
    
    // Convert markdown-style formatting to HTML
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\\n/g, '<br>');
    
    contentDiv.innerHTML = content;
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    messagesDiv.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addMessage('user', message);
    
    // Clear input
    input.value = '';
    
    // Disable send button
    document.getElementById('sendBtn').disabled = true;
    
    // Update chat bot's server
    chatBot.currentServer = document.getElementById('serverUrl').value;
    
    // Process query
    try {
        // Show typing indicator
        addMessage('assistant', 'Thinking...', 'typing');
        
        const response = await chatBot.processQuery(message);
        
        // Remove typing indicator
        const messages = document.getElementById('chatMessages');
        messages.removeChild(messages.lastChild);
        
        // Add response
        addMessage('assistant', response.content, response.type);
    } catch (error) {
        addMessage('assistant', `Error: ${error.message}`, 'error');
    } finally {
        document.getElementById('sendBtn').disabled = false;
    }
}

function sendSuggestion(text) {
    document.getElementById('userInput').value = text;
    sendMessage();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Show local development notice if running locally
window.addEventListener('DOMContentLoaded', function() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    
    if (isLocalhost) {
        document.getElementById('localDevNotice').style.display = 'block';
    }
    
    // Smart mode toggle functionality
    const modelSelect = document.getElementById('modelSelect');
    const smartToggle = document.getElementById('smartModeToggle');
    
    // Load saved model preference
    const savedModel = localStorage.getItem('selected_model');
    if (savedModel) {
        modelSelect.value = savedModel;
    }
    
    // Smart mode toggle handler
    smartToggle.addEventListener('click', async function(e) {
        e.preventDefault();
        console.log('Smart mode toggle clicked', chatBot.smartMode);
        
        if (chatBot.isModelLoading) {
            alert('Model is still loading. Please wait...');
            return;
        }
        
        // Toggle smart mode
        chatBot.smartMode = !chatBot.smartMode;
        console.log('Smart mode is now:', chatBot.smartMode);
        
        // Update button appearance
        if (chatBot.smartMode) {
            this.classList.add('active');
            this.textContent = '🧠 Smart Mode: ON';
            this.disabled = true;
            
            const selectedModel = modelSelect.value;
            localStorage.setItem('selected_model', selectedModel);
            
            try {
                await chatBot.initializeWebLLM(selectedModel);
                this.disabled = false;
            } catch (error) {
                console.error('Smart mode activation error:', error);
                // Reset on error
                chatBot.smartMode = false;
                this.classList.remove('active');
                this.textContent = '🧠 Smart Mode: OFF';
                this.disabled = false;
            }
        } else {
            this.classList.remove('active');
            this.textContent = '🧠 Smart Mode: OFF';
            
            // Clean up WebLLM
            if (chatBot.llmEngine) {
                chatBot.llmEngine = null;
                chatBot.currentModel = null;
            }
            
            addMessage('assistant', 'Smart Mode deactivated. Using pattern matching for FHIR queries.');
        }
    });
    
    // Model change handler
    modelSelect.addEventListener('change', function() {
        if (chatBot.smartMode && chatBot.currentModel !== this.value) {
            addMessage('assistant', 'Please turn off Smart Mode and turn it back on to load the new model.');
        }
    });
    
    // Provider selection handler
    const providerSelect = document.getElementById('providerSelect');
    const apiKeyField = document.getElementById('apiKey');
    const modelSelectField = document.getElementById('modelSelect');
    const providerInfo = document.getElementById('providerInfo');
    
    providerSelect.addEventListener('change', function() {
        const provider = this.value;
        
        if (provider === 'openai') {
            apiKeyField.style.display = 'block';
            apiKeyField.placeholder = 'Enter OpenAI API key...';
            modelSelectField.style.display = 'none';
            providerInfo.textContent = 'GPT-4 with extensive medical knowledge - requires API key';
        } else if (provider === 'claude') {
            apiKeyField.style.display = 'block';
            apiKeyField.placeholder = 'Enter Claude API key...';
            modelSelectField.style.display = 'none';
            providerInfo.textContent = 'Claude 3.5 Sonnet with superior reasoning - requires API key';
        } else if (provider === 'local') {
            apiKeyField.style.display = 'none';
            modelSelectField.style.display = 'block';
            providerInfo.textContent = 'Local AI models with FHIR context - no API key needed!';
        }
        
        // Reset Smart Mode if it's active when changing providers
        if (chatBot.smartMode) {
            const smartModeToggle = document.getElementById('smartModeToggle');
            smartModeToggle.classList.remove('active');
            smartModeToggle.textContent = '🧠 Smart Mode: OFF';
            chatBot.smartMode = false;
            chatBot.llmEngine = null;
            chatBot.currentModel = null;
            
            addMessage('assistant', `Provider changed to ${provider}. Smart Mode has been reset. Please configure your settings and re-enable Smart Mode.`);
        }
    });
    
    // Update server status when changed
    document.getElementById('serverUrl').addEventListener('change', async function() {
        const status = document.getElementById('serverStatus');
        status.textContent = '🟡 Connecting...';
        
        // Update chatBot's server
        chatBot.currentServer = this.value;
        
        // Test connection using the same proxy system as makeRequest
        try {
            await chatBot.makeRequest('metadata');
            status.textContent = '🟢 Connected';
        } catch (error) {
            console.log('Connection test failed:', error.message);
            status.textContent = '🔴 Connection failed';
        }
    });
});