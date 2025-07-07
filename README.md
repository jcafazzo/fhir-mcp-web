# Chat with FHIR Servers - Web Demo

A natural language chat interface for querying FHIR servers. Ask questions about patients, conditions, medications, and more - just like chatting with an AI assistant!

## 🚀 Live Demo

Visit: [Your Netlify URL will go here]

## 💬 Features

- **Natural Language Queries**: Ask questions in plain English
- **Smart Mode (NEW!)**: AI-powered query understanding using GPT-4
- **Multi-Server Support**: Switch between HAPI, Firely, and SMART servers
- **Comprehensive Data Access**: Query patients, conditions, medications, observations, and care plans
- **Data Quality Checks**: Assess server data quality with a simple command
- **Smart Suggestions**: Quick-access buttons for common queries
- **Real-time Results**: Instant responses with formatted healthcare data

## 🛠️ Deployment

### Netlify (Recommended)

1. **Fork or download** this web-demo folder
2. **Deploy to Netlify**:
   - Drag the folder to [Netlify Drop](https://app.netlify.com/drop)
   - Or connect via GitHub and deploy

### Local Testing

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

## 🔧 CORS Considerations

Some FHIR servers may have CORS restrictions. The demo works best with:
- HAPI Test Server ✅
- Firely Server ✅  
- SMART Health IT ✅

For servers with CORS issues, consider using the proxy feature in `netlify.toml`.

## 🧠 Smart Mode (Free AI - No API Key!)

Smart Mode uses local AI models running directly in your browser via WebLLM. No API keys, no costs, completely private!

### How to Enable:
1. Select an AI model from the dropdown (Llama 3.2 3B recommended)
2. Click "Smart Mode: OFF" to toggle it on
3. Wait for the model to download (first time only, ~1-2GB)
4. Start asking complex questions!

### Available Models:
- **Llama 3.2 1B**: Fastest, basic understanding
- **Llama 3.2 3B**: Best balance of speed and intelligence (recommended)
- **Phi 3.5 Mini**: Microsoft's efficient model
- **Gemma 2 2B**: Google's compact model

### Smart Mode Queries:
- **"What is the LLM you're using?"** - Meta questions about the system
- **"Show me diabetic patients over 65"** - Complex multi-criteria searches
- **"Explain what FHIR is"** - General healthcare informatics questions
- **"List all the vital signs for John Smith"** - Natural patient lookups

## 💡 Example Queries

### Basic Mode (Pattern Matching)
- **"Show me all patients"** - Lists patients with demographics
- **"Find patients with diabetes"** - Searches for patients with specific conditions
- **"Get patient 87a339d0-8cae-418e-89c7-8651e6aab3c6"** - Retrieves specific patient details
- **"Show recent observations"** - Displays recent lab results and vitals
- **"Find medications for patient 123"** - Lists prescriptions for a patient
- **"Check data quality"** - Assesses the FHIR server's data integrity

### Smart Mode (AI-Powered)
- All basic queries work, plus:
- **Complex natural language** - "Which patients have both diabetes and hypertension?"
- **Conversational queries** - "What medications is the oldest patient taking?"
- **Meta questions** - "How does this system work?"
- **Healthcare concepts** - "Show me patients with metabolic syndrome indicators"

## 🔧 How It Works

1. **Natural Language Processing**: Interprets your questions to determine intent
2. **FHIR API Calls**: Makes appropriate FHIR queries based on your request
3. **Data Formatting**: Presents results in an easy-to-read chat format
4. **Error Handling**: Gracefully handles missing data and server issues

## 🔗 Related Projects

- [FHIR MCP Server](https://github.com/jcafazzo/fhir-mcp) - The original MCP server for Claude Desktop
- [FHIR Specification](https://hl7.org/fhir/) - Official FHIR documentation

## 📄 License

MIT License - See the main repository for details.