# Chat with FHIR Servers - Web Demo

A natural language chat interface for querying FHIR servers. Ask questions about patients, conditions, medications, and more - just like chatting with an AI assistant!

## 🚀 Live Demo

Visit: [Your Netlify URL will go here]

## 💬 Features

- **Natural Language Queries**: Ask questions in plain English
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

## 💡 Example Queries

- **"Show me all patients"** - Lists patients with demographics
- **"Find patients with diabetes"** - Searches for patients with specific conditions
- **"Get patient 87a339d0-8cae-418e-89c7-8651e6aab3c6"** - Retrieves specific patient details
- **"Show recent observations"** - Displays recent lab results and vitals
- **"Find medications for patient 123"** - Lists prescriptions for a patient
- **"Check data quality"** - Assesses the FHIR server's data integrity

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