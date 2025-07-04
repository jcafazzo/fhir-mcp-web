// FHIR Server Data Quality Assessment Web Demo
// Based on the FHIR MCP Server logic

class FHIRQualityAssessor {
    constructor() {
        this.assessments = [];
    }

    async assessServer(serverUrl) {
        const assessment = {
            server_url: serverUrl,
            timestamp: new Date().toISOString(),
            resource_assessments: {},
            overall_score: 0
        };

        // Test basic resources
        const resources = ['Patient', 'Observation', 'Condition', 'MedicationRequest'];
        let totalScore = 0;
        let validResources = 0;

        for (const resourceType of resources) {
            const resourceAssessment = await this.assessResource(serverUrl, resourceType);
            assessment.resource_assessments[resourceType] = resourceAssessment;
            
            if (resourceAssessment.accessible) {
                totalScore += resourceAssessment.data_quality_score;
                validResources++;
            }
        }

        assessment.overall_score = validResources > 0 ? totalScore / validResources : 0;
        return assessment;
    }

    async assessResource(serverUrl, resourceType) {
        const assessment = {
            accessible: false,
            total_available: 0,
            data_quality_score: 0,
            issues: [],
            error: null
        };

        try {
            // Fetch resource bundle
            const response = await fetch(`${serverUrl}/${resourceType}?_count=10`, {
                headers: {
                    'Accept': 'application/fhir+json'
                }
            });

            if (!response.ok) {
                assessment.error = `HTTP ${response.status}: ${response.statusText}`;
                return assessment;
            }

            const bundle = await response.json();
            assessment.accessible = true;
            assessment.total_available = bundle.total || 0;

            // Validate bundle structure
            const validation = this.validateFHIRResponse(bundle);
            assessment.issues = validation.issues;
            assessment.data_quality_score = this.calculateQualityScore(validation);

            // Check for orphaned references
            if (resourceType !== 'Patient' && bundle.entry) {
                const orphanedCheck = await this.checkOrphanedReferences(serverUrl, bundle);
                if (orphanedCheck.orphaned_count > 0) {
                    assessment.issues.push({
                        severity: 'warning',
                        code: 'orphaned-references',
                        details: `Found ${orphanedCheck.orphaned_count} orphaned patient references`
                    });
                    assessment.data_quality_score -= 20;
                }
            }

        } catch (error) {
            assessment.error = error.message;
            assessment.issues.push({
                severity: 'error',
                code: 'network-error',
                details: error.message
            });
        }

        return assessment;
    }

    validateFHIRResponse(response) {
        const validation = {
            is_valid: true,
            issues: [],
            data_quality: {}
        };

        // Check if it's an OperationOutcome (error)
        if (response.resourceType === 'OperationOutcome') {
            validation.is_valid = false;
            if (response.issue) {
                response.issue.forEach(issue => {
                    validation.issues.push({
                        severity: issue.severity || 'unknown',
                        code: issue.code || 'unknown',
                        details: issue.details?.text || 'No details'
                    });
                });
            }
            return validation;
        }

        // Validate Bundle structure
        if (response.resourceType === 'Bundle') {
            const entries = response.entry || [];
            validation.data_quality = {
                total_resources: response.total || 0,
                returned_resources: entries.length,
                has_data: entries.length > 0
            };

            // Check for empty bundle
            if (response.total === 0) {
                validation.issues.push({
                    severity: 'info',
                    code: 'empty-resource',
                    details: 'No resources found'
                });
            }
        }

        return validation;
    }

    async checkOrphanedReferences(serverUrl, bundle) {
        const patientRefs = new Set();
        const entries = bundle.entry || [];

        // Extract patient references
        entries.forEach(entry => {
            const resource = entry.resource;
            if (resource && resource.subject && resource.subject.reference) {
                const ref = resource.subject.reference;
                if (ref.startsWith('Patient/')) {
                    patientRefs.add(ref.split('/')[1]);
                }
            }
        });

        // Check if patients exist
        let orphanedCount = 0;
        for (const patientId of patientRefs) {
            try {
                const response = await fetch(`${serverUrl}/Patient/${patientId}`, {
                    headers: { 'Accept': 'application/fhir+json' }
                });
                if (response.status === 404) {
                    orphanedCount++;
                }
            } catch (error) {
                // Count as orphaned if we can't verify
                orphanedCount++;
            }
        }

        return { orphaned_count: orphanedCount, total_refs: patientRefs.size };
    }

    calculateQualityScore(validation) {
        if (!validation.is_valid) return 0;

        let score = 100;

        // Deduct for issues
        validation.issues.forEach(issue => {
            if (issue.severity === 'error') score -= 30;
            else if (issue.severity === 'warning') score -= 10;
            else if (issue.severity === 'info') score -= 5;
        });

        // Deduct for no data
        if (validation.data_quality && validation.data_quality.total_resources === 0) {
            score -= 50;
        }

        return Math.max(0, score);
    }
}

// UI Functions
const assessor = new FHIRQualityAssessor();

function setServer(url) {
    document.getElementById('serverUrl').value = url;
}

async function assessServer() {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    if (!serverUrl) {
        alert('Please enter a FHIR server URL');
        return;
    }

    // Show results section
    const resultsSection = document.getElementById('results');
    resultsSection.classList.remove('hidden');

    // Update UI to loading state
    document.getElementById('assessBtn').disabled = true;
    document.getElementById('assessBtn').textContent = 'Assessing...';
    document.getElementById('overallScore').textContent = '--';
    document.getElementById('scoreLabel').textContent = 'Assessing...';
    document.getElementById('resourceGrid').innerHTML = '<p>Loading resource assessments...</p>';

    try {
        // Perform assessment
        const assessment = await assessor.assessServer(serverUrl);
        
        // Update overall score
        displayOverallScore(assessment.overall_score);
        
        // Display resource assessments
        displayResourceAssessments(assessment.resource_assessments);
        
        // Display issues
        displayIssues(assessment.resource_assessments);
        
        // Show raw data
        document.getElementById('rawData').textContent = JSON.stringify(assessment, null, 2);
        
    } catch (error) {
        alert(`Assessment failed: ${error.message}`);
    } finally {
        document.getElementById('assessBtn').disabled = false;
        document.getElementById('assessBtn').textContent = 'Assess Data Quality';
    }
}

function displayOverallScore(score) {
    const scoreElement = document.getElementById('overallScore');
    const labelElement = document.getElementById('scoreLabel');
    const descElement = document.getElementById('scoreDescription');
    const scoreCircle = scoreElement.parentElement;
    
    scoreElement.textContent = Math.round(score);
    
    // Update score appearance based on value
    scoreCircle.className = 'score-circle';
    if (score >= 80) {
        scoreCircle.classList.add('excellent');
        labelElement.textContent = 'EXCELLENT';
        descElement.textContent = 'This server has high-quality, well-connected data';
    } else if (score >= 60) {
        scoreCircle.classList.add('good');
        labelElement.textContent = 'GOOD';
        descElement.textContent = 'This server has decent data with some issues';
    } else if (score >= 40) {
        scoreCircle.classList.add('fair');
        labelElement.textContent = 'FAIR';
        descElement.textContent = 'This server has significant data quality issues';
    } else {
        scoreCircle.classList.add('poor');
        labelElement.textContent = 'POOR';
        descElement.textContent = 'This server has major data quality problems';
    }
}

function displayResourceAssessments(assessments) {
    const grid = document.getElementById('resourceGrid');
    grid.innerHTML = '';
    
    Object.entries(assessments).forEach(([resource, data]) => {
        const card = document.createElement('div');
        card.className = 'resource-card';
        card.innerHTML = `
            <h4>${resource}</h4>
            <div class="resource-status ${data.accessible ? 'accessible' : 'inaccessible'}">
                ${data.accessible ? '✅ Accessible' : '❌ Not Accessible'}
            </div>
            ${data.accessible ? `
                <div class="resource-details">
                    <p>Quality Score: <strong>${Math.round(data.data_quality_score)}/100</strong></p>
                    <p>Total Available: <strong>${data.total_available}</strong></p>
                    ${data.issues.length > 0 ? `<p class="issues-count">⚠️ ${data.issues.length} issues</p>` : '<p class="no-issues">✅ No issues</p>'}
                </div>
            ` : `
                <div class="error-details">
                    <p>Error: ${data.error || 'Unknown error'}</p>
                </div>
            `}
        `;
        grid.appendChild(card);
    });
}

function displayIssues(assessments) {
    const issuesSection = document.getElementById('issuesSection');
    const issuesList = document.getElementById('issuesList');
    issuesList.innerHTML = '';
    
    let hasIssues = false;
    
    Object.entries(assessments).forEach(([resource, data]) => {
        if (data.issues && data.issues.length > 0) {
            hasIssues = true;
            data.issues.forEach(issue => {
                const li = document.createElement('li');
                li.className = `issue ${issue.severity}`;
                li.innerHTML = `<strong>${resource}</strong> - ${issue.severity.toUpperCase()}: ${issue.details}`;
                issuesList.appendChild(li);
            });
        }
    });
    
    if (hasIssues) {
        issuesSection.classList.remove('hidden');
    } else {
        issuesSection.classList.add('hidden');
    }
}