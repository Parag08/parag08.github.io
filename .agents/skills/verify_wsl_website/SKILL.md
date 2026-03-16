---
name: verify_wsl_website
description: Navigates to a specific WSL-friendly file URL to verify the website layout in the browser.
---

# Verify WSL Website Skill

This skill provides a standardized way to access and verify a local website running inside WSL from the browser subagent.

## Usage

When a project is hosted inside a WSL (Windows Subsystem for Linux) distribution, standard `file:///home/user/...` paths may fail due to browser security restrictions or environment differences. This skill uses the `wsl.localhost` network namespace to bypass these issues.

### Target URL
The primary target URL for this project is:
`file://wsl.localhost/Ubuntu/home/parag/parag.github.io/index.html`

### Steps for the Browser Subagent
1.  **Open URL**: Call `open_browser_url` with the `wsl.localhost` path.
2.  **Verify Rendering**: Check for specific elements like `.navbar`, `.hero-title`, or `.profile-img` to ensure the page loaded correctly.
3.  **Check Layout**: Use `browser_resize_window` to verify responsiveness at different breakpoints (e.g., 375px for mobile, 1440px for desktop).
4.  **No Overflow**: Verify that `document.documentElement.scrollWidth <= window.innerWidth` to ensure no horizontal scrolling.

## Example Browser Task
"Open file://wsl.localhost/Ubuntu/home/parag/parag.github.io/index.html. Verify that the hamburger menu appears at 375px width and that the hero image is centered."

## Troubleshooting
If the URL still fails to load:
- Ensure the WSL distribution name is correct (currently `Ubuntu`).
- Try starting a local server using `python3 -m http.server` and accessing `http://localhost:[port]`.
- Note that `wsl.localhost` is only accessible if the Playwright browser is running on the host Windows machine.
