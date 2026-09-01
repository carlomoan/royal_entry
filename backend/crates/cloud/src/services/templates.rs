// ==============================================================================
// FILE: src/services/templates.rs
// ==============================================================================
// Email template service with Handlebars rendering
// ==============================================================================
use std::sync::Arc;
use handlebars::Handlebars;
use regex::Regex;
use serde_json::Value;
use std::collections::BTreeSet;
use crate::{
    error::{AppError, AppResult},
    AppState,
};

pub struct TemplateService {
    state: Arc<AppState>,
    #[allow(dead_code)]
    handlebars: Handlebars<'static>,
}

impl TemplateService {
    pub fn new(state: Arc<AppState>) -> Self {
        let mut handlebars = Handlebars::new();
        handlebars.set_strict_mode(true);
        Self { state, handlebars }
    }

    pub async fn seed_system_templates(&self) -> AppResult<()> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM email_templates WHERE is_system = TRUE",
        )
        .fetch_one(&*self.state.db.pool())
        .await?;

        if count > 0 {
            return Ok(());
        }

        let templates: Vec<(&str, &str, &str, &str, &str)> = vec![
            (
                "welcome_new_user",
                "welcome",
                "Welcome to RoyalEntry, {{user_name}}!",
                "<h1>Welcome {{user_name}}!</h1><p>Your account for {{organization_name}} is ready.</p>",
                "Welcome {{user_name}}! Your account for {{organization_name}} is ready.",
            ),
            (
                "dunning_first_notice",
                "dunning",
                "Payment Reminder - Invoice {{invoice_number}}",
                "<h1>Payment Reminder</h1><p>Invoice {{invoice_number}} for {{amount}} is due.</p>",
                "Invoice {{invoice_number}} for {{amount}} is due.",
            ),
            (
                "dunning_final_notice",
                "dunning",
                "FINAL NOTICE - Invoice {{invoice_number}}",
                "<h1>Final Notice</h1><p>Invoice {{invoice_number}} for {{amount}} is overdue. Service suspension imminent.</p>",
                "Final notice: Invoice {{invoice_number}} for {{amount}} is overdue.",
            ),
            (
                "guest_invitation",
                "invitation",
                "You're Invited to {{event_title}}",
                "<h1>You're Invited!</h1><p>{{event_title}} on {{event_date}} at {{venue}}</p>",
                "You're invited to {{event_title}} on {{event_date}} at {{venue}}",
            ),
            (
                "payment_receipt",
                "payment",
                "Payment Receipt - {{amount}}",
                "<h1>Payment Receipt</h1><p>{{amount}} paid via {{payment_method}}</p>",
                "Payment of {{amount}} received.",
            ),
            (
                "payment_failed",
                "payment",
                "Payment Failed - {{amount}}",
                "<h1>Payment Failed</h1><p>{{amount}} via {{payment_method}} failed. Reason: {{error_reason}}</p>",
                "Payment of {{amount}} failed.",
            ),
        ];

        for (name, category, subject, html, text) in &templates {
            let variables = self.extract_variables(subject, html, Some(text))?;
            sqlx::query(
                r#"
                INSERT INTO email_templates
                    (name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, NOW(), NOW())
                "#,
            )
            .bind(name)
            .bind(subject)
            .bind(html)
            .bind(text)
            .bind(&variables)
            .bind(category)
            .execute(&*self.state.db.pool())
            .await?;
        }

        tracing::info!("Seeded {} system email templates", templates.len());
        Ok(())
    }

    pub async fn render_template(
        &self,
        template_name: &str,
        variables: Value,
    ) -> AppResult<String> {
        let template = sqlx::query_as::<_, crate::models::template::EmailTemplate>(
            "SELECT * FROM email_templates WHERE name = $1 AND is_active = TRUE LIMIT 1",
        )
        .bind(template_name)
        .fetch_optional(&*self.state.db.pool())
        .await?
        .ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;

        let mut hbs = Handlebars::new();
        hbs.register_template_string("html", &template.html_body)
            .map_err(|e| AppError::BadRequest(format!("Invalid template syntax: {}", e)))?;

        let rendered = hbs
            .render("html", &variables)
            .map_err(|e| AppError::BadRequest(format!("Template render error: {}", e)))?;

        Ok(rendered)
    }

    fn extract_variables(&self, subject: &str, html: &str, text: Option<&str>) -> AppResult<Vec<String>> {
        let re = Regex::new(r"\{\{(\w+)\}\}")
            .map_err(|e| AppError::InternalServerError)?;

        let mut vars = BTreeSet::new();

        for cap in re.captures_iter(subject) {
            vars.insert(cap[1].to_string());
        }
        for cap in re.captures_iter(html) {
            vars.insert(cap[1].to_string());
        }
        if let Some(text) = text {
            for cap in re.captures_iter(text) {
                vars.insert(cap[1].to_string());
            }
        }

        Ok(vars.into_iter().collect())
    }
}
