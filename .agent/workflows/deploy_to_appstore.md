---
description: Guide to deploying the Hampton Inn iOS app to the App Store
---

# Deploying to Apple App Store

This guide details the steps to prepare and submit your application to the Apple App Store.

## Prerequisites

1.  **Apple Developer Account**: You must have an enrolled [Apple Developer Program](https://developer.apple.com/programs/) account ($99/year).
2.  **App Store Connect**: Access to [App Store Connect](https://appstoreconnect.apple.com/).
3.  **Xcode**: Installed on your Mac (you already have this).

## Step 1: Configuration Check

Ensure your `capacitor.config.ts` matches your App Store setup.

1.  **App ID**: The `appId` in `capacitor.config.ts` (currently `com.hamptoninn.app`) **MUST** match the Bundle ID you create in the Apple Developer Portal.
    *   *Recommendation*: Change it to something unique like `com.yourcompany.hamptoninn` or `com.hamptoninn.manager`.
2.  **Version**: In Xcode title bar, check "Version" (e.g., 1.0.0) and "Build" (e.g., 1). Bump the Build number for every new upload.

## Step 2: Assets (Icons & Splash)

If you haven't customized your app icon yet:
1.  Create a folder named `resources` in the root.
2.  Add `icon.png` (1024x1024) and `splash.png` (2732x2732).
3.  Run: `npx capacitor-assets generate --ios` (You may need to install this tool: `npm install @capacitor/assets --save-dev`).
    *   *Note*: If you don't do this, you will have default Capacitor icons.

## Step 3: Xcode Signing

1.  Open Xcode: `npx cap open ios`.
2.  Click on the **App** project in the left navigator.
3.  Select the **App** target.
4.  Go to the **Signing & Capabilities** tab.
5.  **Team**: Select your Apple Developer Team.
6.  **Bundle Identifier**: Ensure this matches your App ID.
7.  **Signing Certificate**: Ensure "Automatically manage signing" is checked.

## Step 4: Create App Record in App Store Connect

1.  Go to [App Store Connect](https://appstoreconnect.apple.com/apps).
2.  Click the **(+)** button -> **New App**.
3.  **Platforms**: iOS.
4.  **Name**: "Hampton Inn Manager" (or your chosen name).
5.  **Primary Language**: English (US).
6.  **Bundle ID**: Choose the one that matches your Xcode project.
7.  **SKU**: A unique ID (e.g., `HAMPTON_INN_001`).
8.  Click **Create**.

## Step 5: Archive and Upload

1.  In Xcode, select **Generic iOS Device** (Any iOS Device (arm64)) from the device selector top bar.
2.  Menu: **Product** > **Archive**.
3.  Wait for the build to complete. The Organizer window will open.
4.  Select your new archive and click **Distribute App**.
5.  Select **App Store Connect** > **Upload** -> **Next**.
6.  Keep default options unchecked/checked usually works fine.
7.  Click **Upload**.

## Step 6: TestFlight (Optional but Recommended)

1.  Once uploaded, go to App Store Connect > **TestFlight**.
2.  Wait for "Processing" to finish.
3.  Add yourself as a tester to verified the production build on a real device.

## Step 7: Submission

1.  In App Store Connect, go to the **App Store** tab.
2.  Fill in all required metadata (Screenshots, Description, Keywords, Support URL).
3.  **Build**: Select the build you just uploaded.
4.  **Copyright**: e.g., "2024 Hampton Inn".
5.  Click **Save**, then **Add for Review**.

## Common Issues

*   **Permissions**: If you use Camera or Location later, you MUST add descriptions to `Info.plist` (Privacy - Camera Usage Description, etc.).
*   **Asset Catalog**: If build fails on icons, delete `AppIcon` in Xcode assets and regenerate using capacitor-assets.
