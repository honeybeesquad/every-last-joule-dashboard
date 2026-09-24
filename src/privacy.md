<nav class="page-back-nav"><a href="./">← Dashboard</a></nav>

<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · Privacy</div>

# Privacy

<p class="methodology-deck">This site collects very little. It has no accounts, no signup forms, no advertising and no cookies. This page lists everything it does collect, and who else handles it.</p>

</header>

**Effective 24 September 2026.**

## Who runs this site

Every Last Joule (everylastjoule.com) is run by Simon Collins in New Zealand. Send privacy questions and requests to [simon@collins.nu](mailto:simon@collins.nu).

## What the site collects

- **Visit statistics.** The site counts visits with Vercel Web Analytics. Each page view records the page, the site that linked you here, your browser, operating system and device type, and your approximate location (country, region and city). Web Analytics sets no cookies. Vercel says page views are not tied to an individual or an IP address, and a visitor's session is discarded after 24 hours. We see the results only as totals.
- **Server logs.** Vercel hosts the site. Like any web host, its servers receive your IP address and browser details with each request, and they keep request logs to run and secure the service.
- **Your light or dark choice.** If you use the mode switch, your browser saves that choice on your device (in local storage, under `elj-theme`). It is never sent to us.
- **Email you send.** If you email us, we keep your message and address so we can reply and act on it.

That is the complete list. The site has no newsletter signup and no form that sends information anywhere. The region filter on the [Regions](./regions) page runs in your browser. The site's fonts, map data and scripts all load from this domain. There are no advertising or cross-site trackers.

## How it is used

- Visit statistics show us which pages people read and where they came from. We do not sell them, use them for advertising or combine them with other data.
- Vercel uses its server logs to deliver the site and protect it from abuse.
- We use email to answer you, and to fix the data or the site when you report a problem.

## Who else handles it

- **Vercel Inc.** hosts the site and runs the visit statistics. See [Vercel's privacy policy](https://vercel.com/legal/privacy-policy) and [how Web Analytics handles data](https://vercel.com/docs/analytics/privacy-policy).
- **Our email provider** stores email you send us.
- **Social media platforms.** Every Last Joule publishes posts to its own social media accounts, including on Meta's platforms. If you follow, like or comment there, the platform handles your information under its own privacy policy.
- **Other sites.** The site links to grid operators, regulators, GitHub, Zenodo and others. Once you follow a link, that site's own policy applies.

## Your choices and rights

- **See or delete what we hold.** Email us. For most visitors we hold nothing personal: the statistics are totals, and the only personal information we keep is email you send us. We will tell you what we have and delete it on request.
- **Unsubscribe.** This site runs no mailing list, so there is nothing to unsubscribe from here.
- **Opt out of statistics.** A content blocker that blocks the analytics script stops it. The site works without it.
- **Clear your mode choice.** Clear this site's data in your browser settings.

## Changes

If what the site collects changes, this page changes with it, and the effective date above moves.

</div>

```js
// The site header's mode switch and menu (src/lib/site-header.ts draws it).
import { mountSiteChrome } from "./components/site-chrome.js";
const unmountSiteChrome = mountSiteChrome();
```
