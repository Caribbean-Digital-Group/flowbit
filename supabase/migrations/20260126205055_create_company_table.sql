-- ============================================================================
-- Migration: Create Company Table and Partner-Company Relationship
-- Organization management with multi-tenant support
-- ============================================================================

-- Create ENUM types for company and relationships
CREATE TYPE company_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
CREATE TYPE company_size AS ENUM ('micro', 'small', 'medium', 'large', 'enterprise');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'cancelled');
CREATE TYPE partner_company_role AS ENUM ('owner', 'admin', 'member', 'viewer', 'guest');

-- ============================================================================
-- Company Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.company (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    legal_name VARCHAR(255), -- Razón social
    slug VARCHAR(100) UNIQUE, -- URL-friendly identifier
    
    -- Brand/Identity
    logo_url TEXT,
    banner_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for branding
    
    -- Contact Information
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Address Information
    street VARCHAR(255),
    street2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    zip VARCHAR(20),
    country_code CHAR(2) DEFAULT 'MX', -- ISO 3166-1 alpha-2 country code
    
    -- Fiscal/Legal Information
    vat VARCHAR(50), -- Tax ID / RFC / NIF / VAT number
    fiscal_regime VARCHAR(100), -- Régimen fiscal
    legal_representative VARCHAR(255),
    
    -- Company Details
    industry VARCHAR(100),
    company_size company_size DEFAULT 'micro',
    founded_date DATE,
    description TEXT,
    
    -- Preferences
    lang VARCHAR(10) DEFAULT 'es', -- Language preference (ISO 639-1)
    tz VARCHAR(50) DEFAULT 'America/Mexico_City', -- Timezone
    currency VARCHAR(3) DEFAULT 'MXN', -- ISO 4217 currency code
    
    -- Status
    status company_status DEFAULT 'active',
    is_personal BOOLEAN DEFAULT false, -- Personal workspace vs organization
    
    -- Settings (JSON for flexibility)
    settings JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- Partner-Company Relationship Table (Pivot Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rel_partner_company (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    partner_id UUID NOT NULL REFERENCES public.partner(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    
    -- Relationship Details
    role partner_company_role DEFAULT 'member',
    invitation_status invitation_status DEFAULT 'accepted',
    
    -- Invitation Details
    invited_by UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    
    -- Permissions (granular control)
    permissions JSONB DEFAULT '{}',
    
    -- Status
    is_default BOOLEAN DEFAULT false, -- Default company for this partner
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint: one relationship per partner-company pair
    UNIQUE (partner_id, company_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Company table indexes
CREATE INDEX idx_company_name ON public.company(name);
CREATE INDEX idx_company_slug ON public.company(slug);
CREATE INDEX idx_company_email ON public.company(email);
CREATE INDEX idx_company_vat ON public.company(vat);
CREATE INDEX idx_company_status ON public.company(status);
CREATE INDEX idx_company_country ON public.company(country_code);
CREATE INDEX idx_company_created_at ON public.company(created_at);
CREATE INDEX idx_company_is_personal ON public.company(is_personal);

-- Full text search index for company name
CREATE INDEX idx_company_name_search ON public.company USING gin(to_tsvector('spanish', name));

-- Composite indexes for common queries
CREATE INDEX idx_company_status_active ON public.company(status) WHERE status = 'active';

-- Relationship table indexes
CREATE INDEX idx_rel_partner_company_partner ON public.rel_partner_company(partner_id);
CREATE INDEX idx_rel_partner_company_company ON public.rel_partner_company(company_id);
CREATE INDEX idx_rel_partner_company_role ON public.rel_partner_company(role);
CREATE INDEX idx_rel_partner_company_status ON public.rel_partner_company(invitation_status);
CREATE INDEX idx_rel_partner_company_default ON public.rel_partner_company(partner_id, is_default) WHERE is_default = true;
CREATE INDEX idx_rel_partner_company_active ON public.rel_partner_company(is_active);

-- Composite indexes for common queries
CREATE INDEX idx_rel_partner_company_accepted ON public.rel_partner_company(partner_id, invitation_status) 
    WHERE invitation_status = 'accepted';

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Trigger for company table
CREATE TRIGGER trigger_company_updated_at
    BEFORE UPDATE ON public.company
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for rel_partner_company table
CREATE TRIGGER trigger_rel_partner_company_updated_at
    BEFORE UPDATE ON public.rel_partner_company
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Function to auto-generate company display_name and slug
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_company_display_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate display_name if not provided
    IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
        NEW.display_name = NEW.name;
    END IF;
    
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

CREATE TRIGGER trigger_company_display_name
    BEFORE INSERT OR UPDATE ON public.company
    FOR EACH ROW
    EXECUTE FUNCTION generate_company_display_name();

-- ============================================================================
-- Function to set accepted_at when invitation is accepted
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_invitation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invitation_status = 'accepted' AND OLD.invitation_status != 'accepted' THEN
        NEW.accepted_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invitation_accepted
    BEFORE UPDATE ON public.rel_partner_company
    FOR EACH ROW
    EXECUTE FUNCTION handle_invitation_status_change();

-- ============================================================================
-- Function to ensure only one default company per partner
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_single_default_company()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Unset other defaults for this partner
        UPDATE public.rel_partner_company
        SET is_default = false
        WHERE partner_id = NEW.partner_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_default_company
    BEFORE INSERT OR UPDATE ON public.rel_partner_company
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_company();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rel_partner_company ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view companies they belong to
CREATE POLICY "Users can view their companies" ON public.company
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.rel_partner_company rpc
            JOIN public.partner p ON p.id = rpc.partner_id
            WHERE rpc.company_id = company.id
              AND p.user_id = auth.uid()
              AND rpc.invitation_status = 'accepted'
              AND rpc.is_active = true
        )
    );

-- Policy: Owners and admins can update their companies
CREATE POLICY "Owners and admins can update companies" ON public.company
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.rel_partner_company rpc
            JOIN public.partner p ON p.id = rpc.partner_id
            WHERE rpc.company_id = company.id
              AND p.user_id = auth.uid()
              AND rpc.role IN ('owner', 'admin')
              AND rpc.invitation_status = 'accepted'
              AND rpc.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rel_partner_company rpc
            JOIN public.partner p ON p.id = rpc.partner_id
            WHERE rpc.company_id = company.id
              AND p.user_id = auth.uid()
              AND rpc.role IN ('owner', 'admin')
              AND rpc.invitation_status = 'accepted'
              AND rpc.is_active = true
        )
    );

-- Policy: Authenticated users can create companies
CREATE POLICY "Authenticated users can create companies" ON public.company
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can view their own relationships
CREATE POLICY "Users can view own relationships" ON public.rel_partner_company
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.partner p
            WHERE p.id = rel_partner_company.partner_id
              AND p.user_id = auth.uid()
        )
    );

-- Policy: Owners and admins can manage relationships in their companies
CREATE POLICY "Owners and admins can manage relationships" ON public.rel_partner_company
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.rel_partner_company rpc
            JOIN public.partner p ON p.id = rpc.partner_id
            WHERE rpc.company_id = rel_partner_company.company_id
              AND p.user_id = auth.uid()
              AND rpc.role IN ('owner', 'admin')
              AND rpc.invitation_status = 'accepted'
              AND rpc.is_active = true
        )
    );

-- Policy: Users can update their own invitation status (accept/reject)
CREATE POLICY "Users can respond to invitations" ON public.rel_partner_company
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.partner p
            WHERE p.id = rel_partner_company.partner_id
              AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.partner p
            WHERE p.id = rel_partner_company.partner_id
              AND p.user_id = auth.uid()
        )
    );

-- ============================================================================
-- Update handle_new_user function to create default company
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_partner_id UUID;
    new_company_id UUID;
    user_name VARCHAR(255);
BEGIN
    -- Get user name from metadata or email
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    
    -- Create partner record
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
    )
    RETURNING id INTO new_partner_id;
    
    -- Create default personal company/workspace
    INSERT INTO public.company (
        name,
        display_name,
        email,
        is_personal,
        status,
        created_by
    ) VALUES (
        user_name || '''s Workspace',
        user_name || '''s Workspace',
        NEW.email,
        true,
        'active',
        NEW.id
    )
    RETURNING id INTO new_company_id;
    
    -- Create relationship between partner and company as owner
    INSERT INTO public.rel_partner_company (
        partner_id,
        company_id,
        role,
        invitation_status,
        accepted_at,
        is_default,
        is_active
    ) VALUES (
        new_partner_id,
        new_company_id,
        'owner',
        'accepted',
        now(),
        true,
        true
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper function to invite a partner to a company
-- ============================================================================
CREATE OR REPLACE FUNCTION public.invite_partner_to_company(
    p_partner_id UUID,
    p_company_id UUID,
    p_role partner_company_role DEFAULT 'member',
    p_invited_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_rel_id UUID;
BEGIN
    INSERT INTO public.rel_partner_company (
        partner_id,
        company_id,
        role,
        invitation_status,
        invited_by,
        invited_at,
        is_default,
        is_active
    ) VALUES (
        p_partner_id,
        p_company_id,
        p_role,
        'pending',
        p_invited_by,
        now(),
        false,
        true
    )
    RETURNING id INTO new_rel_id;
    
    RETURN new_rel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper function to accept/reject invitation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.respond_to_invitation(
    p_rel_id UUID,
    p_accept BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.rel_partner_company
    SET invitation_status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END
    WHERE id = p_rel_id
      AND invitation_status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- View for easy access to partner's companies
-- ============================================================================
CREATE OR REPLACE VIEW public.v_partner_companies AS
SELECT 
    rpc.id AS relationship_id,
    rpc.partner_id,
    rpc.company_id,
    rpc.role,
    rpc.invitation_status,
    rpc.is_default,
    rpc.is_active,
    rpc.accepted_at,
    c.name AS company_name,
    c.display_name AS company_display_name,
    c.logo_url AS company_logo,
    c.is_personal AS company_is_personal,
    c.status AS company_status,
    p.name AS partner_name,
    p.email AS partner_email
FROM public.rel_partner_company rpc
JOIN public.company c ON c.id = rpc.company_id
JOIN public.partner p ON p.id = rpc.partner_id
WHERE rpc.is_active = true;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.company IS 'Company/Organization table for multi-tenant support';
COMMENT ON TABLE public.rel_partner_company IS 'Many-to-many relation between partners and companies with roles';

COMMENT ON COLUMN public.company.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN public.company.is_personal IS 'True if this is a personal workspace, not an organization';
COMMENT ON COLUMN public.company.settings IS 'JSON settings for company preferences';
COMMENT ON COLUMN public.company.vat IS 'Tax ID / RFC / NIF / VAT number';

COMMENT ON COLUMN public.rel_partner_company.role IS 'Role of the partner in the company: owner, admin, member, viewer, guest';
COMMENT ON COLUMN public.rel_partner_company.invitation_status IS 'Status of the invitation: pending, accepted, rejected, expired, cancelled';
COMMENT ON COLUMN public.rel_partner_company.is_default IS 'If true, this is the default company for the partner';
COMMENT ON COLUMN public.rel_partner_company.permissions IS 'JSON object with granular permissions';

COMMENT ON FUNCTION public.invite_partner_to_company IS 'Helper function to invite a partner to join a company';
COMMENT ON FUNCTION public.respond_to_invitation IS 'Helper function to accept or reject an invitation';
COMMENT ON VIEW public.v_partner_companies IS 'View showing all partner-company relationships with details';
