# RepoMonkey

A Chrome extension that manages userscripts via GitHub, similar to Tampermonkey but with Git-based version control.

## Features

- 📦 **GitHub Integration**: Bind a GitHub repository to store and manage your userscripts
- 🔄 **Auto Sync**: Automatically syncs scripts every 30 minutes (or manually)
- 🎯 **Script Management**: Enable/disable scripts with a simple toggle
- 🎨 **Modern UI**: Clean, minimal interface with green/black/gray color scheme
- ⚡ **Lightweight**: Fast and efficient, runs only when needed

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the repo-monkey directory

## Setup

1. Create a GitHub Personal Access Token (PAT):
   - Go to https://github.com/settings/tokens/new
   - Select the `repo` scope
   - Generate and copy your token

2. Click the RepoMonkey icon in Chrome toolbar
3. Click "Bind Repository" to open settings
4. Enter your PAT, repository owner, and repository name
5. Click "Save & Sync"

## Repository Structure

RepoMonkey looks for scripts in two locations (priority order):
1. `/output/` directory - if this exists, only scripts here will be loaded
2. Repository root - otherwise, all `.js` files in root will be loaded

## Userscript Format

Scripts should follow standard userscript metadata format:

```javascript
// ==UserScript==
// @name         My Awesome Script
// @match        https://example.com/*
// ==/UserScript==

console.log('Hello, World!');
```

## Usage

- Toggle scripts on/off from the popup
- Sync manually by clicking "Sync Now"
- Manage settings from the options page

## License

MIT
