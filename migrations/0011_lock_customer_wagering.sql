-- Retire the customer demo mode and forcibly keep real-money wagering disabled.
-- The historical 0010 migration enabled a cash feature flag; this corrective migration
-- explicitly closes that flag. API handlers additionally fail closed independently.
INSERT INTO app_settings(setting_key,setting_value) VALUES
  ('real_money_enabled','false'),
  ('demo_mode_enabled','false')
ON CONFLICT(setting_key) DO UPDATE SET
  setting_value=excluded.setting_value,
  updated_at=datetime('now');
