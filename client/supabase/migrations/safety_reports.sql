CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'road_hazard',
    'poor_lighting',
    'flooding',
    'unsafe_area',
    'traffic_accident',
    'other'
  )),
  description TEXT,
  severity INTEGER NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active reports" ON safety_reports
  FOR SELECT USING (expires_at > NOW());

CREATE POLICY "Auth users can insert" ON safety_reports
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id != '');

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

CREATE INDEX IF NOT EXISTS idx_safety_reports_expires ON safety_reports(expires_at);

CREATE INDEX IF NOT EXISTS idx_safety_reports_location ON safety_reports USING gist(
  ll_to_earth(lat, lng)
);
