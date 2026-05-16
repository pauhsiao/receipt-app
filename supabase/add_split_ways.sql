-- Add split_ways column to receipts table
-- Run this in Supabase SQL Editor
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS split_ways INTEGER DEFAULT NULL;
