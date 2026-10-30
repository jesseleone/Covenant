---
name: preview
description: Make sure the Covenant app is running and give the person a link to see their extension (or the app). Use when they ask to see, preview, try or open what was built.
---

# Preview

1. Start the app if it isn't already running:
   ```bash
   bash .devcontainer/start-preview.sh
   ```
   It prints "✓ Covenant preview is running on port 3000" when ready. If it fails, show the last lines of `/tmp/covenant-dev.log` and explain the problem simply. If the preview shows an error page (for example "502"), restart it with `bash .devcontainer/start-preview.sh --restart`.

2. Work out the address:
   - In GitHub Codespaces (the variable `CODESPACE_NAME` is set): `https://$CODESPACE_NAME-3000.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`. Get the values with `echo $CODESPACE_NAME $GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`.
   - Otherwise: `http://localhost:3000`.

3. Add the page for the extension being worked on (read its `manifest.json`):
   - left-menu page (`"placement": "nav"`): `/x/<name>`
   - deal tab (`"placement": "deal-tab"`): `/deals/deal_larch/<name>` (Project Larch has the most complete demo data)

4. Reply with the link and short instructions, for example:

   > Here's your preview: <link>
   > Sign in as **Jordan Reyes** (analyst) if you're asked. You'll find it in the left menu under Extensions (or: as the "<Name>" tab on the deal).
   > The app uses demo data, so feel free to click around. Tell me anything you'd like changed.

   In Codespaces the same page is also under the **Ports** tab, labelled "Covenant preview".

If the extension was just created and doesn't appear, run `npm run extensions` and reload the page.
