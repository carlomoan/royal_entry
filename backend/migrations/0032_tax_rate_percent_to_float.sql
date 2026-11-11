-- 0027 created billing_invoices.tax_rate_percent as NUMERIC(6,2), but the Rust code
-- reads it as f64 (FLOAT8), so every invoice query failed to decode the row.
ALTER TABLE billing_invoices
    ALTER COLUMN tax_rate_percent TYPE DOUBLE PRECISION
    USING tax_rate_percent::double precision;
