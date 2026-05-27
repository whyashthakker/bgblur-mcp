# bgblur-mcp

Official Model Context Protocol (MCP) server for BGBlur.

This server lets Claude Desktop, Claude Code, Cursor, and other MCP-compatible
agents use BGBlur image and video processing tools through a small, stable API
surface.

The MCP server must only call the public BGBlur API:

```text
MCP client -> bgblur-mcp -> https://bgblur.com/api/v1/* -> BGBlur backend
```

It must not expose or depend on BGBlur internal routes, FastAPI URLs, RunPod
payloads, S3 bucket URLs, database models, webhook URLs, worker names, or any
other implementation detail.

## Status

This repository is the MCP server package. The intended implementation details
are documented in [codex.md](./codex.md) so Codex can scaffold and maintain the
server consistently.

## Features

- Blur image backgrounds
- Remove image backgrounds
- Enhance portraits
- Blur faces in images and videos
- Blur license plates in images and videos
- Remove objects from videos
- Detect NSFW content
- Check async job status
- Upload local image and video files from the local stdio MCP server
- Check remaining credits
- List available BGBlur features and input schemas
- Authenticate with user-owned BGBlur API keys
- Return stable, user-facing JSON responses only

## Public API Boundary

The MCP server should call public API endpoints like:

```text
POST /api/v1/images/blur-background
POST /api/v1/images/remove-background
POST /api/v1/images/portrait-enhance
POST /api/v1/images/face-blur
POST /api/v1/images/license-plate-blur
POST /api/v1/videos/background-blur
POST /api/v1/videos/face-blur
POST /api/v1/videos/license-plate-blur
POST /api/v1/videos/object-removal
POST /api/v1/detect/nsfw
GET  /api/v1/jobs/{job_id}
POST /api/v1/uploads/image
POST /api/v1/uploads/video
GET  /api/v1/me/credits
GET  /api/v1/features
```

All requests use bearer authentication:

```http
Authorization: Bearer vba_your_api_key
```

## MCP Tools

### `check_credits`

Check the remaining credits for the API key user.

Input:

```json
{}
```

### `list_features`

List all available BGBlur tools, endpoints, input schemas, and credit costs.

Input:

```json
{}
```

### `upload_image`

Upload a local image file to BGBlur and return a CDN URL. This tool is only
available in the local stdio MCP server, not the hosted remote MCP server.

Input:

```json
{
  "file_path": "/Users/rahulsantra/Downloads/image.png"
}
```

Output:

```json
{
  "success": true,
  "image_url": "https://cdn.bgblur.com/uploads/image.png",
  "media_url": "https://cdn.bgblur.com/uploads/image.png"
}
```

### `upload_video`

Upload a local video file to BGBlur and return a CDN URL. This tool is only
available in the local stdio MCP server.

Input:

```json
{
  "file_path": "/Users/rahulsantra/Downloads/video.mp4"
}
```

### `blur_background`

Blur an image background with configurable intensity.

Input:

```json
{
  "image_url": "https://example.com/image.jpg",
  "blur_strength": 0.7,
  "output_format": "png"
}
```

Output:

```json
{
  "success": true,
  "output_url": "https://cdn.bgblur.com/results/image.png",
  "credits_used": 1,
  "remaining_credits": 99
}
```

### `remove_background`

Remove an image background.

Input:

```json
{
  "image_url": "https://example.com/image.jpg",
  "output_transparent": true,
  "output_format": "png"
}
```

### `portrait_enhance`

Enhance a portrait and optionally apply a depth/background effect.

Input:

```json
{
  "image_url": "https://example.com/image.jpg",
  "enhance_face": true,
  "depth_effect": true,
  "output_format": "png"
}
```

### `blur_faces`

Blur faces in an image or video.

Input:

```json
{
  "media_url": "https://example.com/photo.jpg",
  "media_type": "image",
  "blur_strength": 0.8,
  "pixelated": false
}
```

### `blur_license_plates`

Blur license plates in an image or video.

Input:

```json
{
  "media_url": "https://example.com/dashcam.mp4",
  "media_type": "video",
  "blur_strength": 0.8,
  "pixelated": false
}
```

### `blur_video_background`

Blur a video background.

Input:

```json
{
  "video_url": "https://example.com/video.mp4",
  "blur_strength": 0.7
}
```

Async output:

```json
{
  "success": true,
  "job_id": "job_abc123",
  "status": "queued"
}
```

### `remove_object_from_video`

Remove a named object from a video.

Input:

```json
{
  "video_url": "https://example.com/video.mp4",
  "object_text": "person",
  "duration_seconds": 10
}
```

### `detect_nsfw`

Detect whether image or video content is unsafe.

Input:

```json
{
  "media_url": "https://example.com/image.jpg",
  "media_type": "image"
}
```

### `get_job_status`

Check the result of an async BGBlur job.

Input:

```json
{
  "job_id": "job_abc123"
}
```

Output:

```json
{
  "success": true,
  "job_id": "job_abc123",
  "status": "completed",
  "output_url": "https://cdn.bgblur.com/results/video.mp4",
  "credits_used": 12,
  "remaining_credits": 87
}
```

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/bgblur-mcp.git
cd bgblur-mcp
```

Install dependencies:

```bash
npm install
```

Create `.env`:

```env
BGBLUR_API_KEY=your_bgblur_api_key
BGBLUR_API_BASE_URL=https://bgblur.com/api/v1
```

Build the server:

```bash
npm run build
```

Run locally:

```bash
npm run dev
```

Run as a remote Streamable HTTP MCP server:

```bash
npm run dev:http
```

Production HTTP entrypoint:

```bash
npm run start:http
```

By default, the MCP server calls:

```text
https://bgblur.com/api/v1
```

Use `BGBLUR_API_BASE_URL` only for staging or local testing. Do not hard-code
environment-specific URLs inside tool implementations.

## Claude Desktop Configuration

After building the server, add it to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "bgblur": {
      "command": "node",
      "args": ["/absolute/path/to/bgblur-mcp/dist/server.js"],
      "env": {
        "BGBLUR_API_KEY": "vba_your_api_key",
        "BGBLUR_API_BASE_URL": "https://bgblur.com/api/v1"
      }
    }
  }
}
```

## Remote MCP Configuration

When hosted at `https://mcp.bgblur.com`, remote MCP clients should connect to:

```text
https://mcp.bgblur.com/mcp
```

Remote requests must include the user's BGBlur API key as a bearer token:

```http
Authorization: Bearer vba_user_api_key
```

The remote MCP server forwards that same user key to `https://bgblur.com/api/v1`.
This keeps billing, usage limits, credits, and jobs per user.

## Security

- Never hard-code API keys.
- Never print API keys in logs.
- Never return BGBlur internal URLs, S3 URLs, FastAPI URLs, RunPod IDs, or raw
  upstream worker payloads.
- Validate every tool input with a schema.
- Return clear user-facing errors without leaking stack traces or internal
  service names.

## Development Notes

The MCP server should be a thin client over the BGBlur public API. Any business
logic such as credits, billing, usage logging, policy checks, worker selection,
webhooks, and storage should remain inside BGBlur's backend.

See [codex.md](./codex.md) for the complete implementation brief.

## License

MIT License

## Links

- Website: https://bgblur.com
- MCP Protocol: https://modelcontextprotocol.io
- Claude: https://claude.ai
