# bgblur-mcp

Official MCP server for bgblur.com — AI-powered background blur and image enhancement tools for Claude and MCP-compatible AI clients.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![MCP](https://img.shields.io/badge/MCP-compatible-green)
![API](https://img.shields.io/badge/API-bgblur.com-black)

---

## Features

- AI background blur
- Portrait enhancement
- Background removal
- Batch image processing
- Claude-compatible MCP tools
- Fast API responses
- Remote MCP server support

---

## Example Use Cases

- Blur backgrounds for portraits
- Generate DSLR-style depth effects
- Enhance profile pictures
- Process ecommerce images
- Automate image workflows in Claude

---

## MCP Tools

### `blur_background`

Blur image backgrounds with configurable intensity.

#### Input

```json
{
  "image_url": "https://example.com/image.jpg",
  "blur_strength": 0.7
}
```

---

### `remove_background`

Remove image backgrounds automatically.

#### Input

```json
{
  "image_url": "https://example.com/image.jpg"
}
```

---

### `portrait_enhance`

Enhance portraits and apply depth effects.

#### Input

```json
{
  "image_url": "https://example.com/image.jpg",
  "enhance_face": true
}
```

---

## Installation

### Clone repository

```bash
git clone https://github.com/YOUR_USERNAME/bgblur-mcp.git
cd bgblur-mcp
```

### Install dependencies

```bash
npm install
```

### Configure environment

Create `.env`

```env
BGBLUR_API_KEY=your_api_key
PORT=3000
```

---

## Run locally

```bash
npm run dev
```

---

## Claude MCP Configuration

Example MCP config:

```json
{
  "mcpServers": {
    "bgblur": {
      "command": "node",
      "args": ["dist/server.js"]
    }
  }
}
```

---

## Remote MCP Support

This repository supports:
- Claude Desktop
- Claude Code
- MCP-compatible AI agents
- Remote MCP deployments

---

## API

Visit:

- https://bgblur.com

---

## Roadmap

- [ ] Video background blur
- [ ] Batch processing
- [ ] Realtime streaming
- [ ] Photoshop plugin
- [ ] Webhook support

---

## Security

Never expose your API keys publicly.

Use environment variables for all credentials.

---

## License

MIT License

---

## Contributing

Pull requests are welcome.

For major changes, please open an issue first to discuss proposed updates.

---

## Links

- Website: https://bgblur.com
- MCP Protocol: https://modelcontextprotocol.io
- Claude: https://claude.ai
