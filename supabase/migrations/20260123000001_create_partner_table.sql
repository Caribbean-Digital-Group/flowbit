-- ============================================================================
-- Migration: Create Partner Table
-- Based on Odoo's res.partner model with Supabase auth integration
-- ============================================================================

-- Create ENUM types for partner
CREATE TYPE partner_type AS ENUM ('person', 'company');
CREATE TYPE partner_title AS ENUM ('mr', 'mrs', 'ms', 'dr', 'prof', 'other');

-- ============================================================================
-- Partner Categories Table (for tags/labels like Odoo's res.partner.category)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI display
    parent_id UUID REFERENCES public.partner_category(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for category lookups
CREATE INDEX idx_partner_category_parent ON public.partner_category(parent_id);
CREATE INDEX idx_partner_category_active ON public.partner_category(active);

-- ============================================================================
-- Main Partner Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship with Supabase Auth
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Company/Person Type (like Odoo)
    company_type partner_type DEFAULT 'person',
    is_company BOOLEAN GENERATED ALWAYS AS (company_type = 'company') STORED,
    
    -- Parent Company Relationship (for employees belonging to a company)
    parent_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    ref VARCHAR(100), -- Internal reference code
    title partner_title,
    function VARCHAR(255), -- Job position/title
    
    -- Contact Information
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    website VARCHAR(255),
    
    -- Address Information
    street VARCHAR(255),
    street2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    zip VARCHAR(20),
    country_code CHAR(2), -- ISO 3166-1 alpha-2 country code
    
    -- Fiscal/Legal Information
    vat VARCHAR(50), -- Tax ID / RFC / NIF / VAT number
    
    -- Preferences
    lang VARCHAR(10) DEFAULT 'es', -- Language preference (ISO 639-1)
    tz VARCHAR(50) DEFAULT 'America/Mexico_City', -- Timezone
    
    -- Financial
    credit_limit DECIMAL(15, 2) DEFAULT 0.00,
    
    -- Additional Info
    comment TEXT, -- Notes/Comments
    avatar_url TEXT, -- Profile image URL
    birthdate DATE,
    barcode VARCHAR(100), -- For scanning/identification
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- Partner Categories Junction Table (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_category_rel (
    partner_id UUID NOT NULL REFERENCES public.partner(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.partner_category(id) ON DELETE CASCADE,
    PRIMARY KEY (partner_id, category_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Partner table indexes
CREATE INDEX idx_partner_user_id ON public.partner(user_id);
CREATE INDEX idx_partner_parent_id ON public.partner(parent_id);
CREATE INDEX idx_partner_company_type ON public.partner(company_type);
CREATE INDEX idx_partner_email ON public.partner(email);
CREATE INDEX idx_partner_name ON public.partner(name);
CREATE INDEX idx_partner_ref ON public.partner(ref);
CREATE INDEX idx_partner_vat ON public.partner(vat);
CREATE INDEX idx_partner_active ON public.partner(active);
CREATE INDEX idx_partner_country ON public.partner(country_code);
CREATE INDEX idx_partner_city ON public.partner(city);
CREATE INDEX idx_partner_created_at ON public.partner(created_at);

-- Full text search index for name
CREATE INDEX idx_partner_name_search ON public.partner USING gin(to_tsvector('spanish', name));

-- Composite indexes for common queries
CREATE INDEX idx_partner_active_company ON public.partner(active, is_company);
CREATE INDEX idx_partner_parent_active ON public.partner(parent_id, active);

-- Junction table indexes
CREATE INDEX idx_partner_category_rel_partner ON public.partner_category_rel(partner_id);
CREATE INDEX idx_partner_category_rel_category ON public.partner_category_rel(category_id);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for partner table
CREATE TRIGGER trigger_partner_updated_at
    BEFORE UPDATE ON public.partner
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for partner_category table
CREATE TRIGGER trigger_partner_category_updated_at
    BEFORE UPDATE ON public.partner_category
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Function to auto-generate display_name
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_partner_display_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
        IF NEW.parent_id IS NOT NULL THEN
            SELECT name INTO NEW.display_name 
            FROM public.partner 
            WHERE id = NEW.parent_id;
            
            IF NEW.display_name IS NOT NULL THEN
                NEW.display_name = NEW.name || ' (' || NEW.display_name || ')';
            ELSE
                NEW.display_name = NEW.name;
            END IF;
        ELSE
            NEW.display_name = NEW.name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_partner_display_name
    BEFORE INSERT OR UPDATE ON public.partner
    FOR EACH ROW
    EXECUTE FUNCTION generate_partner_display_name();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_category_rel ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own partner record
CREATE POLICY "Users can view own partner" ON public.partner
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can update their own partner record
CREATE POLICY "Users can update own partner" ON public.partner
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Authenticated users can view active partners (for directory)
CREATE POLICY "Authenticated users can view active partners" ON public.partner
    FOR SELECT
    USING (auth.role() = 'authenticated' AND active = true);

-- Policy: Categories are viewable by all authenticated users
CREATE POLICY "Categories viewable by authenticated users" ON public.partner_category
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Partner category relations follow partner access
CREATE POLICY "Category relations follow partner access" ON public.partner_category_rel
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.partner 
            WHERE id = partner_id 
            AND (user_id = auth.uid() OR active = true)
        )
    );

-- ============================================================================
-- Function to create partner profile on user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.partner (
        user_id,
        name,
        email,
        company_type,
        created_by
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        'person',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create partner on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Sample Data for Categories (optional - can be removed)
-- ============================================================================
INSERT INTO public.partner_category (name, color) VALUES
    ('Cliente', '#22c55e'),
    ('Proveedor', '#3b82f6'),
    ('Empleado', '#8b5cf6'),
    ('Prospecto', '#f59e0b'),
    ('VIP', '#ef4444')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.partner IS 'Partner/Contact table based on Odoo res.partner model';
COMMENT ON TABLE public.partner_category IS 'Categories/Tags for partners (like Odoo res.partner.category)';
COMMENT ON TABLE public.partner_category_rel IS 'Many-to-many relation between partners and categories';

COMMENT ON COLUMN public.partner.user_id IS 'Reference to Supabase auth.users';
COMMENT ON COLUMN public.partner.company_type IS 'Type of partner: person or company';
COMMENT ON COLUMN public.partner.is_company IS 'Computed field: true if company_type is company';
COMMENT ON COLUMN public.partner.parent_id IS 'Parent company for employees/contacts';
COMMENT ON COLUMN public.partner.ref IS 'Internal reference code';
COMMENT ON COLUMN public.partner.vat IS 'Tax ID / RFC / NIF / VAT number';
COMMENT ON COLUMN public.partner.lang IS 'Preferred language (ISO 639-1)';
COMMENT ON COLUMN public.partner.tz IS 'Preferred timezone';
COMMENT ON COLUMN public.partner.credit_limit IS 'Credit limit for financial operations';
