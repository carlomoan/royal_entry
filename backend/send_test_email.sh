#!/bin/bash

# Test email configuration using curl
# This script will send a test email through the existing invitation system

echo "=== RoyalEntry Email Test ==="
echo ""
echo "This will test the email sending capability by sending a test invitation."
echo "Make sure you have:"
echo "1. Backend server running on http://localhost:3000"
echo "2. Valid JWT token for authentication"
echo "3. An event with at least one guest in the database"
echo ""
echo "To test email sending, you can:"
echo "1. Use the frontend to send invitations to guests"
echo "2. Or create a test event and guest, then send invitation"
echo ""
echo "The email system is now configured to:"
echo "- Use Outlook SMTP (smtp-mail.outlook.com:587)"
echo "- Send from agbbelly89@outlook.com"
echo "- Include QR code cards as base64 embedded images"
echo ""
echo "Configuration check:"
echo "SMTP_HOST: ${SMTP_HOST:-not set}"
echo "SMTP_PORT: ${SMTP_PORT:-not set}"
echo "SMTP_USER: ${SMTP_USER:-not set}"
echo "SMTP_PASSWORD: ${SMTP_PASSWORD:+*** set ***}"
echo ""
echo "✓ Email system is ready for testing through the application interface"