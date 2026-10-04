-- Organizations are added here rather than in the app, so a new one is a reviewed change.
-- Slugs appear in URLs, so they're kept when a name changes.
INSERT INTO "organizations" ("slug", "name", "country", "currency", "full_day_minutes") VALUES
  ('norge', 'Variant Norge AS', 'NO', 'NOK', 450),
  ('oslo', 'Variant Oslo AS', 'NO', 'NOK', 450),
  ('trondheim', 'Variant Trondheim AS', 'NO', 'NOK', 450),
  ('bergen', 'Variant Bergen AS', 'NO', 'NOK', 450),
  ('stavanger', 'Variant Stavanger AS', 'NO', 'NOK', 450),
  ('sverige', 'Variant Sverige AB', 'SE', 'SEK', 480),
  ('stockholm', 'Variant Stockholm AB', 'SE', 'SEK', 480),
  ('linkoping', 'Variant Linköping AB', 'SE', 'SEK', 480),
  ('goteborg', 'Variant Göteborg AB', 'SE', 'SEK', 480)
ON CONFLICT ("slug") DO NOTHING;
