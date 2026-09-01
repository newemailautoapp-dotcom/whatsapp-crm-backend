# Meta WhatsApp Cloud API Webhook & Firebase Setup Guide

Follow this guide to connect your live WhatsApp Business Account (WABA) with this CRM dashboard.

---

## Step 1: Firebase Project & Functions Deployment

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize Firebase Project**:
   ```bash
   firebase use --add
   # Select your Firebase project ID
   ```

3. **Deploy Firestore Rules, Indexes, Cloud Functions & Frontend**:
   ```bash
   # Build frontend static files
   npm run build

   # Deploy everything to Firebase
   firebase deploy
   ```

   After deployment, Firebase CLI will output your HTTPS Webhook endpoint:
   `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api/webhook`

---

## Step 2: Configure Meta Developer App Dashboard

1. Log in to [developers.facebook.com](https://developers.facebook.com/) and open your **WhatsApp Business App**.
2. In the left menu, navigate to **WhatsApp** -> **Configuration**.
3. Under **Webhook**, click **Edit**.
4. Set **Callback URL**:
   `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api/webhook`
5. Set **Verify Token**:
   `my_secure_token_123` (or set environment variable `WEBHOOK_VERIFY_TOKEN` in Render).
6. Click **Verify and Save**.
7. Under **Webhook Fields**, click **Manage** and subscribe to:
   - `messages` (To receive customer inbound messages and button clicks)
   - `message_template_status_update`
   - `history`

---

## Step 3: Enter Meta Credentials in CRM Dashboard

1. Launch your deployed CRM Dashboard (or local preview at `http://localhost:3000`).
2. Click **Instant Demo Agent Login**.
3. Click the **Settings Icon (⚙)** in the top left header of the sidebar.
4. Input your Meta WABA Credentials:
   - **Phone Number ID**: (Found in Meta App Dashboard -> WhatsApp -> API Setup)
   - **WABA ID**: (WhatsApp Business Account ID)
   - **System User Permanent Access Token**: (Generated in Business Manager -> System Users with `whatsapp_business_messaging` permissions)
   - **Verify Token**: `my_secret_wa_webhook_token_2026`
5. Click **Save Configuration**.

---

## Step 4: Pre-configured Meta Templates

The dashboard comes pre-configured with Meta templates matching your campaign structure:

| Template Name | Category | Description / Use Case |
|---|---|---|
| `yas_island_leads_campaign` | MARKETING | Luxury waterfront real estate campaign with **Get Investment Details** quick reply button |
| `welcome_offer` | MARKETING | VIP client welcome offer with discount code |
| `appointment_reminder` | UTILITY | Viewing appointment date & time reminder |
| `general_followup` | UTILITY | General lead check-in & call back trigger |

---

## Step 5: Testing Local Webhooks without Meta Setup

If you want to test the entire system before connecting live Meta API credentials:
1. Open the CRM Inbox Dashboard.
2. Click the **⚡ Lightning Bolt** icon in the sidebar header to open the **Meta Webhook Simulator**.
3. Click **Trigger Quick Reply** to simulate a customer clicking "Get Investment Details" on the Yas Island campaign template!
