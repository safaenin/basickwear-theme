# Basickwear Shopify Theme

A practical guide to setting up, developing, reviewing, previewing, and releasing the Basickwear Shopify theme without using the live storefront as a development environment.

This guide describes our intended workflow. Check Shopify and GitHub to confirm the actual connected branch, theme IDs, permissions, and monitoring configuration before releasing. Having this README does not configure those services.

## Contents

- [How the workflow works](#how-the-workflow-works)
- [What this repository contains](#what-this-repository-contains)
- [First-time setup](#first-time-setup)
- [Joining an existing repository](#joining-an-existing-repository)
- [Daily code changes](#daily-code-changes)
- [Shopify Editor changes](#shopify-editor-changes)
- [Images, files, and theme assets](#images-files-and-theme-assets)
- [Testing on different devices](#testing-on-different-devices)
- [Creating and publishing a release](#creating-and-publishing-a-release)
- [Monitoring and rollback](#monitoring-and-rollback)
- [Troubleshooting](#troubleshooting)
- [Team rules](#team-rules)
- [Official references](#official-references)

## How the workflow works

```text
Local feature branch
        |
        v
GitHub pull request + checks + review
        |
        v
main: reviewed code
        |
        v
staging branch <--> Shopify unpublished staging theme
        |
        v
Separate unpublished release theme
        |
        v
Device testing + approval
        |
        v
Manual publish -> monitor -> retain previous working theme
```

| Component | Purpose |
| --- | --- |
| `main` | Reviewed code; not connected to a live theme in this workflow |
| `staging` | Automatically syncs with an unpublished Shopify testing theme |
| `codex/<change-name>` | Local development and review for one change |
| `codex/release-<number>` | Records the code used to prepare a release |
| `release-<number>` tag | Records the approved release commit |
| Staging theme | Always unpublished; never publish it |
| Release theme | Separate theme uploaded with CLI, tested, then manually published; not connected to GitHub automatic sync |

**GitHub pushes update staging, not production.** Production changes only when someone explicitly publishes a release or directly edits the published theme.

An unpublished theme is not a separate store. Products, inventory, customers, orders, Content → Files, and many app settings belong to the connected store. Use a separate test store, test credentials, and suitable test data for isolated backend or transaction testing. Local theme preview also connects to Shopify; it is not a complete offline store.

## What this repository contains

Theme folders typically include:

```text
.github/workflows/       Automated checks
assets/                  Theme CSS, JavaScript, fonts, and static assets
blocks/                  Theme blocks, if used by the theme
config/                  Theme settings and their schema
layout/                  Page layouts
locales/                 Translations
sections/                Theme sections and section groups
snippets/                Reusable Liquid snippets
templates/               Page templates
README.md                This guide
```

Keep the actual theme folders at the repository root for Shopify GitHub integration. Preserve any existing build-system instructions; downloaded theme files might not contain the original developer's uncompiled sources.

Git stores theme code and theme configuration. It does not back up the complete Shopify store or the binary files uploaded to Content → Files.

## First-time setup

Skip this section if the repository and Shopify staging integration already exist. Do not pull a fresh theme over uncommitted local work.

### 1. Prepare access

You need:

- Shopify access with permission to manage themes.
- Your `*.myshopify.com` store address.
- A GitHub account and a private company-owned repository where practical.
- Permission to authorize Shopify's GitHub app for that repository.
- Node.js and npm, Git, and a code editor such as VS Code.

Use individual accounts. Do not commit tokens, passwords, or `.env` files. Purchased themes remain subject to their licensing terms, particularly when using a separate store.

### 2. Back up the current live theme

In Shopify:

1. Open **Online Store → Themes**.
2. Identify the current published theme and record its name and ID.
3. Open its actions menu and select **Duplicate**.
4. Name it `Basickwear — Backup — Before GitHub Setup`.
5. Download a ZIP backup as well.
6. Leave the backup unpublished.

This is a theme backup, not a complete store-data backup.

### 3. Install tools

Install Node.js from its official website, Git, VS Code, and the official Shopify Liquid VS Code extension.

The CLI documentation checked for this guide lists Node.js 22.12+ and Git 2.28+; check the official requirements when setting up a new machine.

```bash
node --version
npm --version
git --version
npm install -g @shopify/cli@latest
shopify version
```

Restart the terminal if a newly installed command is not found.

### 4. Download the theme into an empty folder

Replace `YOUR-STORE.myshopify.com` throughout this guide with the actual store address.

```bash
mkdir basickwear
cd basickwear
shopify theme pull --store YOUR-STORE.myshopify.com
```

Authenticate when prompted. Select **Basickwear — Backup — Before GitHub Setup**, not another unrelated theme.

A warning that the empty folder is not a theme directory is expected on the first download. Confirm only after checking the destination is the intended empty folder. Pulling downloads files and does not publish changes, but can overwrite local files.

### 5. Initialize GitHub

Create an empty private repository named `basickwear-theme`. Do not initialize it with a README if you are following these import commands.

Create `.gitignore` in the theme root:

```gitignore
node_modules/
.shopify/
.env
.env.*
!.env.example
.DS_Store
```

Keep `config/settings_data.json`, templates, and section-group JSON tracked in this workflow. Review them carefully because they contain editor configuration.

```bash
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR GITHUB EMAIL"
git init
git add .
git commit -m "Import current Basickwear theme"
git branch -M main
git remote add origin https://github.com/YOUR-ORG/basickwear-theme.git
git push -u origin main
```

Use GitHub's supported authentication, such as a credential manager, GitHub CLI, or SSH. Account passwords are not Git HTTPS credentials.

### 6. Configure automated checks

Our workflow file is `.github/workflows/theme-check.yml`:

```yaml
name: Theme checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main, staging]

permissions:
  contents: read

jobs:
  theme-check:
    name: Theme Check
    runs-on: ubuntu-latest

    steps:
      - name: Download repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install Shopify CLI
        run: npm install -g @shopify/cli@latest

      - name: Check theme
        run: shopify theme check --fail-level error
```

Commit and push the file, then confirm a successful run in GitHub → Actions.

```bash
shopify theme check --fail-level error
git add .github/workflows/theme-check.yml
git commit -m "Add automated theme checks"
git push
```

This check needs no production Shopify credentials. Errors fail the job; warnings remain visible. Theme Check checks Liquid and JSON; it does not replace visual review or browser testing. For repeatable tooling, pin the CLI to a tested version and update it intentionally later.

### 7. Protect main

In GitHub Settings → Branches or Rulesets, configure `main` to:

- Require pull requests.
- Require the `Theme Check` status check after it has run at least once.
- Require a review when another reviewer is available.
- Dismiss stale approvals after changes.
- Block force pushes and deletion.
- Limit bypass access.

For a solo developer, do not require an approval you cannot obtain. Private-repository protection depends on the GitHub plan; keep the repository private even if review initially needs manual enforcement.

### 8. Connect staging to Shopify

```bash
git switch main
git pull --ff-only origin main
git switch -c staging
git push -u origin staging
```

In Shopify:

1. Open **Online Store → Themes → Add theme → Connect from GitHub**.
2. Authorize Shopify's GitHub app for only the required repository.
3. Select the repository and `staging` branch.
4. Wait for the connection and synchronization to finish.
5. Name the theme `Basickwear — STAGING — DO NOT PUBLISH`.
6. Verify it is unpublished and connected to `staging`.

The integration is bidirectional. Shopify Editor saves create commits on the connected branch. Avoid rules that prevent Shopify's integration from writing those commits. Do not connect this staging branch to a published theme.

## Joining an existing repository

Do not reinitialize Git or pull a new Shopify theme over the repository.

```bash
git clone https://github.com/YOUR-ORG/basickwear-theme.git
cd basickwear-theme
npm install -g @shopify/cli@latest
git switch main
git pull --ff-only origin main
shopify theme check --fail-level error
shopify theme dev --store YOUR-STORE.myshopify.com
```

Authenticate using your own authorized account. If this theme has a documented build step, install its dependencies and follow its existing build instructions too.

## Daily code changes

### 1. Start with a clean working tree

```bash
git status
git switch main
git pull --ff-only origin main
git switch -c codex/improve-product-page
```

Commit or safely set aside existing work before switching. Use a new descriptive branch name for each change.

### 2. Preview locally

```bash
shopify theme dev --store YOUR-STORE.myshopify.com
```

Use the returned local URL, normally `http://127.0.0.1:9292`. Changes reload while developing. Use the default development theme; do not target the live theme with a theme flag.

The command also returns a development preview link for other devices. The laptop's localhost address will not reach the laptop when entered on a phone. Checkout customizations are not previewed through the localhost address. Development previews are temporary; use the unpublished staging or release theme for team review.

Stop the local server with Ctrl+C when finished.

### 3. Check, commit, and review

```bash
shopify theme check --fail-level error
git diff
git status
git add PATH-TO-CHANGED-FILE
git commit -m "Describe the change"
git push -u origin codex/improve-product-page
```

Stage the intended files; review anything sensitive or unrelated before committing.

On GitHub, open a pull request with **base `main`** and **compare your feature branch**. Describe the change and testing, wait for checks, obtain review, and merge.

### 4. Update staging

Fetch Shopify's editor commits first:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
```

If staging contains editor changes not yet in `main`, first open a pull request **from `staging` into `main`**, review, check, and merge it.

Then update staging from reviewed main:

```bash
git fetch origin
git merge origin/main
git push origin staging
```

Wait for Shopify sync before testing. If there are conflicts, resolve them and review the result; do not force-push over Shopify's edits.

## Shopify Editor changes

For banner selections, section order, colors, text, and other theme settings:

1. Open the **unpublished staging theme's** editor.
2. Make changes and click Save.
3. Wait for Shopify sync.
4. Confirm a new Shopify commit appears on GitHub's `staging` branch.
5. With a clean local working tree, pull staging:

```bash
git switch staging
git pull --ff-only origin staging
```

6. Open a pull request **base `main`, compare `staging`**.
7. Review the settings/template changes and checks, then merge.
8. Update local main:

```bash
git switch main
git pull --ff-only origin main
```

9. Continue the normal release process. Saving staging changes does not publish them.

Editor configuration may be stored in `config/settings_data.json`, `templates/*.json`, and section-group JSON. Avoid editing the same files simultaneously in Shopify and locally.

### If someone changes the published theme

Saving changes to a published theme affects customers immediately. Our published release theme is deliberately not connected to GitHub, so those saves do not automatically reach staging/main.

Before the next release:

1. Record the live theme ID and what changed.
2. Commit local work and switch to a new branch from current `main`.
3. Pull only the relevant configuration files from that exact live theme, or reproduce the intended settings in staging.
4. Inspect the diff carefully: live configuration can contain older code/configuration than current development.
5. Submit a reviewed pull request, resolve conflicts, and update staging.

Do not blindly pull the entire older live theme over active development. Do not overwrite all settings files without review.

## Images, files, and theme assets

| Type | Location | Included in Git? |
| --- | --- | --- |
| Banners, lookbook photos, campaign images, PDFs | Shopify Content → Files | File binary: no; theme reference: usually yes |
| Product photos and videos | Product → Media | No |
| Theme CSS, JavaScript, fonts, static icons and decorations | Repository `assets/` | Yes |

### Content images: keep using Content → Files

1. Upload the image to Shopify Content → Files.
2. Open the staging theme editor.
3. Select it in the section/block image picker.
4. Save and confirm the GitHub staging commit.
5. Review the editor changes into main and follow the release process.

Content → Files is shared across themes in the same store. Upload replacements under new filenames for staging tests. Replacing or deleting a file used by the live theme can affect customers immediately.

Git tracks the image selection/reference, not the actual uploaded file. Keep original media separately. A separate test store needs its own media and references.

For new custom sections, prefer an `image_picker` setting. Example entry inside the section's existing schema settings array:

```json
{
  "type": "image_picker",
  "id": "banner_image",
  "label": "Banner image"
}
```

Render it in the section:

```liquid
{% if section.settings.banner_image != blank %}
  {{ section.settings.banner_image
    | image_url: width: 1600
    | image_tag: loading: 'lazy', widths: '400, 800, 1200, 1600', sizes: '100vw'
  }}
{% endif %}
```

Use `block.settings` for a block setting. Choose loading priority appropriately: above-the-fold hero images may need eager loading rather than lazy loading.

For a Content → Files document link, use its exact filename:

```liquid
<a href="{{ 'size-guide.pdf' | file_url }}">Size guide</a>
```

### Theme assets

Add files locally under `assets/`, then commit them with the feature change. Example references:

```liquid
{{ 'custom-styles.css' | asset_url | stylesheet_tag }}
<script src="{{ 'custom-script.js' | asset_url }}" defer></script>
```

**`asset_url` looks in theme assets, not Content → Files.** Filenames, capitalization, and extensions must match. A missing file must be added, its reference corrected, or its unused UI removed; do not hide missing-asset errors.

## Testing on different devices

1. Wait for the staging theme to finish syncing.
2. In Shopify → Themes, preview that unpublished theme.
3. Use the link/share control in the preview bar to create a visitor preview link.
4. Open the same link on real devices or share it with reviewers.
5. Visitor links expire after two days; regenerate when necessary.

An unpublished Shopify-hosted theme does not need your laptop's development server running.

Minimum coverage:

- iPhone with Safari.
- Android with Chrome.
- Desktop Chrome/Edge and Safari where relevant to your customers.
- Tablet if it represents meaningful traffic.
- Small screens, portrait/landscape, and normal desktop widths.

Browser device emulation helps with layout but does not replace real-device testing.

### Test checklist

- [ ] Home, collection, product, search, and cart pages load.
- [ ] Desktop and mobile menus work.
- [ ] Filters, sorting, and pagination work.
- [ ] Images, variant selection, prices, and sold-out states are correct.
- [ ] Add-to-cart, quantity updates, removal, and cart drawer work.
- [ ] Login popup opens/closes; keyboard focus and Escape work.
- [ ] Forms validate and remain usable with the mobile keyboard.
- [ ] Reviews and intended app embeds work.
- [ ] Proceed-to-checkout behaves correctly.
- [ ] No unexpected JavaScript errors or failed requests.
- [ ] No serious layout shifts, horizontal overflow, or major performance regression.

Record the browser, device, tested theme ID, result, and defects. Do not complete real purchases casually while previewing a production-connected store. Use an isolated test store for transaction testing.

## Creating and publishing a release

### 1. Reconcile and approve staging

1. Briefly pause team theme-editor changes.
2. Compare staging with intentional changes on the live theme.
3. Preserve current banners, sections, app selections, and relevant settings.
4. Confirm required apps, menus, metafields, files, and other store resources exist.
5. Merge intended staging configuration into main through review.
6. Update staging from main and finish its tests.

Do not assume all external store resources are included in a theme upload.

### 2. Create an independent release candidate

Choose a new unique release number; `001` below is an example.

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/release-001
git status
shopify theme check --fail-level error
shopify theme push --unpublished --store YOUR-STORE.myshopify.com
```

Require a clean working tree before uploading. Name the new unpublished theme `Basickwear — Release 001` when prompted, or rename it in Shopify. Record its ID.

Do not connect this release theme to GitHub automatic sync. Do not use `--publish` or `--allow-live` in this preparation step.

### 3. Test the exact candidate

Generate the release theme's own visitor preview link. Repeat the important device and shopping-journey tests on this exact theme, including app embeds and configuration.

If code changes, use a reviewed fix and recreate/update the candidate from the approved code. If someone edits the release in Shopify, reconcile those changes back into Git and review them before tagging. The Git tag must represent the files actually approved for release.

```bash
git push -u origin codex/release-001
git tag -a release-001 -m "Basickwear Release 001"
git push origin release-001
```

Verify the exact approved commit has a passing check. In the sample workflow, checks run on main and staging, not release branches; a different release commit needs validation too.

### 4. Publish manually

- [ ] Exact release candidate tested and approved.
- [ ] Previous working theme retained and its ID recorded.
- [ ] Monitoring and notifications checked.
- [ ] Release owner and rollback owner available.
- [ ] No additional changes since approval.

In Shopify → Online Store → Themes, select **Publish** for the approved release theme and confirm. Never publish the staging theme.

Open the public store URL in a fresh private browser session without a preview link. Repeat the critical shopping journey and record the publication time.

## Monitoring and rollback

### Prepare monitoring before release

1. Configure an external availability monitor for the public homepage and an important product page.
2. Use a reasonable interval, such as five minutes, and alert after consecutive failures.
3. Configure the team's alert destination and send a test alert.
4. Add a browser journey that selects a variant, adds to cart, and verifies the result without completing a purchase.
5. Use stable test expectations so a legitimate stock change is not mistaken for a code outage.
6. If adding browser error tracking, configure privacy filtering and verify alerts.
7. Record normal page performance, existing errors, and business activity as a baseline.

An HTTP-successful homepage does not prove add-to-cart works. Conversion and order metrics need interpretation against traffic and normal trading patterns.

### After publishing

Check immediately, again after approximately 15–30 minutes, and during the next normal sales period:

- Store/page availability.
- Variant selection and cart behaviour.
- JavaScript errors and failed requests.
- Page performance.
- Add-to-cart, checkout starts, and completed-order trends in Shopify Analytics.

### Roll back a broken theme release

1. Open Shopify → Online Store → Themes.
2. Find the previous known-working theme using the recorded ID.
3. Publish it.
4. Open the public store without a preview link and confirm recovery.
5. Record the incident and investigate the failed candidate in staging.

Republishing an old theme restores its code and theme configuration. It does not undo orders, inventory changes, app uninstalls, external integrations, or other store data. Global app/backend changes need separate recovery plans.

Release record:

```text
Release / Git tag:
Approved commit:
New theme ID:
Previous theme ID:
Published at (with timezone):
Approved by:
Devices/browsers tested:
Known limitations:
Monitoring checked:
Rollback owner:
```

## Troubleshooting

### UnknownFilter: applicable_disclosures

`applicable_disclosures` is a valid Shopify Liquid filter. Update CLI first and rerun checks:

```bash
npm install -g @shopify/cli@latest
shopify theme check --fail-level error
```

If a verified valid filter is still incorrectly flagged, use a narrowly scoped, documented inline exception rather than removing the behaviour or disabling every filter check:

```liquid
{% # theme-check-disable-next-line UnknownFilter %}
{%- assign disclosures = closest.product.metafields.shopify.disclosure.value | applicable_disclosures -%}
```

### MissingAsset in the login popup

The old popup referenced a missing `BASICKWEAR Urban Lookbook.png` theme asset. Its image panel was removed and the popup changed to a compact single-column layout. Do not restore the reference unless the intended asset is actually added.

### Countdown app / JSONMissingBlock

The VOL countdown app was uninstalled from Shopify. Its two product blocks, their `block_order` entries, and its app embed in `config/settings_data.json` were removed locally.

When removing future apps, inspect both template blocks and global app embeds. Remove order references alongside removed blocks. Do not delete unrelated apps or invent local Liquid files to satisfy an app URI. Other countdown snippets may be independent custom code rather than part of the uninstalled app.

App uninstallation is store-wide and can affect the live theme immediately, regardless of which theme is being previewed.

### Warnings remain after checks pass

The validation after the countdown cleanup reported zero errors and 13 warnings. This is a historical baseline, not a guarantee about future checks. Review hardcoded routes, unused assignments/documentation, unused snippets, and settings-count warnings separately. Do not disable all checks simply to get a green result.

### Git pull fails or shows conflicts

Run `git status`, inspect local changes, and fetch current branches. A failed `--ff-only` pull requires reconciliation; it is not a reason to force-push or discard changes. Coordinate with the person editing Shopify, resolve conflicts, and test the combined result.

### Preview shows unexpected content

Confirm the theme ID, connected branch, sync status, preview URL, and whether the link expired. Use a fresh private browser session. Opening the normal store URL may show the published theme rather than the candidate.

## Team rules

1. Develop on feature branches and review through pull requests.
2. Keep staging unpublished permanently.
3. Create a separate release theme for each approved release.
4. Avoid direct live-theme edits; if necessary, reconcile them before the next release.
5. Pull Shopify Editor commits before further local changes.
6. Avoid simultaneous edits to the same configuration files.
7. Keep secrets out of Git and retain original media separately.
8. Test the exact candidate, including real phones.
9. Keep the previous working theme and verify monitoring before publishing.
10. Treat store data, Files replacements, and app changes as shared production operations.

## Official references

- [Shopify CLI installation and requirements](https://shopify.dev/docs/api/shopify-cli)
- [Customize an existing Shopify theme](https://shopify.dev/docs/storefronts/themes/getting-started/customize)
- [Shopify GitHub integration](https://shopify.dev/docs/storefronts/themes/tools/github)
- [Theme version-control guidance](https://shopify.dev/docs/storefronts/themes/best-practices/version-control)
- [Development preview command](https://shopify.dev/docs/api/shopify-cli/theme/theme-dev)
- [Theme upload command](https://shopify.dev/docs/api/shopify-cli/theme/theme-push)
- [Theme Check](https://shopify.dev/docs/storefronts/themes/tools/theme-check)
- [Theme Check configuration and inline exceptions](https://shopify.dev/docs/storefronts/themes/tools/theme-check/configuration)
- [Theme previews and sharing](https://help.shopify.com/en/manual/online-store/themes/adding-themes)
- [Shopify CDN and image guidance](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-shopify-cdn)
- [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
