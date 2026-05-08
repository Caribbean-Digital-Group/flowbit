export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      company: {
        Row: {
          banner_url: string | null
          city: string | null
          company_size: Database["public"]["Enums"]["company_size"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          display_name: string | null
          email: string | null
          fiscal_regime: string | null
          founded_date: string | null
          id: string
          industry: string | null
          is_personal: boolean | null
          lang: string | null
          legal_name: string | null
          legal_representative: string | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          settings: Json | null
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"] | null
          street: string | null
          street2: string | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          banner_url?: string | null
          city?: string | null
          company_size?: Database["public"]["Enums"]["company_size"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          fiscal_regime?: string | null
          founded_date?: string | null
          id?: string
          industry?: string | null
          is_personal?: boolean | null
          lang?: string | null
          legal_name?: string | null
          legal_representative?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          street?: string | null
          street2?: string | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          banner_url?: string | null
          city?: string | null
          company_size?: Database["public"]["Enums"]["company_size"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          fiscal_regime?: string | null
          founded_date?: string | null
          id?: string
          industry?: string | null
          is_personal?: boolean | null
          lang?: string | null
          legal_name?: string | null
          legal_representative?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          settings?: Json | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          street?: string | null
          street2?: string | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      order: {
        Row: {
          amount_discount: number | null
          amount_tax: number | null
          amount_total: number | null
          amount_untaxed: number | null
          company_id: string
          confirmation_date: string | null
          created_at: string | null
          created_by: string | null
          created_by_partner_id: string | null
          currency: string
          delivery_date: string | null
          exchange_rate: number | null
          id: string
          is_delivered: boolean | null
          is_invoiced: boolean | null
          is_paid: boolean | null
          name: string | null
          notes: string | null
          order_date: string
          order_state: Database["public"]["Enums"]["order_state"]
          order_type: Database["public"]["Enums"]["order_type"]
          partner_id: string
          payment_due_date: string | null
          payment_term: string | null
          reference: string | null
          shipping_city: string | null
          shipping_country_code: string | null
          shipping_state: string | null
          shipping_street: string | null
          shipping_street2: string | null
          shipping_zip: string | null
          tax_included: boolean | null
          tax_rate: number | null
          terms: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount_discount?: number | null
          amount_tax?: number | null
          amount_total?: number | null
          amount_untaxed?: number | null
          company_id: string
          confirmation_date?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_partner_id?: string | null
          currency?: string
          delivery_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_delivered?: boolean | null
          is_invoiced?: boolean | null
          is_paid?: boolean | null
          name?: string | null
          notes?: string | null
          order_date?: string
          order_state?: Database["public"]["Enums"]["order_state"]
          order_type?: Database["public"]["Enums"]["order_type"]
          partner_id: string
          payment_due_date?: string | null
          payment_term?: string | null
          reference?: string | null
          shipping_city?: string | null
          shipping_country_code?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_street2?: string | null
          shipping_zip?: string | null
          tax_included?: boolean | null
          tax_rate?: number | null
          terms?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount_discount?: number | null
          amount_tax?: number | null
          amount_total?: number | null
          amount_untaxed?: number | null
          company_id?: string
          confirmation_date?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_partner_id?: string | null
          currency?: string
          delivery_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_delivered?: boolean | null
          is_invoiced?: boolean | null
          is_paid?: boolean | null
          name?: string | null
          notes?: string | null
          order_date?: string
          order_state?: Database["public"]["Enums"]["order_state"]
          order_type?: Database["public"]["Enums"]["order_type"]
          partner_id?: string
          payment_due_date?: string | null
          payment_term?: string | null
          reference?: string | null
          shipping_city?: string | null
          shipping_country_code?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_street2?: string | null
          shipping_zip?: string | null
          tax_included?: boolean | null
          tax_rate?: number | null
          terms?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_created_by_partner_id_fkey"
            columns: ["created_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line: {
        Row: {
          created_at: string | null
          description: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          margin: number | null
          margin_percent: number | null
          order_id: string
          product_id: string | null
          quantity: number
          quantity_delivered: number | null
          quantity_invoiced: number | null
          sequence: number | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          unit_cost: number | null
          unit_price: number
          uom_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          margin?: number | null
          margin_percent?: number | null
          order_id: string
          product_id?: string | null
          quantity?: number
          quantity_delivered?: number | null
          quantity_invoiced?: number | null
          sequence?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          unit_cost?: number | null
          unit_price?: number
          uom_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          margin?: number | null
          margin_percent?: number | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          quantity_delivered?: number | null
          quantity_invoiced?: number | null
          sequence?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          unit_cost?: number | null
          unit_price?: number
          uom_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
        ]
      }
      partner: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          barcode: string | null
          birthdate: string | null
          city: string | null
          comment: string | null
          company_type: Database["public"]["Enums"]["partner_type"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          display_name: string | null
          email: string | null
          function: string | null
          id: string
          is_company: boolean | null
          lang: string | null
          mobile: string | null
          name: string
          parent_id: string | null
          phone: string | null
          ref: string | null
          state: string | null
          street: string | null
          street2: string | null
          title: Database["public"]["Enums"]["partner_title"] | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          barcode?: string | null
          birthdate?: string | null
          city?: string | null
          comment?: string | null
          company_type?: Database["public"]["Enums"]["partner_type"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          display_name?: string | null
          email?: string | null
          function?: string | null
          id?: string
          is_company?: boolean | null
          lang?: string | null
          mobile?: string | null
          name: string
          parent_id?: string | null
          phone?: string | null
          ref?: string | null
          state?: string | null
          street?: string | null
          street2?: string | null
          title?: Database["public"]["Enums"]["partner_title"] | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          barcode?: string | null
          birthdate?: string | null
          city?: string | null
          comment?: string | null
          company_type?: Database["public"]["Enums"]["partner_type"] | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          display_name?: string | null
          email?: string | null
          function?: string | null
          id?: string
          is_company?: boolean | null
          lang?: string | null
          mobile?: string | null
          name?: string
          parent_id?: string | null
          phone?: string | null
          ref?: string | null
          state?: string | null
          street?: string | null
          street2?: string | null
          title?: Database["public"]["Enums"]["partner_title"] | null
          tz?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_category: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "partner_category"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_category_rel: {
        Row: {
          category_id: string
          partner_id: string
        }
        Insert: {
          category_id: string
          partner_id: string
        }
        Update: {
          category_id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_category_rel_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "partner_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_category_rel_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      picking: {
        Row: {
          active: boolean | null
          cancelled_at: string | null
          company_id: string
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_return: boolean | null
          name: string | null
          notes: string | null
          order_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["picking_status"]
          type: Database["public"]["Enums"]["picking_type"]
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          active?: boolean | null
          cancelled_at?: string | null
          company_id: string
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_return?: boolean | null
          name?: string | null
          notes?: string | null
          order_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["picking_status"]
          type: Database["public"]["Enums"]["picking_type"]
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          active?: boolean | null
          cancelled_at?: string | null
          company_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_return?: boolean | null
          name?: string | null
          notes?: string | null
          order_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["picking_status"]
          type?: Database["public"]["Enums"]["picking_type"]
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_line: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          lot_name: string | null
          picking_id: string
          product_id: string
          quantity: number
          sequence: number | null
          serial_number: string | null
          tracking_type: Database["public"]["Enums"]["product_tracking"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lot_name?: string | null
          picking_id: string
          product_id: string
          quantity?: number
          sequence?: number | null
          serial_number?: string | null
          tracking_type?: Database["public"]["Enums"]["product_tracking"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lot_name?: string | null
          picking_id?: string
          product_id?: string
          quantity?: number
          sequence?: number | null
          serial_number?: string | null
          tracking_type?: Database["public"]["Enums"]["product_tracking"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          attributes: Json | null
          barcode: string | null
          can_be_purchased: boolean | null
          can_be_sold: boolean | null
          category_id: string | null
          company_id: string
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          default_supplier_id: string | null
          description: string | null
          display_name: string | null
          featured: boolean | null
          height: number | null
          id: string
          image_url: string | null
          images: Json | null
          internal_ref: string | null
          is_published: boolean | null
          is_stockable: boolean | null
          lead_time: number | null
          length: number | null
          list_price: number | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          name: string
          notes: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          purchase_uom_id: string | null
          sale_price: number | null
          short_description: string | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock_max: number | null
          stock_min: number | null
          stock_quantity: number | null
          supplier_sku: string | null
          tags: string[] | null
          tax_included: boolean | null
          tax_rate: number | null
          tracking: Database["public"]["Enums"]["product_tracking"] | null
          uom_id: string | null
          updated_at: string | null
          updated_by: string | null
          volume: number | null
          weight: number | null
          weight_unit: string | null
          width: number | null
        }
        Insert: {
          attributes?: Json | null
          barcode?: string | null
          can_be_purchased?: boolean | null
          can_be_sold?: boolean | null
          category_id?: string | null
          company_id: string
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_supplier_id?: string | null
          description?: string | null
          display_name?: string | null
          featured?: boolean | null
          height?: number | null
          id?: string
          image_url?: string | null
          images?: Json | null
          internal_ref?: string | null
          is_published?: boolean | null
          is_stockable?: boolean | null
          lead_time?: number | null
          length?: number | null
          list_price?: number | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          name: string
          notes?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_uom_id?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock_max?: number | null
          stock_min?: number | null
          stock_quantity?: number | null
          supplier_sku?: string | null
          tags?: string[] | null
          tax_included?: boolean | null
          tax_rate?: number | null
          tracking?: Database["public"]["Enums"]["product_tracking"] | null
          uom_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          volume?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Update: {
          attributes?: Json | null
          barcode?: string | null
          can_be_purchased?: boolean | null
          can_be_sold?: boolean | null
          category_id?: string | null
          company_id?: string
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_supplier_id?: string | null
          description?: string | null
          display_name?: string | null
          featured?: boolean | null
          height?: number | null
          id?: string
          image_url?: string | null
          images?: Json | null
          internal_ref?: string | null
          is_published?: boolean | null
          is_stockable?: boolean | null
          lead_time?: number | null
          length?: number | null
          list_price?: number | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          name?: string
          notes?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_uom_id?: string | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"] | null
          stock_max?: number | null
          stock_min?: number | null
          stock_quantity?: number | null
          supplier_sku?: string | null
          tags?: string[] | null
          tax_included?: boolean | null
          tax_rate?: number | null
          tracking?: Database["public"]["Enums"]["product_tracking"] | null
          uom_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          volume?: number | null
          weight?: number | null
          weight_unit?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category: {
        Row: {
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_category"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricelist: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          currency: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          currency?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricelist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricelist_item: {
        Row: {
          created_at: string | null
          discount_percent: number | null
          end_date: string | null
          id: string
          min_quantity: number | null
          price: number
          pricelist_id: string
          product_id: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          min_quantity?: number | null
          price: number
          pricelist_id: string
          product_id: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discount_percent?: number | null
          end_date?: string | null
          id?: string
          min_quantity?: number | null
          price?: number
          pricelist_id?: string
          product_id?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricelist_item_pricelist_id_fkey"
            columns: ["pricelist_id"]
            isOneToOne: false
            referencedRelation: "product_pricelist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricelist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricelist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricelist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_uom: {
        Row: {
          category: string | null
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          ratio: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          ratio?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          ratio?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_uom_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      project: {
        Row: {
          active: boolean | null
          budget_actual: number | null
          budget_estimated: number | null
          code: string | null
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date_actual: string | null
          end_date_estimated: string | null
          id: string
          name: string
          notes: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          progress: number | null
          project_type_id: string | null
          responsible_partner_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          budget_actual?: number | null
          budget_estimated?: number | null
          code?: string | null
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date_actual?: string | null
          end_date_estimated?: string | null
          id?: string
          name: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_type_id?: string | null
          responsible_partner_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          budget_actual?: number | null
          budget_estimated?: number | null
          code?: string | null
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date_actual?: string | null
          end_date_estimated?: string | null
          id?: string
          name?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_type_id?: string | null
          responsible_partner_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task: {
        Row: {
          active: boolean | null
          actual_cost: number | null
          actual_hours: number | null
          code: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          estimated_hours: number | null
          id: string
          name: string
          notes: string | null
          order_index: number | null
          priority: Database["public"]["Enums"]["project_priority"]
          progress: number | null
          project_id: string
          responsible_partner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_task_status"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          actual_cost?: number | null
          actual_hours?: number | null
          code?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_id: string
          responsible_partner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_task_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          actual_cost?: number | null
          actual_hours?: number | null
          code?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_hours?: number | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number | null
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number | null
          project_id?: string
          responsible_partner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_task_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      project_type: {
        Row: {
          active: boolean | null
          code: string
          color: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          color?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          color?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_type_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_partner_company: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string | null
          id: string
          invitation_status:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          is_default: boolean | null
          partner_id: string
          permissions: Json | null
          role: Database["public"]["Enums"]["partner_company_role"] | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          partner_id: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["partner_company_role"] | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          partner_id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["partner_company_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_partner_company_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_partner_company_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_partner_company_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse: {
        Row: {
          active: boolean | null
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_low_stock_products: {
        Row: {
          company_id: string | null
          company_name: string | null
          default_supplier_id: string | null
          id: string | null
          name: string | null
          quantity_needed: number | null
          sku: string | null
          stock_max: number | null
          stock_min: number | null
          stock_quantity: number | null
          supplier_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_lines: {
        Row: {
          company_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string | null
          margin: number | null
          margin_percent: number | null
          order_id: string | null
          order_name: string | null
          order_state: Database["public"]["Enums"]["order_state"] | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          partner_id: string | null
          product_barcode: string | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number | null
          quantity_delivered: number | null
          quantity_invoiced: number | null
          sequence: number | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          unit_cost: number | null
          unit_price: number | null
          uom_code: string | null
          uom_id: string | null
          uom_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_orders: {
        Row: {
          amount_discount: number | null
          amount_tax: number | null
          amount_total: number | null
          amount_untaxed: number | null
          company_currency: string | null
          company_id: string | null
          company_name: string | null
          confirmation_date: string | null
          created_at: string | null
          created_by: string | null
          created_by_partner_id: string | null
          created_by_partner_name: string | null
          currency: string | null
          delivery_date: string | null
          exchange_rate: number | null
          id: string | null
          is_delivered: boolean | null
          is_invoiced: boolean | null
          is_paid: boolean | null
          line_count: number | null
          name: string | null
          notes: string | null
          order_date: string | null
          order_state: Database["public"]["Enums"]["order_state"] | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          partner_email: string | null
          partner_id: string | null
          partner_name: string | null
          partner_vat: string | null
          payment_due_date: string | null
          payment_term: string | null
          reference: string | null
          shipping_city: string | null
          shipping_country_code: string | null
          shipping_state: string | null
          shipping_street: string | null
          shipping_street2: string | null
          shipping_zip: string | null
          tax_included: boolean | null
          tax_rate: number | null
          terms: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_created_by_partner_id_fkey"
            columns: ["created_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_partner_companies: {
        Row: {
          accepted_at: string | null
          company_display_name: string | null
          company_id: string | null
          company_is_personal: boolean | null
          company_logo: string | null
          company_name: string | null
          company_status: Database["public"]["Enums"]["company_status"] | null
          invitation_status:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          is_active: boolean | null
          is_default: boolean | null
          partner_email: string | null
          partner_id: string | null
          partner_name: string | null
          relationship_id: string | null
          role: Database["public"]["Enums"]["partner_company_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_partner_company_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_partner_company_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_picking_lines: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          lot_name: string | null
          order_id: string | null
          order_name: string | null
          picking_id: string | null
          picking_name: string | null
          picking_status: Database["public"]["Enums"]["picking_status"] | null
          picking_type: Database["public"]["Enums"]["picking_type"] | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number | null
          sequence: number | null
          serial_number: string | null
          tracking_type: Database["public"]["Enums"]["product_tracking"] | null
          updated_at: string | null
          updated_by: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_line_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "picking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_picking_id_fkey"
            columns: ["picking_id"]
            isOneToOne: false
            referencedRelation: "v_pickings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pickings: {
        Row: {
          active: boolean | null
          cancelled_at: string | null
          company_id: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_return: boolean | null
          line_count: number | null
          name: string | null
          notes: string | null
          order_id: string | null
          order_name: string | null
          order_state: Database["public"]["Enums"]["order_state"] | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          published_at: string | null
          status: Database["public"]["Enums"]["picking_status"] | null
          total_quantity: number | null
          type: Database["public"]["Enums"]["picking_type"] | null
          updated_at: string | null
          updated_by: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      v_products: {
        Row: {
          attributes: Json | null
          barcode: string | null
          can_be_purchased: boolean | null
          can_be_sold: boolean | null
          category_id: string | null
          category_name: string | null
          company_id: string | null
          company_name: string | null
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          default_supplier_id: string | null
          description: string | null
          display_name: string | null
          featured: boolean | null
          height: number | null
          id: string | null
          image_url: string | null
          images: Json | null
          internal_ref: string | null
          is_published: boolean | null
          is_stockable: boolean | null
          lead_time: number | null
          length: number | null
          list_price: number | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          name: string | null
          notes: string | null
          product_type: Database["public"]["Enums"]["product_type"] | null
          purchase_uom_code: string | null
          purchase_uom_id: string | null
          purchase_uom_name: string | null
          sale_price: number | null
          short_description: string | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock_max: number | null
          stock_min: number | null
          stock_quantity: number | null
          supplier_name: string | null
          supplier_sku: string | null
          tags: string[] | null
          tax_included: boolean | null
          tax_rate: number | null
          tracking: Database["public"]["Enums"]["product_tracking"] | null
          uom_code: string | null
          uom_id: string | null
          uom_name: string | null
          updated_at: string | null
          updated_by: string | null
          volume: number | null
          weight: number | null
          weight_unit: string | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "product_uom"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_tasks: {
        Row: {
          active: boolean | null
          actual_cost: number | null
          actual_hours: number | null
          code: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          days_until_due: number | null
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          estimated_hours: number | null
          id: string | null
          is_overdue: boolean | null
          name: string | null
          notes: string | null
          order_index: number | null
          priority: Database["public"]["Enums"]["project_priority"] | null
          progress: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          project_status: Database["public"]["Enums"]["project_status"] | null
          responsible_avatar_url: string | null
          responsible_display_name: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_partner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_task_status"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_projects: {
        Row: {
          active: boolean | null
          budget_actual: number | null
          budget_estimated: number | null
          code: string | null
          color: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          days_remaining: number | null
          description: string | null
          end_date_actual: string | null
          end_date_estimated: string | null
          id: string | null
          is_overdue: boolean | null
          name: string | null
          notes: string | null
          overdue_task_count: number | null
          priority: Database["public"]["Enums"]["project_priority"] | null
          progress: number | null
          project_type_code: string | null
          project_type_color: string | null
          project_type_id: string | null
          project_type_name: string | null
          responsible_avatar_url: string | null
          responsible_display_name: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_partner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          task_cancelled_count: number | null
          task_completed_count: number | null
          task_count: number | null
          task_in_progress_count: number | null
          task_pending_count: number | null
          total_actual_hours: number | null
          total_estimated_hours: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_responsible_partner_id_fkey"
            columns: ["responsible_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_purchases_by_supplier: {
        Row: {
          company_id: string | null
          first_order_date: string | null
          last_order_date: string | null
          order_count: number | null
          partner_id: string | null
          supplier_name: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sales_by_partner: {
        Row: {
          company_id: string | null
          first_order_date: string | null
          last_order_date: string | null
          order_count: number | null
          partner_id: string | null
          partner_name: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_order_line: {
        Args: {
          p_description?: string
          p_discount_percent?: number
          p_order_id: string
          p_product_id?: string
          p_quantity?: number
          p_tax_rate?: number
          p_unit_cost?: number
          p_unit_price?: number
        }
        Returns: string
      }
      apply_picking_inventory: {
        Args: { p_picking_id: string }
        Returns: boolean
      }
      cancel_order: { Args: { p_order_id: string }; Returns: boolean }
      create_order: {
        Args: {
          p_company_id: string
          p_currency?: string
          p_order_type: Database["public"]["Enums"]["order_type"]
          p_partner_id: string
          p_tax_rate?: number
        }
        Returns: string
      }
      create_partner_for_company: {
        Args: { p_company_id: string; p_partner: Json }
        Returns: {
          active: boolean | null
          avatar_url: string | null
          barcode: string | null
          birthdate: string | null
          city: string | null
          comment: string | null
          company_type: Database["public"]["Enums"]["partner_type"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          display_name: string | null
          email: string | null
          function: string | null
          id: string
          is_company: boolean | null
          lang: string | null
          mobile: string | null
          name: string
          parent_id: string | null
          phone: string | null
          ref: string | null
          state: string | null
          street: string | null
          street2: string | null
          title: Database["public"]["Enums"]["partner_title"] | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partner"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_default_warehouse: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_partner_companies: {
        Args: { p_partner_id: string }
        Returns: {
          company_id: string
          invitation_status: string
          is_default: boolean
          role: string
        }[]
      }
      invite_partner_to_company: {
        Args: {
          p_company_id: string
          p_invited_by?: string
          p_partner_id: string
          p_role?: Database["public"]["Enums"]["partner_company_role"]
        }
        Returns: string
      }
      is_company_admin: { Args: { p_company_id: string }; Returns: boolean }
      is_company_member: { Args: { p_company_id: string }; Returns: boolean }
      is_own_partner: { Args: { p_partner_id: string }; Returns: boolean }
      post_order: { Args: { p_order_id: string }; Returns: boolean }
      preview_order_stock_shortages: {
        Args: { p_order_id: string }
        Returns: {
          available: number
          product_id: string
          product_name: string
          requested: number
        }[]
      }
      recompute_project_metrics: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      respond_to_invitation: {
        Args: { p_accept: boolean; p_rel_id: string }
        Returns: boolean
      }
      seed_product_uoms: { Args: { p_company_id: string }; Returns: undefined }
      set_picking_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["picking_status"]
          p_picking_id: string
        }
        Returns: boolean
      }
      set_project_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["project_status"]
          p_project_id: string
        }
        Returns: boolean
      }
      set_project_task_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["project_task_status"]
          p_task_id: string
        }
        Returns: boolean
      }
      sync_order_to_draft_picking: {
        Args: { p_is_return?: boolean; p_order_id: string }
        Returns: string
      }
      update_partner_for_company: {
        Args: { p_partner_id: string; p_updates: Json }
        Returns: {
          active: boolean | null
          avatar_url: string | null
          barcode: string | null
          birthdate: string | null
          city: string | null
          comment: string | null
          company_type: Database["public"]["Enums"]["partner_type"] | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          display_name: string | null
          email: string | null
          function: string | null
          id: string
          is_company: boolean | null
          lang: string | null
          mobile: string | null
          name: string
          parent_id: string | null
          phone: string | null
          ref: string | null
          state: string | null
          street: string | null
          street2: string | null
          title: Database["public"]["Enums"]["partner_title"] | null
          tz: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          vat: string | null
          website: string | null
          zip: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partner"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_belongs_to_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      company_size: "micro" | "small" | "medium" | "large" | "enterprise"
      company_status:
        | "active"
        | "inactive"
        | "suspended"
        | "pending_verification"
      invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      order_state: "draft" | "posted" | "cancel"
      order_type: "purchase" | "sale"
      partner_company_role: "owner" | "admin" | "member" | "viewer" | "guest"
      partner_title: "mr" | "mrs" | "ms" | "dr" | "prof" | "other"
      partner_type: "person" | "company"
      picking_status: "borrador" | "publicado" | "confirmado" | "cancelado"
      picking_type: "entrada" | "salida"
      product_status:
        | "active"
        | "inactive"
        | "discontinued"
        | "out_of_stock"
        | "coming_soon"
      product_tracking: "none" | "lot" | "serial"
      product_type: "product" | "service" | "others"
      project_priority: "low" | "medium" | "high" | "urgent"
      project_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "paused"
        | "cancelled"
      project_task_status: "pending" | "in_progress" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      company_size: ["micro", "small", "medium", "large", "enterprise"],
      company_status: [
        "active",
        "inactive",
        "suspended",
        "pending_verification",
      ],
      invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      order_state: ["draft", "posted", "cancel"],
      order_type: ["purchase", "sale"],
      partner_company_role: ["owner", "admin", "member", "viewer", "guest"],
      partner_title: ["mr", "mrs", "ms", "dr", "prof", "other"],
      partner_type: ["person", "company"],
      picking_status: ["borrador", "publicado", "confirmado", "cancelado"],
      picking_type: ["entrada", "salida"],
      product_status: [
        "active",
        "inactive",
        "discontinued",
        "out_of_stock",
        "coming_soon",
      ],
      product_tracking: ["none", "lot", "serial"],
      product_type: ["product", "service", "others"],
      project_priority: ["low", "medium", "high", "urgent"],
      project_status: [
        "pending",
        "in_progress",
        "completed",
        "paused",
        "cancelled",
      ],
      project_task_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
