-- ============================================================================
-- Migration: Create Product Table
-- Product and service management with multi-tenant (company) support
-- ============================================================================

-- Create ENUM types for products
CREATE TYPE product_type AS ENUM ('product', 'service', 'others');
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued', 'out_of_stock', 'coming_soon');
CREATE TYPE product_tracking AS ENUM ('none', 'lot', 'serial'); -- Inventory tracking type

-- ============================================================================
-- Product Category Table (hierarchical categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_category (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company relation (multi-tenant)
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    
    -- Category info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100),
    description TEXT,
    parent_id UUID REFERENCES public.product_category(id) ON DELETE SET NULL,
    
    -- Display
    image_url TEXT,
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
    display_order INT DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Unique slug per company
    UNIQUE (company_id, slug)
);

-- ============================================================================
-- Product Unit of Measure Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_uom (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company relation (multi-tenant)
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    
    -- Unit info
    name VARCHAR(50) NOT NULL, -- e.g., 'Unidad', 'Kilogramo', 'Hora'
    code VARCHAR(10) NOT NULL, -- e.g., 'UND', 'KG', 'HR'
    category VARCHAR(50), -- e.g., 'Unidad', 'Peso', 'Tiempo'
    
    -- Conversion
    ratio DECIMAL(15, 6) DEFAULT 1.000000, -- Conversion ratio to base unit
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique code per company
    UNIQUE (company_id, code)
);

-- ============================================================================
-- Main Product Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company relation (multi-tenant) - REQUIRED
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    
    -- Product Type
    product_type product_type NOT NULL DEFAULT 'product',
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    short_description VARCHAR(500),
    
    -- Identification Codes
    sku VARCHAR(100), -- Stock Keeping Unit
    barcode VARCHAR(100), -- EAN, UPC, etc.
    internal_ref VARCHAR(100), -- Internal reference code
    
    -- Category
    category_id UUID REFERENCES public.product_category(id) ON DELETE SET NULL,
    
    -- Pricing
    sale_price DECIMAL(15, 2) DEFAULT 0.00, -- Precio de venta
    cost_price DECIMAL(15, 2) DEFAULT 0.00, -- Precio de costo/compra
    list_price DECIMAL(15, 2) DEFAULT 0.00, -- Precio de lista
    currency VARCHAR(3) DEFAULT 'MXN', -- ISO 4217 currency code
    
    -- Tax
    tax_rate DECIMAL(5, 2) DEFAULT 0.00, -- Tax percentage (e.g., 16.00 for IVA)
    tax_included BOOLEAN DEFAULT false, -- Is tax included in sale_price?
    
    -- Units
    uom_id UUID REFERENCES public.product_uom(id) ON DELETE SET NULL, -- Sale unit
    purchase_uom_id UUID REFERENCES public.product_uom(id) ON DELETE SET NULL, -- Purchase unit
    
    -- Inventory (only for product_type = 'product')
    is_stockable BOOLEAN DEFAULT true, -- Track inventory?
    stock_quantity DECIMAL(15, 3) DEFAULT 0.000, -- Current stock
    stock_min DECIMAL(15, 3) DEFAULT 0.000, -- Minimum stock alert
    stock_max DECIMAL(15, 3), -- Maximum stock level
    tracking product_tracking DEFAULT 'none', -- Lot/Serial tracking
    
    -- Weight & Dimensions (for shipping)
    weight DECIMAL(10, 3), -- Weight in kg
    weight_unit VARCHAR(10) DEFAULT 'kg',
    length DECIMAL(10, 2), -- Length in cm
    width DECIMAL(10, 2), -- Width in cm
    height DECIMAL(10, 2), -- Height in cm
    volume DECIMAL(10, 3), -- Volume in m³
    
    -- Media
    image_url TEXT, -- Main product image
    images JSONB DEFAULT '[]', -- Array of additional images
    
    -- Sales & Purchase
    can_be_sold BOOLEAN DEFAULT true,
    can_be_purchased BOOLEAN DEFAULT true,
    
    -- E-commerce (optional)
    is_published BOOLEAN DEFAULT false, -- Visible in storefront?
    featured BOOLEAN DEFAULT false, -- Featured product?
    
    -- Supplier info
    default_supplier_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    supplier_sku VARCHAR(100), -- Supplier's product code
    lead_time INT DEFAULT 0, -- Days to receive from supplier
    
    -- Status
    status product_status DEFAULT 'active',
    
    -- SEO (for e-commerce)
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    meta_keywords VARCHAR(255),
    
    -- Additional data
    attributes JSONB DEFAULT '{}', -- Custom attributes (color, size, etc.)
    tags TEXT[], -- Array of tags for filtering
    notes TEXT, -- Internal notes
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Unique constraints per company
    UNIQUE (company_id, sku),
    UNIQUE (company_id, barcode),
    UNIQUE (company_id, internal_ref)
);

-- ============================================================================
-- Product Price List Table (for multiple price lists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_pricelist (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company relation
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    
    -- Price list info
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    currency VARCHAR(3) DEFAULT 'MXN',
    
    -- Validity
    start_date DATE,
    end_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique code per company
    UNIQUE (company_id, code)
);

-- ============================================================================
-- Product Price List Items (prices per product per pricelist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_pricelist_item (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    pricelist_id UUID NOT NULL REFERENCES public.product_pricelist(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
    
    -- Pricing
    price DECIMAL(15, 2) NOT NULL,
    min_quantity DECIMAL(15, 3) DEFAULT 1.000, -- Minimum qty for this price
    
    -- Discount
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    
    -- Validity
    start_date DATE,
    end_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique product per pricelist per min_quantity
    UNIQUE (pricelist_id, product_id, min_quantity)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Product category indexes
CREATE INDEX idx_product_category_company ON public.product_category(company_id);
CREATE INDEX idx_product_category_parent ON public.product_category(parent_id);
CREATE INDEX idx_product_category_slug ON public.product_category(company_id, slug);
CREATE INDEX idx_product_category_active ON public.product_category(is_active);

-- Product UOM indexes
CREATE INDEX idx_product_uom_company ON public.product_uom(company_id);
CREATE INDEX idx_product_uom_code ON public.product_uom(company_id, code);

-- Product table indexes
CREATE INDEX idx_product_company ON public.product(company_id);
CREATE INDEX idx_product_type ON public.product(product_type);
CREATE INDEX idx_product_category ON public.product(category_id);
CREATE INDEX idx_product_name ON public.product(name);
CREATE INDEX idx_product_sku ON public.product(company_id, sku);
CREATE INDEX idx_product_barcode ON public.product(company_id, barcode);
CREATE INDEX idx_product_internal_ref ON public.product(company_id, internal_ref);
CREATE INDEX idx_product_status ON public.product(status);
CREATE INDEX idx_product_supplier ON public.product(default_supplier_id);
CREATE INDEX idx_product_created_at ON public.product(created_at);
CREATE INDEX idx_product_can_be_sold ON public.product(can_be_sold);
CREATE INDEX idx_product_is_published ON public.product(is_published);

-- Full text search index for product name and description
CREATE INDEX idx_product_search ON public.product 
    USING gin(to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Composite indexes for common queries
CREATE INDEX idx_product_company_active ON public.product(company_id, status) WHERE status = 'active';
CREATE INDEX idx_product_company_type ON public.product(company_id, product_type);
CREATE INDEX idx_product_company_published ON public.product(company_id, is_published) WHERE is_published = true;
CREATE INDEX idx_product_low_stock ON public.product(company_id, stock_quantity, stock_min) 
    WHERE is_stockable = true AND stock_quantity <= stock_min;

-- Tags GIN index for array searches
CREATE INDEX idx_product_tags ON public.product USING gin(tags);

-- Pricelist indexes
CREATE INDEX idx_product_pricelist_company ON public.product_pricelist(company_id);
CREATE INDEX idx_product_pricelist_active ON public.product_pricelist(is_active);
CREATE INDEX idx_product_pricelist_default ON public.product_pricelist(company_id, is_default) WHERE is_default = true;

-- Pricelist item indexes
CREATE INDEX idx_pricelist_item_pricelist ON public.product_pricelist_item(pricelist_id);
CREATE INDEX idx_pricelist_item_product ON public.product_pricelist_item(product_id);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Trigger for product_category table
CREATE TRIGGER trigger_product_category_updated_at
    BEFORE UPDATE ON public.product_category
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for product_uom table
CREATE TRIGGER trigger_product_uom_updated_at
    BEFORE UPDATE ON public.product_uom
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for product table
CREATE TRIGGER trigger_product_updated_at
    BEFORE UPDATE ON public.product
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for product_pricelist table
CREATE TRIGGER trigger_product_pricelist_updated_at
    BEFORE UPDATE ON public.product_pricelist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for product_pricelist_item table
CREATE TRIGGER trigger_pricelist_item_updated_at
    BEFORE UPDATE ON public.product_pricelist_item
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Function to auto-generate product display_name and validate type
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_product_display_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate display_name if not provided
    IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
        NEW.display_name = NEW.name;
    END IF;
    
    -- Services should not be stockable
    IF NEW.product_type = 'service' THEN
        NEW.is_stockable = false;
        NEW.stock_quantity = 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_display_name
    BEFORE INSERT OR UPDATE ON public.product
    FOR EACH ROW
    EXECUTE FUNCTION generate_product_display_name();

-- ============================================================================
-- Function to auto-generate category slug
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_product_category_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate slug if not provided
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug = lower(regexp_replace(
            regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        )) || '-' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_category_slug
    BEFORE INSERT OR UPDATE ON public.product_category
    FOR EACH ROW
    EXECUTE FUNCTION generate_product_category_slug();

-- ============================================================================
-- Function to ensure only one default pricelist per company
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_single_default_pricelist()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Unset other defaults for this company
        UPDATE public.product_pricelist
        SET is_default = false
        WHERE company_id = NEW.company_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_default_pricelist
    BEFORE INSERT OR UPDATE ON public.product_pricelist
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_pricelist();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.product_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_uom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricelist_item ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user belongs to company
CREATE OR REPLACE FUNCTION user_belongs_to_company(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.rel_partner_company rpc
        JOIN public.partner p ON p.id = rpc.partner_id
        WHERE rpc.company_id = p_company_id
          AND p.user_id = auth.uid()
          AND rpc.invitation_status = 'accepted'
          AND rpc.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Users can view products from their companies
CREATE POLICY "Users can view company products" ON public.product
    FOR SELECT
    USING (user_belongs_to_company(company_id));

-- Policy: Users can insert products in their companies
CREATE POLICY "Users can create company products" ON public.product
    FOR INSERT
    WITH CHECK (user_belongs_to_company(company_id));

-- Policy: Users can update products in their companies
CREATE POLICY "Users can update company products" ON public.product
    FOR UPDATE
    USING (user_belongs_to_company(company_id))
    WITH CHECK (user_belongs_to_company(company_id));

-- Policy: Users can delete products in their companies
CREATE POLICY "Users can delete company products" ON public.product
    FOR DELETE
    USING (user_belongs_to_company(company_id));

-- Same policies for product_category
CREATE POLICY "Users can view company categories" ON public.product_category
    FOR SELECT
    USING (user_belongs_to_company(company_id));

CREATE POLICY "Users can manage company categories" ON public.product_category
    FOR ALL
    USING (user_belongs_to_company(company_id));

-- Same policies for product_uom
CREATE POLICY "Users can view company UOMs" ON public.product_uom
    FOR SELECT
    USING (user_belongs_to_company(company_id));

CREATE POLICY "Users can manage company UOMs" ON public.product_uom
    FOR ALL
    USING (user_belongs_to_company(company_id));

-- Same policies for product_pricelist
CREATE POLICY "Users can view company pricelists" ON public.product_pricelist
    FOR SELECT
    USING (user_belongs_to_company(company_id));

CREATE POLICY "Users can manage company pricelists" ON public.product_pricelist
    FOR ALL
    USING (user_belongs_to_company(company_id));

-- Policy for pricelist items (based on pricelist access)
CREATE POLICY "Users can view pricelist items" ON public.product_pricelist_item
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.product_pricelist pl
            WHERE pl.id = pricelist_id
              AND user_belongs_to_company(pl.company_id)
        )
    );

CREATE POLICY "Users can manage pricelist items" ON public.product_pricelist_item
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.product_pricelist pl
            WHERE pl.id = pricelist_id
              AND user_belongs_to_company(pl.company_id)
        )
    );

-- ============================================================================
-- Views for common queries
-- ============================================================================

-- View: Products with category and UOM names
CREATE OR REPLACE VIEW public.v_products AS
SELECT 
    p.*,
    pc.name AS category_name,
    uom.name AS uom_name,
    uom.code AS uom_code,
    puom.name AS purchase_uom_name,
    puom.code AS purchase_uom_code,
    s.name AS supplier_name,
    c.name AS company_name
FROM public.product p
LEFT JOIN public.product_category pc ON pc.id = p.category_id
LEFT JOIN public.product_uom uom ON uom.id = p.uom_id
LEFT JOIN public.product_uom puom ON puom.id = p.purchase_uom_id
LEFT JOIN public.partner s ON s.id = p.default_supplier_id
LEFT JOIN public.company c ON c.id = p.company_id;

-- View: Low stock products alert
CREATE OR REPLACE VIEW public.v_low_stock_products AS
SELECT 
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.stock_quantity,
    p.stock_min,
    p.stock_max,
    (p.stock_min - p.stock_quantity) AS quantity_needed,
    p.default_supplier_id,
    s.name AS supplier_name,
    c.name AS company_name
FROM public.product p
LEFT JOIN public.partner s ON s.id = p.default_supplier_id
LEFT JOIN public.company c ON c.id = p.company_id
WHERE p.is_stockable = true
  AND p.status = 'active'
  AND p.stock_quantity <= p.stock_min;

-- ============================================================================
-- Sample Data for UOMs (common units)
-- ============================================================================
-- Note: This will be inserted when the first company is created
-- For now, we create a function that can be called to seed UOMs for a company

CREATE OR REPLACE FUNCTION public.seed_product_uoms(p_company_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.product_uom (company_id, name, code, category, ratio) VALUES
        (p_company_id, 'Unidad', 'UND', 'Unidad', 1.000000),
        (p_company_id, 'Pieza', 'PZA', 'Unidad', 1.000000),
        (p_company_id, 'Par', 'PAR', 'Unidad', 2.000000),
        (p_company_id, 'Docena', 'DOC', 'Unidad', 12.000000),
        (p_company_id, 'Caja', 'CJA', 'Unidad', 1.000000),
        (p_company_id, 'Kilogramo', 'KG', 'Peso', 1.000000),
        (p_company_id, 'Gramo', 'GR', 'Peso', 0.001000),
        (p_company_id, 'Libra', 'LB', 'Peso', 0.453592),
        (p_company_id, 'Litro', 'LT', 'Volumen', 1.000000),
        (p_company_id, 'Mililitro', 'ML', 'Volumen', 0.001000),
        (p_company_id, 'Galón', 'GAL', 'Volumen', 3.785410),
        (p_company_id, 'Metro', 'MT', 'Longitud', 1.000000),
        (p_company_id, 'Centímetro', 'CM', 'Longitud', 0.010000),
        (p_company_id, 'Hora', 'HR', 'Tiempo', 1.000000),
        (p_company_id, 'Día', 'DIA', 'Tiempo', 24.000000),
        (p_company_id, 'Servicio', 'SRV', 'Servicio', 1.000000)
    ON CONFLICT (company_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.product IS 'Products and services catalog with multi-tenant support';
COMMENT ON TABLE public.product_category IS 'Hierarchical product categories per company';
COMMENT ON TABLE public.product_uom IS 'Units of measure for products per company';
COMMENT ON TABLE public.product_pricelist IS 'Price lists for different customer segments or periods';
COMMENT ON TABLE public.product_pricelist_item IS 'Individual product prices within a pricelist';

COMMENT ON COLUMN public.product.product_type IS 'Type: product (physical), service (intangible), others';
COMMENT ON COLUMN public.product.company_id IS 'Company/organization that owns this product (multi-tenant)';
COMMENT ON COLUMN public.product.sku IS 'Stock Keeping Unit - unique product identifier';
COMMENT ON COLUMN public.product.barcode IS 'EAN, UPC or other barcode for scanning';
COMMENT ON COLUMN public.product.is_stockable IS 'Whether to track inventory for this product';
COMMENT ON COLUMN public.product.tracking IS 'Inventory tracking: none, lot (batch), or serial (individual)';
COMMENT ON COLUMN public.product.tax_included IS 'Whether sale_price includes tax';
COMMENT ON COLUMN public.product.is_published IS 'Visible in e-commerce storefront';
COMMENT ON COLUMN public.product.attributes IS 'JSON for custom attributes like color, size, material, etc.';
COMMENT ON COLUMN public.product.tags IS 'Array of tags for filtering and categorization';
COMMENT ON COLUMN public.product.lead_time IS 'Days needed to receive product from supplier';

COMMENT ON FUNCTION public.seed_product_uoms IS 'Seeds default units of measure for a new company';
COMMENT ON FUNCTION public.user_belongs_to_company IS 'Helper function to check if current user belongs to a company';

COMMENT ON VIEW public.v_products IS 'Products with resolved category, UOM and supplier names';
COMMENT ON VIEW public.v_low_stock_products IS 'Products that are at or below minimum stock level';
