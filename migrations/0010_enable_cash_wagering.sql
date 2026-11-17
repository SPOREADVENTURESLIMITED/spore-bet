-- Enable cash-wallet wagering. The cash transaction queue remains available for settlement.
INSERT INTO app_settings(setting_key,setting_value) VALUES('real_money_enabled','true')
ON CONFLICT(setting_key) DO UPDATE SET setting_value='true',updated_at=datetime('now');
