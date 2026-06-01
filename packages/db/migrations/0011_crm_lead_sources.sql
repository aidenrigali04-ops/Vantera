-- CRM lead source values for HubSpot, GoHighLevel, and Salesforce sync
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'hubspot';
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'gohighlevel';
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'salesforce';
