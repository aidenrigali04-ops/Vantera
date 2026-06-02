-- Vantera platform subscriptions (workspace owner billing via Stripe)

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(255);
