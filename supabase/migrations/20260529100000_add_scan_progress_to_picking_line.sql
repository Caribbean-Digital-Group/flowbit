-- Add scan progress fields to picking_line for warehouse barcode scanning workflow
ALTER TABLE public.picking_line
  ADD COLUMN IF NOT EXISTS done_quantity DECIMAL(15, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scan_notes   TEXT,
  ADD COLUMN IF NOT EXISTS scanned_at   TIMESTAMPTZ;
