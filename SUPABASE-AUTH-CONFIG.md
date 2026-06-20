# Supabase Authentication Configuration

To enable the "Forgot Password?" feature in Settings, you need to configure the redirect URL in Supabase.

## Configuration Steps

### 1. Open Supabase Dashboard
- Go to [app.supabase.com](https://app.supabase.com)
- Select your **NTS Claims Tracker** project

### 2. Navigate to Authentication Settings
- Click **Authentication** in the left sidebar
- Click **URL Configuration**

### 3. Add Redirect URL

Add the following URL to **Redirect URLs**:

**Production:**
```
https://sales.ntsconnect.com/auth/update-password
```

**Local Development:**
```
http://localhost:3000/auth/update-password
```

**Both should be added** (one per line in the textarea).

### 4. Save Configuration
- Click **Save** at the bottom of the page
- Changes take effect immediately

## How It Works

### User Flow:
1. **User is in Settings** → Clicks "Change Password"
2. **Forgot current password?** → Clicks "Forgot your current password?"
3. **Email sent** → Receives password reset email
4. **Clicks link** → Redirected to `/auth/update-password`
5. **Sets new password** → Automatically signed in
6. **Success** → Redirected to dashboard

### Security Notes:
- Only URLs listed in Supabase configuration are allowed
- Reset links expire after 1 hour (Supabase default)
- Each reset link can only be used once
- User must have access to their email to reset password

## Troubleshooting

### Error: "Invalid redirect URL"
- Make sure the exact URL is added to Supabase Redirect URLs
- Check for typos (trailing slashes matter!)
- Verify you're using the correct domain

### Reset email not arriving
- Check spam/junk folder
- Verify email is configured in Supabase (Authentication → Email Templates)
- Check Supabase logs (Authentication → Logs)

### Link expired
- Reset links are valid for 1 hour
- Request a new reset email

## Email Template Customization (Optional)

You can customize the password reset email template:

1. Go to **Authentication** → **Email Templates**
2. Select **Reset Password**
3. Customize the template HTML/text
4. Use variables like `{{ .ConfirmationURL }}` for the reset link

---

**Last Updated:** February 8, 2026  
**Feature:** Settings page "Forgot Password?" option
