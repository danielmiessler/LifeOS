# Python Server for Foursquare API

## Getting Started

### Prerequisites

Follow [getting started](../README.md) steps in the project guide.

### Python Environment

Ensure that you're running Python 3.10 or higher.

Next install `uv`, a fast python project manager:

```
curl -LsSf https://astral.sh/uv/install.sh | sh
```
or alternatively if you are on a mac you can install with homebrew
```
brew install uv
```
(if you already have it installed, make sure it is up to date)

### Clone the Repo

This project currently must be cloned locally and run with uv. Clone using:
```
git clone git@github.com:foursquare/fsq-ai-mcp.git
```
Then set up the project:
```
cd fsq-ai-mcp/fsq-server-python
uv venv
uv sync
```

### Configure MCP

You will need to update the `~/Library/Application\ Support/Claude/claude_desktop_config.json` configuration. If the file doesn't exit, you can copy paste `claude_desktop_config.json` from this folder into `Claude`.

Based on the example [claude_desktop_config.json](claude_desktop_config.json), update the values with 
correct local paths and your Service API key and add to `claude_desktop_config.json`. 

- `"command": "/path/to/uv/bin/uv"`,
- `"args": [...,"/path/to/git/clone/fsq-ai-mcp/fsq-server-python/", ...]`,
- `"FOURSQUARE_SERVICE_TOKEN": "YOUR FOURSQUARE SERVICE TOKEN"`

If the file already exists because you have other local MCP servers, just insert the `foursquare` 
sub-object into the existing config.

### Run MCP

Open Claude Desktop. You should see a hammer icon appear in the lower right part of the chat input that says "5 MCP tools available" (or more, if you have installed other MCP servers). There should not be any popup dialogs with errors. Verify by clicking on the hammer that 5 tools from `server: foursquare` are listed as available.

Finally test it out by asking Claude for place recommendations!
```
hi claude, can you suggest some good coffee shops near Prospect Heights, Brooklyn?
```
(It will ask you to allow access to running the foursquare tools)
