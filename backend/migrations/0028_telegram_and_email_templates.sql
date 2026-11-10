-- ==============================================================================
-- Migration: 0028_telegram_and_email_templates.sql
-- 1) Telegram linking: store each guest's Telegram chat_id (captured via the
--    bot webhook when the guest presses /start with their invite token).
-- 2) Seed system email templates: invitation, reminder, pledge reminder,
--    payment, and verification (OTP after QR scanning).
-- ==============================================================================

ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_guests_telegram_chat ON guests (telegram_chat_id);

-- Unique template names so the seeds below can upsert (upgrade existing ones).
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_templates_name ON email_templates (name);

-- ----------------------------------------------------------------------------
-- Email templates (idempotent per name)
-- ----------------------------------------------------------------------------
INSERT INTO email_templates (name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
SELECT 'guest_invitation',
       'You''re Invited to {{event_title}}',
       '<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0a1628;padding:24px;text-align:center;">
      <div style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#fbbf24);color:#0a1628;font-weight:800;font-size:20px;border-radius:10px;padding:8px 16px;">RoyalEntry</div>
      <h1 style="color:#ffffff;margin:16px 0 4px;font-size:24px;">You''re Invited</h1>
      <p style="color:#c9a84c;margin:0;font-size:14px;">{{event_title}}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#334e68;font-size:15px;line-height:1.6;">Dear <strong>{{guest_name}}</strong>,</p>
      <p style="color:#334e68;font-size:15px;line-height:1.6;">We are delighted to invite you to <strong>{{event_title}}</strong>.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Date</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{event_date}}</td></tr>
        {{#if event_time}}<tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Time</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{event_time}}</td></tr>{{/if}}
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Venue</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{venue}}</td></tr>
        {{#if venue_address}}<tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Address</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{venue_address}}</td></tr>{{/if}}
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="{{check_in_link}}" style="background:#c9a84c;color:#0a1628;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;padding:12px 28px;display:inline-block;">View Your Invitation</a>
      </p>
      <p style="color:#627d98;font-size:13px;line-height:1.6;">Show your invitation (QR code) at the entrance for check-in. We look forward to celebrating with you.</p>
    </div>
    <div style="background:#0a1628;color:#94a3b8;text-align:center;padding:16px;font-size:12px;">Sent by RoyalEntry · {{organization_name}}</div>
  </div>
</div>',
       'Dear {{guest_name}}, you are invited to {{event_title}} on {{event_date}} at {{venue}}. View your invitation: {{check_in_link}}',
       ARRAY['guest_name','event_title','event_date','event_time','venue','venue_address','check_in_link','organization_name'],
       'invitation', TRUE, TRUE, NOW(), NOW()
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, category = EXCLUDED.category, is_active = TRUE, is_system = TRUE, updated_at = NOW();

INSERT INTO email_templates (name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
SELECT 'event_reminder',
       'Reminder: {{event_title}} is coming up',
       '<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0a1628;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">Event Reminder</h1>
      <p style="color:#c9a84c;margin:8px 0 0;font-size:14px;">{{event_title}}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#334e68;font-size:15px;line-height:1.6;">Dear <strong>{{guest_name}}</strong>,</p>
      <p style="color:#334e68;font-size:15px;line-height:1.6;">This is a friendly reminder that <strong>{{event_title}}</strong> is coming up soon.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Date</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{event_date}}</td></tr>
        {{#if event_time}}<tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Time</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{event_time}}</td></tr>{{/if}}
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Venue</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{venue}}</td></tr>
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="{{check_in_link}}" style="background:#c9a84c;color:#0a1628;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;padding:12px 28px;display:inline-block;">Open My Invitation</a>
      </p>
    </div>
    <div style="background:#0a1628;color:#94a3b8;text-align:center;padding:16px;font-size:12px;">Sent by RoyalEntry</div>
  </div>
</div>',
       'Dear {{guest_name}}, a reminder that {{event_title}} is on {{event_date}} at {{venue}}. Open your invitation: {{check_in_link}}',
       ARRAY['guest_name','event_title','event_date','event_time','venue','check_in_link'],
       'reminder', TRUE, TRUE, NOW(), NOW()
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, category = EXCLUDED.category, is_active = TRUE, is_system = TRUE, updated_at = NOW();

INSERT INTO email_templates (name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
SELECT 'pledge_reminder',
       'Pledge Payment Reminder — {{amount_remaining}} outstanding',
       '<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0a1628;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">Pledge Payment Reminder</h1>
      <p style="color:#c9a84c;margin:8px 0 0;font-size:14px;">{{event_title}}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#334e68;font-size:15px;line-height:1.6;">Dear <strong>{{guest_name}}</strong>,</p>
      <p style="color:#334e68;font-size:15px;line-height:1.6;">Thank you for your pledge towards <strong>{{event_title}}</strong>. A balance is still outstanding.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Pledged</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{pledged_amount}}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Paid</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{amount_paid}}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Outstanding</td><td style="padding:8px 12px;color:#b45309;font-weight:700;font-size:14px;">{{amount_remaining}}</td></tr>
        {{#if payment_deadline}}<tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Due</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{payment_deadline}}</td></tr>{{/if}}
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="{{pay_link}}" style="background:#c9a84c;color:#0a1628;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;padding:12px 28px;display:inline-block;">Make a Payment</a>
      </p>
      <p style="color:#627d98;font-size:13px;">Your support makes this event possible. Thank you.</p>
    </div>
    <div style="background:#0a1628;color:#94a3b8;text-align:center;padding:16px;font-size:12px;">Sent by RoyalEntry</div>
  </div>
</div>',
       'Dear {{guest_name}}, your pledge towards {{event_title}} has {{amount_remaining}} outstanding. Pay here: {{pay_link}}',
       ARRAY['guest_name','event_title','pledged_amount','amount_paid','amount_remaining','payment_deadline','pay_link'],
       'pledge_reminder', TRUE, TRUE, NOW(), NOW()
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, category = EXCLUDED.category, is_active = TRUE, is_system = TRUE, updated_at = NOW();

INSERT INTO email_templates (name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
SELECT 'payment_receipt',
       'Payment Received — {{amount}}',
       '<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0a1628;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">Payment Received</h1>
      <p style="color:#c9a84c;margin:8px 0 0;font-size:14px;">{{event_title}}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#334e68;font-size:15px;line-height:1.6;">Dear <strong>{{guest_name}}</strong>,</p>
      <p style="color:#334e68;font-size:15px;line-height:1.6;">We have received your payment. Thank you!</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Amount</td><td style="padding:8px 12px;color:#102a43;font-weight:700;font-size:15px;">{{amount}}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Method</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{payment_method}}</td></tr>
        {{#if reference}}<tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Reference</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{reference}}</td></tr>{{/if}}
      </table>
      <p style="color:#627d98;font-size:13px;">Keep this receipt for your records.</p>
    </div>
    <div style="background:#0a1628;color:#94a3b8;text-align:center;padding:16px;font-size:12px;">Sent by RoyalEntry · {{organization_name}}</div>
  </div>
</div>',
       'Dear {{guest_name}}, payment of {{amount}} via {{payment_method}} was received for {{event_title}}.',
       ARRAY['guest_name','event_title','amount','payment_method','reference','organization_name'],
       'payment', TRUE, TRUE, NOW(), NOW()
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, category = EXCLUDED.category, is_active = TRUE, is_system = TRUE, updated_at = NOW();

INSERT INTO email_templates (name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
SELECT 'otp_verification',
       'Your {{event_title}} Check-in Code: {{otp_code}}',
       '<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0a1628;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">Check-in Verification</h1>
      <p style="color:#c9a84c;margin:8px 0 0;font-size:14px;">{{event_title}}</p>
    </div>
    <div style="padding:24px;text-align:center;">
      <p style="color:#334e68;font-size:15px;">Dear <strong>{{guest_name}}</strong>, use this one-time code at the entrance:</p>
      <div style="margin:20px auto;background:#f8fafc;border:2px dashed #c9a84c;border-radius:10px;padding:20px;font-size:34px;font-weight:800;letter-spacing:8px;color:#0a1628;width:fit-content;">{{otp_code}}</div>
      {{#if expires_at}}<p style="color:#627d98;font-size:13px;">This code expires at {{expires_at}}.</p>{{/if}}
      <p style="color:#334e68;font-size:14px;">Or open your invitation to scan your QR code:</p>
      <p style="margin:16px 0;">
        <a href="{{check_in_link}}" style="background:#c9a84c;color:#0a1628;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;padding:12px 28px;display:inline-block;">Open Invitation</a>
      </p>
    </div>
    <div style="background:#0a1628;color:#94a3b8;text-align:center;padding:16px;font-size:12px;">Sent by RoyalEntry</div>
  </div>
</div>',
       'Dear {{guest_name}}, your check-in code for {{event_title}} is {{otp_code}}. It expires at {{expires_at}}.',
       ARRAY['guest_name','event_title','otp_code','expires_at','check_in_link'],
       'verification', TRUE, TRUE, NOW(), NOW()
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, category = EXCLUDED.category, is_active = TRUE, is_system = TRUE, updated_at = NOW();