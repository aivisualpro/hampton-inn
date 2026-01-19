---
description: How to install local apps on iOS without App Store (AltStore / Sideloading)
---

# Deploying iOS Apps Without App Store

Yes, you can install apps directly onto your iPhone without using the App Store. However, Apple puts strict limits on this ("sideloading").

## Option 1: Direct Install via Xcode (7-Day Expiry)
This is the standard "developer" way.
**Pros**: Free, easiest.
**Cons**: The app expires every 7 days. You must reconnect to computer and re-install every week.

1.  Connect iPhone to Mac via cable.
2.  Open Xcode (`npx cap open ios`).
3.  Select your iPhone as the destination.
4.  Run (Play button).
5.  On iPhone, go to **Settings > General > VPN & Device Management** and "Trust" your developer profile.

## Option 2: TestFlight (90-Day Expiry)
If you have an Apple Developer Account ($99/year), use TestFlight.
**Pros**: Wireless install, lasts 90 days, easy to share with team.
**Cons**: Requires paid account, waiting for "Processing".

1.  Archive and Upload to App Store Connect (as per previous guide).
2.  Don't submit for review. Just use the **TestFlight** tab.
3.  Add yourself as a tester.
4.  Download "TestFlight" app on iPhone and install your app from there.

## Option 3: Ad-Hoc Distribution (1-Year Expiry)
Requires Paid Account. For distributing to specific registered devices (UDIDs).
**Pros**: Lasts 1 year.
**Cons**: Manual device registration required.

## Option 4: Enterprise Distribution (Corporate)
Requires Apple Enterprise Account ($299/year).
**Pros**: Distribute via a private link/website to anyone in company.
**Cons**: Expensive, strict eligibility.

## Summary
For personal use or small internal teams without much hassle:
*   **Free**: Use Option 1 (Re-install weekly).
*   **Paid ($99)**: Use Option 2 (TestFlight).
