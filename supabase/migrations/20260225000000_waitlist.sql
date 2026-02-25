-- Waitlist table for email capture on landing page
CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT, -- 'hero' | 'footer' | 'cta'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anonymous inserts (no auth needed for waitlist signups)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist" ON waitlist FOR INSERT WITH CHECK (true);
