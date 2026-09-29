// Simple test to verify email configuration
use std::env;

fn main() {
    println!("=== Email Configuration Test ===\n");
    
    let smtp_host = env::var("SMTP_HOST").unwrap_or_else(|_| "not set".to_string());
    let smtp_port = env::var("SMTP_PORT").unwrap_or_else(|_| "not set".to_string());
    let smtp_user = env::var("SMTP_USER").unwrap_or_else(|_| "not set".to_string());
    let smtp_pass = env::var("SMTP_PASSWORD").unwrap_or_else(|_| "not set".to_string());
    let smtp_from = env::var("SMTP_FROM_ADDRESS").unwrap_or_else(|_| "not set".to_string());
    let smtp_from_name = env::var("SMTP_FROM_NAME").unwrap_or_else(|_| "not set".to_string());
    
    println!("SMTP Host: {}", smtp_host);
    println!("SMTP Port: {}", smtp_port);
    println!("SMTP User: {}", smtp_user);
    println!("SMTP Password: {}", if smtp_pass.is_empty() { "not set" } else { "*** set ***" });
    println!("SMTP From: {}", smtp_from);
    println!("SMTP From Name: {}", smtp_from_name);
    
    if smtp_host == "smtp-mail.outlook.com" && !smtp_pass.is_empty() {
        println!("\n✓ Email configuration appears to be correctly set for Outlook SMTP");
        println!("Ready to send test email to agbbelly89@gmail.com");
    } else {
        println!("\n✗ Email configuration may be incomplete");
    }
}