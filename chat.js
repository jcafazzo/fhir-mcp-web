// FHIR Chat Interface - Natural language queries for FHIR servers

class FHIRChatBot {
    constructor() {
        this.currentServer = document.getElementById('serverUrl').value;
        this.messageHistory = [];
    }

    async processQuery(query) {
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
        try {
            let requestUrl;
            
            // Check if we're running locally and need CORS proxy
            const isLocalhost = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname === '';
            
            if (isLocalhost) {
                // Use CORS proxy for local development
                const targetUrl = new URL(`${this.currentServer}/${endpoint}`);
                Object.keys(params).forEach(key => targetUrl.searchParams.append(key, params[key]));
                
                // Use a more reliable CORS proxy
                requestUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl.toString())}`;
            } else {
                // Direct request for production/Netlify
                requestUrl = new URL(`${this.currentServer}/${endpoint}`);
                Object.keys(params).forEach(key => requestUrl.searchParams.append(key, params[key]));
            }
            
            const response = await fetch(requestUrl, {
                headers: {
                    'Accept': 'application/fhir+json',
                    ...(isLocalhost && { 'X-Requested-With': 'XMLHttpRequest' })
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            // Enhanced error handling for CORS issues
            if (error.message.includes('CORS') || error.message.includes('fetch')) {
                throw new Error(`CORS error - try switching to a different FHIR server or check the console for details`);
            }
            throw error;
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
});

// Update server status when changed
document.getElementById('serverUrl').addEventListener('change', function() {
    const status = document.getElementById('serverStatus');
    status.textContent = '🟡 Connecting...';
    
    // Test connection with CORS proxy if local
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    
    let testUrl = `${this.value}/metadata`;
    if (isLocalhost) {
        testUrl = `https://corsproxy.io/?${encodeURIComponent(testUrl)}`;
    }
    
    fetch(testUrl, {
        headers: { 'Accept': 'application/fhir+json' }
    })
    .then(response => {
        if (response.ok) {
            status.textContent = '🟢 Connected';
        } else {
            status.textContent = '🔴 Connection failed';
        }
    })
    .catch(() => {
        status.textContent = '🔴 Connection failed';
    });
});