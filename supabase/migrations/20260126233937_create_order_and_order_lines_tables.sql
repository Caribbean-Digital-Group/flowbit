-- ============================================================================
-- Migration: Create Order and Order Lines Tables
-- Purchase and Sale order management with multi-tenant (company) support
-- ============================================================================

-- Create ENUM types for orders
CREATE TYPE order_type AS ENUM ('purchase', 'sale');
CREATE TYPE order_state AS ENUM ('draft', 'posted', 'cancel');

-- ============================================================================
-- Main Order Table (Parent table for purchases and sales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company relation (multi-tenant) - REQUIRED
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    
    -- Order Type (purchase = compra, sale = venta)
    order_type order_type NOT NULL DEFAULT 'sale',
    
    -- Order Identification
    name VARCHAR(100), -- Order number/reference (auto-generated)
    reference VARCHAR(255), -- External reference (customer PO, supplier invoice, etc.)
    
    -- Partner Relations
    partner_id UUID NOT NULL REFERENCES public.partner(id) ON DELETE RESTRICT, -- Customer/Supplier
    created_by_partner_id UUID REFERENCES public.partner(id) ON DELETE SET NULL, -- Who created the order
    
    -- Order Status
    order_state order_state NOT NULL DEFAULT 'draft',
    
    -- Dates
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    confirmation_date TIMESTAMPTZ, -- When order was posted
    delivery_date DATE, -- Expected/actual delivery date
    
    -- Currency
    currency VARCHAR(3) NOT NULL DEFAULT 'MXN', -- ISO 4217 currency code
    exchange_rate DECIMAL(15, 6) DEFAULT 1.000000, -- Exchange rate to company currency
    
    -- Tax Configuration
    tax_rate DECIMAL(5, 2) DEFAULT 0.00, -- Default tax percentage (e.g., 16.00 for IVA)
    tax_included BOOLEAN DEFAULT false, -- Are line prices tax inclusive?
    
    -- Amounts (calculated from lines)
    amount_untaxed DECIMAL(15, 2) DEFAULT 0.00, -- Subtotal before tax
    amount_tax DECIMAL(15, 2) DEFAULT 0.00, -- Total tax amount
    amount_total DECIMAL(15, 2) DEFAULT 0.00, -- Grand total
    amount_discount DECIMAL(15, 2) DEFAULT 0.00, -- Total discount amount
    
    -- Payment Terms
    payment_term VARCHAR(100), -- Payment terms description
    payment_due_date DATE, -- Payment due date
    
    -- Shipping/Delivery Address (can be different from partner address)
    shipping_street VARCHAR(255),
    shipping_street2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_zip VARCHAR(20),
    shipping_country_code CHAR(2),
    
    -- Additional Info
    notes TEXT, -- Internal notes
    terms TEXT, -- Terms and conditions
    
    -- Status flags
    is_invoiced BOOLEAN DEFAULT false, -- Has been invoiced
    is_delivered BOOLEAN DEFAULT false, -- Has been delivered/received
    is_paid BOOLEAN DEFAULT false, -- Has been paid
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- Order Lines Table (Detail lines for each order)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_line (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Parent Order Relation - REQUIRED
    order_id UUID NOT NULL REFERENCES public.order(id) ON DELETE CASCADE,
    
    -- Product Relation
    product_id UUID REFERENCES public.product(id) ON DELETE SET NULL,
    
    -- Line Details
    sequence INT DEFAULT 10, -- Line ordering
    description TEXT NOT NULL, -- Product description (can be customized)
    
    -- Quantities
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 1.000,
    quantity_delivered DECIMAL(15, 3) DEFAULT 0.000, -- Delivered/received qty
    quantity_invoiced DECIMAL(15, 3) DEFAULT 0.000, -- Invoiced qty
    
    -- Unit of Measure
    uom_id UUID REFERENCES public.product_uom(id) ON DELETE SET NULL,
    
    -- Pricing
    unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- Sale price per unit
    unit_cost DECIMAL(15, 2) DEFAULT 0.00, -- Cost price per unit (for margin calculation)
    
    -- Discount
    discount_percent DECIMAL(5, 2) DEFAULT 0.00, -- Line discount percentage
    discount_amount DECIMAL(15, 2) DEFAULT 0.00, -- Calculated discount amount
    
    -- Tax
    tax_rate DECIMAL(5, 2) DEFAULT 0.00, -- Line-specific tax rate
    tax_amount DECIMAL(15, 2) DEFAULT 0.00, -- Calculated tax amount
    
    -- Totals (calculated)
    subtotal DECIMAL(15, 2) DEFAULT 0.00, -- quantity * unit_price - discount
    total DECIMAL(15, 2) DEFAULT 0.00, -- subtotal + tax
    
    -- Margin (for sales analysis)
    margin DECIMAL(15, 2) DEFAULT 0.00, -- subtotal - (quantity * unit_cost)
    margin_percent DECIMAL(5, 2) DEFAULT 0.00, -- Margin percentage
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Order table indexes
CREATE INDEX idx_order_company ON public.order(company_id);
CREATE INDEX idx_order_type ON public.order(order_type);
CREATE INDEX idx_order_state ON public.order(order_state);
CREATE INDEX idx_order_partner ON public.order(partner_id);
CREATE INDEX idx_order_created_by_partner ON public.order(created_by_partner_id);
CREATE INDEX idx_order_name ON public.order(name);
CREATE INDEX idx_order_date ON public.order(order_date);
CREATE INDEX idx_order_created_at ON public.order(created_at);
CREATE INDEX idx_order_currency ON public.order(currency);

-- Composite indexes for common queries
CREATE INDEX idx_order_company_type ON public.order(company_id, order_type);
CREATE INDEX idx_order_company_state ON public.order(company_id, order_state);
CREATE INDEX idx_order_company_partner ON public.order(company_id, partner_id);
CREATE INDEX idx_order_type_state ON public.order(order_type, order_state);
CREATE INDEX idx_order_company_date ON public.order(company_id, order_date DESC);

-- Sales orders
CREATE INDEX idx_order_sales_active ON public.order(company_id, order_date) 
    WHERE order_type = 'sale' AND order_state != 'cancel';

-- Purchase orders
CREATE INDEX idx_order_purchase_active ON public.order(company_id, order_date) 
    WHERE order_type = 'purchase' AND order_state != 'cancel';

-- Order line indexes
CREATE INDEX idx_order_line_order ON public.order_line(order_id);
CREATE INDEX idx_order_line_product ON public.order_line(product_id);
CREATE INDEX idx_order_line_sequence ON public.order_line(order_id, sequence);

-- ============================================================================
-- Sequence for Order Numbers
-- ============================================================================

-- Sequence for sale orders (SO-XXXXXX)
CREATE SEQUENCE IF NOT EXISTS public.sale_order_seq START 1;

-- Sequence for purchase orders (PO-XXXXXX)
CREATE SEQUENCE IF NOT EXISTS public.purchase_order_seq START 1;

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Trigger for order table
CREATE TRIGGER trigger_order_updated_at
    BEFORE UPDATE ON public.order
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for order_line table
CREATE TRIGGER trigger_order_line_updated_at
    BEFORE UPDATE ON public.order_line
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Function to auto-generate order name/number
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_order_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate order name if not provided
    IF NEW.name IS NULL OR NEW.name = '' THEN
        IF NEW.order_type = 'sale' THEN
            NEW.name = 'SO-' || LPAD(nextval('public.sale_order_seq')::TEXT, 6, '0');
        ELSE
            NEW.name = 'PO-' || LPAD(nextval('public.purchase_order_seq')::TEXT, 6, '0');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_name
    BEFORE INSERT ON public.order
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_name();

-- ============================================================================
-- Function to calculate order line totals
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_order_line_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate discount amount
    NEW.discount_amount = ROUND((NEW.quantity * NEW.unit_price * NEW.discount_percent / 100), 2);
    
    -- Calculate subtotal (before tax)
    NEW.subtotal = ROUND((NEW.quantity * NEW.unit_price) - NEW.discount_amount, 2);
    
    -- Calculate tax amount
    NEW.tax_amount = ROUND((NEW.subtotal * NEW.tax_rate / 100), 2);
    
    -- Calculate total (with tax)
    NEW.total = NEW.subtotal + NEW.tax_amount;
    
    -- Calculate margin
    NEW.margin = ROUND(NEW.subtotal - (NEW.quantity * NEW.unit_cost), 2);
    
    -- Calculate margin percentage
    IF NEW.subtotal > 0 THEN
        NEW.margin_percent = ROUND((NEW.margin / NEW.subtotal * 100), 2);
    ELSE
        NEW.margin_percent = 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_line_calculate
    BEFORE INSERT OR UPDATE ON public.order_line
    FOR EACH ROW
    EXECUTE FUNCTION calculate_order_line_totals();

-- ============================================================================
-- Function to update order totals when lines change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
BEGIN
    -- Get the order_id from either NEW or OLD
    IF TG_OP = 'DELETE' THEN
        v_order_id = OLD.order_id;
    ELSE
        v_order_id = NEW.order_id;
    END IF;
    
    -- Update order totals
    UPDATE public.order
    SET 
        amount_untaxed = COALESCE((
            SELECT SUM(subtotal) 
            FROM public.order_line 
            WHERE order_id = v_order_id
        ), 0),
        amount_tax = COALESCE((
            SELECT SUM(tax_amount) 
            FROM public.order_line 
            WHERE order_id = v_order_id
        ), 0),
        amount_discount = COALESCE((
            SELECT SUM(discount_amount) 
            FROM public.order_line 
            WHERE order_id = v_order_id
        ), 0),
        amount_total = COALESCE((
            SELECT SUM(total) 
            FROM public.order_line 
            WHERE order_id = v_order_id
        ), 0),
        updated_at = now()
    WHERE id = v_order_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_totals_on_line_change
    AFTER INSERT OR UPDATE OR DELETE ON public.order_line
    FOR EACH ROW
    EXECUTE FUNCTION update_order_totals();

-- ============================================================================
-- Function to set confirmation date when order is posted
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_order_state_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Set confirmation date when posting
    IF NEW.order_state = 'posted' AND OLD.order_state = 'draft' THEN
        NEW.confirmation_date = now();
    END IF;
    
    -- Prevent canceling a delivered or invoiced order
    IF NEW.order_state = 'cancel' AND (OLD.is_delivered = true OR OLD.is_invoiced = true) THEN
        RAISE EXCEPTION 'Cannot cancel an order that has been delivered or invoiced';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_state_change
    BEFORE UPDATE ON public.order
    FOR EACH ROW
    WHEN (OLD.order_state IS DISTINCT FROM NEW.order_state)
    EXECUTE FUNCTION handle_order_state_change();

-- ============================================================================
-- Function to populate order line from product
-- ============================================================================
CREATE OR REPLACE FUNCTION populate_order_line_from_product()
RETURNS TRIGGER AS $$
DECLARE
    v_product RECORD;
    v_order RECORD;
BEGIN
    -- Only auto-populate if product_id is set and description is empty
    IF NEW.product_id IS NOT NULL AND (NEW.description IS NULL OR NEW.description = '') THEN
        -- Get product info
        SELECT * INTO v_product FROM public.product WHERE id = NEW.product_id;
        
        -- Get order info for type
        SELECT * INTO v_order FROM public.order WHERE id = NEW.order_id;
        
        IF v_product.id IS NOT NULL THEN
            -- Set description from product
            NEW.description = COALESCE(v_product.display_name, v_product.name);
            
            -- Set prices based on order type
            IF v_order.order_type = 'sale' THEN
                NEW.unit_price = COALESCE(v_product.sale_price, 0);
            ELSE
                NEW.unit_price = COALESCE(v_product.cost_price, 0);
            END IF;
            
            -- Set cost price for margin calculation
            NEW.unit_cost = COALESCE(v_product.cost_price, 0);
            
            -- Set tax rate from product
            NEW.tax_rate = COALESCE(v_product.tax_rate, 0);
            
            -- Set UOM from product
            NEW.uom_id = v_product.uom_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_line_populate
    BEFORE INSERT ON public.order_line
    FOR EACH ROW
    EXECUTE FUNCTION populate_order_line_from_product();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view orders from their companies
CREATE POLICY "Users can view company orders" ON public.order
    FOR SELECT
    USING (user_belongs_to_company(company_id));

-- Policy: Users can create orders in their companies
CREATE POLICY "Users can create company orders" ON public.order
    FOR INSERT
    WITH CHECK (user_belongs_to_company(company_id));

-- Policy: Users can update orders in their companies (only draft orders)
CREATE POLICY "Users can update company orders" ON public.order
    FOR UPDATE
    USING (user_belongs_to_company(company_id))
    WITH CHECK (user_belongs_to_company(company_id));

-- Policy: Users can delete draft orders in their companies
CREATE POLICY "Users can delete draft company orders" ON public.order
    FOR DELETE
    USING (user_belongs_to_company(company_id) AND order_state = 'draft');

-- Policy: Order lines - based on order access
CREATE POLICY "Users can view order lines" ON public.order_line
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.order o
            WHERE o.id = order_line.order_id
              AND user_belongs_to_company(o.company_id)
        )
    );

CREATE POLICY "Users can create order lines" ON public.order_line
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.order o
            WHERE o.id = order_line.order_id
              AND user_belongs_to_company(o.company_id)
              AND o.order_state = 'draft'
        )
    );

CREATE POLICY "Users can update order lines" ON public.order_line
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.order o
            WHERE o.id = order_line.order_id
              AND user_belongs_to_company(o.company_id)
              AND o.order_state = 'draft'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.order o
            WHERE o.id = order_line.order_id
              AND user_belongs_to_company(o.company_id)
              AND o.order_state = 'draft'
        )
    );

CREATE POLICY "Users can delete order lines" ON public.order_line
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.order o
            WHERE o.id = order_line.order_id
              AND user_belongs_to_company(o.company_id)
              AND o.order_state = 'draft'
        )
    );

-- ============================================================================
-- Views for common queries
-- ============================================================================

-- View: Orders with partner and company info
CREATE OR REPLACE VIEW public.v_orders AS
SELECT 
    o.*,
    p.name AS partner_name,
    p.email AS partner_email,
    p.vat AS partner_vat,
    cbp.name AS created_by_partner_name,
    c.name AS company_name,
    c.currency AS company_currency,
    (SELECT COUNT(*) FROM public.order_line ol WHERE ol.order_id = o.id) AS line_count
FROM public.order o
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.partner cbp ON cbp.id = o.created_by_partner_id
LEFT JOIN public.company c ON c.id = o.company_id;

-- View: Order lines with product info
CREATE OR REPLACE VIEW public.v_order_lines AS
SELECT 
    ol.*,
    o.name AS order_name,
    o.order_type,
    o.order_state,
    o.partner_id,
    o.company_id,
    o.currency,
    p.name AS product_name,
    p.sku AS product_sku,
    p.barcode AS product_barcode,
    uom.name AS uom_name,
    uom.code AS uom_code
FROM public.order_line ol
JOIN public.order o ON o.id = ol.order_id
LEFT JOIN public.product p ON p.id = ol.product_id
LEFT JOIN public.product_uom uom ON uom.id = ol.uom_id;

-- View: Sales summary by partner
CREATE OR REPLACE VIEW public.v_sales_by_partner AS
SELECT 
    o.company_id,
    o.partner_id,
    p.name AS partner_name,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(o.amount_total) AS total_amount,
    MIN(o.order_date) AS first_order_date,
    MAX(o.order_date) AS last_order_date
FROM public.order o
JOIN public.partner p ON p.id = o.partner_id
WHERE o.order_type = 'sale'
  AND o.order_state = 'posted'
GROUP BY o.company_id, o.partner_id, p.name;

-- View: Purchase summary by supplier
CREATE OR REPLACE VIEW public.v_purchases_by_supplier AS
SELECT 
    o.company_id,
    o.partner_id,
    p.name AS supplier_name,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(o.amount_total) AS total_amount,
    MIN(o.order_date) AS first_order_date,
    MAX(o.order_date) AS last_order_date
FROM public.order o
JOIN public.partner p ON p.id = o.partner_id
WHERE o.order_type = 'purchase'
  AND o.order_state = 'posted'
GROUP BY o.company_id, o.partner_id, p.name;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to create a new order
CREATE OR REPLACE FUNCTION public.create_order(
    p_company_id UUID,
    p_order_type order_type,
    p_partner_id UUID,
    p_currency VARCHAR(3) DEFAULT 'MXN',
    p_tax_rate DECIMAL DEFAULT 16.00
)
RETURNS UUID AS $$
DECLARE
    v_order_id UUID;
    v_created_by_partner_id UUID;
BEGIN
    -- Get the partner_id for the current user
    SELECT id INTO v_created_by_partner_id
    FROM public.partner
    WHERE user_id = auth.uid();
    
    -- Create the order
    INSERT INTO public.order (
        company_id,
        order_type,
        partner_id,
        created_by_partner_id,
        currency,
        tax_rate,
        created_by
    ) VALUES (
        p_company_id,
        p_order_type,
        p_partner_id,
        v_created_by_partner_id,
        p_currency,
        p_tax_rate,
        auth.uid()
    )
    RETURNING id INTO v_order_id;
    
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add a line to an order
CREATE OR REPLACE FUNCTION public.add_order_line(
    p_order_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_quantity DECIMAL DEFAULT 1,
    p_unit_price DECIMAL DEFAULT 0,
    p_unit_cost DECIMAL DEFAULT 0,
    p_discount_percent DECIMAL DEFAULT 0,
    p_tax_rate DECIMAL DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_line_id UUID;
    v_order RECORD;
    v_next_sequence INT;
BEGIN
    -- Get order info
    SELECT * INTO v_order FROM public.order WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    IF v_order.order_state != 'draft' THEN
        RAISE EXCEPTION 'Cannot add lines to a non-draft order';
    END IF;
    
    -- Get next sequence number
    SELECT COALESCE(MAX(sequence), 0) + 10 INTO v_next_sequence
    FROM public.order_line
    WHERE order_id = p_order_id;
    
    -- Create the line
    INSERT INTO public.order_line (
        order_id,
        product_id,
        sequence,
        description,
        quantity,
        unit_price,
        unit_cost,
        discount_percent,
        tax_rate
    ) VALUES (
        p_order_id,
        p_product_id,
        v_next_sequence,
        COALESCE(p_description, 'Line item'),
        p_quantity,
        p_unit_price,
        p_unit_cost,
        p_discount_percent,
        COALESCE(p_tax_rate, v_order.tax_rate)
    )
    RETURNING id INTO v_line_id;
    
    RETURN v_line_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to post an order (change state from draft to posted)
CREATE OR REPLACE FUNCTION public.post_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.order WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    IF v_order.order_state != 'draft' THEN
        RAISE EXCEPTION 'Only draft orders can be posted';
    END IF;
    
    -- Check if order has lines
    IF NOT EXISTS (SELECT 1 FROM public.order_line WHERE order_id = p_order_id) THEN
        RAISE EXCEPTION 'Cannot post an order without lines';
    END IF;
    
    -- Post the order
    UPDATE public.order
    SET order_state = 'posted',
        updated_by = auth.uid()
    WHERE id = p_order_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel an order
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.order WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    IF v_order.order_state = 'cancel' THEN
        RAISE EXCEPTION 'Order is already cancelled';
    END IF;
    
    -- Cancel the order
    UPDATE public.order
    SET order_state = 'cancel',
        updated_by = auth.uid()
    WHERE id = p_order_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.order IS 'Purchase and sale orders with multi-tenant support';
COMMENT ON TABLE public.order_line IS 'Order line items/details';

COMMENT ON COLUMN public.order.order_type IS 'Type: purchase (compra) or sale (venta)';
COMMENT ON COLUMN public.order.order_state IS 'Status: draft (borrador), posted (confirmada), cancel (cancelada)';
COMMENT ON COLUMN public.order.partner_id IS 'Customer (for sales) or Supplier (for purchases)';
COMMENT ON COLUMN public.order.created_by_partner_id IS 'Partner who created this order';
COMMENT ON COLUMN public.order.company_id IS 'Company/organization that owns this order (multi-tenant)';
COMMENT ON COLUMN public.order.currency IS 'Order currency (ISO 4217)';
COMMENT ON COLUMN public.order.exchange_rate IS 'Exchange rate to company base currency';
COMMENT ON COLUMN public.order.tax_included IS 'Whether line prices include tax';
COMMENT ON COLUMN public.order.amount_untaxed IS 'Total before taxes (subtotal)';
COMMENT ON COLUMN public.order.amount_tax IS 'Total tax amount';
COMMENT ON COLUMN public.order.amount_total IS 'Grand total including taxes';

COMMENT ON COLUMN public.order_line.sequence IS 'Line ordering within the order';
COMMENT ON COLUMN public.order_line.unit_price IS 'Price per unit (sale or purchase price)';
COMMENT ON COLUMN public.order_line.unit_cost IS 'Cost per unit (for margin calculation)';
COMMENT ON COLUMN public.order_line.subtotal IS 'Line total before tax (qty * price - discount)';
COMMENT ON COLUMN public.order_line.total IS 'Line total including tax';
COMMENT ON COLUMN public.order_line.margin IS 'Profit margin (subtotal - cost)';

COMMENT ON FUNCTION public.create_order IS 'Helper function to create a new order';
COMMENT ON FUNCTION public.add_order_line IS 'Helper function to add a line to an order';
COMMENT ON FUNCTION public.post_order IS 'Helper function to confirm/post a draft order';
COMMENT ON FUNCTION public.cancel_order IS 'Helper function to cancel an order';

COMMENT ON VIEW public.v_orders IS 'Orders with resolved partner and company names';
COMMENT ON VIEW public.v_order_lines IS 'Order lines with resolved product and order info';
COMMENT ON VIEW public.v_sales_by_partner IS 'Sales summary grouped by customer';
COMMENT ON VIEW public.v_purchases_by_supplier IS 'Purchase summary grouped by supplier';
