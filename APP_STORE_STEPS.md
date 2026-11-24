# Babyway on the App Store: your steps

The iOS app is ready to build. These are the steps only you can do, because they need your Apple account. Do them in order. Each step says what to copy and where it goes.

**Bundle ID:** `com.jamiejmann.littledays`

> **Renamed from Little Days.** The bundle ID stays `com.jamiejmann.littledays` because Apple doesn't let you change it, and users never see it. If the app record already exists in App Store Connect as "Little Days", rename it under **App Information → Name** (and the subtitle on the version page). Steps below that say "Apps → Little Days" mean the same app record.
**App name:** Babyway (App Store name: "Babyway: Baby Tracker") · **Price:** $9.99 one-time, whole family, no in-app purchases · **Devices:** iPhone only

> **Keep keys out of chat.** Apple gives you two secret files (`.p8`) and a few IDs. Never paste them into a chat, email, or the code. Paste them yourself into the two places listed in step 5: GitHub's **Secrets** page and Supabase's **Edge Function Secrets** page. If you'd like me to do it for you, ask me for a **secure form** and I'll send one. Don't paste them in a message.

---

## 0. Wait for Apple to approve your developer account
You'll get an email ("Welcome to the Apple Developer Program"). Nothing below works until then.

## 1. Find your Team ID
1. Go to <https://developer.apple.com/account> and sign in.
2. Scroll to **Membership details**. Copy the **Team ID**, which is 10 letters and numbers, like `AB12CD34EF`.
3. Save it for step 5. It's not secret, but treat it carefully anyway.

## 2. Register the app's ID, with push turned on
1. Go to **Certificates, Identifiers & Profiles → Identifiers** and click **+**.
2. Choose **App IDs**, then **App**, then Continue.
3. Description: `Little Days`. Bundle ID: **Explicit**, `com.jamiejmann.littledays`.
4. Under Capabilities, tick **Push Notifications**. Click Continue, then Register.

## 3. Create the app in App Store Connect
1. Go to <https://appstoreconnect.apple.com>, then **Apps**, then **+**, then **New App**.
2. Fill it in like this:
   - Platform: **iOS**
   - Name: **Babyway: Baby Tracker** (fallback: "Babyway: Baby & Feed Log")
   - Primary language: English (U.S.)
   - Bundle ID: pick **com.jamiejmann.littledays** from the list
   - SKU: `littledays-ios-1` (this is only for your records)
   - User access: Full Access
3. Click **Create**.

## 4. Create the two Apple keys

### 4a. App Store Connect API key (used to build and upload)
1. In App Store Connect, open **Users and Access → Integrations → App Store Connect API**.
2. Under **Team Keys**, click **Generate API Key**. (If asked, request access first. It's instant for the Account Holder.)
3. Name it `GitHub TestFlight`. For **Access**, choose **Admin**.
   - *Why Admin and not App Manager?* The build uses Apple's automatic "cloud signing", so there are no certificates for you to manage. Apple only allows cloud signing for **Admin** keys. An App Manager key builds the app but then fails at signing. If you'd rather use App Manager, tell me, and I'll switch the build to "fastlane match", which keeps signing certificates in a private Git repo. That's more setup.
4. Click Generate, then note:
   - **Issuer ID**, shown above the table (a long ID with dashes)
   - **Key ID**, in the new row (10 characters)
   - **Download API Key.** This gives you `AuthKey_XXXXXXXXXX.p8`. **You can only download it once.** Keep the file somewhere safe, like a password manager.

### 4b. Push notification key (APNs), used to send feeding alerts
1. Go to developer.apple.com, then **Certificates, Identifiers & Profiles → Keys**, then **+**.
2. Name it `Little Days Push` and tick **Apple Push Notifications service (APNs)**. If you're asked for an environment, choose **Sandbox & Production**. Continue, then Register.
3. Note the **Key ID** and click **Download** to get another `AuthKey_XXXXXXXXXX.p8`. **This download is also one-time only.**


### 4c. Sign in with Apple (so parents can tap Continue with Apple in the iPhone app)

Do this on a computer, signed into the same Apple Developer account.

1. Go to [developer.apple.com/account](https://developer.apple.com/account) and open **Certificates, Identifiers & Profiles → Identifiers**.
2. Open the App ID **`com.jamiejmann.littledays`**.
3. Tick **Sign in with Apple**, then **Save**. If Apple asks you to confirm the provisioning profile, confirm it.
4. Still under **Keys**, click **+**. Name it something like `Babyway Sign in with Apple`. Tick **Sign in with Apple**, click **Configure**, choose this App ID, then **Save**, **Continue**, and **Register**.
5. Note the **Key ID** and click **Download** to get the `.p8` file. **This download is one-time only.** Keep the file somewhere safe on your computer. Don't paste it into chat, email, or the code — you'll paste it only into Supabase in step 5c (or ask me for a secure form).
6. You do **not** need a Services ID for the iPhone app. That's only if we later turn on Sign in with Apple on the website. Skip it for now.

If you already have a key that has **Sign in with Apple** enabled for this App ID, you can reuse that Key ID and `.p8` instead of making a new key. Don't reuse the push-notification (APNs) key unless that same key also has Sign in with Apple ticked.

## 5. Paste the secrets into the right places

### 5a. GitHub, for building the app
Go to **github.com/jamiejmann/little-days → Settings → Secrets and variables → Actions → New repository secret**. Add these four:

| Secret name | What to paste |
|---|---|
| `ASC_KEY_ID` | The Key ID from step 4a |
| `ASC_ISSUER_ID` | The Issuer ID from step 4a |
| `ASC_KEY_P8` | The whole contents of the step 4a `.p8` file. Open it in TextEdit and copy everything, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `APPLE_TEAM_ID` | Your Team ID from step 1 |

### 5b. Supabase, for push alerts from the server
Go to **supabase.com → your Little Days project → Edge Functions → Secrets** (Project Settings → Edge Functions). Add these:

| Secret name | What to paste |
|---|---|
| `APNS_KEY_ID` | The Key ID from step 4b |
| `APNS_TEAM_ID` | Your Team ID from step 1 |
| `APNS_PRIVATE_KEY` | The whole contents of the step 4b `.p8` file, including the BEGIN and END lines |

That's all it takes to switch server push on. Until these are set, the app still alerts parents using reminders scheduled on the phone itself. Once they're set, the server also alerts every parent's phone when the baby is due a feed, even if the feed was logged on another phone.

### 5c. Supabase, for Sign in with Apple (and to revoke it when someone deletes their account)

**A. Turn the Apple sign-in provider on**

1. Open your Supabase project → **Authentication → Sign In / Providers** (or **Authentication → Providers**).
2. Open **Apple** and turn it **on**.
3. In **Client IDs**, enter exactly: `com.jamiejmann.littledays`
4. If the page also asks for a **Secret Key** (or Team ID, Key ID, and a private key) and will not save without it, paste those only on this page, not in chat. If you get stuck, ask me and I'll send a **secure form** or walk you through it. The iPhone app uses "Sign in with ID token," so the important field is the Client ID above.
5. Save.

**B. Edge Function secrets, so deleting an account can tell Apple to forget the login**

Go to **Project Settings → Edge Functions → Secrets**. Add these (paste the `.p8` only here, or through a secure form — never in chat):

| Secret name | What to paste |
|---|---|
| `APPLE_CLIENT_ID` | `com.jamiejmann.littledays` |
| `APPLE_TEAM_ID` | Your Team ID from step 1 |
| `APPLE_KEY_ID` | The Key ID from step 4c |
| `APPLE_PRIVATE_KEY` | The whole contents of the step 4c `.p8` file, including the BEGIN and END lines |

**C. Database + function (when you say yes)**

Two more pieces live in the code, but they are not live until you apply them:

1. In the Supabase **SQL editor**, run `supabase/011_apple_sign_in.sql`. This only adds a private table used for Apple token revocation. It does not touch real families' logs.
2. Deploy the **apple-auth** Edge Function (the same way **feed-alarm** was deployed). Until this is deployed and the secrets above are set, Continue with Apple can still sign people in once the provider is on, but account deletion may not be able to revoke the Apple token yet. Email/password sign-in and account deletion themselves still work.


## 6. Build and send to TestFlight
1. On GitHub, open the **Actions** tab, then **iOS app -> TestFlight**, then **Run workflow**.
2. It takes about 15–25 minutes. If a secret is missing, the run stops early and says which one.
3. About 10–30 minutes later, the build appears in App Store Connect under **TestFlight**. Answer the export compliance question if you're asked. The app already declares that it uses no special encryption, so this usually doesn't come up.
4. Add yourself and your family as **Internal Testers**. Install the **TestFlight** app on your iPhone and accept the invite.

You can run the workflow again any time. Each run uploads a new build number automatically.

## 7. Set the price: $9.99
1. First, in App Store Connect, go to **Business** (or **Agreements, Tax, and Banking**). Accept the **Paid Apps Agreement** and add your bank account and tax forms. **Paid apps can't go on sale until this shows "Active".**
2. Then open **Apps → Little Days → Pricing and Availability**.
3. Under Price Schedule, click **Add Pricing**. Set the base country to **United States (USD)** and the price to **$9.99**. Apple fills in matching prices for other countries. Click Confirm.
4. Availability: all countries, or only the ones you want.
5. Don't add any in-app purchases. The whole family shares one purchase, because invited parents use the same account system.
   - Note: each parent who wants the iPhone app needs it on their phone. Turn **Family Sharing** on for this app in Pricing and Availability. A paid app can then be shared through Apple Family Sharing, so people in your Apple Family can download it without paying again. Partners outside your Apple Family would buy it once themselves.

## 8. App Privacy ("nutrition label")
Go to **Apps → Little Days → App Privacy**, then **Get Started**.

- **Do you or your third-party partners collect data from this app?** Yes.
- Pick these data types:

| Data type | Why | Linked to the user? | Used for tracking? |
|---|---|---|---|
| **Contact Info → Email Address** | Signing in | Yes | No |
| **Contact Info → Name** | The parent's display name shown to family members | Yes | No |
| **Health & Fitness → Health** | The baby's feeds, pumping, sleep, diapers, medicine, growth, and notes about health | Yes | No |
| **User Content → Other User Content** | Free-text notes on entries | Yes | No |
| **Identifiers → User ID** | The account ID that links your family's data | Yes | No |

- For each type, the purpose is **App Functionality** only. Don't tick Analytics, Advertising, Product Personalization, or Other.
- **Tracking:** No. The app has no ads, no analytics, and no third-party SDKs. Data is stored in your Supabase database and shared only with the family members you invite.
- Don't tick these: Location, Contacts, Photos, Purchases, Financial info, Browsing history, Search history, Diagnostics, Usage data, or Device ID. The push-notification token is used only to deliver your alerts, and Apple doesn't count it as a "Device ID".
- **Privacy Policy URL (current):** `https://thelittledaysapp.com/privacy.html` (marketing site) or `https://jamiejmann.github.io/little-days/privacy.html` (in-app copy). Both are drafts for a lawyer to review. After getbabyway.com is pointed at the site, switch this to `https://getbabyway.com/privacy.html`.
- **Terms of Use URL (current):** `https://thelittledaysapp.com/terms.html` or `https://jamiejmann.github.io/little-days/terms.html`. After the new domain is pointed, use `https://getbabyway.com/terms.html`. Add this link in the App Store listing (description or the Terms of Use field). These pages are also drafts for a lawyer to review.
- **Support URL / contact:** https://thelittledaysapp.com/support.html and hello@getbabyway.com.

## 9. Age rating
Go to **Apps → Little Days → App Information → Age Rating → Edit**. Answer **None** or **No** to everything:
- violence, horror, sexual content, nudity, profanity, drugs, alcohol, tobacco, gambling, contests: **None**
- medical or treatment information: **None**. The growth percentiles are informational WHO charts, not diagnosis or treatment.
- unrestricted web access: **No**
- user-generated content, or messaging with strangers: **No**. Sharing happens only within a family you invite.
- parental controls and age assurance: **No**

The result is **4+**. Don't choose the "Made for Kids" category, because the app is for parents. Suggested categories are **Primary: Health & Fitness** and **Secondary: Lifestyle**.

## 10. Before you press "Submit for Review"
- **Account deletion (required by Apple):** done. It's under **Family → Settings → Delete my account**, and also on the welcome screen. You confirm by typing DELETE. Mention it in the review notes.
- **Screenshots:** upload 6.9-inch iPhone screenshots (1320×2868 or 1290×2796). I can make these.
- **App Review information:** create a demo login yourself in the app (don't send the password in chat). Then, when you're ready, run `supabase/seed_reviewer_demo.sql` in the Supabase SQL editor (change the email at the top first). That script adds only fake sample data for that login. It will refuse to run if you haven't changed the email, if the account doesn't exist, or if that account is already on a baby. Put the email and password only in App Store Connect. A copy-paste checklist, including review notes, is in `/workspace/little-days-marketing/app-store-connect-checklist-babyway.txt`.
- **Review notes, something like:** "Babyway is a shared baby tracker for parents. Demo account is preloaded with a sample baby, Olive (review sample). The Family screen shows invite code REVIEW. Continue with Apple is on the sign-in screen in the iPhone app. Account deletion: Family → Settings → Delete my account (type DELETE). Feeding alarms use local notifications and APNs. Growth percentiles are WHO charts, labeled information only, not medical advice. $9.99 paid app, no in-app purchases."
- **Description, keywords, support URL:** the support URL can be the GitHub Pages site.

## What's already done (no action needed)
- The iOS app project is in `ios-app/`. The website is bundled inside the app, so it works without loading the site. It uses the same Supabase backend and the same accounts.
- The push notification code, phone-only alarm reminders, haptics, Babyway chick icon, splash screen, and status bar are all built in.
- The **iOS app → TestFlight** build workflow only runs when you start it, and it skips itself until the four GitHub secrets exist.
- The privacy policy page and the in-app "Delete my account" button are live. This guide is kept out of the public website.
