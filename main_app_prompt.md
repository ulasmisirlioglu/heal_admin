I have a separate local admin dashboard app that uploads blood test PDF results for users. When an admin uploads a PDF, the admin dashboard's backend extracts biomarkers via AI and inserts a row into the `test_results` table with `status = 'completed'`. Summary, action plan, and daily objectives are already being generated automatically — that part is handled.

## 1. Email notification when results are ready

I need to **send the user an email notification** when their blood test results are ready. I don't have an email service set up yet.

When a `test_results` row is inserted or updated with `status = 'completed'`, send a notification email to the user.

- The user's email is in the `auth.users` table (Supabase Auth)
- The email should be branded with the **heal** name and include the **heal logo**
- The sender address should look like it comes from heal (e.g. `results@heal.com` or similar). Tell me what I need to do to set up a custom sender domain/address (DNS records, domain verification, etc.)
- Recommend and set up **Resend** (or another simple option) for sending emails
- Trigger this via a **Supabase Database Webhook + Edge Function**, or integrate it into the existing flow if there's already a trigger on `test_results`

## 2. Progress tracker & upcoming appointment logic on home page

The home page currently has an **upcoming appointment box** and a **progress tracker** box that appear after a test is booked. I need the following automatic transitions:

### Upcoming appointment box
- Once the booked test date+time has passed by **30 minutes**, the upcoming appointment box should disappear from the home page.

### Progress tracker steps
The progress tracker should advance through these steps automatically:

1. **Step 1 — Booked** (current behavior, already works)
2. **Step 2 — Blood Drawn**: Activate automatically **30 minutes after** the booked test date+time (same moment the upcoming appointment box disappears)
3. **Step 3 — Analyzing Results**: Activate automatically **5 hours after** the booked test date+time
4. **Step 4 — Results Ready**: Activate when the admin uploads the blood test PDF from the admin dashboard (i.e. when `test_results` row is inserted/updated with `status = 'completed'` for that user). This is also when the `current_step` in `booked_tests` should be set to 4.
5. **Progress tracker disappears**: Once the user opens the app and navigates to the **health page** for the first time after results are ready, the progress tracker should disappear from the home page.

### Implementation notes
- Steps 2 and 3 are time-based — they should be calculated on the frontend based on `booking_details.date` and `booking_details.time`, NOT by updating `current_step` in the database. Only step 4 requires a database update.
- Step 5 (hiding the tracker) could be done by setting a flag (e.g. `results_viewed: true` on the booking or a separate field) when the user visits the health page.
- The `current_step` field in `booked_tests` should only be updated to 4 when results are actually uploaded. Steps 2 and 3 are purely visual/time-based on the frontend.
