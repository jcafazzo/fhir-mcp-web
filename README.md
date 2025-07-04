# FHIR Server Data Quality Assessment - Web Demo

A web-based demonstration of the FHIR MCP Server's data quality assessment capabilities. Test any FHIR server instantly from your browser!

## 🚀 Live Demo

Visit: [Your Netlify URL will go here]

## 🎯 Features

- **Instant Assessment**: Check any FHIR server's data quality in seconds
- **Quality Scoring**: 0-100 scoring algorithm based on data integrity
- **Issue Detection**: Identifies orphaned references and data problems
- **Resource Analysis**: Tests Patient, Observation, Condition, and MedicationRequest resources
- **Visual Results**: Color-coded scores and detailed issue reporting

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

## 📊 How It Works

1. **Resource Testing**: Checks accessibility of key FHIR resources
2. **Data Validation**: Validates FHIR bundle structure and content
3. **Orphan Detection**: Identifies clinical data without patient records
4. **Quality Scoring**: Calculates score based on issues found

## 🔗 Related Projects

- [FHIR MCP Server](https://github.com/jcafazzo/fhir-mcp) - The original MCP server for Claude Desktop
- [FHIR Specification](https://hl7.org/fhir/) - Official FHIR documentation

## 📄 License

MIT License - See the main repository for details.