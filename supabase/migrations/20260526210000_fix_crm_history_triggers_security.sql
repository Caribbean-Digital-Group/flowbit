-- ============================================================================
-- Fix: CRM history trigger functions must run as SECURITY DEFINER
-- so they can INSERT into crm_history bypassing RLS (which is read-only
-- for regular users — the table is append-only via triggers).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.append_crm_lead_history()
RETURNS TRIGGER AS $$
DECLARE
    v_old_stage_name TEXT;
    v_new_stage      RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.crm_history(lead_id, event, new_value, created_by)
        VALUES (NEW.id, 'created', NEW.name, NEW.created_by);
        RETURN NEW;
    END IF;

    -- Stage change
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        SELECT name INTO v_old_stage_name
        FROM public.crm_lead_stage WHERE id = OLD.stage_id;

        SELECT name, is_won, is_lost INTO v_new_stage
        FROM public.crm_lead_stage WHERE id = NEW.stage_id;

        INSERT INTO public.crm_history(lead_id, event, old_value, new_value, created_by)
        VALUES (
            NEW.id,
            CASE
                WHEN v_new_stage.is_won  THEN 'closed_won'
                WHEN v_new_stage.is_lost THEN 'closed_lost'
                WHEN (
                    SELECT is_won OR is_lost
                    FROM public.crm_lead_stage
                    WHERE id = OLD.stage_id
                ) THEN 'reopened'
                ELSE 'stage_changed'
            END,
            v_old_stage_name,
            v_new_stage.name,
            NEW.updated_by
        );
    END IF;

    -- Responsible change
    IF OLD.responsible_partner_id IS DISTINCT FROM NEW.responsible_partner_id THEN
        INSERT INTO public.crm_history(lead_id, event, old_value, new_value, created_by)
        VALUES (
            NEW.id,
            'responsible_changed',
            (SELECT COALESCE(display_name, name) FROM public.partner WHERE id = OLD.responsible_partner_id),
            (SELECT COALESCE(display_name, name) FROM public.partner WHERE id = NEW.responsible_partner_id),
            NEW.updated_by
        );
    END IF;

    -- Priority change
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO public.crm_history(lead_id, event, old_value, new_value, created_by)
        VALUES (NEW.id, 'priority_changed', OLD.priority::TEXT, NEW.priority::TEXT, NEW.updated_by);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.append_crm_lead_order_history()
RETURNS TRIGGER AS $$
DECLARE
    v_order_ref TEXT;
BEGIN
    SELECT COALESCE(name, id::TEXT) INTO v_order_ref
    FROM public."order"
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.crm_history(lead_id, event, new_value, created_by)
        VALUES (NEW.lead_id, 'order_linked', v_order_ref, NEW.created_by);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.crm_history(lead_id, event, old_value, created_by)
        VALUES (OLD.lead_id, 'order_unlinked', v_order_ref, auth.uid());
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
