-- ==============================================================================
-- Migration: 0034_invitation_pledge_template.sql
-- The invitation email should welcome the guest and let them know they can
-- make a pledge (michango) towards the event.
-- ==============================================================================

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
      <p style="color:#334e68;font-size:15px;line-height:1.6;">We are delighted to invite you to <strong>{{event_title}}</strong>. We look forward to celebrating with you.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Date</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{event_date}}</td></tr>
        {{#if event_time}}<tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Time</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{event_time}}</td></tr>{{/if}}
        <tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Venue</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{venue}}</td></tr>
        {{#if venue_address}}<tr><td style="padding:8px 12px;background:#f8fafc;color:#627d98;font-size:13px;">Address</td><td style="padding:8px 12px;color:#102a43;font-weight:600;font-size:14px;">{{venue_address}}</td></tr>{{/if}}
      </table>
      <div style="margin:18px 0;padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
        <p style="color:#334e68;font-size:14px;margin:0 0 6px;"><strong>Support the event</strong></p>
        <p style="color:#627d98;font-size:13px;line-height:1.6;margin:0;">You are welcome to make a pledge (michango) towards this event. Suggested range for your category: <strong>{{pledge_range}}</strong>. Your support makes the celebration possible.</p>
      </div>
      <p style="text-align:center;margin:24px 0;">
        <a href="{{check_in_link}}" style="background:#c9a84c;color:#0a1628;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;padding:12px 28px;display:inline-block;">View Your Invitation</a>
      </p>
      <p style="color:#627d98;font-size:13px;line-height:1.6;">Show your invitation (QR code) at the entrance for check-in. We look forward to seeing you.</p>
    </div>
    <div style="background:#0a1628;color:#94a3b8;text-align:center;padding:16px;font-size:12px;">Sent by RoyalEntry · {{organization_name}}</div>
  </div>
</div>',
       'Dear {{guest_name}}, you are invited to {{event_title}} on {{event_date}} at {{venue}}. You can support the event with a pledge (suggested: {{pledge_range}}). View your invitation: {{check_in_link}}',
       ARRAY['guest_name','event_title','event_date','event_time','venue','venue_address','check_in_link','organization_name','pledge_range'],
       'invitation', TRUE, TRUE, NOW(), NOW()
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, category = EXCLUDED.category, is_active = TRUE, is_system = TRUE, updated_at = NOW();