-- Organizations are added here rather than in the app, so a new one is a reviewed change.
-- Slugs appear in URLs, so they're kept when a name changes.
-- Legal names must match the Harvest account names exactly.
INSERT INTO "organizations" ("slug", "name", "legal_name", "country", "currency", "full_day_minutes") VALUES
  ('norge', 'Norge', 'Variant Norge AS', 'NO', 'NOK', 450),
  ('oslo', 'Oslo', 'Variant Oslo AS', 'NO', 'NOK', 450),
  ('trondheim', 'Trondheim', 'Variant Trondheim AS', 'NO', 'NOK', 450),
  ('bergen', 'Bergen', 'Variant Bergen AS', 'NO', 'NOK', 450),
  ('stavanger', 'Stavanger', 'Variant Stavanger AS', 'NO', 'NOK', 450),
  ('sverige', 'Sverige', 'Variant Sverige AB', 'SE', 'SEK', 480),
  ('stockholm', 'Stockholm', 'Variant Stockholm AB', 'SE', 'SEK', 480),
  ('linkoping', 'Linköping', 'Variant Linköping AB', 'SE', 'SEK', 480),
  ('goteborg', 'Göteborg', 'Variant Göteborg AB', 'SE', 'SEK', 480)
ON CONFLICT ("slug") DO NOTHING;
