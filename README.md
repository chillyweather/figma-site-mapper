# Figma Site Mapper

A Figma plugin that automatically crawls websites and generates visual sitemaps directly in Figma. The plugin captures screenshots of web pages and organizes them into an interactive sitemap layout, perfect for UX research, site audits, and design planning.

## 🚀 Features

- **Automated Website Crawling**: Crawl entire websites or specific sections with configurable depth limits
- **Screenshot Generation**: Capture high-quality screenshots of all discovered pages
- **Interactive Sitemap**: Automatically generates a visual sitemap in Figma with clickable elements
- **Figma Integration**: Seamlessly works within the Figma environment as a native plugin
- **Configurable Crawling**: Control crawl depth, request limits, delays, and more
- **Language Detection**: Filter pages by language to focus on specific locales
- **Authentication Support**: Crawl protected sites with login credentials or cookies
- **Progress Tracking**: Real-time progress updates during the crawling process

## 🏗️ Architecture

This project consists of two main components:

### Backend (`packages/backend/`)

- **Fastify Server**: RESTful API for managing crawl jobs
- **Crawlee Engine**: Powerful web crawling using Playwright
- **BullMQ**: Queue management for handling crawl jobs
- **Screenshot Processing**: Image capture and optimization with Sharp

### Plugin (`packages/plugin/`)

- **Figma Plugin**: React-based UI that runs inside Figma
- **Sitemap Renderer**: Automatically creates visual sitemaps in Figma
- **Real-time Updates**: Progress tracking and status monitoring

## 📋 Prerequisites

Before running this project, make sure you have:

- **Node.js** (v18 or later)
- **pnpm** (v8 or later)
- **Redis** (for BullMQ job queue)
- **Figma Desktop App** (for plugin development)

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/chillyweather/figma-site-mapper.git
   cd figma-site-mapper
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start Redis** (required for job queue)

   ```bash
   # Using Homebrew on macOS
   brew services start redis

   # Or using Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

## 🏃‍♂️ Running the Project

### Development Mode

Start both the backend server and plugin development server:

```bash
pnpm dev
```

This will start:

- Backend server on `http://localhost:3006`
- Plugin build watcher for hot reloading

### Individual Components

**Backend only:**

```bash
pnpm dev:backend
```

**Plugin only:**

```bash
pnpm dev:plugin
```

### Production Build

Build the plugin for distribution:

```bash
pnpm build:plugin
```

## 🔧 Figma Plugin Setup

1. **Open Figma Desktop App**
2. **Go to Plugins** → **Development** → **Import plugin from manifest**
3. **Select** `packages/plugin/manifest.json`
4. **Run the plugin** from the Plugins menu

## 📖 Usage

1. **Launch the Plugin**: Open the "Figma Site Mapper" plugin in Figma
2. **Configure Crawl Settings**:
   - Enter the website URL to crawl
   - Set crawl depth (0 = no limit)
   - Configure request limits and delays
   - Choose screenshot dimensions
   - Set up authentication if needed
3. **Start Crawling**: Click "Start Crawl" and monitor progress
4. **View Results**: Once complete, the sitemap will automatically render in Figma

### Crawl Configuration Options

- **Max Requests**: Limit the total number of pages to crawl
- **Max Depth**: Control how deep the crawler should go (0 = unlimited)
- **Screenshot Width**: Set the width for page screenshots (default: 1440px)
- **Device Scale Factor**: Adjust for high-DPI screenshots
- **Request Delay**: Add delays between requests to be respectful to servers
- **Language Filtering**: Only crawl pages in the default language
- **Sample Size**: Limit screenshots per page for performance

### Authentication Support

The crawler supports two authentication methods:

**Credentials-based**:

```json
{
  "method": "credentials",
  "loginUrl": "https://example.com/login",
  "username": "your_username",
  "password": "your_password"
}
```

**Cookie-based**:

```json
{
  "method": "cookies",
  "cookies": [{ "name": "session_id", "value": "abc123" }]
}
```

## 🛠️ API Endpoints

### POST `/crawl`

Start a new crawl job

```json
{
  "url": "https://example.com",
  "publicUrl": "http://localhost:3006",
  "maxRequestsPerCrawl": 50,
  "deviceScaleFactor": 1,
  "delay": 0,
  "requestDelay": 1000,
  "maxDepth": 2,
  "defaultLanguageOnly": true,
  "sampleSize": 3
}
```

### GET `/status/:jobId`

Get crawl job status and progress

### POST `/progress/:jobId`

Update job progress (used internally by crawler)

### GET `/screenshots/manifest.json`

Retrieve the generated sitemap manifest

## 🧪 Testing

Run the test request limit script:

```bash
# TypeScript version
npx tsx test-request-limit.ts

# JavaScript version
node test-request-limit.js
```

## 🐛 Troubleshooting

### Common Issues

**Backend not connecting:**

- Ensure Redis is running
- Check that port 3006 is available
- Verify all dependencies are installed

**Plugin not loading:**

- Make sure Figma Desktop App is used (not web version)
- Check that manifest.json path is correct
- Rebuild plugin with `pnpm build:plugin`

**Crawl failing:**

- Verify the target URL is accessible
- Check for CORS issues or authentication requirements
- Reduce crawl limits if hitting rate limits

### Debug Mode

Enable verbose logging by setting environment variables:

```bash
DEBUG=crawlee* pnpm dev:backend
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Figma Plugin API Documentation](https://www.figma.com/plugin-docs/)
- [Crawlee Documentation](https://crawlee.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [BullMQ Documentation](https://docs.bullmq.io/)

## ⚠️ Disclaimer

Be respectful when crawling websites. Always:

- Check robots.txt
- Use appropriate delays between requests
- Respect rate limits
- Follow website terms of service
- Consider the server load you're creating

---

Built with ❤️ for the design and development community.
