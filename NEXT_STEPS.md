# Little Days: where things stand and what's next

## What works now
- **Real accounts.** Each parent or caregiver signs in with their own email and password. You can also get a sign-in link by email.
- **A shared baby.** The first person creates the baby and becomes its **owner**. They tap *Make an invite code* on the Family screen and send the link (it looks like `...?invite=ABC123`). When someone opens the link and signs in, they're added automatically. They can also type the 6-letter code instead. Codes expire after 7 days.
- **Live sync.** When Dad logs a diaper, it shows up on Mom's phone about a second later. A sleep or nursing timer started on one phone can be seen and stopped on the other.
- **Every entry shows who logged it.** The app fills this in from the signed-in account, so nobody can log as someone else.
- **Privacy.** Only members of a baby can see or change its data. Only the owner can remove people.
- **Works on bad Wi-Fi.** If there's no signal, entries are saved on the phone and sent when it reconnects. A small pill at the top shows "live" or "1 to sync".
- **Demo mode.** "Try the demo" still works without an account, using sample data that stays on that one device.

The online part is a free **Supabase** project called `little-days`. The page only contains the *public* key, which is safe to share. The database rules are what protect the data.

## Things Jamie needs to do (one-time, in the Supabase dashboard)
1. **Email confirmation.** Right now new sign-ups must click a confirmation email. Supabase's built-in email only delivers to people on your Supabase team, and only a few emails an hour. So your partner's confirmation email might never arrive. Pick one:
   - **Easiest:** Dashboard → *Authentication* → *Sign In / Providers* → *Email* → turn **off** "Confirm email".
   - **Better long term:** Dashboard → *Authentication* → *Emails* → *SMTP settings*. Connect a free email sender such as Resend or Brevo, and keep confirmation on.
   The same limit affects the "Email me a sign-in link" button.
2. **After the site is online:** Dashboard → *Authentication* → *URL Configuration*. Set **Site URL** to your website address and add it under **Redirect URLs**, so email links bring people back to the right place.
3. *(Optional, needs a paid plan)* turn on "Leaked password protection".

## Putting it online (nothing is published yet)
The app is one file (`index.html`), so any free static host works:
- **GitHub Pages:** the box is already signed in to GitHub as `jamiejmann`. Next step: create a repo (e.g. `little-days`), upload `index.html`, and turn on Pages. The site would be at `https://jamiejmann.github.io/little-days/`. Note: on the free GitHub plan the repo has to be public for Pages to work. Only the public key is in the file, so that's OK.
- **Netlify or Vercel:** you can drag the folder onto app.netlify.com/drop. This needs your own account, and those tools aren't signed in on the box.
After it's online, do step 2 above. Then on each phone, open the site and tap *Share → Add to Home Screen* so it gets its own icon.

## Ideas for later
- Pumping, medicine (e.g. alternating Tylenol/Motrin), growth, and solids.
- A "view only" role for grandparents.
- Home-screen widgets and lock-screen timers (these need a real App Store app, e.g. built with Capacitor or Expo).
- Nap-time suggestions.
