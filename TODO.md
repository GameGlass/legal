# Legal TODO

Things to do outside the documents before (or when) publishing the new EULA, Terms of Service and Privacy Policy.

## Before publishing

- [ ] **Cookie consent banner on gameglass.gg** (Privacy Policy 5.2)
  - Use a Google-certified consent platform (for example Cookiebot, CookieYes or Usercentrics).
  - Set up Consent Mode v2 in Google Tag Manager (GTM-PNC9SQ4G) so Google Analytics (G-FJEFQBFBNB) waits for consent from EEA, UK and Swiss visitors.
  - In Google Analytics, unlink Google Ads and turn off Google Signals, so the website matches Privacy Policy 5.2 (no Google Ads or retargeting). If either is turned on again later, update the Privacy Policy first.
  - Add a "Cookie settings" link to the site footer so visitors can change their choice.
- [x] **Register a DMCA agent** with the US Copyright Office at [copyright.gov/dmca-directory](https://www.copyright.gov/dmca-directory/) (Terms of Service 8.3)
  - $6 fee; renew every 3 years.
  - The registered details must match Terms of Service 8.3. The registration also asks for a phone number.
  - The DMCA safe harbor for user-uploaded Shards only applies once the agent is registered.
- [ ] **Overwolf ads** (Terms of Service 4.3, Privacy Policy 2.8 and 5.1)
  - Ask Overwolf whether ads in GameGlass Hub can be personalized, in which regions, and when its consent prompt is shown. Users have never seen the prompt; check from an EU location (for example with a VPN).
  - If ads are personalized for users under 18 anywhere, revisit the 13+ minimum age.
  - Get the URL of Overwolf's privacy policy and link it in Privacy Policy 5.1.
- [x] **Confirm data regions** for Intercom and Featurebase, and update the table in Privacy Policy 4.2 if either is in the EU.
- [ ] **Publish gameglass.gg/legal/eula**, which the documents link to (EULA 14.1, Terms of Service 1.3, Privacy Policy 1.3). It currently returns 404.
- [x] **Replace `easy-auto-launch` in GameGlass Hub.** It is licensed under GPL-3.0-or-later and is bundled into Hub's main process (used in `src/main/managers/autolaunch-manager.ts`). Shipping GPL code inside a proprietary app can require releasing the whole app under the GPL. Use Electron's built-in `app.setLoginItemSettings()` or the MIT-licensed `auto-launch` package instead. Its dependency `applescript` goes away with it.
- [x] **Move `node-ts` to `devDependencies` in `@gameglass/omnibot`.** It is only used in development, but omnibot lists it under `dependencies`, so electron-builder may copy it (LGPL-3.0) into GameGlass Hub's installer. After moving it, publish a new omnibot version, update Hub to it, and confirm `node-ts` is no longer in the packaged app.
- [ ] **Ship the third-party notices in each product** (EULA 7.2 says they are "included with the Software"; they are not published on the website). Generate each product's THIRD-PARTY.md with `third-party-notices` (see README.md).
  - [ ] GameGlass Hub: show it in an about or settings screen, or include it as a file in the installation folder.
  - [ ] Move the libraries bundled into Hub's interface (React and its UI libraries, currently in `devDependencies`) into `dependencies`, or Hub's notices will leave them out. Check that electron-builder still packages Hub correctly afterwards.
  - [ ] Web interface (`frontend`) and Forge: link to their notices from an about page or footer, since their JavaScript is delivered to users.
  - [ ] Confirm Hub's installer includes Electron's `LICENSE` and `LICENSES.chromium.html` (Hub's THIRD-PARTY.md says it does).
  - [ ] Add an "Open-source licenses" screen to the companion app using Flutter's `showLicensePage()`. It lists the Flutter engine's components, which the notices file points to.
- [ ] **Set the "Last updated" date** in all three documents to the actual publication date (all currently say 2026-10-29).
- [ ] **Legal review** of all three documents by counsel.

## In the product

- [ ] **Sign-up checkbox**: "I am 13 or older and agree to the Terms of Service, EULA and Privacy Policy" with links (Terms of Service 2.1, 1.2). The marketing opt-in stays a separate, unticked checkbox.
- [ ] **EULA acceptance in GameGlass Hub** at first launch, and on sign-in through the Software (EULA 1.2).
- [ ] **Refund handling** in Chargebee and support matches Terms of Service 6: 14 days from the first payment or Lifetime purchase, 7 days from each renewal charge.
- [ ] **Price change notices**: make sure subscribers get at least 30 days' notice before a price change applies (Terms of Service 5.5).
- [ ] **Failed payments**: confirm Chargebee moves accounts to Basic after failed retries, as Terms of Service 5.6 describes.
- [ ] **Account deletion in the mobile apps**: Apple and Google require it in-app when accounts can be created in the app. Confirm the companion apps offer it or link to it.

## App stores and distributors

- [ ] **Apple App Store**: enter the GameGlass EULA as the custom License Agreement in App Store Connect, and make sure the App Privacy details match the Privacy Policy (ads, analytics, account data).
- [ ] **Google Play**: make sure the Data safety form matches the Privacy Policy, and that the privacy policy URL is set.
- [ ] **Microsoft Store, Amazon Appstore and Flathub**: link the EULA and Privacy Policy in each listing; ship the EULA with the Flathub package (EULA 4.1 item 2).

## After publishing

- [ ] **Tell existing users** about the new terms by email and in GameGlass Hub, at least 30 days before any change that reduces their rights takes effect.

## Every release

- [ ] **Regenerate THIRD-PARTY.md** in each of `hub`, `frontend`, `forge` and `flutter_app`: install dependencies, then run `third-party-notices` (from this repo's package) in the project folder, so new or updated dependencies are listed.

## Later

- [ ] **Before turning on PostHog session recording**: update the Privacy Policy (what is recorded, 30-day retention) and mask sensitive inputs.
- [ ] **EU and UK GDPR representative** (GDPR Article 27, UK GDPR Article 27): deferred for now.
- [ ] **Shard credits**: when crediting original creators on remixes ships, consider updating Terms of Service 7.4.
- [ ] **License Action**: Use [license checker](https://github.com/marketplace/actions/license-checker-action) for all active builds across gameglass repos
