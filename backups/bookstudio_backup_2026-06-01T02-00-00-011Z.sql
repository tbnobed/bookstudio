--
-- PostgreSQL database dump
--

\restrict g55Wz2XjBZyOcaDdbBRUprmwJY8LfbfKv2Pkn0vtMaCYBZe0xfuqHc8ZWpEezL6

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

-- Started on 2026-06-01 02:00:00 UTC

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE heliumdb;
--
-- TOC entry 3871 (class 1262 OID 24576)
-- Name: heliumdb; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE heliumdb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE heliumdb OWNER TO postgres;

\unrestrict g55Wz2XjBZyOcaDdbBRUprmwJY8LfbfKv2Pkn0vtMaCYBZe0xfuqHc8ZWpEezL6
\connect heliumdb
\restrict g55Wz2XjBZyOcaDdbBRUprmwJY8LfbfKv2Pkn0vtMaCYBZe0xfuqHc8ZWpEezL6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 284 (class 1255 OID 24577)
-- Name: copy_booking_to_multiple_dates(integer, date[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.copy_booking_to_multiple_dates(booking_id integer, dates date[]) RETURNS TABLE(id integer)
    LANGUAGE plpgsql
    AS $$
      DECLARE
        orig_title TEXT;
        orig_description TEXT;
        orig_type TEXT;
        orig_user_id INTEGER;
        orig_studio_id INTEGER;
        orig_pcr_room_id INTEGER;
        orig_severity TEXT;
        orig_template_id INTEGER;
        orig_notify_list JSONB;
        orig_start TIMESTAMP;
        orig_end TIMESTAMP;
        time_diff INTERVAL;
        new_start TIMESTAMP;
        new_end TIMESTAMP;
        new_id INTEGER;
        target_date DATE;
        studio_id_item INTEGER;
        studio_ids INTEGER[];
        has_conflict BOOLEAN;
      BEGIN
        -- Get original booking data as separate variables
        SELECT 
          title, description, type, user_id, studio_id, pcr_room_id, 
          severity, template_id, notify_list, start, "end"
        INTO 
          orig_title, orig_description, orig_type, orig_user_id, orig_studio_id, 
          orig_pcr_room_id, orig_severity, orig_template_id, orig_notify_list, 
          orig_start, orig_end
        FROM bookings 
        WHERE id = booking_id;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Booking with ID % not found', booking_id;
          RETURN;
        END IF;
        
        -- Get associated studios
        SELECT array_agg(studio_id) INTO studio_ids
        FROM booking_studios
        WHERE booking_id = booking_id;
        
        -- Calculate time difference
        time_diff := orig_end - orig_start;
        
        -- Process each date
        FOREACH target_date IN ARRAY dates LOOP
          -- Skip if same date as original
          IF DATE(orig_start) = target_date THEN
            CONTINUE;
          END IF;
          
          -- Create new times
          new_start := target_date + (orig_start::time);
          new_end := new_start + time_diff;
          
          -- Check for conflicts
          has_conflict := FALSE;
          
          -- Only check for conflicts if we have studios to check against
          IF studio_ids IS NOT NULL AND array_length(studio_ids, 1) > 0 THEN
            -- Use EXISTS for efficiency
            IF EXISTS (
              SELECT 1 
              FROM bookings b 
              JOIN booking_studios bs ON b.id = bs.booking_id
              WHERE 
                bs.studio_id = ANY(studio_ids) AND
                ((new_start >= b.start AND new_start < b."end") OR
                 (new_end > b.start AND new_end <= b."end") OR
                 (new_start <= b.start AND new_end >= b."end"))
            ) THEN
              has_conflict := TRUE;
            END IF;
          ELSIF orig_studio_id IS NOT NULL THEN
            -- Check single studio
            IF EXISTS (
              SELECT 1 
              FROM bookings b 
              JOIN booking_studios bs ON b.id = bs.booking_id
              WHERE 
                bs.studio_id = orig_studio_id AND
                ((new_start >= b.start AND new_start < b."end") OR
                 (new_end > b.start AND new_end <= b."end") OR
                 (new_start <= b.start AND new_end >= b."end"))
            ) THEN
              has_conflict := TRUE;
            END IF;
          END IF;
          
          -- Skip if conflict
          IF has_conflict THEN
            CONTINUE;
          END IF;
          
          -- Insert new booking and get ID
          INSERT INTO bookings (
            title, description, type, start, "end", 
            user_id, studio_id, pcr_room_id, severity, 
            template_id, notify_list, created_at
          )
          VALUES (
            orig_title, 
            orig_description,
            orig_type, 
            new_start, 
            new_end, 
            orig_user_id,
            orig_studio_id, 
            orig_pcr_room_id, 
            orig_severity,
            orig_template_id, 
            orig_notify_list, 
            CURRENT_TIMESTAMP
          )
          RETURNING id INTO new_id;
          
          -- Link studios
          IF studio_ids IS NOT NULL AND array_length(studio_ids, 1) > 0 THEN
            FOREACH studio_id_item IN ARRAY studio_ids LOOP
              INSERT INTO booking_studios (booking_id, studio_id)
              VALUES (new_id, studio_id_item);
            END LOOP;
          ELSIF orig_studio_id IS NOT NULL THEN
            INSERT INTO booking_studios (booking_id, studio_id)
            VALUES (new_id, orig_studio_id);
          END IF;
          
          -- Return the new booking ID
          id := new_id;
          RETURN NEXT;
        END LOOP;
        
        RETURN;
      END;
      $$;


ALTER FUNCTION public.copy_booking_to_multiple_dates(booking_id integer, dates date[]) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 24578)
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    alert_type text NOT NULL,
    severity text NOT NULL,
    start timestamp without time zone NOT NULL,
    "end" timestamp without time zone NOT NULL,
    notify_list jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status text DEFAULT 'active'::text,
    is_all_day boolean DEFAULT false,
    created_by integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 24588)
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_id_seq OWNER TO postgres;

--
-- TOC entry 3872 (class 0 OID 0)
-- Dependencies: 216
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- TOC entry 256 (class 1259 OID 24932)
-- Name: asset_checkouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_checkouts (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    checked_out_by integer NOT NULL,
    checked_out_at timestamp without time zone DEFAULT now(),
    checked_in_at timestamp without time zone,
    checked_in_by integer,
    notes text,
    purpose text
);


ALTER TABLE public.asset_checkouts OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 24931)
-- Name: asset_checkouts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_checkouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asset_checkouts_id_seq OWNER TO postgres;

--
-- TOC entry 3873 (class 0 OID 0)
-- Dependencies: 255
-- Name: asset_checkouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_checkouts_id_seq OWNED BY public.asset_checkouts.id;


--
-- TOC entry 258 (class 1259 OID 24955)
-- Name: asset_photos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_photos (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    photo_data text NOT NULL,
    uploaded_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.asset_photos OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 24954)
-- Name: asset_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asset_photos_id_seq OWNER TO postgres;

--
-- TOC entry 3874 (class 0 OID 0)
-- Dependencies: 257
-- Name: asset_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_photos_id_seq OWNED BY public.asset_photos.id;


--
-- TOC entry 254 (class 1259 OID 24920)
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assets (
    id integer NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    serial_number text,
    asset_tag text,
    location text,
    description text,
    notes text,
    purchase_date text,
    last_maintenance_date text,
    assigned_to integer,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    decommission_reason text,
    is_kit boolean DEFAULT false NOT NULL,
    parent_asset_id integer
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 24919)
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assets_id_seq OWNER TO postgres;

--
-- TOC entry 3875 (class 0 OID 0)
-- Dependencies: 253
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- TOC entry 217 (class 1259 OID 24589)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id integer,
    entity_title text,
    details json DEFAULT '{}'::json,
    ip_address text,
    user_agent text,
    "timestamp" timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 24596)
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- TOC entry 3876 (class 0 OID 0)
-- Dependencies: 218
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- TOC entry 260 (class 1259 OID 32770)
-- Name: booking_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_assets (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    asset_id integer NOT NULL,
    added_by integer NOT NULL,
    added_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.booking_assets OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 32769)
-- Name: booking_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.booking_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_assets_id_seq OWNER TO postgres;

--
-- TOC entry 3877 (class 0 OID 0)
-- Dependencies: 259
-- Name: booking_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.booking_assets_id_seq OWNED BY public.booking_assets.id;


--
-- TOC entry 272 (class 1259 OID 65636)
-- Name: booking_crew; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_crew (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    position_id integer NOT NULL,
    crew_member_id integer,
    status text DEFAULT 'unfilled'::text NOT NULL,
    rate_type text,
    rate_snapshot_cents integer DEFAULT 0 NOT NULL,
    response_token text,
    invited_at timestamp without time zone,
    responded_at timestamp without time zone,
    decline_reason text,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.booking_crew OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 65635)
-- Name: booking_crew_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.booking_crew_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_crew_id_seq OWNER TO postgres;

--
-- TOC entry 3878 (class 0 OID 0)
-- Dependencies: 271
-- Name: booking_crew_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.booking_crew_id_seq OWNED BY public.booking_crew.id;


--
-- TOC entry 219 (class 1259 OID 24597)
-- Name: booking_studios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_studios (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    studio_id integer NOT NULL
);


ALTER TABLE public.booking_studios OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 24600)
-- Name: booking_studios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.booking_studios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_studios_id_seq OWNER TO postgres;

--
-- TOC entry 3879 (class 0 OID 0)
-- Dependencies: 220
-- Name: booking_studios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.booking_studios_id_seq OWNED BY public.booking_studios.id;


--
-- TOC entry 221 (class 1259 OID 24601)
-- Name: booking_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_types (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#3b82f6'::text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.booking_types OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 24611)
-- Name: booking_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.booking_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_types_id_seq OWNER TO postgres;

--
-- TOC entry 3880 (class 0 OID 0)
-- Dependencies: 222
-- Name: booking_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.booking_types_id_seq OWNED BY public.booking_types.id;


--
-- TOC entry 223 (class 1259 OID 24612)
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    studio_id integer,
    user_id integer NOT NULL,
    start timestamp without time zone NOT NULL,
    "end" timestamp without time zone NOT NULL,
    type text NOT NULL,
    severity text,
    template_id integer,
    notify_list jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pcr_room_id integer,
    color text DEFAULT '#3B82F6'::text,
    status text DEFAULT 'confirmed'::text,
    link_group_id text,
    is_primary_in_group boolean DEFAULT false
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 24622)
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bookings_id_seq OWNER TO postgres;

--
-- TOC entry 3881 (class 0 OID 0)
-- Dependencies: 224
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- TOC entry 266 (class 1259 OID 65579)
-- Name: crew_member_positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crew_member_positions (
    id integer NOT NULL,
    crew_member_id integer NOT NULL,
    position_id integer NOT NULL
);


ALTER TABLE public.crew_member_positions OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 65578)
-- Name: crew_member_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.crew_member_positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crew_member_positions_id_seq OWNER TO postgres;

--
-- TOC entry 3882 (class 0 OID 0)
-- Dependencies: 265
-- Name: crew_member_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.crew_member_positions_id_seq OWNED BY public.crew_member_positions.id;


--
-- TOC entry 264 (class 1259 OID 65551)
-- Name: crew_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crew_members (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    day_rate_cents integer DEFAULT 0 NOT NULL,
    half_day_rate_cents integer DEFAULT 0 NOT NULL,
    notes text,
    user_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crew_members OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 65550)
-- Name: crew_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.crew_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crew_members_id_seq OWNER TO postgres;

--
-- TOC entry 3883 (class 0 OID 0)
-- Dependencies: 263
-- Name: crew_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.crew_members_id_seq OWNED BY public.crew_members.id;


--
-- TOC entry 262 (class 1259 OID 65537)
-- Name: crew_positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crew_positions (
    id integer NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    description text,
    color text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.crew_positions OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 65536)
-- Name: crew_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.crew_positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crew_positions_id_seq OWNER TO postgres;

--
-- TOC entry 3884 (class 0 OID 0)
-- Dependencies: 261
-- Name: crew_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.crew_positions_id_seq OWNED BY public.crew_positions.id;


--
-- TOC entry 270 (class 1259 OID 65617)
-- Name: crew_template_slots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crew_template_slots (
    id integer NOT NULL,
    template_id integer NOT NULL,
    position_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.crew_template_slots OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 65616)
-- Name: crew_template_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.crew_template_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crew_template_slots_id_seq OWNER TO postgres;

--
-- TOC entry 3885 (class 0 OID 0)
-- Dependencies: 269
-- Name: crew_template_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.crew_template_slots_id_seq OWNED BY public.crew_template_slots.id;


--
-- TOC entry 268 (class 1259 OID 65600)
-- Name: crew_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crew_templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    booking_type_id integer,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crew_templates OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 65599)
-- Name: crew_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.crew_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crew_templates_id_seq OWNER TO postgres;

--
-- TOC entry 3886 (class 0 OID 0)
-- Dependencies: 267
-- Name: crew_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.crew_templates_id_seq OWNED BY public.crew_templates.id;


--
-- TOC entry 225 (class 1259 OID 24623)
-- Name: file_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.file_attachments (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    mime_type text NOT NULL,
    path text NOT NULL,
    uploaded_by integer NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    description text
);


ALTER TABLE public.file_attachments OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 24629)
-- Name: file_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.file_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.file_attachments_id_seq OWNER TO postgres;

--
-- TOC entry 3887 (class 0 OID 0)
-- Dependencies: 226
-- Name: file_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.file_attachments_id_seq OWNED BY public.file_attachments.id;


--
-- TOC entry 227 (class 1259 OID 24630)
-- Name: invite_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invite_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    role text NOT NULL,
    email text NOT NULL,
    expires timestamp without time zone NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    used boolean DEFAULT false
);


ALTER TABLE public.invite_tokens OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 24637)
-- Name: invite_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invite_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invite_tokens_id_seq OWNER TO postgres;

--
-- TOC entry 3888 (class 0 OID 0)
-- Dependencies: 228
-- Name: invite_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invite_tokens_id_seq OWNED BY public.invite_tokens.id;


--
-- TOC entry 229 (class 1259 OID 24638)
-- Name: linked_bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.linked_bookings (
    id integer NOT NULL,
    primary_booking_id integer NOT NULL,
    linked_booking_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT linked_bookings_check CHECK ((primary_booking_id <> linked_booking_id))
);


ALTER TABLE public.linked_bookings OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 24643)
-- Name: linked_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.linked_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.linked_bookings_id_seq OWNER TO postgres;

--
-- TOC entry 3889 (class 0 OID 0)
-- Dependencies: 230
-- Name: linked_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.linked_bookings_id_seq OWNED BY public.linked_bookings.id;


--
-- TOC entry 231 (class 1259 OID 24644)
-- Name: notification_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_groups (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    group_type text NOT NULL,
    description text,
    enabled boolean DEFAULT true
);


ALTER TABLE public.notification_groups OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 24650)
-- Name: notification_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_groups_id_seq OWNER TO postgres;

--
-- TOC entry 3890 (class 0 OID 0)
-- Dependencies: 232
-- Name: notification_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_groups_id_seq OWNED BY public.notification_groups.id;


--
-- TOC entry 233 (class 1259 OID 24651)
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    read boolean DEFAULT false,
    booking_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 24658)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- TOC entry 3891 (class 0 OID 0)
-- Dependencies: 234
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 235 (class 1259 OID 24659)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    user_id integer NOT NULL,
    expires timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    used boolean DEFAULT false
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 24666)
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- TOC entry 3892 (class 0 OID 0)
-- Dependencies: 236
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- TOC entry 237 (class 1259 OID 24667)
-- Name: pcr_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcr_rooms (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'available'::text NOT NULL
);


ALTER TABLE public.pcr_rooms OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 24673)
-- Name: pcr_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pcr_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pcr_rooms_id_seq OWNER TO postgres;

--
-- TOC entry 3893 (class 0 OID 0)
-- Dependencies: 238
-- Name: pcr_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pcr_rooms_id_seq OWNED BY public.pcr_rooms.id;


--
-- TOC entry 239 (class 1259 OID 24674)
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 24679)
-- Name: studios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.studios (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    location text,
    status text DEFAULT 'available'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    attributes jsonb
);


ALTER TABLE public.studios OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 24686)
-- Name: studios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.studios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.studios_id_seq OWNER TO postgres;

--
-- TOC entry 3894 (class 0 OID 0)
-- Dependencies: 241
-- Name: studios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.studios_id_seq OWNED BY public.studios.id;


--
-- TOC entry 242 (class 1259 OID 24687)
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 24694)
-- Name: system_settings_backup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings_backup (
    key text,
    value text,
    description text,
    updated_at timestamp with time zone
);


ALTER TABLE public.system_settings_backup OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 24699)
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO postgres;

--
-- TOC entry 3895 (class 0 OID 0)
-- Dependencies: 244
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- TOC entry 245 (class 1259 OID 24700)
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    id integer NOT NULL,
    team_id integer NOT NULL,
    user_id integer NOT NULL,
    role text DEFAULT 'member'::text,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 24707)
-- Name: team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.team_members_id_seq OWNER TO postgres;

--
-- TOC entry 3896 (class 0 OID 0)
-- Dependencies: 246
-- Name: team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;


--
-- TOC entry 247 (class 1259 OID 24708)
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 24715)
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_id_seq OWNER TO postgres;

--
-- TOC entry 3897 (class 0 OID 0)
-- Dependencies: 248
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- TOC entry 249 (class 1259 OID 24716)
-- Name: templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    duration integer NOT NULL,
    created_by integer NOT NULL,
    user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    start_time text,
    end_time text,
    studio_ids json DEFAULT '[]'::json,
    pcr_room_id integer,
    color character varying(7) DEFAULT '#3259f5'::character varying,
    status character varying(20) DEFAULT 'confirmed'::character varying,
    notify_list json DEFAULT '[]'::json
);


ALTER TABLE public.templates OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 24726)
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.templates_id_seq OWNER TO postgres;

--
-- TOC entry 3898 (class 0 OID 0)
-- Dependencies: 250
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- TOC entry 251 (class 1259 OID 24727)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    calendar_token text,
    sso_provider text,
    sso_id text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 24733)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 3899 (class 0 OID 0)
-- Dependencies: 252
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3409 (class 2604 OID 24734)
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- TOC entry 3473 (class 2604 OID 24935)
-- Name: asset_checkouts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_checkouts ALTER COLUMN id SET DEFAULT nextval('public.asset_checkouts_id_seq'::regclass);


--
-- TOC entry 3475 (class 2604 OID 24958)
-- Name: asset_photos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_photos ALTER COLUMN id SET DEFAULT nextval('public.asset_photos_id_seq'::regclass);


--
-- TOC entry 3468 (class 2604 OID 24923)
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- TOC entry 3415 (class 2604 OID 24735)
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- TOC entry 3477 (class 2604 OID 32773)
-- Name: booking_assets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_assets ALTER COLUMN id SET DEFAULT nextval('public.booking_assets_id_seq'::regclass);


--
-- TOC entry 3494 (class 2604 OID 65639)
-- Name: booking_crew id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_crew ALTER COLUMN id SET DEFAULT nextval('public.booking_crew_id_seq'::regclass);


--
-- TOC entry 3418 (class 2604 OID 24736)
-- Name: booking_studios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_studios ALTER COLUMN id SET DEFAULT nextval('public.booking_studios_id_seq'::regclass);


--
-- TOC entry 3419 (class 2604 OID 24737)
-- Name: booking_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_types ALTER COLUMN id SET DEFAULT nextval('public.booking_types_id_seq'::regclass);


--
-- TOC entry 3425 (class 2604 OID 24738)
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- TOC entry 3489 (class 2604 OID 65582)
-- Name: crew_member_positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_member_positions ALTER COLUMN id SET DEFAULT nextval('public.crew_member_positions_id_seq'::regclass);


--
-- TOC entry 3483 (class 2604 OID 65554)
-- Name: crew_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members ALTER COLUMN id SET DEFAULT nextval('public.crew_members_id_seq'::regclass);


--
-- TOC entry 3479 (class 2604 OID 65540)
-- Name: crew_positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_positions ALTER COLUMN id SET DEFAULT nextval('public.crew_positions_id_seq'::regclass);


--
-- TOC entry 3492 (class 2604 OID 65620)
-- Name: crew_template_slots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_template_slots ALTER COLUMN id SET DEFAULT nextval('public.crew_template_slots_id_seq'::regclass);


--
-- TOC entry 3490 (class 2604 OID 65603)
-- Name: crew_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_templates ALTER COLUMN id SET DEFAULT nextval('public.crew_templates_id_seq'::regclass);


--
-- TOC entry 3431 (class 2604 OID 24739)
-- Name: file_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_attachments ALTER COLUMN id SET DEFAULT nextval('public.file_attachments_id_seq'::regclass);


--
-- TOC entry 3433 (class 2604 OID 24740)
-- Name: invite_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_tokens ALTER COLUMN id SET DEFAULT nextval('public.invite_tokens_id_seq'::regclass);


--
-- TOC entry 3436 (class 2604 OID 24741)
-- Name: linked_bookings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linked_bookings ALTER COLUMN id SET DEFAULT nextval('public.linked_bookings_id_seq'::regclass);


--
-- TOC entry 3438 (class 2604 OID 24742)
-- Name: notification_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_groups ALTER COLUMN id SET DEFAULT nextval('public.notification_groups_id_seq'::regclass);


--
-- TOC entry 3440 (class 2604 OID 24743)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 3443 (class 2604 OID 24744)
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- TOC entry 3446 (class 2604 OID 24745)
-- Name: pcr_rooms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcr_rooms ALTER COLUMN id SET DEFAULT nextval('public.pcr_rooms_id_seq'::regclass);


--
-- TOC entry 3448 (class 2604 OID 24746)
-- Name: studios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studios ALTER COLUMN id SET DEFAULT nextval('public.studios_id_seq'::regclass);


--
-- TOC entry 3452 (class 2604 OID 24747)
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- TOC entry 3454 (class 2604 OID 24748)
-- Name: team_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);


--
-- TOC entry 3457 (class 2604 OID 24749)
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- TOC entry 3460 (class 2604 OID 24750)
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- TOC entry 3466 (class 2604 OID 24751)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3808 (class 0 OID 24578)
-- Dependencies: 215
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerts (id, title, description, alert_type, severity, start, "end", notify_list, created_at, status, is_all_day, created_by) FROM stdin;
5	Curator Upgrade	This is a significant upgrade which will require the system be down for an extended period of time over the weekend and then extensive testing by the users on the following Monday the 11th.	all-day:maintenance	medium	2025-08-09 05:00:00	2025-08-10 04:59:59.999	[]	2025-07-09 15:56:32.481	active	f	9
6	Curator Upgrade	This is a significant upgrade which will require the system be down for an extended period of time over the weekend and then extensive testing by the users on the following Monday the 11th.	all-day:maintenance	medium	2025-08-10 05:00:00	2025-08-11 04:59:59.999	[]	2025-07-09 15:57:55.114	active	f	9
7	Audio console swap out - Irving		all-day:maintenance	medium	2025-08-25 05:00:00	2025-08-26 04:59:59.999	[]	2025-08-14 17:42:18.837	active	f	13
8	Audio console swap out - Irving		all-day:maintenance	medium	2025-08-26 05:00:00	2025-08-27 04:59:59.999	[]	2025-08-14 17:42:27.591	active	f	13
9	Audio console swap out - Irving		all-day:maintenance	medium	2025-08-27 05:00:00	2025-08-28 04:59:59.999	[]	2025-08-14 17:42:38.286	active	f	13
11	XPression Updates - The Plex		all-day:maintenance	medium	2025-08-27 05:00:00	2025-08-28 04:59:59.999	"[]"	2025-08-15 17:06:57.417	active	f	9
10	XPression Updates - The Plex		all-day:maintenance	medium	2025-08-28 05:00:00	2025-08-29 04:59:59.999	"[]"	2025-08-15 17:06:34.332	active	f	9
12	EQX Router Commissioning 	Evertz will be on site all week for final\ncommissioning and set up. 	maintenance	medium	2025-09-29 14:00:00	2025-09-29 22:00:00	[]	2025-09-28 20:28:55.284	active	f	15
13	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-21 05:00:00	2025-10-22 04:59:59.999	[]	2025-10-15 14:17:19.129	active	f	13
14	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-22 05:00:00	2025-10-23 04:59:59.999	[]	2025-10-15 14:17:28.747	active	f	13
15	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-23 05:00:00	2025-10-24 04:59:59.999	[]	2025-10-15 14:17:41.56	active	f	13
16	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-24 05:00:00	2025-10-25 04:59:59.999	[]	2025-10-15 14:17:50.454	active	f	13
17	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-25 05:00:00	2025-10-26 04:59:59.999	[]	2025-10-15 14:17:58.434	active	f	13
18	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-26 05:00:00	2025-10-27 04:59:59.999	[]	2025-10-15 14:18:11.581	active	f	13
19	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-27 05:00:00	2025-10-28 04:59:59.999	[]	2025-10-15 14:18:18.171	active	f	13
20	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-28 05:00:00	2025-10-29 04:59:59.999	[]	2025-10-15 14:18:24.718	active	f	13
21	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-29 05:00:00	2025-10-30 04:59:59.999	[]	2025-10-15 14:18:30.885	active	f	13
22	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-30 05:00:00	2025-10-31 04:59:59.999	[]	2025-10-15 14:18:37.803	active	f	13
23	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-10-31 05:00:00	2025-11-01 04:59:59.999	[]	2025-10-15 14:18:46.268	active	f	13
24	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-01 05:00:00	2025-11-02 04:59:59.999	[]	2025-10-15 14:18:55.422	active	f	13
25	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-02 05:00:00	2025-11-03 05:59:59.999	[]	2025-10-15 14:19:04.755	active	f	13
26	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-03 06:00:00	2025-11-04 05:59:59.999	[]	2025-10-15 14:19:10.626	active	f	13
27	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-04 06:00:00	2025-11-05 05:59:59.999	[]	2025-10-15 14:19:17.395	active	f	13
28	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-05 06:00:00	2025-11-06 05:59:59.999	[]	2025-10-15 14:19:23.775	active	f	13
29	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-06 06:00:00	2025-11-07 05:59:59.999	[]	2025-10-15 14:19:29.764	active	f	13
30	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-07 06:00:00	2025-11-08 05:59:59.999	[]	2025-10-15 14:19:35.839	active	f	13
31	PCR2/ACR2 - PCR4/ACR4 Offline		all-day:maintenance	medium	2025-11-08 06:00:00	2025-11-09 05:59:59.999	"[]"	2025-10-15 14:19:42.704	active	f	13
32	Test Multiple day alert	Test Multiple day alert	maintenance	medium	2025-12-28 15:00:00	2025-12-28 22:30:00	[]	2025-12-28 03:07:03.085	active	f	1
33	Test Multiple day alert	Test Multiple day alert	maintenance	medium	2025-12-29 15:00:00	2025-12-29 22:30:00	[]	2025-12-28 03:07:04.426	active	f	1
34	Test Multiple day alert	Test Multiple day alert	maintenance	medium	2025-12-30 15:00:00	2025-12-30 22:30:00	[]	2025-12-28 03:07:05.457	active	f	1
35	Test Multiple day alert	Test Multiple day alert	maintenance	medium	2025-12-31 15:00:00	2025-12-31 22:30:00	[]	2025-12-28 03:07:06.295	active	f	1
36	Test Multiple day alert	Test Multiple day alert	maintenance	medium	2026-01-01 15:00:00	2026-01-01 22:30:00	[]	2025-12-28 03:07:06.935	active	f	1
37	Test Multiple day alert	Test Multiple day alert	maintenance	medium	2026-01-02 15:00:00	2026-01-02 22:30:00	[]	2025-12-28 03:07:07.687	active	f	1
38	Test all day multiple day alert		all-day:maintenance	critical	2025-12-28 06:00:00	2025-12-29 05:59:59.999	[]	2025-12-28 03:07:34.807	active	f	1
39	Test all day multiple day alert		all-day:maintenance	critical	2025-12-29 06:00:00	2025-12-30 05:59:59.999	[]	2025-12-28 03:07:35.711	active	f	1
40	Test all day multiple day alert		all-day:maintenance	critical	2025-12-30 06:00:00	2025-12-31 05:59:59.999	[]	2025-12-28 03:07:36.671	active	f	1
41	Test all day multiple day alert		all-day:maintenance	critical	2025-12-31 06:00:00	2026-01-01 05:59:59.999	[]	2025-12-28 03:07:37.693	active	f	1
42	Test all day multiple day alert		all-day:maintenance	critical	2026-01-01 06:00:00	2026-01-02 05:59:59.999	[]	2025-12-28 03:07:38.626	active	f	1
43	Test all day multiple day alert		all-day:maintenance	critical	2026-01-02 06:00:00	2026-01-03 05:59:59.999	[]	2025-12-28 03:07:39.737	active	f	1
69	test multiple days		maintenance	medium	2026-02-16 15:00:00	2026-02-16 16:00:00	[]	2026-02-16 01:58:49.09	active	f	1
70	test multiple days		maintenance	medium	2026-02-17 15:00:00	2026-02-17 16:00:00	[]	2026-02-16 01:58:49.123	active	f	1
71	test multiple days		maintenance	medium	2026-02-18 15:00:00	2026-02-18 16:00:00	[]	2026-02-16 01:58:49.153	active	f	1
72	test multiple days		maintenance	medium	2026-02-19 15:00:00	2026-02-19 16:00:00	[]	2026-02-16 01:58:49.181	active	f	1
73	test multiple days		maintenance	medium	2026-02-20 15:00:00	2026-02-20 16:00:00	[]	2026-02-16 01:58:49.21	active	f	1
\.


--
-- TOC entry 3849 (class 0 OID 24932)
-- Dependencies: 256
-- Data for Name: asset_checkouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_checkouts (id, asset_id, checked_out_by, checked_out_at, checked_in_at, checked_in_by, notes, purpose) FROM stdin;
1	22	1	2026-03-13 22:38:41.929191	2026-03-13 22:38:47.172	1		
2	9	1	2026-03-13 22:38:41.929663	2026-03-13 22:38:47.986	1		
3	22	1	2026-03-13 22:39:00.412228	2026-03-14 03:59:08.956	1		Better Together
4	9	1	2026-03-13 22:39:00.4155	2026-03-14 03:59:09.967	1		Better Together
12	22	1	2026-03-14 04:53:45.691012	2026-03-14 04:57:22.375	1		Test booking with assets
13	9	1	2026-03-14 04:53:46.789526	2026-03-14 04:57:23.245	1		Test booking with assets
14	29	1	2026-03-14 04:53:48.630294	2026-03-14 04:57:24.169	1		Test booking with assets
15	2	1	2026-03-14 04:53:52.882037	2026-03-14 04:57:24.821	1		Test booking with assets
16	23	1	2026-03-14 04:53:54.294876	2026-03-14 04:57:25.577	1		Test booking with assets
8	8	1	2026-03-14 04:51:56.33236	2026-03-14 04:57:26.418	1		Test booking with assets
9	1	1	2026-03-14 04:51:58.017203	2026-03-14 04:57:27.07	1		Test booking with assets
11	5	1	2026-03-14 04:52:03.860499	2026-03-14 04:57:28.044	1		Test booking with assets
10	16	1	2026-03-14 04:52:02.376135	2026-03-14 04:57:28.75	1		Test booking with assets
6	32	1	2026-03-14 03:59:31.443449	2026-03-14 05:54:57.871	1		Breaking Sunday School with Jason Sobel
5	12	1	2026-03-14 03:59:31.442337	2026-03-14 05:54:59.19	1		Breaking Sunday School with Jason Sobel
7	38	1	2026-03-14 03:59:31.453303	2026-03-14 05:54:59.82	1		Breaking Sunday School with Jason Sobel
18	33	1	2026-03-14 04:57:34.761452	2026-03-14 05:55:00.975	1		Test booking with assets
17	35	1	2026-03-14 04:57:33.050199	2026-03-14 20:16:27.862	1		Test booking with assets
20	30	1	2026-03-14 04:57:36.903032	2026-03-14 20:16:28.787	1		Test booking with assets
22	22	1	2026-03-15 03:43:49.810142	2026-03-15 03:46:50.606	1		Breaking Sunday School with Jason Sobel
23	9	1	2026-03-15 03:46:58.064509	2026-03-15 03:48:43.31	1		test linked booking
24	22	1	2026-03-15 04:10:08.080841	2026-03-15 04:10:20.419	1		
25	29	1	2026-03-15 04:44:18.248676	2026-03-15 04:48:10.699	1		Test booking with assets
19	25	1	2026-03-14 04:57:35.718971	2026-03-15 04:48:57.154	1		Test booking with assets
21	14	1	2026-03-14 04:57:40.596009	2026-03-15 04:48:58.856	1		Test booking with assets
26	29	1	2026-03-15 05:00:37.217667	2026-03-15 05:01:49.459	1		
28	40	1	2026-03-15 20:37:20.378812	\N	\N		Test 
29	29	1	2026-03-15 22:28:32.91679	\N	\N		Test assets booking
27	32	1	2026-03-15 05:01:07.392739	2026-03-15 22:44:57.622	1		
\.


--
-- TOC entry 3851 (class 0 OID 24955)
-- Dependencies: 258
-- Data for Name: asset_photos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_photos (id, asset_id, photo_data, uploaded_by, created_at) FROM stdin;
1	39	data:image/jpeg;base64,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	1	2026-03-14 20:01:29.865191+00
2	40	data:image/jpeg;base64,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	1	2026-03-15 20:36:57.629915+00
\.


--
-- TOC entry 3847 (class 0 OID 24920)
-- Dependencies: 254
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assets (id, name, category, status, serial_number, asset_tag, location, description, notes, purchase_date, last_maintenance_date, assigned_to, created_by, created_at, updated_at, decommission_reason, is_kit, parent_asset_id) FROM stdin;
38	Apple MacBook Pro 16in M3	other	available	AMBP-M3-0041	OTH-004	Control Room	\N	Editing workstation	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:54:59.822	\N	f	\N
33	Portabrace Camera Rain Cover	accessories	available	\N	ACC-004	Storage	\N	Fits FX6/FX9	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:55:00.978	\N	f	\N
6	Blackmagic URSA Mini Pro 12K	camera	maintenance	BM-URSA-0091	CAM-005	Repair Shop	\N	Lens mount being serviced	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
7	GoPro Hero 12 Black	camera	available	GP12-55023	CAM-006	Equipment Room	\N	With 3 mounts and housing	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
11	Kino Flo Select 31 DMX LED	lighting	available	KFS31-00423	LGT-003	Equipment Room	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
13	LED Light Panel 1x1 (x4 set)	lighting	available	LED1X1-SET2	LGT-005	Storage	\N	Set of 4 panels	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
17	Shure SM7B Dynamic Mic	audio	available	SSM7-44019	AUD-004	Audio Booth	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
18	Sound Devices 788T Recorder	audio	available	SD788-00112	AUD-005	Equipment Room	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
19	Lectrosonics Wireless IFB System	audio	maintenance	LIFB-0091	AUD-006	Repair Shop	\N	Battery contacts corroded	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
21	Blackmagic HyperDeck Studio 4K	video	available	BMHD-0881	VID-002	Equipment Room	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
24	Marshall CV503 Miniature Camera	video	retired	MCV503-0041	VID-005	Storage	\N	Replaced by newer model	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
26	XLR Audio Cable 15ft (x20)	cables	available	\N	CBL-002	Cable Rack A	\N	Mogami W2549	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
27	HDMI 2.0 Cable 10ft (x6)	cables	available	\N	CBL-003	Cable Rack B	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
34	Wooden Camera Cheese Plate Kit	accessories	available	WC-CP-0031	ACC-005	Equipment Room	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
36	Studio Monitor Stand (pair)	other	available	\N	OTH-002	Audio Booth	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-13 22:14:08.633315	\N	f	\N
20	Blackmagic ATEM Mini Pro ISO	video	available	BMATEM-0234	VID-001	PCR 1	\N	Primary switcher	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:00:56.184	\N	f	\N
28	Cat6 Ethernet 50ft (x8)	cables	available	\N	CBL-004	Studio A	\N	Studio A network run	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:00:58.288	\N	f	\N
10	Litepanels Gemini 2x1 Soft LED	lighting	available	LPG-08831	LGT-002	Studio B	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:00:59.967	\N	f	\N
31	O'Connor 2575 Fluid Head	accessories	available	OC2575-0042	ACC-002	Studio A	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:01:02.45	\N	f	\N
15	Rode NTG5 Broadcast Mic	audio	available	RNTG5-8821	AUD-002	Studio A	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:01:04.981	\N	f	\N
4	Sony FX9 Full-Frame Camera	camera	available	SFX9-00482	CAM-003	Studio A	\N	Primary studio camera	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:01:08.085	\N	f	\N
2	Canon 5D	camera	available	784651-46216	PLX-34234	plex backstage			2025-02-05	2026-03-11	\N	1	2026-03-13 21:50:03.453508	2026-03-14 04:57:24.823	\N	f	\N
23	Decimator MD-HX Cross Converter	video	available	DMDHX-0291	VID-004	Equipment Room	\N	x2 units	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 04:57:25.58	\N	f	\N
8	Sony A7S III Mirrorless	camera	available	SA7S-00761	CAM-007	Equipment Room	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 04:57:26.421	\N	f	\N
1	Sony FX6 Camera	camera	available	12346-654321	TAG-001	PLEX	Sony FX6 Camera black		2023-03-10	2026-03-12	\N	1	2026-03-13 21:24:00.937143	2026-03-14 04:57:27.073	\N	f	\N
5	Sony PXW-Z280 4K Camcorder	camera	available	SPZ-11203	CAM-004	Equipment Room	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 04:57:28.047	\N	f	\N
16	Sony UWP-D21 Wireless Lav Kit	audio	available	SUWP-00572	AUD-003	Equipment Room	\N	2 transmitters, 1 receiver	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 04:57:28.753	\N	f	\N
22	AJA Ki Pro Ultra 12G Recorder	video	retired	AJAKI-0045	VID-003	Equipment Room		test			\N	1	2026-03-13 22:14:08.633315	2026-03-15 04:18:22.926	Test Decommission\n	f	\N
37	Teleprompter 17in iPad Kit	other	available	TP17-0091	OTH-003	Studio B	\N	Prompter Pro app configured	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:01:09.71	\N	f	\N
12	Aputure LS 600d Pro	lighting	available	ALS-60091	LGT-004	Storage	\N	With Fresnel attachment	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 05:54:59.195	\N	f	\N
39	Canon TL1 	camera	available	0270107155	AST-LBPJNC				\N	\N	\N	1	2026-03-14 19:52:05.262228	2026-03-14 19:52:05.262228	\N	f	\N
35	Pelican 1650 Rolling Case	other	available	PEL1650-0221	OTH-001	Storage	\N	Interior foam cut for Sony FX6	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 20:16:27.874	\N	f	\N
30	Sachtler Ace L Fluid Head Tripod	accessories	available	SACE-00821	ACC-001	Equipment Room	\N		\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-14 20:16:28.795	\N	f	\N
9	ARRI SkyPanel S60-C LED	lighting	available	AS60-20145	LGT-001	Studio A	\N	RGBW, includes yoke	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-15 03:48:43.317	\N	f	\N
40	UltraStudio Monitor	accessory	in-use	11869349	11869349	IT office 			\N	\N	\N	1	2026-03-15 20:36:57.35546	2026-03-15 20:37:20.384	\N	f	\N
25	SDI BNC Cable 25ft (x10)	cables	available	\N	CBL-001	Cable Rack A	\N	Belden 1694A	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-15 04:48:57.161	\N	f	\N
14	Sennheiser MKH 416 Shotgun Mic	audio	available	SMK416-0314	AUD-001	Audio Booth	\N	With blimp windshield	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-15 04:48:58.896	\N	f	\N
29	Anton Bauer Gold Mount Extension	cables	in-use	\N	CBL-005	Equipment Room	\N	Power extension cables x4	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-15 22:28:32.994	\N	f	\N
32	Anton Bauer Titon Base 240 Battery	accessories	available	ABT240-0114	ACC-003	Equipment Room		Set of 4 batteries	\N	\N	\N	1	2026-03-13 22:14:08.633315	2026-03-15 22:44:57.662	\N	f	\N
41	Aputure Accent B7C 8-Light Kit	lighting	available	6HQ04J25420	100432	Lighting Workshop	1x Case\n8x Accent B7C Practical Bulbs \n1x Edison to IEC (D-Plug)				\N	1	2026-03-16 19:10:35.054266	2026-03-16 19:10:35.054266		t	\N
\.


--
-- TOC entry 3810 (class 0 OID 24589)
-- Dependencies: 217
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, entity_title, details, ip_address, user_agent, "timestamp") FROM stdin;
1047	1	CHECKOUT	asset	22	AJA Ki Pro Ultra 12G Recorder	{"checkedOutBy":"admin","purpose":"","notes":""}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:10:08.095731
1048	1	CHECKIN	asset	22	AJA Ki Pro Ultra 12G Recorder	{"checkedInBy":"admin"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:10:20.440704
1049	1	SYSTEM_MIGRATION	assets_system	\N	\N	{"message":"Decommission migration v1.5.6 completed. Added decommission_reason column to assets table with partial index."}	\N	\N	2026-03-15 04:12:44.723793
1070	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-16 18:41:08.001059
1072	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	2026-03-23 05:48:50.401221
1075	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	2026-05-14 18:35:55.340399
1077	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-28 17:49:06.122047
1082	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-29 00:48:18.382341
1083	1	create	crew_member	2	obed test	{}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-29 18:19:04.009383
1085	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0	2026-05-31 19:12:08.327993
1086	1	UPDATE	booking	723	test	{"originalBooking":{"title":"test","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"test","description":"stetsetset","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":5,"templateId":null,"pcrRoomId":null,"studioIds":[5,17]},"studioIds":[5,17],"linkedGroupId":null,"hasLinked":null}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0	2026-06-01 01:50:20.255037
1050	1	DECOMMISSION	asset	22	AJA Ki Pro Ultra 12G Recorder	{"reason":"Test Decommission\\n","previousStatus":"available"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:15:40.378053
1071	1	CREATE	asset	41	Aputure Accent B7C 8-Light Kit	{"category":"lighting","status":"available","location":"Lighting Workshop"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-16 19:10:35.062236
1078	1	create	crew_member	1	Obed Lighting	{}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-28 18:27:31.146749
1084	1	invite_sent	booking_crew	4	Producer → obed test	{}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-29 18:19:25.989706
1051	1	UPDATE	asset	22	AJA Ki Pro Ultra 12G Recorder	{"changes":{"from":{"status":"retired"},"to":{"status":"available"}}}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:18:19.413421
1052	1	DECOMMISSION	asset	22	AJA Ki Pro Ultra 12G Recorder	{"reason":"Test Decommission\\n","previousStatus":"available"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:18:22.933313
1079	1	CREATE	booking	723	test	{"bookingType":"production","studioId":5,"studioIds":[5,17],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-28 18:27:46.287494
1053	1	CREATE	booking	722	Test assets booking	{"bookingType":"production","studioId":13,"studioIds":[13],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:43:20.224739
1080	1	UPDATE	booking	723	test	{"originalBooking":{"title":"test","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"test","description":"stetsetset","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":5,"templateId":null,"pcrRoomId":null,"studioIds":[5,17]},"studioIds":[5,17],"linkedGroupId":null,"hasLinked":null}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-28 19:57:12.428819
1054	1	UPDATE	booking	722	Test assets booking	{"originalBooking":{"title":"Test assets booking","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test assets booking","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:44:08.375352
1055	1	CHECKOUT	asset	29	Anton Bauer Gold Mount Extension	{"checkedOutBy":"admin","purpose":"Test booking with assets","notes":""}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:44:18.262309
1056	1	CHECKIN	asset	29	Anton Bauer Gold Mount Extension	{"checkedInBy":"admin"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:48:10.714385
1057	1	CHECKIN	asset	25	SDI BNC Cable 25ft (x10)	{"checkedInBy":"admin"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:48:57.170307
1058	1	CHECKIN	asset	14	Sennheiser MKH 416 Shotgun Mic	{"checkedInBy":"admin"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:48:58.91977
1059	1	SYSTEM_MIGRATION	assets_system	\N	\N	{"message":"Booking-asset planning migration v1.5.7 completed. Created booking_assets table for informational gear planning per production. Checkout from Assets page with a booking selected auto-adds to the plan."}	\N	\N	2026-03-15 04:53:13.299791
1060	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:59:50.996053
1061	1	CHECKOUT	asset	29	Anton Bauer Gold Mount Extension	{"checkedOutBy":"admin","purpose":"","notes":""}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 05:00:37.230587
1062	1	CHECKOUT	asset	32	Anton Bauer Titon Base 240 Battery	{"checkedOutBy":"admin","purpose":"","notes":""}	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.2 Mobile/15E148 Safari/604.1	2026-03-15 05:01:07.405916
1063	1	CHECKIN	asset	29	Anton Bauer Gold Mount Extension	{"checkedInBy":"admin"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 05:01:49.474607
1064	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.2 Mobile/15E148 Safari/604.1	2026-03-15 19:54:13.64779
1065	1	CREATE	asset	40	UltraStudio Monitor	{"category":"accessory","status":"available","location":"IT office "}	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.2 Mobile/15E148 Safari/604.1	2026-03-15 20:36:57.364639
1066	1	CHECKOUT	asset	40	UltraStudio Monitor	{"checkedOutBy":"admin","purpose":"Test ","notes":""}	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.2 Mobile/15E148 Safari/604.1	2026-03-15 20:37:20.391226
1067	1	CHECKOUT	asset	29	Anton Bauer Gold Mount Extension	{"checkedOutBy":"admin","purpose":"Test assets booking","notes":""}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 22:28:33.003402
1068	1	CHECKIN	asset	32	Anton Bauer Titon Base 240 Battery	{"checkedInBy":"admin"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 22:44:57.685346
987	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:09:27.202704
988	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:48:33.711687
989	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:49:25.688349
990	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:49:38.642334
991	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.9.254"}	10.81.9.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:49:57.157148
999	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.4.28"}	10.81.4.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 19:44:17.021819
992	1	CREATE	booking	709	Test in use filtering	{"bookingType":"production","studioId":13,"studioIds":[13,10],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	10.81.13.100	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 08:03:09.313405
993	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.10.112	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 17:58:01.925594
1000	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.5.166"}	10.81.5.166	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 19:44:36.15428
994	1	CREATE	booking	710	Testing timeline 2 day	{"bookingType":"production","studioId":21,"studioIds":[21,17,8],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	10.81.5.166	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:09:31.595867
1003	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.9.131"}	10.81.9.131	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-27 02:32:10.996565
1005	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.1.156"}	10.81.1.156	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-28 03:06:10.840821
1006	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.8.13"}	10.81.8.13	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-28 05:06:45.461758
1007	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.5.166"}	10.81.5.166	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-28 05:46:48.57485
1009	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.0.181"}	10.81.0.181	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-28 17:30:32.399507
1012	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.6.75"}	10.81.6.75	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0	2026-01-12 17:41:29.725392
1020	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.11.177"}	10.81.11.177	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 00:53:17.230298
995	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.9.131	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:11:19.969629
1008	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.0.181"}	10.81.0.181	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-28 05:47:00.963487
1010	1	CREATE	booking	711	Test Studio Status	{"bookingType":"production","studioId":2,"studioIds":[2,3],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	10.81.8.13	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-28 17:37:45.022532
1021	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.9.111"}	10.81.9.111	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 00:56:32.922074
996	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.6.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:15:57.64666
1011	1	UPDATE	booking	711	Test Studio Status	{"originalBooking":{"title":"Test Studio Status","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test Studio Status","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":2,"templateId":null,"pcrRoomId":null,"studioIds":[2,3]},"studioIds":[2,3],"linkedGroupId":null,"hasLinked":null}	10.81.8.13	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-28 17:44:57.098759
1026	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.118"}	10.81.3.118	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	2026-02-16 01:36:10.110273
997	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"cancelled"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.5.166	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:16:08.21259
1027	1	CREATE	booking	712	test copying booking	{"bookingType":"production","studioId":5,"studioIds":[5],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[42]}	10.81.7.134	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	2026-02-16 01:42:20.659269
998	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.11.23	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:16:15.589661
1028	1	DELETE	booking	712	test copying booking	{"deletedBookingIds":[712],"bookingTitle":"test copying booking","bookingType":"production","studioId":5,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	10.81.5.13	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	2026-02-16 01:55:50.190824
1030	1	DELETE	booking	714	test copying booking	{"deletedBookingIds":[714],"bookingTitle":"test copying booking","bookingType":"production","studioId":5,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	10.81.5.13	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	2026-02-16 01:55:58.739937
1029	1	DELETE	booking	713	test copying booking	{"deletedBookingIds":[713],"bookingTitle":"test copying booking","bookingType":"production","studioId":5,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	10.81.5.13	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	2026-02-16 01:55:55.252965
1032	1	CREATE	booking	716	test linked booking	{"bookingType":"production","studioId":4,"studioIds":[4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	10.81.7.134	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	2026-02-16 01:56:46.114824
1031	1	DELETE	booking	715	test copying booking	{"deletedBookingIds":[715],"bookingTitle":"test copying booking","bookingType":"production","studioId":5,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	10.81.5.13	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0	2026-02-16 01:56:02.200122
1037	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	2026-03-13 20:37:03.9832
1038	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	2026-03-14 01:03:31.627352
1039	1	CREATE	booking	721	Test booking with assets	{"bookingType":"production","studioId":2,"studioIds":[2,3],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":null,"linkedGroupId":null,"notifyList":[]}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	2026-03-14 04:51:34.944673
1041	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-14 04:57:01.529141
1042	1	SYSTEM_MIGRATION	assets_system	\N	\N	{"message":"Asset management migration v1.5.4 completed. Created assets and asset_checkouts tables with indexes and foreign keys."}	\N	\N	2026-03-14 05:05:35.068048
1044	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"127.0.0.1"}	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.2 Mobile/15E148 Safari/604.1	2026-03-14 16:46:11.188727
1045	1	SYSTEM_MIGRATION	assets_system	\N	\N	{"message":"Asset photos migration v1.5.5 completed. Created asset_photos table with indexes and foreign key to assets."}	\N	\N	2026-03-14 18:13:41.56494
1046	1	CLEANUP	audit_logs	\N	Audit Log Cleanup	{"deletedCount":911,"daysToKeep":90}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-15 04:06:32.647784
\.


--
-- TOC entry 3853 (class 0 OID 32770)
-- Dependencies: 260
-- Data for Name: booking_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.booking_assets (id, booking_id, asset_id, added_by, added_at) FROM stdin;
3	722	32	1	2026-03-15 04:51:27.467075+00
4	721	29	1	2026-03-15 05:00:16.329553+00
5	721	32	1	2026-03-15 05:00:18.743744+00
6	722	29	1	2026-03-15 22:28:33.003587+00
\.


--
-- TOC entry 3865 (class 0 OID 65636)
-- Dependencies: 272
-- Data for Name: booking_crew; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.booking_crew (id, booking_id, position_id, crew_member_id, status, rate_type, rate_snapshot_cents, response_token, invited_at, responded_at, decline_reason, notes, created_by, created_at) FROM stdin;
4	723	3	2	pending	day	50000	pUuJgSmQne-3fcqRA9vIxyeVDwkwSTFpRYfhiyeF4F4	2026-05-29 18:19:25.794	\N	\N	\N	1	2026-05-29 18:19:22.221219
\.


--
-- TOC entry 3812 (class 0 OID 24597)
-- Dependencies: 219
-- Data for Name: booking_studios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.booking_studios (id, booking_id, studio_id) FROM stdin;
493	51	3
494	51	4
497	52	3
498	52	4
522	53	3
160	47	13
161	43	9
162	43	4
163	46	4
164	46	9
165	44	3
166	45	3
1733	76	3
1734	76	4
1737	120	1
1738	120	2
1739	121	1
1740	121	2
1741	122	1
1742	122	2
1743	119	1
1744	119	2
540	71	9
541	72	9
542	73	9
543	74	9
1747	81	3
1748	81	4
552	75	3
553	75	4
557	78	3
558	78	4
565	80	3
566	80	4
567	82	3
568	82	4
569	83	3
570	83	4
2494	140	9
2495	140	12
573	77	3
574	77	4
467	38	13
468	64	13
469	65	13
470	33	1
471	33	2
472	37	1
473	37	2
474	66	1
475	66	2
476	35	1
477	35	2
478	36	1
479	36	2
482	55	1
483	55	2
484	41	7
487	50	4
488	50	9
489	49	4
490	49	9
11992	367	3
4031	235	3
581	86	8
4032	235	4
584	89	9
585	90	9
586	91	9
587	92	9
588	93	9
591	94	3
592	95	3
4033	236	3
4034	236	4
4041	252	8
4044	323	7
11993	367	4
13271	577	13
13273	579	13
12518	531	8
609	48	4
610	48	9
711	100	10
916	101	5
1181	103	4
1182	103	3
1236	54	1
1237	54	2
1292	70	8
2049	133	6
2050	134	3
2051	134	4
12519	532	8
12520	533	8
11937	429	6
12011	432	1
3851	141	9
3852	141	12
12544	552	6
12545	552	7
12546	552	8
2063	135	3
2064	135	4
2065	88	8
2066	136	14
2067	96	9
2068	96	12
2069	97	9
2070	97	12
2071	98	3
2072	98	4
2073	137	3
2074	137	4
12371	211	9
2077	139	9
2078	139	12
3878	195	6
3879	195	7
12378	243	3
12379	243	4
3880	195	8
3881	195	17
2087	144	3
2088	144	4
12401	430	21
12409	234	6
12410	234	7
2095	148	3
2096	148	4
12411	234	8
12412	234	17
12413	234	22
11988	285	1
3894	264	8
11989	285	2
12070	373	3
3898	267	8
3902	270	1
12071	373	4
3903	270	2
3904	271	1
3905	271	2
2118	160	8
2119	161	8
3906	272	1
2121	163	8
3907	272	2
2123	165	8
2124	166	8
3908	273	1
3909	273	2
3918	257	1
3919	257	2
3920	278	1
3921	278	2
3922	279	1
3923	279	2
12116	204	8
2140	169	3
2141	172	3
3924	280	1
3925	280	2
3926	281	1
3927	281	2
3928	282	1
12118	233	6
12119	233	7
3929	282	2
3930	283	1
3931	283	2
3932	284	1
3933	284	2
12120	233	8
12121	233	17
12123	221	3
12124	222	3
2159	188	3
2160	188	4
2167	185	9
2168	185	12
2174	192	13
12810	475	8
2177	193	13
2178	194	13
2179	84	3
2180	84	4
12154	216	8
11934	400	5
12814	476	3
4042	321	7
12522	535	9
12523	536	9
13272	578	13
12004	389	7
12012	246	8
12526	539	9
11948	197	3
2193	99	3
2194	99	4
11949	197	4
4079	355	5
12527	540	9
12529	542	9
4081	354	5
12530	543	9
12531	544	9
12348	441	19
12349	441	20
3853	145	3
3854	145	4
2207	200	8
3855	150	3
3856	150	4
13283	683	8
2211	164	8
2212	168	8
2214	203	8
12350	441	18
12353	498	19
11986	324	7
2219	208	8
12536	549	9
12183	447	3
12184	447	4
2224	213	9
12188	448	3
12189	448	4
12192	450	3
12193	450	4
12060	363	3
12061	363	4
12196	456	8
12199	453	3
12200	453	4
12205	465	9
12206	466	9
12207	467	9
12208	468	9
12362	446	3
12363	446	4
12538	551	9
12547	552	17
12372	506	21
12209	469	9
12210	470	9
12375	505	9
12380	439	19
13012	630	3
13013	630	4
12823	537	9
12827	489	5
13014	626	3
13015	626	4
12838	611	20
13018	628	1
13020	629	1
12211	471	9
12212	472	9
12104	434	9
13024	548	9
12222	479	3
12117	433	9
12127	239	3
12128	239	4
13030	546	9
12548	552	22
12550	553	19
12876	620	3
12381	439	20
12233	438	19
12234	438	20
12235	438	18
12382	439	18
12247	484	3
12248	484	4
12250	482	1
12251	482	2
12255	249	3
12256	249	4
12138	245	3
12139	245	4
12258	202	3
12259	202	4
2301	250	3
13042	571	5
4121	370	3
4122	370	4
4124	309	8
4127	162	8
4128	167	8
4130	178	9
4131	179	9
12402	431	21
12406	219	8
2482	256	9
2483	256	12
12144	241	3
12145	241	4
12146	248	8
4142	251	3
2488	142	9
2489	142	12
2490	143	9
2491	143	12
2492	146	3
2493	146	4
4143	251	4
12407	512	8
3899	258	7
3900	268	13
3901	269	13
4158	376	3
4159	376	4
12273	483	3
12586	557	6
12587	557	7
12588	557	8
13058	572	3
12589	557	17
12590	557	22
13059	572	4
12601	504	18
12290	493	19
12292	494	8
13067	645	8
12610	232	3
12611	232	4
12303	495	1
12304	495	2
13077	573	8
13102	648	20
13103	648	21
13110	641	3
12327	210	8
12329	190	3
4737	396	8
12330	190	4
12333	398	14
6415	402	13
12335	244	3
12336	244	4
13111	641	4
13114	513	3
12960	633	3
13115	513	4
13119	656	9
13127	659	8
12002	217	9
13280	708	3
12821	593	5
12824	538	9
12164	359	3
12015	237	3
12016	237	4
12165	359	4
12828	490	5
12829	490	23
12833	566	3
12364	442	19
12365	442	20
12366	442	18
12370	206	8
12834	566	4
13016	632	3
11935	393	3
4039	175	9
4040	319	8
3983	149	3
3984	149	4
11936	393	4
13017	632	4
12551	554	6
12552	554	7
12178	445	3
11950	198	3
4060	337	13
4061	338	13
4062	339	13
4063	340	13
3995	182	14
12553	554	8
3997	174	9
3998	173	9
12057	436	18
12058	437	18
12062	435	18
12554	554	17
12555	554	22
11951	198	4
4005	180	14
12179	445	4
12182	454	8
13281	708	4
4009	311	3
4010	311	4
4011	313	7
4012	314	7
12400	492	19
12403	511	3
12404	511	4
4016	255	6
4017	151	8
4018	310	3
4019	310	4
12408	501	19
4022	154	3
4023	154	4
4024	155	3
4025	155	4
12854	616	2
12862	609	3
12863	609	4
4077	308	13
13043	615	8
12882	568	3
11987	341	13
12883	568	4
12884	575	8
12581	559	6
12582	559	7
12583	559	8
12584	559	17
12105	218	9
12109	240	3
12110	240	4
12111	247	8
12187	226	8
4120	316	8
4123	371	13
12122	214	9
12190	449	3
4129	177	9
4132	207	8
4133	212	9
4134	220	3
12191	449	4
4140	315	7
12129	457	8
12132	242	3
12133	242	4
12585	559	22
4150	186	9
4151	186	12
4153	378	6
12591	558	6
12592	558	7
4160	375	5
12593	558	8
12594	558	17
12149	215	8
12150	223	8
13048	640	3
12899	623	2
12201	461	8
4448	392	3
4449	392	4
12202	462	8
12203	463	8
4720	385	8
4721	386	8
4734	395	9
4738	372	3
4739	372	4
12595	558	22
13049	640	4
13052	642	3
13053	642	4
12220	477	3
13056	635	1
13060	644	3
13061	644	2
13065	550	9
12608	231	3
12609	231	4
6747	426	13
6749	333	7
12246	485	8
6752	357	3
6753	357	4
6754	181	14
6755	312	14
13075	646	8
12252	486	19
6758	397	9
12253	486	20
12254	486	18
7065	356	3
7066	356	4
13078	614	3
13079	614	4
7069	362	3
7070	362	4
12941	619	5
12942	561	5
12274	487	2
7079	201	3
7080	201	4
12285	491	7
12293	205	8
12302	224	8
12632	563	3
12633	563	4
12954	556	6
12955	556	7
12636	565	3
12321	365	3
12322	365	4
12637	565	4
12328	455	8
12331	191	3
12332	191	4
12334	399	14
12640	567	3
12641	567	4
12644	569	3
12645	569	4
12646	570	3
12647	570	4
12956	556	8
12957	556	17
12958	556	22
12998	634	3
12999	634	4
13004	576	3
13005	576	4
13008	636	21
12661	503	18
13276	696	3
12822	591	5
12825	608	3
12826	608	4
12830	541	9
13019	627	1
12668	368	3
12669	368	4
12670	499	3
12671	499	4
13023	547	9
13029	637	3
13277	696	4
13041	562	5
13044	638	3
13045	638	4
12837	610	18
13286	707	18
13287	707	21
12684	443	19
13057	618	18
13062	612	3
12687	263	19
12688	262	19
12689	261	19
12690	581	20
12691	582	20
13063	612	4
13066	545	9
12694	530	3
12695	530	4
12696	451	3
12697	451	4
12698	583	8
13073	622	3
13074	622	4
13076	534	9
13081	639	5
12706	452	3
12707	452	4
12708	584	8
12709	227	9
12710	227	12
12885	621	13
13094	647	20
13095	647	21
12715	228	9
12716	228	12
13104	650	20
12721	588	19
12722	588	20
12723	588	18
12724	588	21
12725	587	19
12726	587	20
12727	587	18
12728	587	21
13105	650	21
13106	651	20
13107	651	21
12734	580	9
12735	580	12
13118	655	9
13120	654	9
13128	660	9
13129	661	9
13130	662	9
13131	663	9
13132	664	18
13133	665	18
13134	653	18
13135	653	21
12754	478	8
12755	585	8
12758	594	8
12762	601	17
12763	589	3
12764	229	9
12765	229	12
12766	586	3
12767	586	4
12770	500	1
12771	500	2
12772	481	6
12773	481	7
12774	481	8
12775	481	17
12776	481	22
13141	667	3
12779	473	9
12780	464	8
13142	667	4
13143	666	3
13144	666	4
12788	590	3
13145	643	5
13148	668	3
12793	564	3
12794	564	4
13149	668	4
13150	669	5
12797	606	5
12798	606	23
12799	607	20
12800	474	8
13161	658	5
13163	674	9
13164	675	9
13165	676	9
13166	677	9
13169	679	8
13170	680	9
13171	681	9
13172	682	9
13174	684	14
13175	685	3
13176	685	4
13178	672	14
13183	673	8
13190	671	3
13191	671	4
13212	688	3
13213	688	4
13214	689	8
13215	678	3
13216	678	4
13217	617	3
13218	617	4
13219	555	6
13220	555	7
13221	555	8
13222	555	17
13223	555	22
13224	687	6
13225	687	22
13226	687	23
13230	690	1
13234	691	19
13235	692	18
13236	693	18
13237	624	5
13238	625	5
13239	694	20
13240	694	19
13245	697	3
13246	697	4
13247	698	8
13249	695	8
13250	699	9
13251	700	9
13252	701	9
13253	702	9
13254	703	3
13255	703	4
13262	705	3
13263	705	4
13264	706	3
13265	706	4
13266	670	8
13267	686	3
13268	686	4
13270	704	11
13292	710	21
13293	710	17
13294	710	8
13301	709	13
13302	709	10
13305	711	2
13306	711	3
13311	716	4
13312	717	4
13313	718	4
13314	719	4
13315	720	4
13316	721	2
13317	721	3
13319	722	13
13324	723	5
13325	723	17
\.


--
-- TOC entry 3814 (class 0 OID 24601)
-- Dependencies: 221
-- Data for Name: booking_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.booking_types (id, name, description, color, is_active, sort_order, created_at, updated_at) FROM stdin;
1	Production	Regular production booking	#3b82f6	t	1	2025-07-09 04:57:49.568962	2025-07-09 04:57:49.568962
2	Rehearsal	Rehearsal session	#8b5cf6	t	2	2025-07-09 04:57:49.576813	2025-07-09 04:57:49.576813
3	Meeting	Meeting or conference	#10b981	t	3	2025-07-09 04:57:49.583719	2025-07-09 04:57:49.583719
4	Training	Training session	#f59e0b	t	4	2025-07-09 04:57:49.59057	2025-07-09 04:57:49.59057
6	Setup	Setup or preparation	#6b7280	t	6	2025-07-09 04:57:49.604197	2025-07-09 04:57:49.604197
5	Strike	Equipment or system testing	#ef4444	t	5	2025-07-09 04:57:49.597256	2025-07-09 04:57:49.597256
10	Tour	Equipment or system testing	#8000ff	t	5	2025-07-09 12:59:36.881894	2025-07-09 12:59:36.881894
13	Other	Other type of booking	#84cc16	t	7	2025-07-10 02:09:10.281965	2025-07-10 02:09:10.281965
14	Testing	Equipment or system testing	#ef4444	t	5	2025-08-01 18:20:08.167716	2025-08-01 18:20:08.167716
\.


--
-- TOC entry 3816 (class 0 OID 24612)
-- Dependencies: 223
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bookings (id, title, description, studio_id, user_id, start, "end", type, severity, template_id, notify_list, created_at, pcr_room_id, color, status, link_group_id, is_primary_in_group) FROM stdin;
218	Centerpoint News Updates	Cody Crouch	9	1	2025-07-11 15:00:00	2025-07-11 16:00:00	production	\N	\N	[]	2025-05-30 20:05:20.51	\N	#ffaa00	confirmed	\N	f
553	CAR: TBN Rabbi Sobel Prep Day		19	22	2025-08-15 14:00:00	2025-08-15 22:00:00	setup	\N	23	[24, 7]	2025-08-06 20:44:51.225	\N	#814bd2	confirmed	\N	f
483	Prerecords with Blynda	Recording from 2p-4p segments for tomorrow's live Praise.	3	1	2025-07-16 17:00:00	2025-07-16 22:00:00	production	\N	20	[]	2025-07-14 19:40:02.66	1	#4f7a28	confirmed	\N	f
670	Stakelbeck Tonight		8	16	2025-10-16 16:00:00	2025-10-16 20:30:00	production	\N	6	[]	2025-10-03 15:52:15.403	64	#008cb4	confirmed	\N	f
577	SFC: Zane Gray	Director: Ryan Tyler -\nREMOTE IN CABO - Control Room PCR4 @ PLEX -\nLIVE @ 4:00 - 7:00 PM CT / 2:00 - 5:00 PM PT	13	9	2025-10-18 17:00:00	2025-10-19 01:00:00	production	\N	\N	[]	2025-08-13 16:18:46.912	64	#ff2600	confirmed	\N	f
505	Stakscast Episode	Erick in Y to interview Mark Gerson (Inbound) @ 2:30pm CT.\nPodcast Mic / Monitor behind Erick / D Columns. / 1x Cam\nPCR1 - ACR 1	9	1	2025-07-28 19:30:00	2025-07-28 21:00:00	production	\N	6	[14]	2025-07-25 15:25:24.859	\N	#008cb4	cancelled	\N	f
578	SFC: Zane Gray	Director: Ryan Tyler -\nREMOTE IN CABO - Control Room PCR4 @ PLEX\n- LIVE @ 4:30 - 7:30 PM CT / 2:30 - 5:30 PM PT	13	9	2025-10-19 17:30:00	2025-10-20 01:30:00	production	\N	\N	[]	2025-08-13 16:18:46.935	64	#ff2600	confirmed	\N	f
579	SFC: Zane Gray	Director: Ryan Tyler -\nREMOTE IN CABO - Control Room PCR4 @ PLEX\n- LIVE @ 4:30 - 7:30 PM CT / 2:30 - 5:30 PM PT	13	9	2025-10-20 17:30:00	2025-10-21 01:30:00	production	\N	\N	[]	2025-08-13 16:18:46.95	64	#ff2600	confirmed	\N	f
530	SFC	Director: Ryan Tyler	3	9	2025-09-01 11:00:00	2025-09-01 19:30:00	production	\N	\N	[]	2025-08-05 16:27:11.95	64	#ff2600	cancelled	\N	f
588	Trilogy: DP Workshop	Overview: Trilogy Studios is hosting a workshop for DPs/ Cinematographers in the area. This is a ticketed only event, capped at 40 individuals attending the class. \nTrilogy POC: Sara & Taylor \nHaze Machine: TBD \n\nFriday Sept 12th: Prep Day \nSmall group of crew onsite to prep scenes/ stages \nEst start time: 9am \nWrap time: 5pm \nEst # of people: 15\nNames: TBD \n\nSaturday Sept 13th: Workshop Day \nDoors Open to attendees: 9:30am \nEvent start time: 10am \nWelcome/ Trilogy Presentation/ Shine Cine: 10:15am\nSplit to groups A & B: 10:30am\nLunch: 12:30pm \nSwap groups A & B: 1:30pm \nEst attendee wrap: 4pm \nCrew wrap out: 5pm\nEst # of People: 50 \nNames: TBD 	21	23	2025-09-13 14:00:00	2025-09-13 22:00:00	other	\N	23	[24, 7]	2025-08-19 16:25:18.843	\N	#814bd2	confirmed	\N	f
500	Trilogy Publishing Programs	Recording two or three 30 minute book author programs with Trilogy Publishing. Hosted by Blynda Lane.\nGlass green room and news makeup room.\n11:30am - Blynda arrival for hair/makeup	1	9	2025-09-03 16:00:00	2025-09-03 22:00:00	production	\N	20	[]	2025-07-23 18:33:52.759	65	#4f7a28	confirmed	\N	f
63	Firewall Upgrade		\N	1	2025-05-08 18:30:00	2025-05-08 20:00:00	maintenance	medium	\N	[]	2025-05-07 22:11:00.272	\N	#3B82F6	confirmed	\N	f
635	CHARLIE KIRK MEMORIAL	Feed from Memorial - STUDIO A -\nMemorial START @ 12:00 PM CT / 10:00 AM PST\n- Crew Call Time: 8am - 7pm	1	16	2025-09-21 13:00:00	2025-09-22 00:00:00	production	\N	\N	[]	2025-09-15 14:23:32.846	\N	#4B83E2	confirmed	\N	f
492	SHOOT: Team People Car Shoot	Production Company: TeamPeople\nTrilogy onsite contact: Sara Joyner & Parke May\nTrilogy Receptionist: Cristina Trejo \nHaze Machine: No\n\n\nAug 7th \nEst start time: 8am\nEst wrap time: 6pm\nEst amount of crew: 25-30 \n**Studio J for crew holding/ lunch \n\nAug 8th\nEst start time: 7am\nEst wrap time: 7pm\nEst amount of crew: 25-30\n**Studio J for crew holding/ lunch \n\nList of names: attached 	19	23	2025-08-07 13:00:00	2025-08-07 23:00:00	production	\N	23	[24, 7]	2025-07-17 20:46:38.23	\N	#814bd2	confirmed	\N	f
439	Trilogy: RED Camera Prep Day	Leads: Taylor and Sara\nOverview: RED Camera hosting event on all 3 Trilogy stages to show off new equipment. Everyone in attendance has been pre-registered (see link below)\nHaze Machine: NO\n \nPlanning bible: https://docs.google.com/spreadsheets/d/1caeHS74ej--oV0q8nJPk02I-TcUpAP6Ux-fONSw0Mzs/edit?gid=1571926169#gid=1571926169 \n \nTuesday: Prep Day\nEst start time: 10:30am\nEst end time: 5pm\n**Studio J used for lunch\n# of attendees: 10-15\n\nTuesday list of names: (unfinished)  \nChristina Kennedy\nPhilip Grossman\nSean Busby\nKyle Busby\nJames Lucarelli\nDan Duran\nMatthew Carman\nBobby Hester\n \n \n \nWednesday: Event Day\nEst prep start time: 9am\nAttendee arrival start time: 10am  \nAttendee wrap time: 4pm\nCrew wrap time: 5pm\n# of attendees: 100+ (see planning bible for running list of names)\n**Studio J used for lunch\n 	19	23	2025-07-29 15:30:00	2025-07-29 22:00:00	rehearsal	\N	23	[7]	2025-07-08 15:29:39.216	\N	#814bd2	confirmed	\N	f
612	Praise	2:30pm M&L hosting Sean McNamara	3	9	2025-09-24 18:30:00	2025-09-24 21:30:00	production	\N	8	[]	2025-09-05 17:15:43.753	\N	#ff40ff	confirmed	\N	f
626	The Korey with a K Show Production	Would load in AFTER CODY's Updates -\nNO TBN CAMS - CLIENT FIELD CAMS\nLED/GFX	3	16	2025-09-23 15:30:00	2025-09-24 02:00:00	production	\N	23	[24]	2025-09-12 21:07:11.802	\N	#814bd2	confirmed	\N	f
615	5 Min w/ Jesus	SHELIA - CALL TIME: 1:00-4:00pm	8	16	2025-09-22 17:30:00	2025-09-22 21:00:00	production	\N	20	[]	2025-09-05 20:41:20.853	65	#4f7a28	cancelled	\N	f
675	Centerpoint News Updates	CODY	9	16	2025-10-15 15:00:00	2025-10-15 16:00:00	production	\N	12	[]	2025-10-06 21:33:06.116	1	#ffaa00	confirmed	\N	f
677	Centerpoint News Updates	CODY	9	16	2025-10-17 15:00:00	2025-10-17 16:00:00	production	\N	12	[]	2025-10-06 21:35:33.288	1	#ffaa00	confirmed	\N	f
679	Centerpoint News Updates	BLYNDA	8	16	2025-10-20 15:00:00	2025-10-20 16:00:00	production	\N	12	[]	2025-10-06 21:47:25.643	1	#ffaa00	confirmed	\N	f
104	Network Outage		\N	1	2025-05-07 22:30:00	2025-05-08 00:30:00	maintenance	high	\N	[]	2025-05-08 22:59:32.421	\N	#3B82F6	confirmed	\N	f
105	Curator Upgrade		\N	1	2025-05-09 16:00:00	2025-05-09 17:00:00	maintenance	medium	\N	[]	2025-05-08 23:23:32.289	\N	#3B82F6	confirmed	\N	f
106	Comms are down		\N	6	2025-05-06 07:00:00	2025-05-07 06:59:59.999	all-day:maintenance	high	\N	[]	2025-05-08 23:37:43.416	\N	#3B82F6	confirmed	\N	f
506	Trilogy Tour	Point of Contact: Joe Worth \n\n\nSCHEDULE OF EVENTS: \n10:30 am - I arrive early, while Dan and some guests go and do something else. \n1:00 pm - Full guest arrival and check in\n1:15 pm - Meet in the conference room, eat a bit, and give a small presentation on the tech, benefits to Maryland, including tax benefits. (we need to link to a TV screen to show the ppt)\n2:00 pm - Start the tour: Big wall, car processing wall, then the staged area to get people into the scene to show the technology. \n3:30/4pm - Tour finishes\n \nLIST: (15-17 total)\n- Jeremy Toton \n- Greg Brayton\n- Randy Marriner \n- Joe Walsh \n- Neil Katz \n- Justin Ross and Brad Frome \n- Stephen Rice \n- Medley DeLeonibus\n- Billy Cole \n- Ryan Miller \n- Kate Lawrence\n- Brett Bernard\n- Possibly: Maggie Pederson and Michael Pederson\n- Zachary Guerra	21	23	2025-07-30 15:30:00	2025-07-30 21:00:00	tour	\N	23	[24, 7]	2025-07-25 17:26:55.62	\N	#814bd2	confirmed	\N	f
456	Stakelbeck Tonight		8	9	2025-08-13 16:00:00	2025-08-13 20:30:00	production	\N	6	[9, 7]	2025-07-09 18:36:38.114	1	#4B83E2	confirmed	\N	f
242	Stakelbeck Tonight		3	1	2025-07-24 16:00:00	2025-07-24 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.569	1	#4B83E2	confirmed	\N	f
531	Centerpoint News Updates	Blynda Lane	8	9	2025-09-08 15:00:00	2025-09-08 15:30:00	production	\N	\N	[]	2025-08-05 16:27:36.179	1	#ffaa00	confirmed	\N	f
532	Centerpoint News Updates	Blynda Lane	8	9	2025-09-15 15:00:00	2025-09-15 15:30:00	production	\N	\N	[]	2025-08-05 16:27:36.214	1	#ffaa00	confirmed	\N	f
227	SFC	Director: Ryan Tyler	9	9	2025-08-20 12:30:00	2025-08-20 21:00:00	production	\N	\N	[]	2025-05-30 20:16:31.817	64	#ff2600	cancelled	\N	f
484	Stakelbeck Tonight		3	1	2025-07-15 15:30:00	2025-07-15 19:30:00	production	\N	6	[14, 9, 7]	2025-07-14 20:09:11.433	1	#008cb4	confirmed	\N	f
202	Praise	11:00am M&L or Sheila Walsh host Jonathan Cahn\n12:30pm Erick Stakelbeck hosts Jonathan Cahn\nThe conversations for these programs will be about Jonathan Cahn’s new book, The Avatar that will be released in September 2025	3	1	2025-07-21 14:00:00	2025-07-21 19:30:00	production	\N	8	[]	2025-05-27 21:47:38.692	1	#ff40ff	confirmed	\N	f
533	Centerpoint News Updates	Blynda Lane	8	9	2025-09-22 15:00:00	2025-09-22 15:30:00	production	\N	\N	[]	2025-08-05 16:27:36.228	1	#ffaa00	confirmed	\N	f
554	Better Together		6	9	2025-10-14 13:00:00	2025-10-14 22:30:00	production	\N	13	[]	2025-08-06 21:23:39.304	65	#942192	confirmed	\N	f
688	STAKS LIVE	SPECIAL REPORT - LIVE @ 6:30-8:00PM CT - STUDIO C	3	16	2025-10-13 21:30:00	2025-10-14 01:30:00	production	\N	6	[]	2025-10-10 17:10:11.904	1	#008cb4	confirmed	\N	f
453	Stakelbeck Tonight		3	9	2025-08-21 16:00:00	2025-08-21 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.414	1	#4B83E2	confirmed	\N	f
455	Stakelbeck Tonight		8	9	2025-08-08 16:00:00	2025-08-08 20:30:00	production	\N	6	[]	2025-07-09 18:36:38.1	1	#4B83E2	cancelled	\N	f
555	Better Together		6	9	2025-10-28 13:00:00	2025-10-28 22:30:00	production	\N	13	[14]	2025-08-06 21:23:49.484	1	#942192	cancelled	\N	f
512	Centerpoint News Updates	Blynda Lane	8	9	2025-08-01 15:00:00	2025-08-01 15:30:00	production	\N	\N	[]	2025-07-30 14:21:10.234	1	#ffaa00	confirmed	\N	f
452	Stakelbeck Tonight		3	9	2025-08-20 16:30:00	2025-08-20 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.4	1	#4B83E2	confirmed	\N	f
587	Trilogy: DP Workshop	Overview: Trilogy Studios is hosting a workshop for DPs/ Cinematographers in the area. This is a ticketed only event, capped at 40 individuals attending the class. \nTrilogy POC: Sara & Taylor \nHaze Machine: TBD \n\nFriday Sept 12th: Prep Day \nSmall group of crew onsite to prep scenes/ stages \nEst start time: 9am \nWrap time: 5pm \nEst # of people: 15\nNames: TBD \n\nSaturday Sept 13th: Workshop Day \nDoors Open to attendees: 9:30am \nEvent start time: 10am \nWelcome/ Trilogy Presentation/ Shine Cine: 10:15am\nSplit to groups A & B: 10:30am\nLunch: 12:30pm \nSwap groups A & B: 1:30pm \nEst attendee wrap: 4pm \nCrew wrap out: 5pm\nEst # of People: 50 \nNames: TBD 	19	23	2025-09-12 14:00:00	2025-09-12 22:00:00	other	\N	23	[24, 7]	2025-08-19 16:25:04.241	\N	#814bd2	confirmed	\N	f
692	Halloween Wicked Shoot	7AM- 7PM \n6:45 AM- PA and Taylor Tucker arrival \nUsing fog machine\nUsing: Commercial Stage/ Audience Holding/Trilogy Greenrooms\n	18	24	2025-10-17 12:00:00	2025-10-18 00:00:00	production	\N	23	[24, 7, 14]	2025-10-14 22:45:33.151	\N	#814bd2	confirmed	\N	f
580	SFC	Director: Ryan Tyler	9	9	2025-08-29 14:00:00	2025-08-29 22:00:00	production	\N	\N	[]	2025-08-13 20:57:33.277	64	#ff2600	confirmed	\N	f
694	Silver Sail Entertainment 	Production will bounce from the cinematic stage to the car stage. \n\nAreas they will be using: Studios, Audience holding, (TENT) BT greenroom. 	20	24	2025-10-29 14:00:00	2025-10-29 22:00:00	production	\N	23	[24, 7]	2025-10-14 22:57:34.427	\N	#814bd2	confirmed	\N	f
697	Stakelbeck Tonight		3	16	2025-10-22 16:00:00	2025-10-22 20:30:00	production	\N	6	[]	2025-10-15 17:45:07.273	1	#008cb4	confirmed	\N	f
476	Centerpoint News Updates	Cody Crouch - VO FROM CA 	3	9	2025-08-29 15:00:00	2025-08-29 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.971	1	#ffaa00	cancelled	\N	f
616	DOVES PROMOS	TALENT: Kristin Adams\nSTART TIME: 2:00 PM (Would start after Praise wraps)\nCAMS: JIB / 1X PED\nAUDIO: 1X LAV\nPrompter Needed\n1x Program Monitor 	2	16	2025-09-10 18:00:00	2025-09-10 22:00:00	production	\N	\N	[]	2025-09-05 21:39:52.744	\N	#4B83E2	confirmed	\N	f
501	Trilogy: TBN Eschatology Project	Trilogy POC: Sara Joyner \nTBN POC: Grace Woodward \nHaze Machine: NO \n\n July 31: prep day \nTBN employees only prepping for the shoot throughout the day \n\n\nAug 1: shoot day \nStart time: 8am \nWrap time: 5pm \nEst attendees: 15 (crew names attached) 	19	23	2025-07-31 14:00:00	2025-07-31 22:00:00	production	\N	23	[24, 7]	2025-07-24 14:13:25.499	\N	#814bd2	confirmed	\N	f
493	SHOOT: Team People Car Shoot	**please see day one of filming for information	19	23	2025-08-08 13:00:00	2025-08-08 23:00:00	production	\N	23	[24, 7]	2025-07-17 20:47:13.423	\N	#814bd2	confirmed	\N	f
636	SFC Pre-Pro	PCR4 - Ryan Tyler will be doing pre-pro all day in control room.	21	16	2025-10-17 14:00:00	2025-10-17 22:00:00	other	\N	15	[]	2025-09-15 23:06:04.698	64	#ff2600	confirmed	\N	f
629	The Korey with a K Show Production	NO TBN CAMS - CLIENT FIELD CAMS\n- LED/GFX	1	16	2025-09-24 14:00:00	2025-09-25 00:00:00	production	\N	23	[24]	2025-09-12 21:12:10.833	\N	#814bd2	confirmed	\N	f
645	Stakelbeck Tonight	9am intervirew	8	9	2025-09-24 13:30:00	2025-09-24 15:00:00	production	\N	6	[14]	2025-09-23 20:40:49.993	1	#008cb4	confirmed	\N	f
627	The Korey with a K Show Production	NO TBN CAMS - CLIENT FIELD CAMS\n- LED/GFX	1	16	2025-09-22 14:00:00	2025-09-23 00:00:00	production	\N	23	[24]	2025-09-12 21:11:10.894	\N	#814bd2	confirmed	\N	f
83	Stakelbeck Tonight		3	9	2025-05-21 16:00:00	2025-05-21 20:30:00	production	\N	\N	[]	2025-05-08 14:41:24.35	65	#4B83E2	confirmed	\N	f
38	Through Drama		13	1	2025-05-05 12:00:00	2025-05-05 15:00:00	production	\N	\N	[]	2025-05-07 09:16:23.255	64	#008080	confirmed	\N	f
64	Through Drama	Through Drama	13	1	2025-05-06 12:00:00	2025-05-06 15:00:00	production	\N	\N	[]	2025-05-08 07:44:22.157	64	#008080	confirmed	\N	f
65	Through Drama	Through Drama	13	1	2025-05-07 12:00:00	2025-05-07 15:00:00	production	\N	\N	[]	2025-05-08 07:44:44.412	64	#008080	confirmed	\N	f
33	MSM News		1	1	2025-05-05 11:00:00	2025-05-06 00:00:00	production	\N	\N	[]	2025-05-07 09:14:33.399	1	#800000	confirmed	\N	f
535	Centerpoint News Updates	Cody Crouch	9	9	2025-09-02 15:00:00	2025-09-02 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.289	1	#ffaa00	confirmed	\N	f
536	Centerpoint News Updates	Cody Crouch	9	9	2025-09-03 15:00:00	2025-09-03 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.311	1	#ffaa00	confirmed	\N	f
539	Centerpoint News Updates	Cody Crouch	9	9	2025-09-12 15:00:00	2025-09-12 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.366	1	#ffaa00	confirmed	\N	f
540	Centerpoint News Updates	Cody Crouch	9	9	2025-09-11 15:00:00	2025-09-11 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.382	1	#ffaa00	confirmed	\N	f
446	Stakelbeck Tonight		3	9	2025-08-05 16:00:00	2025-08-05 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.309	1	#4B83E2	cancelled	\N	f
445	Stakelbeck Tonight		3	9	2025-08-04 16:00:00	2025-08-04 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.29	1	#4B83E2	confirmed	\N	f
454	Stakelbeck Tonight		8	9	2025-08-06 16:00:00	2025-08-06 20:30:00	production	\N	6	[9, 7]	2025-07-09 18:36:38.084	1	#4B83E2	confirmed	\N	f
447	Stakelbeck Tonight		3	9	2025-08-07 16:00:00	2025-08-07 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.325	1	#4B83E2	confirmed	\N	f
448	Stakelbeck Tonight		3	9	2025-08-11 16:00:00	2025-08-11 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.339	1	#4B83E2	confirmed	\N	f
449	Stakelbeck Tonight		3	9	2025-08-12 16:00:00	2025-08-12 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.355	1	#4B83E2	confirmed	\N	f
450	Stakelbeck Tonight		3	9	2025-08-14 16:00:00	2025-08-14 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.371	1	#4B83E2	confirmed	\N	f
617	Love Language Series	MOVED TO TUSTIN	3	16	2025-11-24 14:00:00	2025-11-24 23:00:00	production	\N	\N	[]	2025-09-08 17:14:38.257	\N	#4B83E2	cancelled	\N	f
542	Centerpoint News Updates	Cody Crouch	9	9	2025-09-09 15:00:00	2025-09-09 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.415	1	#ffaa00	confirmed	\N	f
543	Centerpoint News Updates	Cody Crouch	9	9	2025-09-16 15:00:00	2025-09-16 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.43	1	#ffaa00	confirmed	\N	f
544	Centerpoint News Updates	Cody Crouch	9	9	2025-09-23 15:00:00	2025-09-23 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.446	1	#ffaa00	confirmed	\N	f
549	Centerpoint News Updates	Cody Crouch	9	9	2025-09-26 15:00:00	2025-09-26 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.521	1	#ffaa00	confirmed	\N	f
551	Centerpoint News Updates	Cody Crouch	9	9	2025-09-30 15:00:00	2025-09-30 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.55	1	#ffaa00	confirmed	\N	f
581	Trilogy Intern Project Production	Production: Trilogy (internal project) \nTrilogy onsite contact: Sara Joyner\nTrilogy Receptionist: n/a (keeping exterior door locked)\nHaze Machine: No\n \n \nAug 14th: Prep Day\nEst start time: 8am\nEst wrap time: 6pm\nEst amount of crew: 10\n**Studio J for crew holding/ lunch\n \nAug 8th: Shoot Day\nEst start time: 8am\nEst wrap time: 6pm\nEst amount of crew: 10\n**Studio J for crew holding/ lunch\n\nProduction bible: https://docs.google.com/spreadsheets/d/1j0uFJaRzIlSF3vFmHeRfEnqjNh99clCS/edit?gid=1880630420#gid=1880630420\n \nNames:\nSophia Gangwere\nCydney Cox\nErica Fulbright\nSuzanne Jackowski\nBucky Brant\nCorwin Gillie\nJack Cline\nHenry Beck\nKatherine Head\nNeemay Shay\nPeter Hoang\nElizabeth Wolff\nRyan Gray\nFelicity Gilmore\nCameron Wadsworth\nEmily Armey\n	20	23	2025-08-14 13:00:00	2025-08-14 23:00:00	production	\N	23	[24, 7]	2025-08-14 15:37:53.718	\N	#814bd2	confirmed	\N	f
485	Erick Stakelbeck - Outbounds	Erick on His Glory TV at 9 AM CT \nErick on Sid Roth's YT channel at 10 AM CT \nNo control room	8	1	2025-07-17 13:30:00	2025-07-17 16:00:00	production	\N	20	[14]	2025-07-14 20:54:13.267	\N	#4f7a28	confirmed	\N	f
196	IRVING POWER OUTAGE	Subject: Oncor Shut Down 2900 W Airport Fwy, Irving Tx\nWhen: Saturday, June 7, 2025 6:00 AM-4:00 PM America/Winnipeg.\nWhere: 2900 W Airport Fwy, Irving, TX 75061, USA\n	\N	9	2025-06-07 11:00:00	2025-06-07 21:00:00	maintenance	critical	\N	[]	2025-05-22 15:06:20.106	\N	#3B82F6	confirmed	\N	f
37	MSM News		1	1	2025-05-06 11:00:00	2025-05-07 00:00:00	production	\N	\N	[]	2025-05-07 09:15:11.859	1	#800000	confirmed	\N	f
451	Stakelbeck Tonight		3	9	2025-08-15 16:00:00	2025-08-15 20:30:00	production	\N	\N	[]	2025-07-09 18:36:12.386	1	#4B83E2	cancelled	\N	f
494	AMAC Spots	Impact Production renting Hit Studio P to record ads for the Charlie Kirk Show. 1 hour rental 11:00am-12:00pm	8	1	2025-07-23 16:00:00	2025-07-23 17:00:00	production	\N	18	[]	2025-07-18 16:38:23.122	\N	#4f7a28	confirmed	\N	f
589	MRO Segments with Blynda	Start time 10:45am	3	9	2025-08-22 15:30:00	2025-08-22 17:30:00	production	\N	20	[14]	2025-08-19 17:22:08.894	1	#4f7a28	confirmed	\N	f
606	SFC Awards Show		5	9	2025-12-02 15:00:00	2025-12-03 05:30:00	production	\N	15	[]	2025-08-26 20:28:21.568	64	#ff2600	confirmed	\N	f
537	Centerpoint News Updates	Cody Crouch	9	9	2025-09-04 15:00:00	2025-09-04 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.336	1	#ffaa00	cancelled	\N	f
538	Centerpoint News Updates	Cody Crouch	9	9	2025-09-05 15:00:00	2025-09-05 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.352	1	#ffaa00	cancelled	\N	f
541	Centerpoint News Updates	Cody Crouch	9	9	2025-09-10 14:30:00	2025-09-10 15:00:00	production	\N	\N	[]	2025-08-05 16:28:04.4	1	#ffaa00	confirmed	\N	f
550	Centerpoint News Updates	Cody Crouch	9	9	2025-09-25 15:00:00	2025-09-25 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.536	1	#ffaa00	confirmed	\N	f
628	The Korey with a K Show Production	NO TBN CAMS - CLIENT FIELD CAMS\n- LED/GFX	1	16	2025-09-23 14:00:00	2025-09-24 00:00:00	production	\N	23	[24]	2025-09-12 21:11:50.679	\N	#814bd2	confirmed	\N	f
547	Centerpoint News Updates	Cody Crouch	9	9	2025-09-18 15:00:00	2025-09-18 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.49	1	#ffaa00	cancelled	\N	f
548	Centerpoint News Updates	Cody Crouch	9	9	2025-09-19 15:00:00	2025-09-19 15:30:00	production	\N	\N	[]	2025-08-05 16:28:04.507	1	#ffaa00	cancelled	\N	f
637	CODY RECORDS	Updated records for Sunday Night Specials w/ Cody Crouch -\nStudio C Anchor Desk (1x Jib / 1x Ped) -\nSTART @ 3:45PM	3	16	2025-09-17 20:30:00	2025-09-17 22:30:00	production	\N	12	[]	2025-09-16 19:11:31.791	\N	#ffaa00	confirmed	\N	f
546	Centerpoint News Updates	CODY CROUCH - START @ 9:30	9	9	2025-09-17 14:00:00	2025-09-17 15:00:00	production	\N	\N	[14]	2025-08-05 16:28:04.475	1	#ffaa00	confirmed	\N	f
545	Centerpoint News Updates	Cody Crouch	9	9	2025-09-24 14:00:00	2025-09-24 15:30:00	production	\N	\N	[14]	2025-08-05 16:28:04.461	65	#ffaa00	confirmed	\N	f
646	5 Minutes with Jesus	Sheila Walsh hosting	8	9	2025-09-29 20:00:00	2025-09-29 22:30:00	production	\N	20	[]	2025-09-24 17:57:38.404	1	#4f7a28	confirmed	\N	f
656	Centerpoint News Updates	CODY	9	16	2025-10-03 15:00:00	2025-10-03 15:30:00	production	\N	12	[14]	2025-10-01 20:56:59.369	1	#ffaa00	confirmed	\N	f
664	TBN Project Set Up Day		18	22	2025-10-08 14:00:00	2025-10-08 22:00:00	production	\N	23	[24, 7]	2025-10-02 19:31:16.299	\N	#814bd2	confirmed	\N	f
667	Praise w/ M&L	WHITLEY PHIPPS w/ M&L\nSTART @ 2:00 OR 2:30 PM	3	16	2025-10-09 19:00:00	2025-10-09 21:00:00	production	\N	8	[14]	2025-10-02 20:09:22.451	1	#ff40ff	confirmed	\N	f
658	Venue Rental	Street Pastors Podcast Tour (Tim Timberlake + Philip Mitchell)	5	9	2025-10-16 15:00:00	2025-10-17 03:00:00	production	\N	20	[]	2025-10-02 14:46:22.217	\N	#4f7a28	confirmed	\N	f
552	Better Together		6	9	2025-10-07 13:00:00	2025-10-07 22:30:00	production	\N	13	[]	2025-08-05 21:50:21.583	65	#942192	confirmed	\N	f
582	Trilogy Intern Project Production	Production: Trilogy (internal project) \nTrilogy onsite contact: Sara Joyner\nTrilogy Receptionist: n/a (keeping exterior door locked)\nHaze Machine: No\n \n \nAug 14th: Prep Day\nEst start time: 8am\nEst wrap time: 6pm\nEst amount of crew: 10\n**Studio J for crew holding/ lunch\n \nAug 8th: Shoot Day\nEst start time: 8am\nEst wrap time: 6pm\nEst amount of crew: 10\n**Studio J for crew holding/ lunch\n\nProduction bible: https://docs.google.com/spreadsheets/d/1j0uFJaRzIlSF3vFmHeRfEnqjNh99clCS/edit?gid=1880630420#gid=1880630420\n \nNames:\nSophia Gangwere\nCydney Cox\nErica Fulbright\nSuzanne Jackowski\nBucky Brant\nCorwin Gillie\nJack Cline\nHenry Beck\nKatherine Head\nNeemay Shay\nPeter Hoang\nElizabeth Wolff\nRyan Gray\nFelicity Gilmore\nCameron Wadsworth\nEmily Armey\n	20	23	2025-08-15 13:00:00	2025-08-15 23:00:00	production	\N	23	[24, 7]	2025-08-14 15:38:04.289	\N	#814bd2	confirmed	\N	f
457	Youtube Shoutouts with Blynda	Blynda will record once news updates have been completed. D'Lynn Everett request. Need to figure out background for monitor.	8	1	2025-07-14 15:30:00	2025-07-14 16:00:00	production	\N	18	[]	2025-07-09 18:51:49.437	\N	#4f7a28	confirmed	\N	f
486	TOUR: Creator Camp	Lead: Taylor Tucker\n \nWhat: Production Company coming in for tour and to shoot content on all stages\n \nList of names:\nSimon Kim\nChris Duncan\nKeoni Carrion\nCristina Colina\nChloe May\nSam Kennard	19	23	2025-07-18 17:30:00	2025-07-18 19:00:00	production	\N	23	[24, 7]	2025-07-15 18:25:44.589	\N	#814bd2	confirmed	\N	f
559	Better Together		6	9	2025-12-09 13:00:00	2025-12-09 22:30:00	production	\N	13	[]	2025-08-06 21:25:13.11	65	#942192	confirmed	\N	f
557	Better Together		6	9	2025-11-11 13:00:00	2025-11-11 22:30:00	production	\N	13	[]	2025-08-06 21:25:13.075	65	#942192	tentative	\N	f
558	Better Together		6	9	2025-11-18 13:00:00	2025-11-18 22:30:00	production	\N	13	[]	2025-08-06 21:25:13.093	65	#942192	tentative	\N	f
441	Trilogy: RED Camera Event	please reference day one of production for all information	19	23	2025-07-30 14:00:00	2025-07-30 22:00:00	other	\N	23	[]	2025-07-08 15:31:05.149	\N	#814bd2	confirmed	\N	f
689	STAKS READS	NEWS READS RE-DO - Erick arrives between 2:30-3:00pm	8	16	2025-10-10 20:00:00	2025-10-10 21:30:00	production	\N	\N	[14]	2025-10-10 17:16:23.051	65	#4B83E2	confirmed	\N	f
257	MSM News		1	1	2025-06-16 13:00:00	2025-06-17 00:30:00	production	\N	\N	[]	2025-06-05 22:22:08.313	1	#ffaa00	confirmed	\N	f
504	SHOOT: Think Branded Media CAT	please reference Aug 11 booking for details	18	23	2025-08-12 12:00:00	2025-08-13 00:00:00	production	\N	23	[24, 7]	2025-07-24 14:15:33.858	\N	#814bd2	confirmed	\N	f
601	Better Together - Robo Test	Hi All,\nIn Hit Studio Q, could we get the robo camera up (and the hallway monitor) up for a little test around 2PM on 8.25.25?\nWe don’t need audio or comms.\n \nLet me know,\nLauran	17	9	2025-08-25 19:00:00	2025-08-25 20:00:00	production	\N	\N	[]	2025-08-21 17:52:18.432	\N	#9929bd	confirmed	\N	f
590	Segments with Pastor D	Studio B - shooting into Studio C	3	9	2025-08-29 16:30:00	2025-08-29 19:00:00	production	\N	20	[]	2025-08-19 20:49:16.472	1	#4f7a28	confirmed	\N	f
503	SHOOT: Think Branded Media CAT	\nProduction Company: Think Branded Media\nTrilogy Onsite contact: Parke May\nHaze Machine: NO\nTrilogy Reception: Cameron Wadsworth\n \nAugust 11th: Prep Day (10 hours)\nEst Start time: 7AM\nEst wrap time: 5PM\nEst # of people: 10\n \n \nAugust 12th: Shoot Day (12 hours)\nEst Start time: 6:45AM\nEst wrap time: 7PM\nEst # of people: 19\n \nAttendee Names: \nBeau W Ethridge\nVince Monsaint\nJT Huffer\nJoey Huffer\nWinona Wenying Yu\nConor Mooney\nPate Sanders\nDaniel Nanasi\nCody Gray\nBobby Kurtz\nMatt Aslan\nLorenzo Torres\nDylan Ngyuen\nElainia Eads\n\nBelow are the CAT Team Members who will show up Tuesday. \n\nJosh Ewing\nJaime Mineart\nCarrie Wallendal\nElle Auer\nOgi Rezic\n	18	23	2025-08-11 12:00:00	2025-08-11 22:00:00	production	\N	23	[24, 7]	2025-07-24 14:15:33.837	\N	#814bd2	confirmed	\N	f
607	(TENT) TBN Client		20	23	2025-12-02 15:00:00	2025-12-02 23:00:00	production	\N	23	[24, 7]	2025-08-26 20:40:08.067	\N	#814bd2	tentative	\N	f
638	Stakelbeck Tonight		3	16	2025-09-30 19:00:00	2025-09-30 20:30:00	production	\N	6	[]	2025-09-16 21:09:09.977	1	#008cb4	cancelled	\N	f
556	Better Together		6	9	2025-10-21 13:00:00	2025-10-21 22:30:00	production	\N	13	[]	2025-08-06 21:24:18.179	65	#942192	cancelled	\N	f
630	The Korey with a K Show Production	NO TBN CAMS - CLIENT FIELD CAMS\nLED/GFX	3	16	2025-09-22 22:00:00	2025-09-23 02:00:00	production	\N	23	[24]	2025-09-12 21:22:50.219	\N	#814bd2	confirmed	\N	f
618	CCSWB Live Stream	Coca Cola South West Beverage \n\nGuests:\nJean Claude Tissot 	18	22	2025-09-25 16:00:00	2025-09-25 21:00:00	production	\N	23	[24, 7, 14]	2025-09-08 21:36:30.998	64	#814bd2	confirmed	\N	f
534	Centerpoint News Updates	Cody Crouch	9	9	2025-09-29 15:00:00	2025-09-29 15:30:00	production	\N	\N	[]	2025-08-05 16:27:36.244	1	#ffaa00	confirmed	\N	f
647	Vertical Shorts Production	Pre-light- 30th\nShoot day- 1-3rd\n \nNames of guests are in the attached PDF’s\n \n9am to 9PM\n \nProduction Company: IAJ Media\nTrilogy Onsite contact: Parke May & Taylor Tucker\nHaze Machine: YES\nTrilogy Reception: Cristina Trejo\n \nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\n 	20	22	2025-09-30 14:00:00	2025-10-01 02:00:00	production	\N	23	[24, 7]	2025-09-29 15:59:33.674	\N	#814bd2	confirmed	\N	f
254	DreamCatcher Maintenance		\N	13	2025-06-08 14:00:00	2025-06-08 20:00:00	maintenance	medium	\N	["Engineering"]	2025-06-05 21:32:32.223	\N	#3B82F6	confirmed	\N	f
650	Vertical Shorts Production	Pre-light- 30th\nShoot day- 1-3rd\n \nNames of guests are in the attached PDF’s on Sept 30th date\n \n9am to 9PM\n \nProduction Company: IAJ Media\nTrilogy Onsite contact: Parke May & Taylor Tucker\nHaze Machine: YES\nTrilogy Reception: Cristina Trejo\n \nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\n 	20	22	2025-10-02 14:00:00	2025-10-03 02:00:00	production	\N	23	[24, 7]	2025-09-29 16:01:42.395	\N	#814bd2	confirmed	\N	f
651	Veritcal Shorts Production	Pre-light- 30th\nShoot day- 1-3rd\n \nNames of guests are in the attached PDF’s on Sept 30th date\n \n9am to 9PM\n \nProduction Company: IAJ Media\nTrilogy Onsite contact: Parke May & Taylor Tucker\nHaze Machine: YES\nTrilogy Reception: Cristina Trejo\n \nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\n 	20	22	2025-10-03 14:00:00	2025-10-04 02:00:00	production	\N	23	[24, 7]	2025-09-29 16:01:42.411	\N	#814bd2	confirmed	\N	f
657	BT Robo Training	Lauran will lead.	6	16	2025-10-02 19:00:00	2025-10-02 21:00:00	production	\N	13	[14]	2025-10-01 21:12:43.407	2	#942192	confirmed	\N	f
665	TBN Project Shoot Day		18	22	2025-10-09 14:00:00	2025-10-09 22:00:00	production	\N	23	[24, 7]	2025-10-02 19:31:42.641	\N	#814bd2	confirmed	\N	f
666	Praise w/ M&L	KEENAN CLARK w/ M&L\nSTART @ 12:30 OR 1:00 PM	3	16	2025-10-09 15:30:00	2025-10-09 19:00:00	production	\N	8	[]	2025-10-02 20:07:40.079	\N	#ff40ff	confirmed	\N	f
673	Centerpoint News Updates	BLYNDA	8	16	2025-10-13 14:30:00	2025-10-13 15:00:00	production	\N	12	[]	2025-10-06 21:32:03.091	1	#ffaa00	confirmed	\N	f
66	MSM News		1	1	2025-05-07 11:00:00	2025-05-08 00:00:00	production	\N	\N	[]	2025-05-08 07:45:56.637	1	#800000	confirmed	\N	f
35	MSM News		1	1	2025-05-08 11:00:00	2025-05-09 00:00:00	production	\N	\N	[]	2025-05-07 09:14:46.976	1	#800000	confirmed	\N	f
36	MSM News		1	1	2025-05-09 11:00:00	2025-05-10 00:00:00	production	\N	\N	[]	2025-05-07 09:14:46.991	1	#800000	confirmed	\N	f
690	TBN Christmas Products	3x Christmas Product Shoot\n2x Peds and Lighting Only. 	1	16	2025-10-14 19:00:00	2025-10-14 21:00:00	production	\N	\N	[]	2025-10-14 19:00:05.776	1	#4B83E2	confirmed	\N	f
511	Stakelbeck Tonight	2x In Studio Guest w/ Erick	3	16	2025-08-01 16:00:00	2025-08-01 20:30:00	production	\N	6	[9, 7, 14]	2025-07-29 20:57:58.769	1	#008cb4	confirmed	\N	f
443	Rabbi Jason Sobel Shoot - TBN	Rabbi Jason Sobel shoot - Set day\n\nProduction Company: TBN\nTrilogy Onsite contact: Sara Joyner & Parke May\nHaze Machine: YES\nTrilogy Reception: Cameron Wadsworth\n\nCall times 8:30am-5:30pm all Production Days\n\nMonday, 8/18/25\n\nAiden Franklin\nElizabeth Suter\nNick Foster\nBrenner Sherrard\nScott LaCroix\nElisea Betancourt\nGrace Woodward\nLindsay Stewart\n\nGuest - Pastor Allen Jackson and assistant\nHost - Rabbi Jason Sobel and his manager, Ted Squires\n \n\nTuesday, 8/19/2025\n\nAiden Franklin\n\nElizabeth Suter\nNick Foster\nSam Baker\nAustin Hines\nScott LaCroix\nElisea Betancourt\nScarlett DeMoss\nBrenner Sherrard\nGrace Woodward\nAshley Andrews\nAandrews@tbn.tv\nBrian Gandy\nBGandy@tbn.tv\nKevin Gandy\nMarcus Olivas\nLindsay Stewart\nJacob Dapar\nBriana Tyson\nSalange Shepard\n \nGuest - Nicole C and her manager, Karen Brockington\nHost - Rabbi Jason Sobel and his manager, Ted Squires\n \nWednesday, 8/20/2025\n\nAiden Franklin\nElizabeth Suter\nNick Foster\nSam Baker\nAustin Hines\nScott LaCroix\nElisea Betancourt\nScarlett DeMoss\nBrenner Sherrard\nGrace Woodard\nAshley Andrews\nBrian Gandy\nKevin Gandy\nMarcus Olivas\nLindsay Stewart\nCassandra Ortega\n\nThursday, 8/21/2025\n\nAiden Franklin\nElizabeth Suter\nNick Foster\nSam Baker\nAustin Hines\nScott LaCroix\nElisea Betancourt\nScarlett DeMoss\nBrenner Sherrard\nGrace Woodward\nAshley Andrews\nBrian Gandy\nKevin Gandy\nMarcus Olivas\nLindsay Stewart\n\nGuest - GUEST and assistant\nHost - Rabbi Jason Sobel and his manager, Ted Squires\n 	19	9	2025-08-18 13:30:00	2025-08-18 22:30:00	production	\N	23	[24, 7]	2025-07-08 19:02:33.19	\N	#814bd2	confirmed	\N	f
487	Stakelbeck Tonight	1 Jib camera\nStaks Monologue in studio B (C wall background)) while Praise sets up	2	1	2025-07-21 15:30:00	2025-07-21 16:00:00	production	\N	6	[]	2025-07-15 20:35:10.975	65	#008cb4	confirmed	\N	f
461	Centerpoint News Updates	Blynda Lane	8	9	2025-08-04 15:00:00	2025-08-04 15:30:00	production	\N	\N	[]	2025-07-14 17:30:24.739	1	#ffaa00	confirmed	\N	f
495	MROs with Blynda	Blynda will record August MROs in Studio B. 	1	1	2025-07-25 15:30:00	2025-07-25 16:30:00	production	\N	20	[]	2025-07-21 17:46:54.184	1	#4f7a28	confirmed	\N	f
81	Praise (x3)	11:00am Sheila Walsh hosts Colby Barrett\n12:30pm M&L host Colby Barrett\n2:00pm M&L host Burl Cain and CJ Orndorff	3	9	2025-05-16 14:30:00	2025-05-16 21:00:00	production	\N	\N	[]	2025-05-08 14:36:30.236	65	#ff40ff	confirmed	\N	f
71	Centerpoint News Updates	Cody Crouch	9	9	2025-05-13 15:30:00	2025-05-13 16:00:00	production	\N	\N	[]	2025-05-08 14:28:27.443	65	#ffaa00	confirmed	\N	f
264	LIVE Special Report	Live at 7:30P ET through until an estimated off-air time at 8:55P ET (off-air time subject to change).\n\nErick Stakelbeck will host based from the Plex. There will be several guests either live in-bound or via pre-recorded segment. Guest list is tbd and in process.\n\nTBN Nashville will be the hub. There will be no breaks.	8	9	2025-06-13 21:00:00	2025-06-14 01:00:00	production	\N	6	[9, 7]	2025-06-13 13:58:16.711	65	#4B83E2	confirmed	\N	f
72	Centerpoint News Updates	Cody Crouch	9	9	2025-05-14 15:30:00	2025-05-14 16:00:00	production	\N	\N	[]	2025-05-08 14:28:27.463	65	#ffaa00	confirmed	\N	f
73	Centerpoint News Updates	Cody Crouch	9	9	2025-05-15 15:30:00	2025-05-15 16:00:00	production	\N	\N	[]	2025-05-08 14:28:27.475	65	#ffaa00	confirmed	\N	f
47	Stakelbeck		13	1	2025-05-07 15:00:00	2025-05-07 16:00:00	production	\N	\N	[]	2025-05-07 09:21:19.687	65	#3B82F6	confirmed	\N	f
43	Cody Crouch		9	1	2025-05-06 15:30:00	2025-05-06 16:00:00	production	\N	\N	[]	2025-05-07 09:18:57.615	65	#3B82F6	confirmed	\N	f
46	Cody Crouch		4	1	2025-05-07 16:00:00	2025-05-07 16:30:00	production	\N	\N	[]	2025-05-07 09:20:36.454	65	#3B82F6	confirmed	\N	f
44	Cody Crouch		3	1	2025-05-08 15:30:00	2025-05-08 16:00:00	production	\N	\N	[]	2025-05-07 09:19:08.695	65	#3B82F6	confirmed	\N	f
462	Centerpoint News Updates	Blynda Lane	8	9	2025-08-11 15:00:00	2025-08-11 15:30:00	production	\N	\N	[]	2025-07-14 17:30:24.759	1	#ffaa00	confirmed	\N	f
463	Centerpoint News Updates	Blynda Lane	8	9	2025-08-18 15:00:00	2025-08-18 15:30:00	production	\N	\N	[]	2025-07-14 17:30:24.772	1	#ffaa00	confirmed	\N	f
45	Cody Crouch		3	1	2025-05-09 15:30:00	2025-05-09 16:00:00	production	\N	\N	[]	2025-05-07 09:19:08.715	65	#3B82F6	confirmed	\N	f
74	Centerpoint News Updates	Cody Crouch	9	9	2025-05-16 15:30:00	2025-05-16 16:00:00	production	\N	\N	[]	2025-05-08 14:28:27.486	65	#ffaa00	confirmed	\N	f
55	Pope Watch		1	1	2025-05-11 08:00:00	2025-05-11 18:00:00	production	\N	\N	[]	2025-05-07 16:26:05.01	1	#ff8000	confirmed	\N	f
41	DP		7	1	2025-05-05 16:00:00	2025-05-05 21:00:00	production	\N	\N	[]	2025-05-07 09:18:06.558	64	#8000ff	confirmed	\N	f
75	Stakelbeck Tonight		3	9	2025-05-12 16:00:00	2025-05-12 20:30:00	production	\N	\N	[]	2025-05-08 14:29:38.832	65	#4B83E2	confirmed	\N	f
50	SFC		4	1	2025-05-09 14:30:00	2025-05-09 21:30:00	production	\N	\N	[]	2025-05-07 09:25:55.359	64	#ff0000	confirmed	\N	f
49	SFC		4	1	2025-05-10 14:30:00	2025-05-10 21:30:00	production	\N	\N	[]	2025-05-07 09:25:19.214	64	#ff0000	confirmed	\N	f
77	Stakelbeck Tonight		3	9	2025-05-14 16:00:00	2025-05-14 20:30:00	production	\N	\N	[]	2025-05-08 14:30:55.483	65	#4B83E2	confirmed	\N	f
51	TCL		3	1	2025-05-09 22:00:00	2025-05-10 04:30:00	production	\N	\N	[]	2025-05-07 09:33:17.07	64	#004000	confirmed	\N	f
52	TCL		3	1	2025-05-10 22:00:00	2025-05-11 04:30:00	production	\N	\N	[]	2025-05-07 15:06:55.313	64	#004000	confirmed	\N	f
270	MSM News		1	1	2025-06-18 13:00:00	2025-06-19 02:00:00	production	\N	\N	[]	2025-06-16 00:13:27.736	1	#791a3e	confirmed	\N	f
267	Open segment with Erick	Recording a new open for Israel at War program 	8	9	2025-06-14 19:00:00	2025-06-14 07:30:00	production	\N	\N	[]	2025-06-14 18:55:07.012	\N	#4B83E2	confirmed	\N	f
583	5 Minutes with Jesus	Sheila Walsh hosting	8	9	2025-08-19 18:30:00	2025-08-19 21:30:00	production	\N	20	[]	2025-08-15 16:47:56.395	1	#4f7a28	confirmed	\N	f
464	Centerpoint News Updates	Blynda Lane	8	9	2025-08-25 15:00:00	2025-08-25 15:30:00	production	\N	\N	[]	2025-07-14 17:30:24.786	1	#ffaa00	cancelled	\N	f
591	Vinia Segments	More details to come	5	9	2025-09-12 13:00:00	2025-09-12 22:00:00	production	\N	20	[]	2025-08-20 18:54:31.768	\N	#4f7a28	cancelled	\N	f
608	Praise	12:00pm Sheila Walsh hosting Erwin McManus	3	9	2025-09-10 15:30:00	2025-09-10 20:00:00	production	\N	8	[]	2025-08-27 21:09:22.947	1	#ff40ff	confirmed	\N	f
561	The Korey with a K Show Production	NO TBN CAMS - CLIENT FIELD CAMS\nLED/GFX	5	23	2025-09-23 14:00:00	2025-09-24 00:00:00	production	\N	23	[24]	2025-08-08 19:31:45.093	\N	#814bd2	confirmed	\N	f
562	The Korey with a K Show Production	NO TBN CAMS - CLIENT FIELD CAMS\nLED/GFX	5	23	2025-09-24 21:00:00	2025-09-25 00:00:00	production	\N	23	[24]	2025-08-08 19:31:45.11	\N	#814bd2	confirmed	\N	f
619	The Korey with a K Show Production	NO TBN CAMS - CLIENT FIELD CAMS -\nLED/GFX	5	16	2025-09-22 14:00:00	2025-09-23 00:00:00	production	\N	24	[]	2025-09-10 16:23:38.171	\N	#814bd2	confirmed	\N	f
639	Stakelbeck Tonight	Staks Reads / Dove Records\n	5	16	2025-10-01 16:00:00	2025-10-01 20:30:00	production	\N	6	[]	2025-09-19 18:34:21.23	64	#008cb4	confirmed	\N	f
317	DreamCatcher Maintenance 	The entire DreamCatcher system will be updated tonight after MSM Evening News.  Please make sure your staff have backed up any files required for production on Wednesday.  All DC servers will be wiped clean during the update.	\N	9	2025-06-18 00:30:00	2025-06-18 04:30:00	maintenance	medium	\N	[]	2025-06-17 17:39:31.177	\N	#3B82F6	confirmed	\N	f
373	Praise	2 Praise Programs\n11:00am Sheila Walsh hosts Henry Cloud\n12:30pm Sheila Walsh hosts 3 guests - Roundtable in studio D\nDirector: Steve Fjordbak	3	1	2025-07-11 14:00:00	2025-07-11 20:30:00	production	\N	8	[9, 7]	2025-06-19 19:55:21.354	65	#ff40ff	confirmed	\N	f
563	Stakelbeck Tonight		3	9	2025-09-03 16:00:00	2025-09-03 20:30:00	production	\N	\N	[]	2025-08-11 16:35:15.993	1	#4B83E2	confirmed	\N	f
372	Praise	Details TBD	3	1	2025-07-09 14:00:00	2025-07-09 20:30:00	production	\N	8	[9, 7]	2025-06-19 13:52:07.612	65	#ff40ff	cancelled	\N	f
565	Stakelbeck Tonight		3	9	2025-09-08 16:00:00	2025-09-08 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.032	1	#4B83E2	confirmed	\N	f
567	Stakelbeck Tonight		3	9	2025-09-15 16:00:00	2025-09-15 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.064	1	#4B83E2	confirmed	\N	f
569	Stakelbeck Tonight		3	9	2025-09-18 16:00:00	2025-09-18 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.095	1	#4B83E2	confirmed	\N	f
570	Stakelbeck Tonight		3	9	2025-09-22 16:00:00	2025-09-22 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.111	1	#4B83E2	confirmed	\N	f
324	DP		7	1	2025-07-02 14:00:00	2025-07-02 21:00:00	production	\N	\N	[]	2025-06-18 15:30:40.225	\N	#0056d6	cancelled	\N	f
367	TCL Boxing 	Boxing 	3	16	2025-08-08 19:00:00	2025-08-09 04:30:00	production	\N	21	[]	2025-06-18 15:46:20.739	64	#77bb41	cancelled	\N	f
426	DP - Remote 		13	1	2025-06-26 16:30:00	2025-06-26 19:00:00	production	\N	\N	[]	2025-06-26 17:35:50.896	64	#4B83E2	confirmed	\N	f
78	Stakelbeck Tonight		3	9	2025-05-15 16:00:00	2025-05-15 18:30:00	production	\N	\N	[]	2025-05-08 14:30:55.494	65	#4B83E2	confirmed	\N	f
53	Praise		3	1	2025-05-09 16:30:00	2025-05-09 20:30:00	production	\N	\N	[]	2025-05-07 15:10:59.062	65	#ff0080	tentative	\N	f
54	Pope Watch	Test description \n	1	1	2025-05-10 08:00:00	2025-05-10 18:00:00	production	\N	\N	[]	2025-05-07 16:25:47.487	1	#ff8000	confirmed	\N	f
70	Centerpoint News Updates	Blynda Lane	8	9	2025-05-12 15:30:00	2025-05-12 16:00:00	production	\N	\N	[]	2025-05-08 14:27:40.59	65	#ffaa00	confirmed	\N	f
80	Praise	2:00pm M&L host Levi Lusko	3	9	2025-05-15 18:30:00	2025-05-15 20:30:00	production	\N	\N	[]	2025-05-08 14:33:53.329	65	#ff40ff	confirmed	\N	f
82	Stakelbeck Tonight		3	9	2025-05-19 16:00:00	2025-05-19 20:30:00	production	\N	\N	[]	2025-05-08 14:41:24.336	65	#4B83E2	confirmed	\N	f
397	SFC READS	CEO of SFC / Owner of Tournament Boats (Reads & Ad)\nSTART TIME: 10:30AM	9	1	2025-06-27 14:00:00	2025-06-27 19:00:00	production	\N	15	[9, 11]	2025-06-24 20:08:30.661	64	#ff2600	confirmed	\N	f
323	DP		7	1	2025-06-30 14:00:00	2025-06-30 21:00:00	production	\N	\N	[]	2025-06-18 15:30:40.203	64	#0056d6	confirmed	\N	f
258	DP		7	1	2025-06-16 16:00:00	2025-06-16 21:00:00	production	\N	\N	[]	2025-06-05 22:23:41.655	64	#0433ff	cancelled	\N	f
393	TCL Boxing 		3	1	2025-07-26 21:30:00	2025-07-27 04:30:00	production	\N	\N	[]	2025-06-23 21:45:18.263	64	#4be24e	confirmed	\N	f
429	Positiv Promo Shoot	Better Together White Cyc set\n1 camera and prompter\nDirector: Kevin Gandy\nProducer: Steve Fjordbal	6	9	2025-07-10 21:00:00	2025-07-10 22:00:00	production	\N	18	[9, 7]	2025-06-30 16:28:41.314	65	#4f7a28	confirmed	\N	f
465	Centerpoint News Updates	Cody Crouch	9	9	2025-08-07 15:00:00	2025-08-07 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.807	1	#ffaa00	confirmed	\N	f
466	Centerpoint News Updates	Cody Crouch	9	9	2025-08-08 15:00:00	2025-08-08 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.827	1	#ffaa00	confirmed	\N	f
337	Through The Drama 		13	1	2025-06-24 12:00:00	2025-06-24 15:00:00	production	\N	\N	[]	2025-06-18 15:33:45.333	64	#008080	confirmed	\N	f
584	Stakelbeck Tonight	We will still have our normal production schedule on the following days. However, we'll also need to pop into a hit studio for quick hits that aren't within our scheduled production time. Is it possible to use studio P next week during the following dates/times? \n\n8/20 11 AM (10-15 minutes) \n8/21 9:30 AM (approximately 20-35 mins) 	8	9	2025-08-20 15:30:00	2025-08-20 16:30:00	production	\N	6	[]	2025-08-15 19:35:13.288	1	#008cb4	confirmed	\N	f
338	Through The Drama 		13	1	2025-06-25 12:00:00	2025-06-25 15:00:00	production	\N	\N	[]	2025-06-18 15:33:45.352	64	#008080	confirmed	\N	f
467	Centerpoint News Updates	Cody Crouch	9	9	2025-08-06 15:00:00	2025-08-06 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.841	1	#ffaa00	confirmed	\N	f
468	Centerpoint News Updates	Cody Crouch	9	9	2025-08-12 15:00:00	2025-08-12 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.856	1	#ffaa00	confirmed	\N	f
469	Centerpoint News Updates	Cody Crouch	9	9	2025-08-13 15:00:00	2025-08-13 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.871	1	#ffaa00	confirmed	\N	f
470	Centerpoint News Updates	Cody Crouch	9	9	2025-08-14 15:00:00	2025-08-14 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.885	1	#ffaa00	confirmed	\N	f
375	Commercials /Merit After Midnght	Analysis set Cams 2,3,6	5	1	2025-06-23 15:30:00	2025-06-23 17:00:00	production	\N	\N	[11, 7, 8]	2025-06-20 13:47:26.17	64	#4B83E2	confirmed	\N	f
471	Centerpoint News Updates	Cody Crouch	9	9	2025-08-15 15:00:00	2025-08-15 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.9	1	#ffaa00	confirmed	\N	f
472	Centerpoint News Updates	Cody Crouch	9	9	2025-08-19 15:00:00	2025-08-19 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.915	1	#ffaa00	confirmed	\N	f
436	Trilogy Shoot: Psychia	***please see day 1 of booking for all information	18	1	2025-07-10 12:30:00	2025-07-10 23:00:00	production	\N	\N	[]	2025-07-08 15:15:02.796	\N	#814bd2	confirmed	\N	f
437	Trilogy Shoot: Psychia	***please see day 1 of booking for all information	18	1	2025-07-11 13:00:00	2025-07-11 23:00:00	production	\N	\N	[]	2025-07-08 15:15:02.813	\N	#814bd2	confirmed	\N	f
473	Centerpoint News Updates	Blynda Lane	9	9	2025-08-26 14:00:00	2025-08-26 14:30:00	production	\N	\N	[]	2025-07-14 17:32:03.928	1	#ffaa00	confirmed	\N	f
564	Stakelbeck Tonight		3	9	2025-09-04 16:00:00	2025-09-04 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.017	1	#4B83E2	confirmed	\N	f
474	Centerpoint News Updates	Cody Crouch	8	9	2025-08-27 15:00:00	2025-08-27 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.943	1	#ffaa00	cancelled	\N	f
475	Centerpoint News Updates	Cody Crouch	8	9	2025-08-28 15:00:00	2025-08-28 15:30:00	production	\N	\N	[]	2025-07-14 17:32:03.957	1	#ffaa00	cancelled	\N	f
609	Praise	M&L hosting both programs -\n1:00pm - Cody Jefferson Praise\n2:30pm Mark Batterson Praise 	3	9	2025-09-26 16:00:00	2025-09-26 21:00:00	production	\N	8	[]	2025-09-02 14:18:36.988	1	#ff40ff	confirmed	\N	f
593	Vinia Segments	More details to come	5	9	2025-09-11 13:00:00	2025-09-11 22:00:00	production	\N	20	[]	2025-08-20 18:54:43.455	\N	#4f7a28	cancelled	\N	f
566	Stakelbeck Tonight		3	9	2025-09-09 16:00:00	2025-09-09 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.048	1	#4B83E2	cancelled	\N	f
620	LIVE: SPECIAL REPORT	Sheila / Erick / Cody	3	16	2025-09-10 20:30:00	2025-09-11 01:00:00	production	\N	18	[]	2025-09-11 03:39:42.338	1	#4f7a28	confirmed	\N	f
568	Stakelbeck Tonight		3	9	2025-09-17 16:00:00	2025-09-17 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.08	1	#4B83E2	confirmed	\N	f
571	Stakelbeck Tonight	Analysis set	5	9	2025-09-24 16:00:00	2025-09-24 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.129	1	#4B83E2	confirmed	\N	f
640	Stakelbeck Tonight		3	16	2025-10-02 16:00:00	2025-10-02 20:30:00	production	\N	6	[14]	2025-09-19 18:35:02.529	65	#008cb4	confirmed	\N	f
642	Stakelbeck Tonight		3	16	2025-10-08 16:00:00	2025-10-08 20:30:00	production	\N	6	[]	2025-09-19 18:36:34.053	65	#008cb4	confirmed	\N	f
573	Stakelbeck Tonight		8	9	2025-09-29 15:00:00	2025-09-29 17:00:00	production	\N	\N	[]	2025-08-11 16:35:16.158	65	#4B83E2	confirmed	\N	f
659	Centerpoint News Updates	BLYNDA	8	16	2025-10-06 15:00:00	2025-10-06 16:00:00	production	\N	12	[]	2025-10-02 19:07:11.225	1	#ffaa00	confirmed	\N	f
359	TCL 	Boxing 	3	1	2025-07-12 19:00:00	2025-07-13 03:00:00	production	\N	\N	[]	2025-06-18 15:38:45.923	64	#77bb41	confirmed	\N	f
438	TRILOGY: FM Creator Camp	Lead: Taylor Tucker\n \nWhat: FM is bringing in a group of creators for a tour of trilogy and they will all be shooting content for their own channels.\n \nWhere: We’ll go through all the studios.\n \nTime: 9am-1pm\n \nList of Names & ROS: https://docs.google.com/document/d/1bNuw_aejvTyWb4hXEHoDwajnb-PFaHoL6UwxKWJL0h0/edit?tab=t.0 	19	23	2025-07-17 14:00:00	2025-07-17 18:00:00	production	\N	23	[]	2025-07-08 15:25:37.912	\N	#814bd2	confirmed	\N	f
478	Centerpoint News Updates	Cody Crouch	8	9	2025-08-21 15:30:00	2025-08-21 16:00:00	production	\N	\N	[]	2025-07-14 17:33:22.905	1	#ffaa00	confirmed	\N	f
585	Stakelbeck Tonight	We will still have our normal production schedule on the following days. However, we'll also need to pop into a hit studio for quick hits that aren't within our scheduled production time. Is it possible to use studio P next week during the following dates/times? \n\n8/20 11 AM (10-15 minutes) \n8/21 9:30 AM (approximately 20-35 mins) 	8	9	2025-08-21 14:00:00	2025-08-21 15:30:00	production	\N	6	[]	2025-08-15 19:35:30.659	1	#008cb4	confirmed	\N	f
594	AMAC Spots	Impact Production renting Hit Studio P to record ads for the Charlie Kirk Show. 1 hour rental 11:00am-12:00pm	8	1	2025-08-25 16:00:00	2025-08-25 17:00:00	production	\N	18	[]	2025-08-21 14:11:33.311	\N	#4f7a28	confirmed	\N	f
477	Centerpoint News Updates	Cody Crouch	3	9	2025-08-20 15:00:00	2025-08-20 15:30:00	production	\N	\N	[]	2025-07-14 17:33:22.889	1	#ffaa00	confirmed	\N	f
479	Centerpoint News Updates	Cody Crouch	3	9	2025-08-22 15:00:00	2025-08-22 15:30:00	production	\N	\N	[]	2025-07-14 17:33:22.92	1	#ffaa00	confirmed	\N	f
489	Breaking Sunday School with Jason Sobel	Set-up day	5	9	2026-01-20 14:00:00	2026-01-21 04:00:00	production	\N	20	[]	2025-07-16 20:26:34.962	64	#4f7a28	confirmed	\N	f
313	Dr.Phil 		7	1	2025-06-23 15:00:00	2025-06-23 22:00:00	production	\N	\N	[]	2025-06-17 16:32:48.341	64	#0056d6	confirmed	\N	f
610	TBN Promo Shoot		18	22	2025-09-10 17:00:00	2025-09-10 22:00:00	production	\N	23	[24, 7]	2025-09-05 17:05:32.408	\N	#814bd2	confirmed	\N	f
100	Test nofication email	Test notification email from Bookstud.io	10	1	2025-05-05 16:00:00	2025-05-05 17:00:00	production	\N	\N	[7]	2025-05-08 15:53:02.676	1	#4B83E2	confirmed	\N	f
86	Centerpoint News Updates	Blynda Lane	8	9	2025-05-19 15:30:00	2025-05-19 16:00:00	production	\N	\N	[]	2025-05-08 14:43:21.616	65	#ffaa00	confirmed	\N	f
89	Centerpoint News Updates	Cody Crouch	9	9	2025-05-21 15:30:00	2025-05-21 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.754	65	#ffaa00	confirmed	\N	f
90	Centerpoint News Updates	Cody Crouch	9	9	2025-05-22 15:30:00	2025-05-22 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.765	65	#ffaa00	confirmed	\N	f
91	Centerpoint News Updates	Cody Crouch	9	9	2025-05-23 15:30:00	2025-05-23 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.777	65	#ffaa00	confirmed	\N	f
92	Centerpoint News Updates	Cody Crouch	9	9	2025-05-27 15:30:00	2025-05-27 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.789	65	#ffaa00	confirmed	\N	f
93	Centerpoint News Updates	Cody Crouch	9	9	2025-05-28 15:30:00	2025-05-28 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.8	65	#ffaa00	confirmed	\N	f
94	Centerpoint News Updates	Cody Crouch	3	9	2025-05-29 15:30:00	2025-05-29 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.812	65	#ffaa00	confirmed	\N	f
95	Centerpoint News Updates	Cody Crouch	3	9	2025-05-30 15:30:00	2025-05-30 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.823	65	#ffaa00	confirmed	\N	f
271	MSM News		1	1	2025-06-17 13:00:00	2025-06-18 02:00:00	production	\N	\N	[]	2025-06-16 00:13:27.759	1	#791a3e	confirmed	\N	f
272	MSM News		1	1	2025-06-19 13:00:00	2025-06-20 02:00:00	production	\N	\N	[]	2025-06-16 00:13:27.775	1	#791a3e	confirmed	\N	f
273	MSM News		1	1	2025-06-20 13:00:00	2025-06-21 02:00:00	production	\N	\N	[]	2025-06-16 00:13:27.791	1	#791a3e	confirmed	\N	f
278	MSM News		1	1	2025-06-23 13:00:00	2025-06-24 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.478	1	#791a3e	confirmed	\N	f
279	MSM News		1	1	2025-06-24 13:00:00	2025-06-25 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.501	1	#791a3e	confirmed	\N	f
280	MSM News		1	1	2025-06-25 13:00:00	2025-06-26 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.516	1	#791a3e	confirmed	\N	f
281	MSM News		1	1	2025-06-26 13:00:00	2025-06-27 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.532	1	#791a3e	confirmed	\N	f
282	MSM News		1	1	2025-06-27 13:00:00	2025-06-28 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.546	1	#791a3e	confirmed	\N	f
575	Stakelbeck Tonight		8	9	2025-09-16 16:00:00	2025-09-16 20:30:00	production	\N	6	[7, 14]	2025-08-11 16:43:24.373	1	#4B83E2	cancelled	\N	f
621	LIVE STAKS	Stakelbeck Tonight going LIVE from 6:30-7:00 PM CT. (PLEX CONTROL ROOM)\nErick remote in WASHINGTON DC. \nCall Time: 5:30 - 7:30 PM	13	16	2025-09-11 22:30:00	2025-09-12 00:30:00	production	\N	6	[]	2025-09-11 03:43:04.367	1	#008cb4	confirmed	\N	f
283	MSM News		1	1	2025-06-30 13:00:00	2025-07-01 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.561	1	#791a3e	confirmed	\N	f
284	MSM News		1	1	2025-07-01 13:00:00	2025-07-02 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.575	1	#791a3e	confirmed	\N	f
285	MSM News		1	1	2025-07-02 13:00:00	2025-07-03 02:00:00	production	\N	\N	[]	2025-06-16 00:14:56.589	1	#791a3e	cancelled	\N	f
339	Through The Drama 		13	1	2025-06-30 12:00:00	2025-06-30 15:00:00	production	\N	\N	[]	2025-06-18 15:33:45.367	64	#008080	confirmed	\N	f
340	Through The Drama 		13	1	2025-07-01 12:00:00	2025-07-01 15:00:00	production	\N	\N	[]	2025-06-18 15:33:45.381	64	#008080	confirmed	\N	f
308	Through The Drama 		13	1	2025-06-23 12:00:00	2025-06-23 15:00:00	production	\N	\N	[]	2025-06-16 00:17:01.182	64	#008080	confirmed	\N	f
341	Through The Drama 		13	1	2025-07-02 12:00:00	2025-07-02 15:00:00	production	\N	\N	[]	2025-06-18 15:33:45.395	64	#008080	cancelled	\N	f
641	Stakelbeck Tonight	Blynda - DOVE READS @ 11:00AM	3	16	2025-10-06 15:30:00	2025-10-06 20:30:00	production	\N	6	[]	2025-09-19 18:36:09.72	65	#008cb4	confirmed	\N	f
314	Dr. Phil 	Podcast 	7	1	2025-06-25 15:00:00	2025-06-25 22:00:00	production	\N	\N	[]	2025-06-17 16:33:29.306	64	#4B83E2	confirmed	\N	f
315	Dr. Phil 		7	1	2025-06-24 15:00:00	2025-06-24 22:00:00	production	\N	\N	[]	2025-06-17 16:34:04.023	64	#4B83E2	confirmed	\N	f
321	DP 		7	1	2025-06-19 15:00:00	2025-06-19 21:00:00	production	\N	\N	[]	2025-06-18 15:26:59.484	64	#4B83E2	confirmed	\N	f
355	TCL 	Boxing 	5	1	2025-06-21 19:00:00	2025-06-21 05:00:00	production	\N	\N	[]	2025-06-18 15:36:11.282	64	#77bb41	confirmed	\N	f
660	Centerpoint News Updates	CODY	9	16	2025-10-07 15:00:00	2025-10-07 16:00:00	production	\N	12	[]	2025-10-02 19:07:41.352	1	#ffaa00	confirmed	\N	f
661	Centerpoint News Updates	CODY	9	16	2025-10-08 15:00:00	2025-10-08 16:00:00	production	\N	12	[]	2025-10-02 19:09:00.406	1	#ffaa00	confirmed	\N	f
643	Stakelbeck Tonight	INBOUND @ 1:30PM CST	5	16	2025-10-09 16:00:00	2025-10-09 20:30:00	production	\N	6	[]	2025-09-19 18:37:00.151	64	#008cb4	confirmed	\N	f
668	Praise (Plex)	OS HAWKINS W/ M&L\nSTART @ 2:00PM	3	16	2025-10-15 17:00:00	2025-10-15 21:00:00	production	\N	8	[]	2025-10-02 21:09:55.657	1	#ff40ff	confirmed	\N	f
674	Centerpoint News Updates	CODY	9	16	2025-10-14 15:00:00	2025-10-14 16:00:00	production	\N	12	[]	2025-10-06 21:32:32.254	1	#ffaa00	confirmed	\N	f
676	Centerpoint News Updates	CODY	9	16	2025-10-16 15:00:00	2025-10-16 16:00:00	production	\N	12	[]	2025-10-06 21:34:35.65	1	#ffaa00	confirmed	\N	f
498	Trilogy: TBN Eschatology Project		19	23	2025-08-01 14:00:00	2025-08-01 22:00:00	production	\N	23	[24, 7]	2025-07-21 18:15:06.842	\N	#814bd2	confirmed	\N	f
368	TCL Boxing 	Boxing 	3	16	2025-08-15 20:30:00	2025-08-16 04:30:00	production	\N	21	[]	2025-06-18 15:46:41.361	64	#77bb41	confirmed	\N	f
371	Through The Drama 		13	1	2025-06-18 12:30:00	2025-06-18 15:00:00	production	\N	\N	[]	2025-06-18 19:59:13.165	\N	#ff6251	confirmed	\N	f
333	DP 		7	1	2025-07-01 14:00:00	2025-07-01 22:00:00	production	\N	\N	[]	2025-06-18 15:31:39.206	64	#4B83E2	confirmed	\N	f
586	SFC	Director: Ryan Tyler\nLIVE @ 11:30 AM - 2:30 PM CT	3	9	2025-08-23 12:30:00	2025-08-23 21:00:00	production	\N	\N	[]	2025-08-18 21:53:43.077	64	#ff2600	confirmed	\N	f
48	SFC - Cancelled	SFC has been cancelled for today due to weather	4	1	2025-05-08 14:30:00	2025-05-08 21:30:00	production	\N	\N	[]	2025-05-07 09:23:46.486	64	#ff0000	cancelled	\N	f
481	Better Together		6	9	2025-08-26 13:00:00	2025-08-26 22:30:00	production	\N	13	[9, 7]	2025-07-14 17:34:50.305	65	#942192	confirmed	\N	f
430	Teton Ridge - Training	Cowboy Channel team will be on site with a Ross trainer to learn how to operate Xpression. No studio only PCR 1 needed.	21	9	2025-08-04 21:00:00	2025-08-05 01:00:00	production	\N	20	[]	2025-07-01 21:28:47.651	1	#4f7a28	cancelled	\N	f
362	TCL 	Boxing 	3	1	2025-07-18 19:00:00	2025-07-19 04:30:00	production	\N	\N	[]	2025-06-18 15:42:44.057	64	#77bb41	confirmed	\N	f
101	Test alert for calendar	Test alert for calendar	5	1	2025-05-07 16:00:00	2025-05-07 17:00:00	production	\N	\N	[]	2025-05-08 21:00:58.086	\N	#4B83E2	confirmed	\N	f
103	Praise Test		4	1	2025-05-05 16:00:00	2025-05-05 15:00:00	production	\N	2	[9, 7]	2025-05-08 22:58:41.313	65	#3259f5	confirmed	\N	f
88	Centerpoint News Updates	Cody Crouch	8	9	2025-05-20 15:30:00	2025-05-20 16:00:00	production	\N	\N	[]	2025-05-08 14:44:32.741	65	#ffaa00	confirmed	\N	f
96	SFC	Director: Ryan Tyler	9	9	2025-05-29 14:30:00	2025-05-29 21:30:00	production	\N	\N	[]	2025-05-08 14:46:02.386	64	#ff2600	confirmed	\N	f
97	SFC	Director: Ryan Tyler	9	9	2025-05-30 14:30:00	2025-05-30 21:30:00	production	\N	\N	[]	2025-05-08 14:46:28.603	64	#ff2600	confirmed	\N	f
98	SFC	Director: Ryan Tyler	3	9	2025-05-31 14:30:00	2025-05-31 21:30:00	production	\N	\N	[]	2025-05-08 14:46:28.615	64	#ff2600	confirmed	\N	f
99	Praise	12:00pm M&L host Max Lucado	3	9	2025-05-24 15:00:00	2025-05-24 19:00:00	production	\N	\N	[]	2025-05-08 14:48:07.802	65	#ff40ff	confirmed	\N	f
76	Stakelbeck Tonight		3	9	2025-05-13 16:00:00	2025-05-13 20:30:00	production	\N	\N	[]	2025-05-08 14:30:55.47	65	#4B83E2	confirmed	\N	f
133	Better Together		6	9	2025-05-15 19:30:00	2025-05-15 21:00:00	production	\N	13	[9, 7]	2025-05-14 20:50:30.948	\N	#942192	confirmed	\N	f
134	Stakelbeck Tonight		3	9	2025-05-20 16:00:00	2025-05-20 20:30:00	production	\N	\N	[]	2025-05-14 20:52:16.875	65	#4B83E2	confirmed	\N	f
395	Staks YouTube/Podcast	NO ENGINEERING NEEDED.	9	1	2025-06-24 21:00:00	2025-06-24 22:00:00	production	\N	18	[]	2025-06-24 17:31:22.869	\N	#4f7a28	confirmed	\N	f
164	Centerpoint News Updates	Blynda Lane	8	9	2025-06-03 15:30:00	2025-06-03 16:00:00	production	\N	\N	[]	2025-05-22 14:39:51.724	65	#ffaa00	confirmed	\N	f
120	MSM News		1	1	2025-05-14 11:00:00	2025-05-14 23:30:00	production	\N	\N	[7, 8]	2025-05-13 20:15:16.59	1	#800000	confirmed	\N	f
135	Stakelbeck Tonight		3	9	2025-05-23 16:00:00	2025-05-23 20:30:00	production	\N	\N	[]	2025-05-14 20:52:29.355	65	#4B83E2	confirmed	\N	f
136	Praise	11:00am M&L host Kyle Idleman\n12:30pm M&L host Dr. Scott Hannen	14	9	2025-05-27 16:00:00	2025-05-27 19:00:00	production	\N	\N	[]	2025-05-14 21:07:04.756	\N	#ff40ff	confirmed	\N	f
137	Stakelbeck Tonight		3	9	2025-05-27 16:00:00	2025-05-27 20:30:00	production	\N	\N	[]	2025-05-22 14:33:08.518	65	#4B83E2	confirmed	\N	f
139	SFC	Director: Ryan Tyler	9	9	2025-06-06 14:30:00	2025-06-06 21:30:00	production	\N	\N	[]	2025-05-22 14:34:07.82	64	#ff2600	confirmed	\N	f
144	SFC	Director: Ryan Tyler	3	9	2025-06-07 14:30:00	2025-06-07 21:30:00	production	\N	\N	[]	2025-05-22 14:34:23.127	64	#ff2600	confirmed	\N	f
121	MSM News		1	1	2025-05-15 11:00:00	2025-05-15 23:30:00	production	\N	\N	[7, 8]	2025-05-13 20:15:16.611	1	#800000	confirmed	\N	f
148	Stakelbeck Tonight		3	9	2025-06-09 16:00:00	2025-06-09 20:30:00	production	\N	\N	[]	2025-05-22 14:38:04.286	65	#4B83E2	confirmed	\N	f
122	MSM News		1	1	2025-05-16 11:00:00	2025-05-16 23:30:00	production	\N	\N	[7, 8]	2025-05-13 20:15:16.624	1	#800000	confirmed	\N	f
119	MSM News		1	1	2025-05-13 11:00:00	2025-05-13 23:30:00	production	\N	\N	[7, 8]	2025-05-13 20:15:01.184	1	#800000	confirmed	\N	f
402	Through The Drama		13	1	2025-06-25 12:30:00	2025-06-25 15:00:00	production	\N	\N	[]	2025-06-25 19:46:32.271	64	#4B83E2	confirmed	\N	f
160	Centerpoint News Updates	Blynda Lane	8	9	2025-06-09 15:30:00	2025-06-09 16:00:00	production	\N	\N	[]	2025-05-22 14:39:36.801	65	#ffaa00	confirmed	\N	f
161	Centerpoint News Updates	Blynda Lane	8	9	2025-06-16 15:30:00	2025-06-16 16:00:00	production	\N	\N	[]	2025-05-22 14:39:36.816	65	#ffaa00	confirmed	\N	f
163	Centerpoint News Updates	Blynda Lane	8	9	2025-06-30 15:30:00	2025-06-30 16:00:00	production	\N	\N	[]	2025-05-22 14:39:36.845	65	#ffaa00	confirmed	\N	f
363	TCL 	Boxing 	3	1	2025-07-11 21:00:00	2025-07-12 04:30:00	production	\N	\N	[]	2025-06-18 15:43:36.301	64	#77bb41	confirmed	\N	f
400	TRS Special / Merit Midnight 		5	1	2025-07-01 15:00:00	2025-07-01 21:00:00	production	\N	\N	[]	2025-06-25 19:42:55.155	\N	#018333	confirmed	\N	f
398	Praise	Host: Sheila Walsh \nGuest: Prestonwood Worship (Musical Guest)	14	1	2025-07-28 14:00:00	2025-07-28 21:00:00	production	\N	10	[]	2025-06-24 21:58:15.471	\N	#ff40ff	confirmed	\N	f
399	Praise	Host: Sheila Walsh\nGuest: Adore Worship (Greg Long) - Musical Guest	14	1	2025-07-30 14:00:00	2025-07-30 21:00:00	production	\N	10	[]	2025-06-24 22:00:29.167	\N	#ff40ff	confirmed	\N	f
632	The Korey with a K Show Production	-ONLY START AFTER M&L PRAISE IS WRAPPED\n-NO TBN CAMS - CLIENT FIELD CAMS\n-LED/GFX	3	16	2025-09-24 22:00:00	2025-09-25 02:00:00	production	\N	23	[24]	2025-09-12 21:30:15.547	\N	#814bd2	confirmed	\N	f
490	Breaking Sunday School with Jason Sobel	Shoot day	5	9	2026-01-21 14:00:00	2026-01-22 04:00:00	production	\N	20	[]	2025-07-16 20:26:59.359	64	#4f7a28	confirmed	\N	f
611	TBN Tour of Trilogy Stages for SFC	TBN’s Guests:\n\n•\tMark Neifeld, CEO of SFC\n•\tSydney Woodman, SFC Event Coordinator\n•\tJennifer Nickerson, EA to CEO\n	20	22	2025-09-08 20:00:00	2025-09-08 21:00:00	tour	\N	23	[24, 7]	2025-09-05 17:12:36.134	\N	#814bd2	confirmed	\N	f
576	KLove Fan Awards Rewind	POSTPONED - NEW DATE TBD - Hosted by Blynda Lane.	3	9	2025-09-19 14:30:00	2025-09-19 19:30:00	production	\N	20	[14]	2025-08-12 18:47:33.998	65	#4f7a28	cancelled	\N	f
622	Praise (Plex)	Via Bob: Matt & Laurie will host a “Praise” program at the Plex with Sheila Walsh on Monday 9/29 at 1:30pm. The topic will be Sheila’s book The Gifts of Christmas which TBN is offering in November and early December.\n----> After the “Praise” Matt will record segments for the Eschatology Specials.\n	3	16	2025-09-29 17:00:00	2025-09-29 20:00:00	production	\N	8	[7, 14]	2025-09-12 18:31:32.706	1	#ff40ff	confirmed	\N	f
513	Praise	11:00am M&L host Nick Vujicic\n12:30pm M&L host David Green + Bill\nPCR1	3	9	2025-09-30 14:00:00	2025-09-30 22:00:00	production	\N	8	[14]	2025-08-01 16:42:17.312	\N	#ff40ff	confirmed	\N	f
662	Centerpoint News Updates	CODY	9	16	2025-10-09 15:00:00	2025-10-09 16:00:00	production	\N	12	[]	2025-10-02 19:10:40.636	1	#ffaa00	confirmed	\N	f
669	Stakelbeck Tonight		5	16	2025-10-15 16:00:00	2025-10-15 20:30:00	production	\N	6	[]	2025-10-02 21:12:43.626	64	#008cb4	confirmed	\N	f
165	Centerpoint News Updates	Cody Crouch	8	9	2025-06-10 15:30:00	2025-06-10 16:00:00	production	\N	\N	[]	2025-05-22 14:39:51.743	65	#ffaa00	confirmed	\N	f
166	Centerpoint News Updates	Cody Crouch	8	9	2025-06-17 15:30:00	2025-06-17 16:00:00	production	\N	\N	[]	2025-05-22 14:39:51.761	65	#ffaa00	confirmed	\N	f
432	TBN Special Report - Lifting Up Texas	Live at 7:00pm CT\nSheila Walsh hosting \nMike Hayes (in studio guest)\nInbound guests - TBD	1	1	2025-07-07 18:00:00	2025-07-08 01:30:00	production	\N	20	[9]	2025-07-07 16:07:37.914	1	#4f7a28	confirmed	\N	f
154	Stakelbeck Tonight	Director: Kevin Gandy	3	9	2025-06-20 16:00:00	2025-06-20 20:30:00	production	\N	6	[9, 7]	2025-05-22 14:38:04.371	65	#008cb4	confirmed	\N	f
169	Centerpoint News Updates	Cody Crouch	3	9	2025-06-12 15:30:00	2025-06-12 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.154	65	#ffaa00	confirmed	\N	f
172	Centerpoint News Updates	Cody Crouch	3	9	2025-06-13 15:30:00	2025-06-13 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.196	65	#ffaa00	confirmed	\N	f
168	Centerpoint News Updates	Blynda Lane	8	9	2025-06-04 15:30:00	2025-06-04 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.139	65	#ffaa00	confirmed	\N	f
142	SFC	Director: Ryan Tyler	9	9	2025-06-19 14:30:00	2025-06-19 21:30:00	production	\N	\N	[]	2025-05-22 14:34:07.865	64	#ff2600	cancelled	\N	f
162	Centerpoint News Updates	Cody Crouch	8	9	2025-06-23 15:30:00	2025-06-23 16:00:00	production	\N	\N	[]	2025-05-22 14:39:36.83	65	#ffaa00	cancelled	\N	f
143	SFC	Director: Ryan Tyler	9	9	2025-06-20 14:30:00	2025-06-20 21:30:00	production	\N	\N	[]	2025-05-22 14:34:07.879	64	#ff2600	cancelled	\N	f
146	SFC	Director: Ryan Tyler	3	9	2025-06-21 14:30:00	2025-06-21 21:30:00	production	\N	\N	[]	2025-05-22 14:34:23.162	64	#ff2600	cancelled	\N	f
140	SFC	Director: Ryan Tyler             \n\nAfter we are off air we will record SFC Investor video opens and closes with Jennifer Nickerson	9	9	2025-06-12 14:00:00	2025-06-12 22:00:00	production	\N	\N	[]	2025-05-22 14:34:07.835	64	#ff2600	confirmed	\N	f
173	Centerpoint News Updates	Cody Crouch	9	9	2025-06-20 15:30:00	2025-06-20 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.211	65	#ffaa00	confirmed	\N	f
145	SFC	Director: Ryan Tyler	3	9	2025-06-14 14:30:00	2025-06-14 21:30:00	production	\N	\N	[]	2025-05-22 14:34:23.146	64	#ff2600	confirmed	\N	f
150	Stakelbeck Tonight	Director: Kevin Gandy	3	9	2025-06-12 16:00:00	2025-06-12 20:30:00	production	\N	\N	[]	2025-05-22 14:38:04.316	65	#4B83E2	confirmed	\N	f
155	Stakelbeck Tonight		3	9	2025-06-23 16:00:00	2025-06-23 20:30:00	production	\N	\N	[]	2025-05-22 14:38:04.385	65	#008cb4	confirmed	\N	f
151	LIVE - TBN Special Report	Prerecords throughtout the day. \nLIVE 6:30p-7:55p CT	8	9	2025-06-16 16:00:00	2025-06-17 01:30:00	production	\N	6	[9, 7]	2025-05-22 14:38:04.33	65	#008cb4	confirmed	\N	f
149	Stakelbeck Tonight	Prerecords throughtout the day. \nLIVE 6:30p-7:55p CT	3	9	2025-06-10 16:00:00	2025-06-10 20:30:00	production	\N	\N	[]	2025-05-22 14:38:04.301	65	#4B83E2	confirmed	\N	f
141	SFC	Director: Ryan Tyler	9	9	2025-06-13 14:30:00	2025-06-13 21:30:00	production	\N	\N	[]	2025-05-22 14:34:07.851	64	#ff2600	confirmed	\N	f
711	Test Studio Status		2	1	2025-12-28 17:00:00	2025-12-28 18:00:00	production	\N	\N	[]	2025-12-28 17:37:44.959	\N	#4B83E2	confirmed	\N	f
175	Centerpoint News Updates	Host: Cody Crouch \nSTART @ 10:15 AM	9	9	2025-06-18 15:00:00	2025-06-18 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.237	65	#ffaa00	confirmed	\N	f
167	Centerpoint News Updates	Cody Crouch	8	9	2025-06-24 15:30:00	2025-06-24 16:00:00	production	\N	\N	[]	2025-05-22 14:39:51.776	65	#ffaa00	cancelled	\N	f
177	Centerpoint News Updates	Cody Crouch	9	9	2025-06-25 15:30:00	2025-06-25 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.263	65	#ffaa00	cancelled	\N	f
217	Centerpoint News Updates	Cody Crouch	9	1	2025-07-10 15:00:00	2025-07-10 15:30:00	production	\N	\N	[]	2025-05-30 20:05:20.489	65	#ffaa00	confirmed	\N	f
623	Chasing Hope	TRILOGY CLIENT - PCR3 ONLY\nTBD	2	16	2025-11-13 15:00:00	2025-11-13 23:00:00	production	\N	23	[24, 14]	2025-09-12 19:58:45.675	\N	#814bd2	tentative	\N	f
188	SFC	Director: Ryan Tyler	3	9	2025-07-05 14:30:00	2025-07-05 21:30:00	production	\N	\N	[]	2025-05-22 14:50:33.451	64	#ff2600	confirmed	\N	f
396	Staks Hit	FOX NEWS HIT w/ Erick\nHit Window: 9:45-10:55pm CT / Hit Time: TBD	8	1	2025-06-25 02:30:00	2025-06-25 04:00:00	production	\N	18	[]	2025-06-24 17:51:09.044	65	#4f7a28	confirmed	\N	f
185	SFC	Director: Tyler Hirth	9	9	2025-07-17 14:30:00	2025-07-17 21:30:00	production	\N	\N	[]	2025-05-22 14:48:32.421	64	#ff2600	confirmed	\N	f
186	SFC	Director: Tyler Hirth	9	9	2025-07-18 11:00:00	2025-07-18 18:00:00	production	\N	\N	[]	2025-05-22 14:48:32.436	64	#ff2600	confirmed	\N	f
192	Houston Eschatology Remote	June 5th - Crew travels to Houston\nJune 6th - Setup\nJune 7th - 2 Praise programs (10am and 11:30am) then strike and travel home.\n\n10:00am - NT Wright\n11:30am - Mark Lanier	13	9	2025-06-05 16:00:00	2025-06-05 23:00:00	production	\N	\N	[]	2025-05-22 14:59:55.305	\N	#008cb4	confirmed	\N	f
193	Houston Eschatology Remote	June 5th - Crew travels to Houston\nJune 6th - Setup\nJune 7th - 2 Praise programs (10am and 11:30am) then strike and travel home.\n\n10:00am - NT Wright\n11:30am - Mark Lanier	13	9	2025-06-06 13:30:00	2025-06-06 20:00:00	production	\N	\N	[]	2025-05-22 15:00:17.323	\N	#008cb4	confirmed	\N	f
194	Houston Eschatology Remote	June 5th - Crew travels to Houston\nJune 6th - Setup\nJune 7th - 2 Praise programs (10am and 11:30am) then strike and travel home.\n\n10:00am - NT Wright\n11:30am - Mark Lanier	13	9	2025-06-07 13:00:00	2025-06-07 19:00:00	production	\N	\N	[]	2025-05-22 15:00:17.339	\N	#008cb4	confirmed	\N	f
84	Stakelbeck Tonight	11:00am MROs with Blynda Lane prior to Staks	3	9	2025-05-22 15:30:00	2025-05-22 20:30:00	production	\N	\N	[9, 7]	2025-05-08 14:41:24.361	65	#4B83E2	confirmed	\N	f
357	TCL 	Boxing 	3	1	2025-06-27 20:00:00	2025-06-28 04:30:00	production	\N	\N	[]	2025-06-18 15:36:56.269	64	#77bb41	confirmed	\N	f
213	Centerpoint News Updates	Cody Crouch	9	9	2025-07-09 15:30:00	2025-07-09 16:00:00	production	\N	\N	[]	2025-05-30 20:04:57.095	65	#ffaa00	confirmed	\N	f
201	TBN Germany	Recording segments for their programs. Prompter needed. \n3x Peds Total. 1-2x Talent.\nSTART ESTIMATE @ 12:00PM	3	1	2025-06-28 16:00:00	2025-06-28 21:00:00	production	\N	18	[]	2025-05-27 20:41:36.781	65	#4f7a28	confirmed	\N	f
182	Living Legacy Testimony	Living Legacy donor will give her testimony immediately following Praise.	14	9	2025-06-17 22:00:00	2025-06-17 22:30:00	production	\N	\N	[]	2025-05-22 14:44:38.586	\N	#4f7a28	cancelled	\N	f
200	AMAC Spots	Impact Production renting Hit Studio P to record ads for the Charlie Kirk Show. 1 hour rental 11:00am-12:00pm	8	9	2025-06-04 16:00:00	2025-06-04 17:00:00	production	\N	18	[]	2025-05-27 16:37:41.811	65	#4f7a28	confirmed	\N	f
203	Centerpoint News Updates	Blynda Lane	8	9	2025-07-07 15:30:00	2025-07-07 16:00:00	production	\N	\N	[]	2025-05-30 20:03:56.054	65	#ffaa00	confirmed	\N	f
204	Centerpoint News Updates	Blynda Lane	8	1	2025-07-14 15:00:00	2025-07-14 15:30:00	production	\N	\N	[]	2025-05-30 20:03:56.073	1	#ffaa00	confirmed	\N	f
433	Centerpoint News Updates	Cody Crouch	9	1	2025-07-15 15:00:00	2025-07-15 15:30:00	production	\N	\N	[]	2025-07-08 14:23:29.424	1	#ffaa00	confirmed	\N	f
214	Centerpoint News Updates	Cody Crouch	9	1	2025-07-16 15:00:00	2025-07-16 15:30:00	production	\N	\N	[]	2025-05-30 20:04:57.11	1	#ffaa00	confirmed	\N	f
190	SFC	Director: Ryan Tyler\nSaturday, July 26:\nSFC+ : 2:00PM-3:00PM ET\nESPN+: 3:00PM-5:00PM ET\n\nSunday, July 27:\nSFC+: 12:00PM-1:00PM ET\nESPN+: 1:00PM-3:00PM ET	3	1	2025-07-26 14:30:00	2025-07-26 21:30:00	production	\N	\N	[]	2025-05-22 14:50:33.485	64	#ff2600	confirmed	\N	f
191	SFC	Director: Ryan Tyler\nSaturday, July 26:\nSFC+ : 2:00PM-3:00PM ET\nESPN+: 3:00PM-5:00PM ET\n\nSunday, July 27:\nSFC+: 12:00PM-1:00PM ET\nESPN+: 1:00PM-3:00PM ET	3	1	2025-07-27 14:30:00	2025-07-27 21:30:00	production	\N	\N	[]	2025-05-22 14:50:33.499	64	#ff2600	confirmed	\N	f
206	Centerpoint News Updates	Blynda Lane	8	1	2025-07-28 15:00:00	2025-07-28 15:30:00	production	\N	12	[9]	2025-05-30 20:03:56.11	1	#ffaa00	confirmed	\N	f
211	Centerpoint News Updates	Blynda Lane	9	1	2025-07-29 15:00:00	2025-07-29 15:30:00	production	\N	12	[9]	2025-05-30 20:04:34.98	1	#ffaa00	confirmed	\N	f
208	Centerpoint News Updates	Cody Crouch	8	9	2025-07-08 15:30:00	2025-07-08 16:00:00	production	\N	\N	[]	2025-05-30 20:04:34.934	65	#ffaa00	confirmed	\N	f
219	Centerpoint News Updates	Blynda Lane	8	1	2025-07-31 15:00:00	2025-07-31 15:30:00	production	\N	\N	[]	2025-05-30 20:05:20.525	1	#ffaa00	confirmed	\N	f
197	SFC	Director: Ryan Tyler	3	1	2025-07-03 14:30:00	2025-07-03 21:30:00	production	\N	\N	[]	2025-05-22 15:12:45.468	64	#ff2600	confirmed	\N	f
195	Better Together		6	9	2025-06-11 13:00:00	2025-06-11 22:30:00	production	\N	13	[9, 7]	2025-05-22 15:03:11.482	\N	#942192	confirmed	\N	f
243	Stakelbeck Tonight	2:30pm CT - Stakscast (Inbound) @ ROUNDTABLE w/ Podcast Mic: 2:30pm CT	3	1	2025-07-28 16:30:00	2025-07-28 21:00:00	production	\N	6	[14]	2025-06-03 15:37:04.587	1	#008cb4	confirmed	\N	f
234	Better Together		6	1	2025-07-29 13:00:00	2025-07-29 22:30:00	production	\N	13	[]	2025-05-30 21:54:53.433	65	#942192	confirmed	\N	f
245	Stakelbeck Tonight		3	9	2025-07-31 16:00:00	2025-07-31 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.63	1	#4B83E2	confirmed	\N	f
226	Centerpoint News Updates	Blynda Lane	8	9	2025-08-05 15:30:00	2025-08-05 16:00:00	production	\N	\N	[]	2025-05-30 20:08:00.713	1	#ffaa00	confirmed	\N	f
174	Centerpoint News Updates	Cody Crouch	9	9	2025-06-19 15:30:00	2025-06-19 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.225	65	#ffaa00	confirmed	\N	f
180	Praise	Director: Steve Fjordbak\n2:00pm Sheila Walsh hosts Jordan Rubin\n3:30pm Sheila Walsh hosts Jordan Rubin	14	9	2025-06-17 17:00:00	2025-06-17 22:00:00	production	\N	\N	[]	2025-05-22 14:42:17.164	\N	#ff40ff	confirmed	\N	f
198	SFC	Director: Ryan Tyler	3	1	2025-07-04 14:30:00	2025-07-04 21:30:00	production	\N	\N	[]	2025-05-22 15:12:45.488	64	#ff2600	confirmed	\N	f
178	Centerpoint News Updates	Cody Crouch	9	9	2025-06-26 15:30:00	2025-06-26 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.276	65	#ffaa00	cancelled	\N	f
179	Centerpoint News Updates	Cody Crouch	9	9	2025-06-27 15:30:00	2025-06-27 16:00:00	production	\N	\N	[]	2025-05-22 14:40:10.29	65	#ffaa00	cancelled	\N	f
207	Centerpoint News Updates	Cody Crouch	8	9	2025-07-01 15:30:00	2025-07-01 16:00:00	production	\N	\N	[]	2025-05-30 20:04:34.914	65	#ffaa00	cancelled	\N	f
212	Centerpoint News Updates	Cody Crouch	9	9	2025-07-02 15:30:00	2025-07-02 16:00:00	production	\N	\N	[]	2025-05-30 20:04:57.079	65	#ffaa00	cancelled	\N	f
220	Centerpoint News Updates	Cody Crouch	3	9	2025-07-03 15:30:00	2025-07-03 16:00:00	production	\N	\N	[]	2025-05-30 20:05:46.832	65	#ffaa00	cancelled	\N	f
231	SFC	Director: Ryan Tyler	3	9	2025-08-30 14:00:00	2025-08-30 22:00:00	production	\N	\N	[]	2025-05-30 20:17:12.497	64	#ff2600	confirmed	\N	f
232	SFC	Director: Ryan Tyler	3	9	2025-08-31 14:00:00	2025-08-31 21:30:00	production	\N	\N	[]	2025-05-30 20:17:12.518	64	#ff2600	confirmed	\N	f
228	SFC	Director: Ryan Tyler	9	9	2025-08-21 12:30:00	2025-08-21 21:00:00	production	\N	\N	[]	2025-05-30 20:16:31.835	64	#ff2600	cancelled	\N	f
229	SFC	Director: Ryan Tyler\nLIVE @ 11:30 AM - 2:30 PM CT	9	9	2025-08-22 12:30:00	2025-08-22 21:00:00	production	\N	\N	[]	2025-05-30 20:16:31.851	64	#ff2600	confirmed	\N	f
633	CP NEWS: Remembering Charlie Kirk	W/ CODY CROUCH\n-CALL TIME: 10:00 AM\n-10-15min segment	3	16	2025-09-13 14:00:00	2025-09-13 17:00:00	production	\N	12	[14, 7]	2025-09-12 23:07:07.553	1	#ffaa00	confirmed	\N	f
572	Stakelbeck Tonight		3	9	2025-09-25 16:00:00	2025-09-25 20:30:00	production	\N	\N	[]	2025-08-11 16:35:16.143	1	#4B83E2	cancelled	\N	f
252	Stakelbeck Tonight	Director: Kevin Gandy	8	9	2025-06-18 17:00:00	2025-06-18 20:30:00	production	\N	6	[9, 7]	2025-06-05 19:04:07.094	65	#008cb4	confirmed	\N	f
654	Centerpoint News Updates	CODY	9	16	2025-10-02 15:00:00	2025-10-02 15:30:00	production	\N	12	[]	2025-10-01 20:55:50.198	1	#ffaa00	confirmed	\N	f
250	Centerpoint News Updates	Cody Crouch	3	9	2025-06-06 15:30:00	2025-06-06 16:00:00	production	\N	\N	[]	2025-06-03 16:04:03.403	65	#ffaa00	confirmed	\N	f
246	Stakelbeck Tonight		8	1	2025-07-16 16:00:00	2025-07-16 20:30:00	production	\N	6	[9, 7]	2025-06-03 15:39:04.139	65	#4B83E2	cancelled	\N	f
256	SFC	Director: Ryan Tyler	9	9	2025-06-05 14:30:00	2025-06-05 21:30:00	production	\N	\N	[]	2025-06-05 22:09:25.27	64	#ff2600	cancelled	\N	f
663	Centerpoint News Updates	CODY	9	16	2025-10-10 15:00:00	2025-10-10 16:00:00	production	\N	12	[]	2025-10-02 19:11:09.308	1	#ffaa00	confirmed	\N	f
255	Positiv Promo Shoot	Better Together White Cyc set\n1 camera and prompter\nDirector: Kevin Gandy\nProducer: Steve Fjordbal	6	9	2025-06-19 21:00:00	2025-06-19 22:00:00	production	\N	18	[9, 7]	2025-06-05 21:32:54.045	65	#4f7a28	cancelled	\N	f
237	Stakelbeck Tonight		3	1	2025-07-10 16:30:00	2025-07-10 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.496	65	#008cb4	confirmed	\N	f
240	Stakelbeck Tonight		3	1	2025-07-17 16:00:00	2025-07-17 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.539	1	#4B83E2	confirmed	\N	f
247	Stakelbeck Tonight		8	1	2025-07-18 16:00:00	2025-07-18 20:30:00	production	\N	6	[9, 7]	2025-06-03 15:39:28.032	1	#4B83E2	confirmed	\N	f
221	Centerpoint News Updates	Cody Crouch	3	1	2025-07-17 15:00:00	2025-07-17 15:30:00	production	\N	\N	[]	2025-05-30 20:05:46.848	1	#ffaa00	confirmed	\N	f
222	Centerpoint News Updates	Cody Crouch	3	1	2025-07-18 15:00:00	2025-07-18 15:30:00	production	\N	\N	[]	2025-05-30 20:05:46.863	1	#ffaa00	confirmed	\N	f
239	Stakelbeck Tonight		3	1	2025-07-14 16:00:00	2025-07-14 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.525	1	#4B83E2	confirmed	\N	f
241	Stakelbeck Tonight		3	1	2025-07-23 16:00:00	2025-07-23 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.554	1	#4B83E2	confirmed	\N	f
248	Stakelbeck Tonight		8	1	2025-07-22 16:00:00	2025-07-22 20:30:00	production	\N	6	[7]	2025-06-03 15:39:39.754	1	#4B83E2	confirmed	\N	f
215	Centerpoint News Updates	Blynda Lane	8	1	2025-07-23 15:30:00	2025-07-23 16:00:00	production	\N	\N	[]	2025-05-30 20:04:57.125	1	#ffaa00	confirmed	\N	f
223	Centerpoint News Updates	Blynda Lane	8	1	2025-07-24 15:30:00	2025-07-24 16:00:00	production	\N	\N	[]	2025-05-30 20:05:46.878	1	#ffaa00	confirmed	\N	f
216	Centerpoint News Updates	Blynda Lane	8	1	2025-07-30 15:30:00	2025-07-30 16:00:00	production	\N	\N	[]	2025-05-30 20:04:57.139	1	#ffaa00	confirmed	\N	f
249	Stakelbeck Tonight		3	1	2025-07-21 19:30:00	2025-07-21 21:00:00	production	\N	6	[]	2025-06-03 15:42:16.615	1	#4B83E2	confirmed	\N	f
205	Centerpoint News Updates	Blynda Lane	8	1	2025-07-21 15:00:00	2025-07-21 15:30:00	production	\N	\N	[]	2025-05-30 20:03:56.089	65	#ffaa00	confirmed	\N	f
224	Centerpoint News Updates	Blynda Lane	8	1	2025-07-25 15:00:00	2025-07-25 15:30:00	production	\N	\N	[]	2025-05-30 20:05:46.893	1	#ffaa00	confirmed	\N	f
210	Centerpoint News Updates	Blynda Lane	8	1	2025-07-22 15:30:00	2025-07-22 16:00:00	production	\N	\N	[]	2025-05-30 20:04:34.965	1	#ffaa00	confirmed	\N	f
244	Stakelbeck Tonight		3	1	2025-07-30 16:00:00	2025-07-30 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.615	1	#4B83E2	cancelled	\N	f
499	TCL Boxing 	Boxing 	3	16	2025-08-31 21:30:00	2025-09-01 04:30:00	production	\N	21	[]	2025-07-21 19:03:01.946	64	#77bb41	confirmed	\N	f
442	Trilogy Event: AAF + DPA Mixer	Trilogy- hosted mixer event for local groups including AAF Dallas, AAF Fort Worth and DPA.\nHaze machine: NO\n \nPrep star time: 5pm\nEvent start time: 6pm\nEvent wrap time: 10pm\nEst number of people: 100 \n\nPrelim attendee list attached\n\nTrilogy onsite contact: Sara Joyner	19	23	2025-07-24 22:00:00	2025-07-25 03:00:00	production	\N	23	[]	2025-07-08 15:33:14.825	\N	#814bd2	confirmed	\N	f
431	Teton Ridge - Training	Cowboy Channel team will be on site with a Ross trainer to learn how to operate Xpression. No studio only PCR 1 needed.	21	9	2025-08-05 12:00:00	2025-08-05 15:00:00	production	\N	20	[]	2025-07-01 21:28:59.297	1	#4f7a28	cancelled	\N	f
235	Stakelbeck Tonight		3	9	2025-07-07 16:00:00	2025-07-07 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.457	65	#008cb4	confirmed	\N	f
236	Stakelbeck Tonight		3	9	2025-07-08 16:00:00	2025-07-08 20:30:00	production	\N	\N	[]	2025-06-03 15:37:04.481	65	#008cb4	confirmed	\N	f
251	Stakelbeck Tonight		3	9	2025-06-25 17:00:00	2025-06-25 20:30:00	production	\N	\N	[]	2025-06-05 17:20:13.53	65	#008cb4	confirmed	\N	f
435	Trilogy Shoot: Psychia	Production Company: Think Branded Media\nTrilogy Onsite contact: Sara Joyner & Parke May\nHaze Machine: NO\nTrilogy Reception: Cristina Trejo\n \nJuly 9th: Prep Day (6 hours)\nEst Start time: 10am\n•\tReceptionist will be here by 9am\nEst wrap time: 5pm\nEst # of people: 15-20\n \n \nJuly 10th: Shoot Day (10 hours)\nEst Start time: 7:45am\nEst wrap time: 7:30pm\nEst # of people:15-20\n \nJuly 11th: Shoot Day (10 hours)\nEst Start time: 8am\nEst wrap time: 7:30pm\nEst # of people:15-20\n \nAttendee Names: \nBeau W Ethridge\nVincent Monsaint\nBrennan Freeze\nDaniel Nanasi\nAaron Payton\nJT Huffer\nJustin Viper\nYuri Chung\nElinea Eads\nLindsey Nickens\nMadison Paine\nMeredith Noles\nZach Warner\nWilliam Cody Gray\nKevin Sloane\nEmily Chapman\nZac Arrington\nDylan Hoep \nDrew Breedlove\nBonnie Criss\nJett Linh Dinh\nYaasmance George Shepard\nCourtney Byrd\nWes Gillum\nRichard Sanchez\nNick Smith\nAlicia S Azahar\nWesley Hayes	18	1	2025-07-09 15:00:00	2025-07-09 21:00:00	production	\N	\N	[]	2025-07-08 15:14:25.68	\N	#814bd2	confirmed	\N	f
181	Praise	11:00am Sheila Walsh hosts Peter Mutabazi\n1:00pm Sheila Walsh hosts Pastor Jack Graham\nDirector: Steve Fjordbak	14	1	2025-06-27 14:30:00	2025-06-27 18:30:00	production	\N	\N	[]	2025-05-22 14:42:17.183	\N	#ff40ff	confirmed	\N	f
312	Living Legacy Testimony	START @ 1:30 - Living Legacy donor will give her testimony immediately following Praise.	14	1	2025-06-27 18:30:00	2025-06-27 19:30:00	production	\N	\N	[]	2025-06-16 18:57:12.456	\N	#4f7a28	confirmed	\N	f
309	Stakelbeck Tonight		8	9	2025-06-24 16:00:00	2025-06-24 20:30:00	production	\N	6	[9, 7]	2025-06-16 13:53:41.361	65	#008cb4	confirmed	\N	f
311	Praise	w/ Matt & Laurie (Guest: Jordan Rubin)\nSTART @ 11:00AM\nPrompter needed	3	16	2025-06-18 14:30:00	2025-06-18 17:00:00	production	\N	8	[9, 7, 9, 7]	2025-06-16 18:55:00.887	65	#ff40ff	confirmed	\N	f
310	Stakelbeck Tonight	Director: Kevin Gandy	3	9	2025-06-17 15:30:00	2025-06-17 20:00:00	production	\N	6	[9, 7]	2025-06-16 13:54:14.226	65	#008cb4	confirmed	\N	f
319	Fox News Hit		8	9	2025-06-18 03:00:00	2025-06-18 04:00:00	production	\N	18	[]	2025-06-17 20:48:43.255	\N	#4f7a28	confirmed	\N	f
316	LIVE - TBN Special Report	HUBBED IN NASHVILLE\nPrerecords throughtout the day.  / HIT @ 4:00PM CT\nLIVE 6:30p-7:55p CT	8	9	2025-06-19 16:00:00	2025-06-20 01:30:00	production	\N	6	[9, 7]	2025-06-17 16:34:15.856	65	#008cb4	confirmed	\N	f
268	Through the Drama 	Chris and Lauren Podcast 	13	1	2025-06-16 12:00:00	2025-06-16 15:00:00	production	\N	\N	[]	2025-06-16 00:11:23.592	64	#ff6251	confirmed	\N	f
269	Through The Drama 		13	1	2025-06-17 12:30:00	2025-06-17 15:00:00	production	\N	\N	[]	2025-06-16 00:12:20.899	\N	#ff6251	confirmed	\N	f
389	DP		7	1	2025-07-22 14:00:00	2025-07-22 21:00:00	production	\N	\N	[]	2025-06-23 15:30:24.236	64	#4B83E2	cancelled	\N	f
261	Rabbi Jason Sobel Shoot - TBN	Please refer to 8/18 for details	19	9	2025-08-19 13:30:00	2025-08-19 22:30:00	production	\N	23	[24, 7]	2025-06-12 17:21:58.817	\N	#814bd2	confirmed	\N	f
370	Stakelbeck Tonight	IN-STUDIO GUEST @ 1:00PM CT\n(Jackson Lahmeyer)	3	16	2025-06-19 16:00:00	2025-06-19 20:30:00	production	\N	6	[9, 7]	2025-06-18 19:25:36.092	65	#008cb4	confirmed	\N	f
378	Positiv Promo Shoot	Better Together White Cyc set\n1 camera and prompter\nDirector: Kevin Gandy	6	9	2025-07-10 21:00:00	2025-07-10 22:00:00	production	\N	18	[9, 7]	2025-06-20 14:19:13.728	65	#4f7a28	confirmed	\N	f
376	MRO reads with Blynda		3	9	2025-06-25 15:30:00	2025-06-25 17:00:00	production	\N	18	[]	2025-06-20 14:01:02.515	65	#4f7a28	cancelled	\N	f
385	LIVE TBN Special Report	Live at 7:00pm CT\nHUB ED IN NASHVILLE 	8	9	2025-06-22 17:00:00	2025-06-23 02:00:00	production	\N	6	[9, 7]	2025-06-22 11:01:12.813	65	#008cb4	confirmed	\N	f
386	Fox News Hit	Erick Stakelbeck 	8	9	2025-06-22 03:00:00	2025-06-21 05:00:00	production	\N	20	[]	2025-06-22 11:03:11.762	65	#4f7a28	confirmed	\N	f
392	SFC	Director: Tyler Hirth	3	1	2025-07-19 14:30:00	2025-07-19 21:30:00	production	\N	\N	[]	2025-06-23 19:47:54.989	64	#ff2600	confirmed	\N	f
354	TCL 	Boxing 	5	1	2025-06-20 19:00:00	2025-06-20 05:00:00	production	\N	\N	[]	2025-06-18 15:35:44.64	64	#77bb41	confirmed	\N	f
356	TCL 	Boxing 	3	1	2025-06-29 19:00:00	2025-06-30 04:30:00	production	\N	\N	[]	2025-06-18 15:36:11.297	64	#77bb41	confirmed	\N	f
233	Better Together		6	1	2025-07-15 13:00:00	2025-07-15 22:30:00	production	\N	13	[9, 7]	2025-05-30 21:54:53.411	65	#942192	confirmed	\N	f
434	SFC - Investor Video	Mark Neifeld will be on site to record a quick video for SFC investors. 2 robo cameras\nSTART @ 11:15 AM	9	1	2025-07-10 16:00:00	2025-07-10 16:30:00	production	\N	15	[]	2025-07-08 14:25:59.978	65	#ff2600	confirmed	\N	f
263	Rabbi Jason Sobel Shoot - TBN	Please refer to 8/18 for details	19	9	2025-08-21 13:30:00	2025-08-21 22:30:00	production	\N	23	[24, 7]	2025-06-12 17:22:26.12	\N	#814bd2	confirmed	\N	f
262	Rabbi Jason Sobel Shoot - TBN	Please refer to 8/18 for details	19	9	2025-08-20 13:30:00	2025-08-20 22:30:00	production	\N	23	[24, 7]	2025-06-12 17:22:26.106	\N	#814bd2	confirmed	\N	f
482	TBN Special Report - LIVE	Live 7pm CT\n	1	1	2025-07-17 22:00:00	2025-07-18 02:00:00	production	\N	20	[]	2025-07-14 18:02:02.195	1	#4f7a28	confirmed	\N	f
655	Centerpoint News Updates	CODY	9	16	2025-10-01 15:00:00	2025-10-01 15:30:00	production	\N	12	[]	2025-10-01 20:56:23.135	\N	#ffaa00	confirmed	\N	f
491	Paul Venter - Outbound	Real Americas Voice - Live at 4:00pm CT	7	1	2025-07-17 21:00:00	2025-07-17 21:30:00	production	\N	20	[14]	2025-07-17 20:39:36.364	\N	#4f7a28	confirmed	\N	f
644	MRO Segments with Blynda		3	9	2025-09-25 15:30:00	2025-09-25 17:30:00	production	\N	20	[]	2025-09-22 21:02:26.455	\N	#4f7a28	confirmed	\N	f
634	LIVE: NIGHT OF PRAYER	HOST: SHELIA WALSH -\nSTUDIO C -\nLIVE @ 7:00 - 8:00 PM CT	3	16	2025-09-18 21:00:00	2025-09-19 02:00:00	production	\N	8	[]	2025-09-13 19:23:23.884	1	#ff40ff	confirmed	\N	f
365	TCL Boxing 	Boxing 	3	1	2025-07-25 19:00:00	2025-07-25 05:00:00	production	\N	21	[]	2025-06-18 15:45:09.586	\N	#77bb41	cancelled	\N	f
614	Praise	M&L HOST: Les + Leslie Parrot and Gary Chapman.\nSTART: 1:00 PM	3	9	2025-10-01 16:00:00	2025-10-01 20:00:00	production	\N	8	[]	2025-09-05 19:09:11.471	1	#ff40ff	confirmed	\N	f
648	Veritcal Shorts Production	Pre-light- 30th\nShoot day- 1-3rd\n \nNames of guests are in the attached PDF’s on Sept 30th date\n \n9am to 9PM\n \nProduction Company: IAJ Media\nTrilogy Onsite contact: Parke May & Taylor Tucker\nHaze Machine: YES\nTrilogy Reception: Cristina Trejo\n \nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\n 	20	22	2025-10-01 14:00:00	2025-10-02 02:00:00	production	\N	23	[24, 7]	2025-09-29 16:00:29.208	\N	#814bd2	confirmed	\N	f
653	TBN B-ROLL SHOOT	Details from Angelique:\n\nThis will be a shoot filming a man (scholar looking) writing on a whiteboard, filming him writing, reading, on a desk, etc\n \nLighting: We will need moody lighting lots of contrast\nAnd a smoke machine\nProps: I will be ordering a white board and other props. Steve F is delivering a desk from Irving this week.\nShooter: I have hired a shooter from Houston who shot Lanier Broll that Matt really liked. Aidan and others are not available.\nLED walls: we will use similar ones to the panel shoot\n\n\n	18	22	2025-10-06 14:00:00	2025-10-06 22:00:00	production	\N	23	[24, 7]	2025-09-29 17:55:53.814	\N	#814bd2	confirmed	\N	f
693	Samsung Pay Commercial Shoot	7AM-7PM \nUsing: Stage, Audience holding, Trilogy Greenrooms	18	24	2025-10-21 14:00:00	2025-10-21 22:00:00	production	\N	23	[24, 7, 14]	2025-10-14 22:49:11.954	\N	#814bd2	confirmed	\N	f
625	Chasing Hope	TRILOGY CLIENT \nALL FIELD CAMS\nUSING: STUDIO E, Audience Holding, Better Together Greenroom. \n\nIn the afternoon they want to do a shot of 1 talent walking down the hallway by PCR 1 and 2. It will be quick. When I have a better time I will update here!	5	16	2025-10-21 12:00:00	2025-10-22 00:00:00	production	\N	23	[24]	2025-09-12 20:12:26.938	\N	#814bd2	confirmed	\N	f
698	Centerpoint News Updates	BLYNDA	8	16	2025-10-27 15:00:00	2025-10-27 16:00:00	production	\N	12	[]	2025-10-15 17:50:48.611	1	#ffaa00	confirmed	\N	f
707	CCSWB Stream + Live Event 	Client- Coca-Cola Southwest Beverages \n\n12PM-12:45- Stream pre-produced PKG out to their platform for a company wide Town Hall. \n\n12:45-1:15PM - 3 CCSWB talent on the commercial stage will present LIVE to the entire company. Taylor will be making graphics for this section of the broadcast. We will need a booth with director, audio, graphics and promotor. \n\nOn stage- 2 broadcast cameras with promotor attached. \n\n1:30- Wrap	18	24	2025-10-31 17:00:00	2025-10-31 18:30:00	production	\N	23	[24, 7, 14]	2025-10-16 16:44:49.043	112	#814bd2	confirmed	\N	f
695	5 MIN W/ JESUS	Sheila in P - START @ 1:00PM - 3:30PM	8	16	2025-10-31 17:30:00	2025-10-31 20:30:00	production	\N	\N	[]	2025-10-15 17:34:57.218	\N	#669c35	confirmed	\N	f
699	Centerpoint News Updates	CODY	9	16	2025-10-28 15:00:00	2025-10-28 16:00:00	production	\N	12	[]	2025-10-15 17:51:49.771	\N	#ffaa00	confirmed	\N	f
701	Centerpoint News Updates	CODY	9	16	2025-10-30 15:00:00	2025-10-30 16:00:00	production	\N	12	[]	2025-10-15 17:53:12.823	\N	#ffaa00	confirmed	\N	f
702	Centerpoint News Updates	CODY	9	16	2025-10-31 15:00:00	2025-10-31 16:00:00	production	\N	12	[]	2025-10-15 17:53:34.291	1	#ffaa00	confirmed	\N	f
686	Praise (Plex)	TIM TIMBERLAKE + PHILLP W. - \nM&L HOST - START @ 4:00PM (PCR1)	3	16	2025-10-16 19:00:00	2025-10-16 23:00:00	production	\N	8	[]	2025-10-09 21:56:07.121	1	#ff40ff	confirmed	\N	f
704	MATT X SUNIL: New Show	New Show - 1st Record - START 12:00 PM ---\n\nThis program will feature Matt Crouch and Sunil Isaac as they discuss stories that build our faith and give glory to God. ---- Camera plan:\n\n4 cameras total -\n2 robos -\n1 dolly in the room -\n1 jib in studio D (locked off, shooting into Studio X)\n\n\n\n	11	16	2025-10-23 15:00:00	2025-10-23 19:00:00	production	\N	\N	[]	2025-10-15 20:30:45.789	\N	#4B83E2	confirmed	\N	f
680	Centerpoint News Updates	CODY	9	16	2025-10-21 15:00:00	2025-10-21 16:00:00	production	\N	12	[]	2025-10-06 21:47:59.297	1	#ffaa00	confirmed	\N	f
681	Centerpoint News Updates	CODY	9	16	2025-10-22 15:00:00	2025-10-22 16:00:00	production	\N	12	[]	2025-10-06 21:49:05.813	1	#ffaa00	confirmed	\N	f
682	Centerpoint News Updates	CODY	9	16	2025-10-23 15:00:00	2025-10-23 16:00:00	production	\N	12	[]	2025-10-06 21:49:30.926	1	#ffaa00	confirmed	\N	f
684	Stakelbeck Tonight		14	16	2025-10-23 16:00:00	2025-10-23 20:30:00	production	\N	6	[14]	2025-10-06 21:52:03.387	\N	#008cb4	confirmed	\N	f
685	Praise (Plex)	ANCIENT NUTRITION - M&L - 2:00 & 3:30 PM	3	16	2025-10-23 17:00:00	2025-10-23 22:00:00	production	\N	8	[14]	2025-10-06 21:53:50.485	1	#ff40ff	confirmed	\N	f
672	Praise (Irving)	MUSICAL PRAISE - FIRST BAPTIST - START @ 3:00PM	14	16	2025-10-17 14:00:00	2025-10-17 22:00:00	production	\N	10	[]	2025-10-06 20:42:47.167	\N	#ff40ff	confirmed	\N	f
671	Praise (Plex)	1:30pm M&L host Tim Dunn\n3:00pm M&L host Scott Hannen and Anthony (A T)	3	16	2025-10-10 16:30:00	2025-10-10 21:30:00	production	\N	8	[]	2025-10-06 15:51:32.362	1	#ff40ff	confirmed	\N	f
678	Stakelbeck Tonight	IN-STUDIO GUESTS -\n11:45 AM + 2PM	3	16	2025-10-13 15:30:00	2025-10-13 20:30:00	production	\N	6	[]	2025-10-06 21:41:23.784	1	#008cb4	confirmed	\N	f
687	BT PICK UPS	WHITE CYC - Christmas Decor - START TBD (Morning w/ Laurie)	6	16	2025-10-15 15:00:00	2025-10-15 18:00:00	production	\N	13	[]	2025-10-10 16:53:48.907	65	#942192	confirmed	\N	f
691	Forsure AI 		19	24	2025-10-16 14:00:00	2025-10-17 00:00:00	production	\N	23	[24, 7, 14]	2025-10-14 22:41:07.405	\N	#bc4bd2	confirmed	\N	f
624	Chasing Hope	TRILOGY CLIENT - TBD\nALL FIELD CAMS	5	16	2025-10-20 13:00:00	2025-10-20 16:00:00	production	\N	23	[24, 14, 7]	2025-09-12 20:05:22.14	\N	#814bd2	confirmed	\N	f
700	Centerpoint News Updates	CODY	9	16	2025-10-29 15:00:00	2025-10-29 16:00:00	production	\N	12	[]	2025-10-15 17:52:46.06	1	#ffaa00	confirmed	\N	f
703	Praise (Plex)	M&L Host: Dudley Hall & Geron Davis -\nSTART @ 2:00 PM	3	16	2025-10-30 17:00:00	2025-10-30 22:00:00	production	\N	8	[]	2025-10-15 17:55:32.993	1	#ff40ff	confirmed	\N	f
705	Stakelbeck Tonight		3	16	2025-10-27 16:00:00	2025-10-27 20:30:00	production	\N	6	[]	2025-10-15 20:35:24.87	1	#008cb4	confirmed	\N	f
706	Stakelbeck Tonight		3	16	2025-10-29 16:00:00	2025-10-29 20:30:00	production	\N	6	[]	2025-10-15 20:36:20.186	1	#008cb4	confirmed	\N	f
696	Stakelbeck Tonight	3X INBOUND - 12:30 / 1:30 / 2:30 CT\n	3	16	2025-10-20 16:00:00	2025-10-20 20:30:00	production	\N	6	[]	2025-10-15 17:44:20.353	1	#008cb4	confirmed	\N	f
708	Praise 	11:00am - M&L host Victor Marx	3	9	2025-10-24 14:00:00	2025-10-24 18:00:00	production	\N	8	[]	2025-10-18 19:39:29.042	\N	#ff40ff	confirmed	\N	f
683	Centerpoint News Updates	BLYNDA	8	16	2025-10-24 15:00:00	2025-10-24 15:30:00	production	\N	12	[]	2025-10-06 21:49:53.896	1	#ffaa00	confirmed	\N	f
710	Testing timeline 2 day		21	1	2025-12-23 17:00:00	2025-12-24 01:30:00	production	\N	\N	[]	2025-12-23 18:09:31.498	\N	#800040	confirmed	\N	f
709	Test in use filtering		13	1	2025-12-23 07:30:00	2025-12-24 02:00:00	production	\N	\N	[]	2025-12-23 08:03:09.245	\N	#4B83E2	tentative	\N	f
716	test linked booking	test	4	1	2026-02-16 17:00:00	2026-02-16 18:00:00	production	\N	\N	[]	2026-02-16 01:56:46.069	\N	#4B83E2	confirmed	linked_1771207051968_0qqrt1byd	f
717	test linked booking	test	4	1	2026-02-17 17:00:00	2026-02-17 18:00:00	production	\N	\N	[]	2026-02-16 01:57:32.031	\N	#4B83E2	confirmed	linked_1771207051968_0qqrt1byd	f
718	test linked booking	test	4	1	2026-02-18 17:00:00	2026-02-18 18:00:00	production	\N	\N	[]	2026-02-16 01:57:32.091	\N	#4B83E2	confirmed	linked_1771207051968_0qqrt1byd	f
719	test linked booking	test	4	1	2026-02-19 17:00:00	2026-02-19 18:00:00	production	\N	\N	[]	2026-02-16 01:57:32.153	\N	#4B83E2	confirmed	linked_1771207051968_0qqrt1byd	f
720	test linked booking	test	4	1	2026-02-20 17:00:00	2026-02-20 18:00:00	production	\N	\N	[]	2026-02-16 01:57:32.231	\N	#4B83E2	confirmed	linked_1771207051968_0qqrt1byd	f
721	Test booking with assets	Test booking with assets	2	1	2026-03-17 16:00:00	2026-03-17 22:00:00	production	\N	\N	[]	2026-03-14 04:51:34.934	1	#4B83E2	confirmed	\N	f
722	Test assets booking		13	1	2026-03-14 16:00:00	2026-03-15 04:30:00	production	\N	\N	[]	2026-03-15 04:43:20.21	\N	#4B83E2	confirmed	\N	f
723	test	stetsetset	5	1	2026-05-25 16:00:00	2026-05-25 18:00:00	production	\N	\N	[]	2026-05-28 18:27:46.282	\N	#4B83E2	confirmed	\N	f
\.


--
-- TOC entry 3859 (class 0 OID 65579)
-- Dependencies: 266
-- Data for Name: crew_member_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crew_member_positions (id, crew_member_id, position_id) FROM stdin;
1	1	1
2	1	10
3	2	3
\.


--
-- TOC entry 3857 (class 0 OID 65551)
-- Dependencies: 264
-- Data for Name: crew_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crew_members (id, name, email, phone, day_rate_cents, half_day_rate_cents, notes, user_id, is_active, created_by, created_at, updated_at) FROM stdin;
1	Obed Lighting	obed2@tbn.tv	2134291810	50000	30000	\N	\N	t	1	2026-05-28 18:27:31.137616	2026-05-28 18:27:31.136
2	obed test	obedtest@tbn.tv	\N	50000	30000	\N	\N	t	1	2026-05-29 18:19:03.838146	2026-05-29 18:19:03.837
\.


--
-- TOC entry 3855 (class 0 OID 65537)
-- Dependencies: 262
-- Data for Name: crew_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crew_positions (id, name, category, description, color, sort_order, is_active) FROM stdin;
1	Director	direction	\N	\N	10	t
2	Associate Director	direction	\N	\N	20	t
3	Producer	direction	\N	\N	30	t
4	Associate Producer	direction	\N	\N	40	t
5	Stage Manager	direction	\N	\N	50	t
6	Production Assistant	direction	\N	\N	60	t
7	Technical Director	technical	\N	\N	110	t
8	Engineer in Charge	technical	\N	\N	120	t
9	Video / Shader (CCU)	technical	\N	\N	130	t
10	Replay / EVS Operator	technical	\N	\N	140	t
11	Streaming / Encoder Operator	technical	\N	\N	150	t
12	Studio Camera Operator	camera	\N	\N	210	t
13	Robotic Camera Operator	camera	\N	\N	220	t
14	Jib / Crane Operator	camera	\N	\N	230	t
15	Camera Utility	camera	\N	\N	240	t
16	A1 — Audio Engineer	audio	\N	\N	310	t
17	A2 — Audio Assistant	audio	\N	\N	320	t
18	Boom Operator	audio	\N	\N	330	t
19	Lighting Director	lighting	\N	\N	410	t
20	Gaffer	lighting	\N	\N	420	t
21	Lighting Board Operator	lighting	\N	\N	430	t
22	Key Grip	lighting	\N	\N	440	t
23	Graphics Operator	graphics	\N	\N	510	t
24	Teleprompter Operator	talent	\N	\N	610	t
25	Hair / Makeup / Wardrobe	talent	\N	\N	620	t
\.


--
-- TOC entry 3863 (class 0 OID 65617)
-- Dependencies: 270
-- Data for Name: crew_template_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crew_template_slots (id, template_id, position_id, quantity) FROM stdin;
\.


--
-- TOC entry 3861 (class 0 OID 65600)
-- Dependencies: 268
-- Data for Name: crew_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crew_templates (id, name, description, booking_type_id, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 3818 (class 0 OID 24623)
-- Dependencies: 225
-- Data for Name: file_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.file_attachments (id, booking_id, file_name, file_size, mime_type, path, uploaded_by, uploaded_at, description) FROM stdin;
5	442	Trilogy Attendance 97.24.25.xlsx	9714	application/vnd.openxmlformats-officedocument.spreadsheetml.sheet	/app/uploads/b3r6nvgx17lbwijx6r0ip07v.xlsx	23	2025-07-24 22:10:57.048399+00	\N
6	492	teampeople shoot crew names.png	77883	image/png	/app/uploads/wzzt7idc5wzjogzx7l4q9til.png	23	2025-07-28 17:15:23.969035+00	\N
7	501	8-1 - Car Shoot 2.0.png	61462	image/png	/app/uploads/aw2bssmal9fakbq3jl8e950g.png	23	2025-07-31 16:07:55.473452+00	\N
9	647	Rat_King_Day_1-Oct1.pdf	268804	application/pdf	/app/uploads/mrb31uv9easrngmg8q8qbiph.pdf	22	2025-09-29 16:06:14.007108+00	\N
10	647	Pre-_Light-Sep30.pdf	236753	application/pdf	/app/uploads/woj1ijmwwjr61ymqd9adz9b4.pdf	22	2025-09-29 16:06:28.897561+00	\N
11	647	Penchant_for_Trouble-Oct2.pdf	252661	application/pdf	/app/uploads/hutmbpj1dnjtb6tfiyi1cd0h.pdf	22	2025-09-29 16:06:41.402369+00	\N
12	647	Project_Contacts (5)[69].pdf	271749	application/pdf	/app/uploads/spmcdjtu5v8eoyh6qk1z2u8r.pdf	22	2025-09-29 16:06:49.728357+00	\N
13	647	Project_Contacts (6).pdf	202633	application/pdf	/app/uploads/elcou3hmyeh0nfhbftr2eowy.pdf	22	2025-09-29 16:07:00.650549+00	\N
14	647	Project_Contacts (7).pdf	203343	application/pdf	/app/uploads/egs79f9w01wm5twk3jqge7r0.pdf	22	2025-09-29 16:07:10.693099+00	\N
15	647	Enhanced-Oct3.pdf	265317	application/pdf	/app/uploads/q5yymc2cauqalcr6yyvrgbwo.pdf	22	2025-09-30 23:41:40.790693+00	\N
\.


--
-- TOC entry 3820 (class 0 OID 24630)
-- Dependencies: 227
-- Data for Name: invite_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invite_tokens (id, token, role, email, expires, created_by, created_at, used) FROM stdin;
1	6915490226702ac64ba87b34cec7e38dfb7fcb2ac51259a6b135f76f33bc6513	producer	obedtest@tbn.tv	2025-05-14 18:32:13.585	1	2025-05-07 13:32:13.589234	t
3	d4b9329f37ccf96329d458790eafc1dbcf70c6726491caabdd70d59559e6b715	producer	dharvilla@tbn.tv	2025-05-15 08:53:09.877	1	2025-05-08 03:53:09.883043	t
2	2845abec132c97518d44b7874de95bc24ace07d6815520fc02e637f1e54df059	producer	lmercado@tbn.tv	2025-05-14 20:48:49.872	1	2025-05-07 15:48:49.874372	t
4	91e9cabd7d760b1cb79a5bf5631f7f216ceb267381507e976d28bb4cf1993a47	it	ddigello@tbn.tv	2025-05-15 23:02:45.37	1	2025-05-08 18:02:45.374271	t
5	e6dc90565ce11bad3261180a7d4d63dc442b3fa33a079d6c27f70fac64612959	engineer	ncasoria@tbn.tv	2025-05-15 23:13:53.747	1	2025-05-08 18:13:53.74963	f
7	7a2f1fce80ce5dab28c089c0311057524fe45e7c6e10f4391d436baded5953b1	admin	zmorales@tbn.tv	2025-05-20 20:50:28.443	1	2025-05-13 15:50:28.446025	f
6	8dd40eea8d0581ada7201be9a1b29cca7ac31cc7fc391fd6579abb5e1340faa7	it	tmontez@tbn.tv	2025-05-20 20:39:26.413	1	2025-05-13 15:39:26.414881	t
8	0edf1eda43b0b3af4b930f0ef809b45e5ab54b058be8aa50571f7304397312b5	admin	zmorales@tbn.tv	2025-05-21 19:51:42.865	1	2025-05-14 14:51:42.869052	t
9	21da323d4a75b4acae96ec95b3bb9cc4f4d34b78a3e085bc905c192afa57f58a	engineer	lhaley@tbn.tv	2025-05-21 22:31:53.435	1	2025-05-14 17:31:53.436324	f
10	5ef26cb39770017532496b0747a46551d090db16445f681e42473dd4c749410f	engineer	dobryan@tbn.tv	2025-05-21 22:32:19.059	1	2025-05-14 17:32:19.060557	t
12	39c694b2dabb3ae381ac72786b87ca87e7953e812548922285197ee1aaca1803	engineer	sprimm@tbn.tv	2025-05-30 20:42:29.791	1	2025-05-23 15:42:29.792165	f
13	e8d2de8d6395372aa6cb7570adfb4f79fa3292b999da415fce5fbc25163a2c92	it	kharris@tbn.tv	2025-06-06 21:56:48.471	1	2025-05-30 16:56:48.472814	f
14	be4b2655ca46073b99240d0c24ec29c66252b6ad24149f49d30f8929fe00262c	producer	DCrawley@meritstreetmedia.com	2025-06-12 22:19:35.672	1	2025-06-05 17:19:35.674526	t
17	f0d6ade200d1499a739bb89241a76b2014c07c1efbb6cd715654ceb0ab9dc9c5	producer	TLee@tbn.tv	2025-06-12 22:24:07.848	1	2025-06-05 17:24:07.849279	f
16	b60839c991f081961425707e76d38b97a31ace7fb0dd56fe4d13d7c3f4c1b653	engineer	sprimm@tbn.tv	2025-06-12 22:21:53.721	1	2025-06-05 17:21:53.722748	t
15	9d839af84b92057109f9b781bf89ac6844b93ab039efe3e3fe889716c7bce5f8	producer	kbrown@meritstreetmedia.com	2025-06-12 22:21:35.317	1	2025-06-05 17:21:35.318286	t
11	b057c824e045b4b92b7821726ce1ad52d84dd6a4a8fd19ed60f0b0aa9c85a8df	producer	gwoodward@tbn.tv	2025-05-27 17:09:24.018	9	2025-05-20 12:09:24.019307	t
19	f0137df8b2437865e97541178b3b12091e3486d5042f38338288bff2b1e0fd27	producer	gwoodward@tbn.tv	2025-06-23 18:50:32.532	9	2025-06-16 13:50:32.53345	t
18	d8967996670a349ff5bc87790c078f47301f7eca01076c0336428a8ab3b72b1c	producer	kbrown@meritstreetmedia.com	2025-06-21 16:51:51.347	1	2025-06-14 11:51:51.348729	t
20	087397bd93855b6f1640706ee62ff617d0ccd0beb69fde76452d82341a4d3367	producer	LHermstad@meritstreetmedia.com	2025-06-25 23:55:12.523	6	2025-06-18 18:55:12.525071	t
21	92b198b78af00a5b8f1c81a658638e4735000d58ac7821c56d2c0dbca509dada	engineer	sblack@tbn.tv	2025-07-04 08:41:07.788	1	2025-06-27 03:41:07.791409	t
23	0efa3f8b2ebd94bc906bc8088b1c1cde81ebd8d14fa16d8bd2872b44490ac24a	producer	pmay@trilogystudios.com	2025-07-15 14:32:29.467	9	2025-07-08 09:32:29.468819	t
22	76cd0de03bdb8a3c86a1505e9b79ac5b973bf231dee2033c35c9bfc7d891094b	producer	SJoyner@trilogystudios.com	2025-07-15 14:32:00.655	9	2025-07-08 09:32:00.657229	t
24	83cf9745be0829626d829ecee4e9a820a2248f1f07d64bed4a1fdd863de1a7a3	producer	TTucker@trilogystudios.com	2025-07-15 14:33:45.965	9	2025-07-08 09:33:45.966938	t
25	320a70adf865601d789750700c7bc17ccac074542dc1c8a2d5866f87921013f5	producer	jmartin@tbn.tv	2025-07-17 15:40:09.887	9	2025-07-10 10:40:09.889348	t
26	3ba330eb9877ae9f091ef86cb7b473a25aa0cea2d20cb087ac315e0ab5df4336	producer	sfjordbak@tbn.tv	2025-07-25 15:09:43.431	9	2025-07-18 10:09:43.432737	t
27	74cb9adeed22b5fdafc77a84e28fa31315abc079ce1d150c32b50c0958fed763	producer	SPrimm@tbn.tv	2025-08-08 14:07:57.414	9	2025-08-01 09:07:57.416047	f
28	69a39ed2b12605c2dd2f582682324bf540ab68684de7a0bec81251f514bd48af	viewer	tbnobed@gmail.com	2025-08-19 21:31:09.476	1	2025-08-12 16:31:09.477982	t
29	ba7eb34802b47c7fe4126a12b6bbc549c6411e6138bbfbef8323c7055644cbb9	engineer	ejeannerat@tbn.tv	2025-09-15 18:11:52.247	1	2025-09-08 13:11:52.250995	t
\.


--
-- TOC entry 3822 (class 0 OID 24638)
-- Dependencies: 229
-- Data for Name: linked_bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.linked_bookings (id, primary_booking_id, linked_booking_id, created_at) FROM stdin;
\.


--
-- TOC entry 3824 (class 0 OID 24644)
-- Dependencies: 231
-- Data for Name: notification_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_groups (id, name, email, group_type, description, enabled) FROM stdin;
9	TBN Staff	TBN-Staff-Calendar@tbn.tv	department	Default group for facility management notifications.	f
7	Facility Management	Plex-facilities-calendar@tbn.tv	department	Default group for facility management notifications.	f
41	Obed Test	obedtest@tbn.tv	site_management	Test email group	t
42	obed test group	obedtest@tbn.tv	department		t
14	Plex Engineering	plexengineering@tbn.tv	department	Plex Engineering group\n	f
43	Asset Alerts	obedtest@tbn.tv	asset_managers		t
\.


--
-- TOC entry 3826 (class 0 OID 24651)
-- Dependencies: 233
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, title, message, type, read, booking_id, created_at) FROM stdin;
1	1	Booking Confirmation	Your booking for \t News has been created successfully.	booking_created	f	1	2025-05-07 06:46:31.554
2	1	Booking Updated	Your booking for "\t News" has been updated.	booking_updated	f	1	2025-05-07 06:48:27.616
3	1	Booking Confirmation	Your booking for 5/5 6am to 7pm has been created successfully.	booking_created	f	2	2025-05-07 06:51:51.401
4	1	Booking Confirmation	Your booking for 5/5 6am to 7pm has been created successfully.	booking_created	f	3	2025-05-07 07:01:33.14
5	1	Booking Confirmation	Your booking for 5/6 4am to 6am has been created successfully.	booking_created	f	4	2025-05-07 07:03:49.778
6	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	3	2025-05-07 07:06:16.899
7	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	3	2025-05-07 07:06:50.708
8	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	3	2025-05-07 07:07:13.891
9	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	3	2025-05-07 07:07:43.885
10	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	3	2025-05-07 07:15:54.419
11	1	Booking Confirmation	Your booking for 5/5 6am to 7pm has been created successfully.	booking_created	f	13	2025-05-07 07:27:02.375
12	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	13	2025-05-07 07:27:21.488
13	1	Booking Confirmation	Your booking for 5/5 6am to 7pm has been created successfully.	booking_created	f	16	2025-05-07 07:30:07.595
14	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	16	2025-05-07 07:30:52.356
15	1	Booking Updated	Your booking for "5/5 6am to 7pm - copy to 5/8 & 5/9" has been updated.	booking_updated	f	18	2025-05-07 07:46:22.767
16	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	13	2025-05-07 07:46:53.384
17	1	Booking Confirmation	Your booking for 5/9 4am to 6am has been created successfully.	booking_created	f	23	2025-05-07 08:22:43.922
18	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	16	2025-05-07 08:34:25.984
19	1	Booking Confirmation	Your booking for 5/5 6am to 7pm has been created successfully.	booking_created	f	26	2025-05-07 08:35:24.669
20	1	Booking Confirmation	Your booking for 5/5 6am to 7pm has been created successfully.	booking_created	f	29	2025-05-07 08:58:37.345
21	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	29	2025-05-07 08:59:31.153
22	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	29	2025-05-07 09:00:56.969
23	1	Booking Updated	Your booking for "5/5 6am to 7pm" has been updated.	booking_updated	f	29	2025-05-07 09:01:13.611
24	1	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	33	2025-05-07 09:14:33.458
25	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	33	2025-05-07 09:14:49.108
26	1	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	37	2025-05-07 09:15:11.871
27	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	37	2025-05-07 09:15:21.73
28	1	Booking Confirmation	Your booking for Through Drama has been created successfully.	booking_created	f	38	2025-05-07 09:16:23.268
29	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	38	2025-05-07 09:16:37.935
30	1	Booking Confirmation	Your booking for Through Drama has been created successfully.	booking_created	f	40	2025-05-07 09:16:52.772
31	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	33	2025-05-07 09:17:02.499
32	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	37	2025-05-07 09:17:06.994
33	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	34	2025-05-07 09:17:11.245
34	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	35	2025-05-07 09:17:15.02
35	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	36	2025-05-07 09:17:19.005
36	1	Booking Confirmation	Your booking for DP has been created successfully.	booking_created	f	41	2025-05-07 09:18:06.57
37	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	41	2025-05-07 09:18:13.503
38	1	Booking Confirmation	Your booking for Cody Crouch has been created successfully.	booking_created	f	43	2025-05-07 09:18:57.637
39	1	Booking Updated	Your booking for "Cody Crouch" has been updated.	booking_updated	f	43	2025-05-07 09:19:11.234
40	1	Booking Confirmation	Your booking for Cody Crouch has been created successfully.	booking_created	f	46	2025-05-07 09:20:36.472
41	1	Booking Confirmation	Your booking for Stakelbeck has been created successfully.	booking_created	f	47	2025-05-07 09:21:19.701
42	1	Booking Updated	Your booking for "Cody Crouch" has been updated.	booking_updated	f	43	2025-05-07 09:21:39.972
43	1	Booking Updated	Your booking for "Cody Crouch" has been updated.	booking_updated	f	46	2025-05-07 09:21:49.169
44	1	Booking Updated	Your booking for "Cody Crouch" has been updated.	booking_updated	f	44	2025-05-07 09:22:03.311
45	1	Booking Updated	Your booking for "Cody Crouch" has been updated.	booking_updated	f	45	2025-05-07 09:22:32.999
46	1	Booking Confirmation	Your booking for SFC has been created successfully.	booking_created	f	48	2025-05-07 09:23:46.503
47	1	Booking Confirmation	Your booking for TCL has been created successfully.	booking_created	f	51	2025-05-07 09:33:17.09
48	1	Booking Updated	Your booking for "TCL" has been updated.	booking_updated	f	51	2025-05-07 15:07:04.722
49	1	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	53	2025-05-07 15:10:59.076
50	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	53	2025-05-07 15:11:21.852
51	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	38	2025-05-07 15:16:47.912
52	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	39	2025-05-07 15:16:53.557
53	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	38	2025-05-07 15:40:35.143
54	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	38	2025-05-07 15:52:18.012
55	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	39	2025-05-07 15:52:27.992
56	1	Booking Confirmation	Your booking for Pope Watch has been created successfully.	booking_created	f	54	2025-05-07 16:25:47.542
57	1	Booking Updated	Your booking for "Pope Watch" has been updated.	booking_updated	f	54	2025-05-07 16:25:58.337
58	1	Booking Confirmation	Your booking for Test booking has been created successfully.	booking_created	f	56	2025-05-07 20:40:48.804
59	1	Booking Confirmation	Your booking for Power Outage Planned has been created successfully.	booking_created	f	60	2025-05-07 20:46:59.964
60	1	Booking Confirmation	Your booking for tst has been created successfully.	booking_created	f	61	2025-05-07 20:54:05.499
61	1	Booking Confirmation	Your booking for test 5/7 has been created successfully.	booking_created	f	62	2025-05-07 22:02:19.582
62	1	Booking Confirmation	Your booking for Firewall Upgrade has been created successfully.	booking_created	f	63	2025-05-07 22:11:00.709
63	1	Booking Updated	Your booking for "Pope Watch" has been updated.	booking_updated	f	54	2025-05-08 03:53:02.533
64	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	38	2025-05-08 05:01:56.302
65	1	Booking Updated	Your booking for "Through Drama" has been updated.	booking_updated	f	38	2025-05-08 07:42:22.552
66	1	Booking Confirmation	Your booking for Through Drama has been created successfully.	booking_created	f	64	2025-05-08 07:44:22.191
67	1	Booking Confirmation	Your booking for Through Drama has been created successfully.	booking_created	f	65	2025-05-08 07:44:44.425
68	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	33	2025-05-08 07:45:06.116
69	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	37	2025-05-08 07:45:12.96
70	1	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	66	2025-05-08 07:45:56.65
71	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	35	2025-05-08 07:46:05.768
72	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	36	2025-05-08 07:46:13.076
73	1	Booking Updated	Your booking for "Pope Watch" has been updated.	booking_updated	f	54	2025-05-08 07:47:08.303
74	1	Booking Updated	Your booking for "Pope Watch" has been updated.	booking_updated	f	55	2025-05-08 07:47:19.396
75	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	41	2025-05-08 07:47:39.364
76	1	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	48	2025-05-08 07:47:50.594
77	1	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	50	2025-05-08 07:48:01.706
78	1	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	49	2025-05-08 07:48:11.459
79	1	Booking Updated	Your booking for "TCL" has been updated.	booking_updated	f	51	2025-05-08 07:48:36.97
80	1	Booking Updated	Your booking for "TCL" has been updated.	booking_updated	f	51	2025-05-08 07:48:49.248
81	1	Booking Updated	Your booking for "TCL" has been updated.	booking_updated	f	52	2025-05-08 07:48:57.449
82	1	Booking Updated	Your booking for "TCL" has been updated.	booking_updated	f	52	2025-05-08 07:49:05.296
83	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	53	2025-05-08 07:49:36.14
84	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	53	2025-05-08 08:59:19.055
85	1	Booking Updated	Your booking for "Pope Watch" has been updated.	booking_updated	f	54	2025-05-08 08:59:33.043
86	1	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	48	2025-05-08 08:59:39.772
87	8	Booking Confirmation	Your booking for Birthday Party has been created successfully.	booking_created	f	67	2025-05-08 09:02:22.433
88	8	Booking Deleted	Your booking for "Birthday Party" has been deleted by administrator.	booking_deleted	f	67	2025-05-08 09:05:03.422
89	8	Booking Confirmation	Your booking for FIRE DRILL has been created successfully.	booking_created	f	68	2025-05-08 09:09:08.796
90	8	Booking Updated	Your booking for "FIRE DRILL" has been updated.	booking_updated	f	68	2025-05-08 09:09:32.249
91	9	Booking Confirmation	Your booking for Praise / TEST has been created successfully.	booking_created	f	69	2025-05-08 13:53:04.855
92	9	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	70	2025-05-08 14:27:40.613
93	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	70	2025-05-08 14:28:29.739
94	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	70	2025-05-08 14:28:43.002
95	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	75	2025-05-08 14:29:38.842
96	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	70	2025-05-08 14:30:16.524
97	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	71	2025-05-08 14:30:23.24
98	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	72	2025-05-08 14:30:28.72
99	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	73	2025-05-08 14:30:34.867
100	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	74	2025-05-08 14:30:41.23
101	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	75	2025-05-08 14:31:06.053
102	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	78	2025-05-08 14:32:04.473
103	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	78	2025-05-08 14:32:59.359
104	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	78	2025-05-08 14:33:21.591
105	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	80	2025-05-08 14:33:53.34
106	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	80	2025-05-08 14:34:01.375
107	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	81	2025-05-08 14:36:30.256
108	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	80	2025-05-08 14:36:50.886
109	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	77	2025-05-08 14:41:30.326
110	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	85	2025-05-08 14:42:10.904
111	1	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	48	2025-05-08 14:42:24.442
112	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	94	2025-05-08 14:45:04.6
113	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	95	2025-05-08 14:45:11.345
114	9	Booking Confirmation	Your booking for SFC has been created successfully.	booking_created	f	96	2025-05-08 14:46:02.402
115	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	98	2025-05-08 14:46:45.882
116	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	97	2025-05-08 14:47:01.199
117	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	96	2025-05-08 14:47:13.252
118	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	98	2025-05-08 14:47:22.003
119	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	99	2025-05-08 14:48:07.817
120	1	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	48	2025-05-08 14:50:27.176
121	1	Booking Confirmation	Your booking for Test nofication email has been created successfully.	booking_created	f	100	2025-05-08 15:53:02.746
122	7	New Booking Notification	A new booking "Test nofication email" has been created that requires your attention.	booking_created	f	100	2025-05-08 15:53:03.45
123	1	Booking Confirmation	Your booking for Test alert for calendar has been created successfully.	booking_created	f	101	2025-05-08 21:00:58.139
124	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	76	2025-05-08 22:04:48.15
125	1	Booking Confirmation	Your booking for test 9am to 10am has been created successfully.	booking_created	f	102	2025-05-08 22:48:57.829
126	1	Booking Updated	Your booking for "Pope Watch" has been updated.	booking_updated	f	54	2025-05-08 22:54:04.446
127	1	Booking Confirmation	Your booking for Praise Test has been created successfully.	booking_created	f	103	2025-05-08 22:58:41.339
128	9	New Booking Notification	A new booking "Praise Test" has been created that requires your attention.	booking_created	f	103	2025-05-08 22:58:41.954
129	7	New Booking Notification	A new booking "Praise Test" has been created that requires your attention.	booking_created	f	103	2025-05-08 22:58:41.96
130	1	Booking Confirmation	Your booking for Network Outage has been created successfully.	booking_created	f	104	2025-05-08 22:59:32.92
131	8	Alert Deleted	Your facility alert "FIRE DRILL" has been deleted by administrator.	booking_deleted	f	68	2025-05-08 23:22:57.407
132	1	Booking Confirmation	Your booking for Curator Upgrade has been created successfully.	booking_created	f	105	2025-05-08 23:23:32.83
133	6	Booking Confirmation	Your booking for Comms are down has been created successfully.	booking_created	f	106	2025-05-08 23:37:43.878
134	1	Booking Updated	Your booking for "Pope Watch" has been updated.	booking_updated	f	54	2025-05-11 07:37:34.293
135	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	70	2025-05-11 09:10:30.837
136	9	Booking Deleted	Your booking for "Centerpoint News Updates" has been deleted by administrator.	booking_deleted	f	107	2025-05-11 09:10:48.492
137	1	Booking Confirmation	Your booking for Test 5/14 1am to 4am  has been created successfully.	booking_created	f	109	2025-05-11 09:34:30.521
138	9	Booking Deleted	Your booking for "Centerpoint News Updates" has been deleted by administrator.	booking_deleted	f	110	2025-05-11 09:35:02.154
139	6	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	112	2025-05-12 16:29:24.06
140	7	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	113	2025-05-12 16:36:36.16
141	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	76	2025-05-13 16:06:09.288
142	1	Booking Confirmation	Your booking for Network Outage  has been created successfully.	booking_created	f	118	2025-05-13 20:11:41.839
143	1	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	119	2025-05-13 20:15:01.207
144	7	New Booking Notification	A new booking "MSM News" has been created that requires your attention.	booking_created	f	119	2025-05-13 20:15:01.755
145	8	New Booking Notification	A new booking "MSM News" has been created that requires your attention.	booking_created	f	119	2025-05-13 20:15:01.765
146	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	119	2025-05-13 20:15:19.38
147	1	Booking Confirmation	Your booking for Test Tentative has been created successfully.	booking_created	f	123	2025-05-13 20:22:48.887
148	1	Booking Updated	Your booking for "Test Tentative" has been updated.	booking_updated	f	123	2025-05-13 20:23:16.485
149	1	Booking Confirmation	Your booking for Comms are down has been created successfully.	booking_created	f	124	2025-05-13 20:26:14.747
150	1	Booking Confirmation	Your booking for Storage Upgrade has been created successfully.	booking_created	f	125	2025-05-13 20:31:03.361
151	1	Booking Updated	Your booking for "Storage Upgrade" has been updated.	booking_updated	f	125	2025-05-13 20:31:26.761
152	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	81	2025-05-14 14:10:55.773
153	1	Booking Deleted	Your booking for "Test Tentative" has been deleted by administrator.	booking_deleted	f	123	2025-05-14 14:51:06.005
154	6	Booking Confirmation	Your booking for test site manager has been created successfully.	booking_created	f	126	2025-05-14 14:51:29.397
155	9	Booking Confirmation	Your booking for TEST has been created successfully.	booking_created	f	127	2025-05-14 15:04:37.361
156	9	Booking Deleted	Your booking for "TEST" has been deleted by administrator.	booking_deleted	f	127	2025-05-14 16:18:37.807
157	6	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	128	2025-05-14 17:58:39.181
158	8	New Booking Notification	A new booking "MSM News" has been created that requires your attention.	booking_created	f	128	2025-05-14 17:58:40.129
159	7	New Booking Notification	A new booking "MSM News" has been created that requires your attention.	booking_created	f	128	2025-05-14 17:58:40.139
160	6	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	129	2025-05-14 18:16:27.942
161	8	New Booking Notification	A new booking "MSM News" has been created that requires your attention.	booking_created	f	129	2025-05-14 18:16:28.857
162	7	New Booking Notification	A new booking "MSM News" has been created that requires your attention.	booking_created	f	129	2025-05-14 18:16:28.868
163	6	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	129	2025-05-14 18:16:41.97
164	9	Booking Confirmation	Your booking for Better Together has been created successfully.	booking_created	f	133	2025-05-14 20:50:30.973
165	9	New Booking Notification	A new booking "Better Together" has been created that requires your attention.	booking_created	f	133	2025-05-14 20:50:32.148
166	7	New Booking Notification	A new booking "Better Together" has been created that requires your attention.	booking_created	f	133	2025-05-14 20:50:32.159
167	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	84	2025-05-14 20:52:39.656
168	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	84	2025-05-14 20:52:50.635
169	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	135	2025-05-14 20:52:57.261
170	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	85	2025-05-14 21:00:04.094
171	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	136	2025-05-14 21:07:04.774
172	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	135	2025-05-22 14:30:41.991
173	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	88	2025-05-22 14:31:33.594
174	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	136	2025-05-22 14:32:04.923
175	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	96	2025-05-22 14:32:26.053
176	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	97	2025-05-22 14:32:32.139
177	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	98	2025-05-22 14:32:35.844
178	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	174	2025-05-22 14:40:45.523
179	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	173	2025-05-22 14:40:52.569
180	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	169	2025-05-22 14:41:03.547
181	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	172	2025-05-22 14:41:09.02
182	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	171	2025-05-22 14:41:17.155
183	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	170	2025-05-22 14:41:22.575
184	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-05-22 14:43:37.417
185	9	Booking Confirmation	Your booking for Living Legacy Testimony has been created successfully.	booking_created	f	182	2025-05-22 14:44:38.6
186	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	181	2025-05-22 14:45:42.481
187	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	185	2025-05-22 14:51:11.454
188	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	186	2025-05-22 14:51:15.641
189	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	189	2025-05-22 14:51:19.382
190	9	Booking Confirmation	Your booking for Houston Eschatology Remote has been created successfully.	booking_created	f	192	2025-05-22 14:59:55.324
191	9	Booking Updated	Your booking for "Houston Eschatology Remote" has been updated.	booking_updated	f	192	2025-05-22 15:00:06.601
192	9	Booking Updated	Your booking for "Houston Eschatology Remote" has been updated.	booking_updated	f	193	2025-05-22 15:00:35.45
193	9	Booking Updated	Your booking for "Houston Eschatology Remote" has been updated.	booking_updated	f	194	2025-05-22 15:00:58.874
194	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	84	2025-05-22 15:02:28
195	9	Booking Confirmation	Your booking for Better Together has been created successfully.	booking_created	f	195	2025-05-22 15:03:11.502
196	9	New Booking Notification	A new booking "Better Together" has been created that requires your attention.	booking_created	f	195	2025-05-22 15:03:12.088
197	7	New Booking Notification	A new booking "Better Together" has been created that requires your attention.	booking_created	f	195	2025-05-22 15:03:12.098
198	9	Booking Confirmation	Your booking for IRVING POWER OUTAGE has been created successfully.	booking_created	f	196	2025-05-22 15:06:20.607
199	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-05-22 15:12:03.427
200	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	99	2025-05-22 19:50:10.898
201	9	Booking Confirmation	Your booking for AMAC Records has been created successfully.	booking_created	f	200	2025-05-27 16:37:41.831
202	9	Booking Updated	Your booking for "AMAC Records" has been updated.	booking_updated	f	200	2025-05-27 16:37:53.274
203	9	Booking Confirmation	Your booking for TBN Germany has been created successfully.	booking_created	f	201	2025-05-27 20:41:36.8
204	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	202	2025-05-27 21:47:38.709
205	9	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	202	2025-05-27 21:47:39.893
206	7	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	202	2025-05-27 21:47:39.902
207	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	202	2025-05-27 22:05:36.1
208	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	202	2025-05-27 22:05:41.905
209	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	202	2025-05-27 22:06:34.897
210	9	Booking Updated	Your booking for "AMAC Records" has been updated.	booking_updated	f	200	2025-05-29 21:18:38.626
211	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	159	2025-05-30 14:27:03.253
212	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	171	2025-05-30 14:27:21.485
213	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	170	2025-05-30 14:27:34.252
214	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	164	2025-05-30 20:02:10.067
215	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	168	2025-05-30 20:02:24.873
216	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	162	2025-05-30 20:02:46.036
217	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	215	2025-05-30 20:06:43.086
218	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	223	2025-05-30 20:06:50.66
219	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	224	2025-05-30 20:06:57.815
220	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	211	2025-05-30 20:07:21.025
221	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	216	2025-05-30 20:07:30.069
222	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	219	2025-05-30 20:07:36.329
223	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	187	2025-05-30 20:12:56.424
224	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	187	2025-05-30 20:14:28.329
225	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	246	2025-06-03 15:39:04.159
226	9	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	246	2025-06-03 15:39:05.083
227	7	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	246	2025-06-03 15:39:05.094
228	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	238	2025-06-03 15:40:05.168
229	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	202	2025-06-03 15:41:46.659
230	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	249	2025-06-03 15:42:16.63
231	9	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	249	2025-06-03 15:42:17.209
232	7	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	249	2025-06-03 15:42:17.219
233	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	147	2025-06-05 14:22:22.905
234	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	138	2025-06-05 14:22:43.166
235	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	252	2025-06-05 19:04:07.116
236	9	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	252	2025-06-05 19:04:08.113
237	7	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	252	2025-06-05 19:04:08.123
238	13	Booking Confirmation	Your booking for DreamCatcher Maintenance  has been created successfully.	booking_created	f	253	2025-06-05 21:30:44.135
239	13	Booking Confirmation	Your booking for DreamCatcher Maintenance has been created successfully.	booking_created	f	254	2025-06-05 21:32:35.15
240	9	Booking Confirmation	Your booking for Positiv Promo Shoot has been created successfully.	booking_created	f	255	2025-06-05 21:32:54.064
241	9	New Booking Notification	A new booking "Positiv Promo Shoot" has been created that requires your attention.	booking_created	f	255	2025-06-05 21:32:54.979
242	7	New Booking Notification	A new booking "Positiv Promo Shoot" has been created that requires your attention.	booking_created	f	255	2025-06-05 21:32:54.988
243	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	140	2025-06-05 21:52:58.055
244	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	256	2025-06-05 22:09:33.184
248	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	142	2025-06-10 14:59:10.17
249	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	143	2025-06-10 14:59:17.714
250	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	146	2025-06-10 14:59:23.813
251	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	140	2025-06-10 16:29:00.976
252	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	181	2025-06-10 20:42:07.2
253	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	181	2025-06-10 20:42:31.497
254	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-11 20:30:42.044
255	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-11 20:30:56.525
256	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	252	2025-06-11 20:31:14.454
257	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	153	2025-06-11 20:31:24.367
258	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	154	2025-06-11 20:31:30.636
259	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-11 20:31:52.313
260	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-11 20:34:15.589
261	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	252	2025-06-11 20:34:44.329
262	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	153	2025-06-11 20:35:01.397
263	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	154	2025-06-11 20:35:12.338
266	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	141	2025-06-12 14:14:54.756
267	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	145	2025-06-12 14:15:06.539
268	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	141	2025-06-12 14:22:36.827
269	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	145	2025-06-12 14:22:46.514
270	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	150	2025-06-12 14:26:55.65
271	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-12 14:27:03.996
272	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	252	2025-06-12 14:27:16.373
273	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	153	2025-06-12 14:27:21.457
274	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	154	2025-06-12 14:27:27.784
275	9	Booking Updated	Your booking for "Positiv Promo Shoot" has been updated.	booking_updated	f	255	2025-06-12 14:27:52.885
276	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-12 14:28:18.861
277	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-12 14:54:38.196
278	9	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	182	2025-06-12 14:54:56.236
279	9	Booking Updated	Your booking for "Positiv Promo Shoot" has been updated.	booking_updated	f	255	2025-06-12 15:17:29.964
280	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	233	2025-06-12 15:18:08.65
281	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	211	2025-06-12 15:20:38.715
282	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	234	2025-06-12 15:20:44.973
283	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	195	2025-06-12 15:21:36.544
284	9	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	182	2025-06-12 15:42:35.076
285	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	259	2025-06-12 17:18:57.49
286	9	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	259	2025-06-12 17:18:58.405
287	7	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	259	2025-06-12 17:18:58.415
288	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	260	2025-06-12 17:19:50.862
289	9	Booking Confirmation	Your booking for Misc Production (Plex) has been created successfully.	booking_created	f	261	2025-06-12 17:21:58.836
290	9	Booking Updated	Your booking for "Misc Production (Plex)" has been updated.	booking_updated	f	261	2025-06-12 17:22:15.766
291	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	262	2025-06-12 17:22:36.226
292	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	263	2025-06-12 17:22:43.016
293	9	Booking Confirmation	Your booking for Stakelbeck Tonight - LIVE has been created successfully.	booking_created	f	264	2025-06-13 13:58:16.73
294	9	New Booking Notification	A new booking "Stakelbeck Tonight - LIVE" has been created that requires your attention.	booking_created	f	264	2025-06-13 13:58:17.903
295	7	New Booking Notification	A new booking "Stakelbeck Tonight - LIVE" has been created that requires your attention.	booking_created	f	264	2025-06-13 13:58:17.913
296	9	Booking Updated	Your booking for "Stakelbeck Tonight - LIVE" has been updated.	booking_updated	f	264	2025-06-13 14:00:01.062
297	9	Booking Updated	Your booking for "LIVE Special Report" has been updated.	booking_updated	f	264	2025-06-13 14:00:22.022
298	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-13 21:59:35.659
299	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-13 23:44:16.651
300	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-14 18:54:04.531
301	9	Booking Confirmation	Your booking for Open segment with Erick has been created successfully.	booking_created	f	267	2025-06-14 18:55:07.031
302	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-15 19:49:29.978
308	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	149	2025-06-16 13:51:50.798
309	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	149	2025-06-16 13:52:44.625
310	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-16 13:53:06.881
311	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	310	2025-06-16 13:54:46.738
312	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-16 14:39:50.005
313	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	151	2025-06-16 15:39:35.873
314	9	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	182	2025-06-16 15:57:29.934
315	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-16 15:57:45.86
316	9	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	182	2025-06-16 18:43:39.585
317	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-16 18:45:28.9
318	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	174	2025-06-16 18:52:03.214
319	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	173	2025-06-16 18:52:17.24
320	16	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	311	2025-06-16 18:55:00.903
321	9	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	311	2025-06-16 18:55:01.841
322	7	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	311	2025-06-16 18:55:01.851
323	16	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	311	2025-06-16 18:55:51.083
324	9	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	312	2025-06-16 18:57:37.331
325	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	180	2025-06-16 20:02:33.962
326	16	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	311	2025-06-16 20:05:25.114
327	9	Booking Updated	Your booking for "TBN Special Report" has been updated.	booking_updated	f	151	2025-06-16 20:59:55.885
332	16	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	311	2025-06-17 15:52:15.916
336	9	Booking Updated	Your booking for "LIVE - TBN Special Report" has been updated.	booking_updated	f	316	2025-06-17 16:34:58.216
337	9	Booking Updated	Your booking for "Positiv Promo Shoot" has been updated.	booking_updated	f	255	2025-06-17 17:29:03.368
338	9	Booking Confirmation	Your booking for DreamCatcher Maintenance  has been created successfully.	booking_created	f	317	2025-06-17 17:39:31.924
339	9	Booking Updated	Your booking for "LIVE - TBN Special Report" has been updated.	booking_updated	f	151	2025-06-17 18:33:59.771
340	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	310	2025-06-17 18:34:20.188
343	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	154	2025-06-17 18:34:51.648
346	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	157	2025-06-17 18:35:29.852
347	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	309	2025-06-17 18:35:39.912
341	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	252	2025-06-17 18:34:31.588
342	9	Booking Updated	Your booking for "LIVE - TBN Special Report" has been updated.	booking_updated	f	316	2025-06-17 18:34:39.471
344	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	155	2025-06-17 18:35:13.511
345	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	251	2025-06-17 18:35:21.575
348	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	235	2025-06-17 18:38:58.629
349	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	236	2025-06-17 18:39:33.127
350	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	237	2025-06-17 18:39:44.737
351	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	238	2025-06-17 18:39:50.957
352	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	175	2025-06-17 20:47:32.525
353	9	Booking Confirmation	Your booking for Fox News Hit has been created successfully.	booking_created	f	319	2025-06-17 20:48:43.276
354	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	252	2025-06-18 14:34:05.185
376	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	370	2025-06-18 19:25:36.114
377	9	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	370	2025-06-18 19:25:37.224
378	7	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	370	2025-06-18 19:25:37.234
379	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	370	2025-06-18 19:25:54.903
380	9	Booking Updated	Your booking for "LIVE - TBN Special Report" has been updated.	booking_updated	f	316	2025-06-18 19:26:23.938
381	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	370	2025-06-18 19:28:51.142
382	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	309	2025-06-18 21:43:02.284
383	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	372	2025-06-19 13:52:07.632
384	9	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	372	2025-06-19 13:52:08.522
385	7	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	372	2025-06-19 13:52:08.532
386	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	162	2025-06-19 17:01:09.554
387	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	167	2025-06-19 17:01:18.482
388	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	177	2025-06-19 17:01:28.249
389	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	178	2025-06-19 17:01:35.247
390	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	179	2025-06-19 17:01:42.718
391	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	207	2025-06-19 17:01:53.746
392	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	212	2025-06-19 17:02:00.439
393	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	220	2025-06-19 17:02:13.895
395	11	New Booking Notification	A new booking "Commercials " has been created that requires your attention.	booking_created	f	375	2025-06-20 13:47:27.333
396	7	New Booking Notification	A new booking "Commercials " has been created that requires your attention.	booking_created	f	375	2025-06-20 13:47:27.344
397	8	New Booking Notification	A new booking "Commercials " has been created that requires your attention.	booking_created	f	375	2025-06-20 13:47:27.35
400	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	251	2025-06-20 14:00:57.115
401	9	Booking Confirmation	Your booking for MRO reads with Blynda has been created successfully.	booking_created	f	376	2025-06-20 14:01:02.535
402	9	Booking Updated	Your booking for "TBN Germany" has been updated.	booking_updated	f	201	2025-06-20 14:01:43.427
403	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	186	2025-06-20 14:07:20.874
404	9	Booking Updated	Your booking for "Positiv Promo Shoot" has been updated.	booking_updated	f	378	2025-06-20 16:18:46.479
405	9	Booking Updated	Your booking for "MRO reads with Blynda" has been updated.	booking_updated	f	376	2025-06-20 16:35:17.367
406	9	Booking Updated	Your booking for "MRO reads with Blynda" has been updated.	booking_updated	f	376	2025-06-20 16:35:30.669
407	9	Booking Updated	Your booking for "MRO reads with Blynda" has been updated.	booking_updated	f	376	2025-06-20 19:23:46.593
409	1	Booking Confirmation	Your booking for Test Maintenance Alert *Please ignore* has been created successfully.	booking_created	f	379	2025-06-22 08:24:32.21
410	1	Booking Confirmation	Your booking for TEST BOOKING *PLEASE IGNORE* has been created successfully.	booking_created	f	380	2025-06-22 08:25:31.682
411	9	New Booking Notification	A new booking "TEST BOOKING *PLEASE IGNORE*" has been created that requires your attention.	booking_created	f	380	2025-06-22 08:25:31.997
412	9	Booking Confirmation	Your booking for LIVE TBN Special Report has been created successfully.	booking_created	f	385	2025-06-22 11:01:12.829
413	9	New Booking Notification	A new booking "LIVE TBN Special Report" has been created that requires your attention.	booking_created	f	385	2025-06-22 11:01:13.429
414	7	New Booking Notification	A new booking "LIVE TBN Special Report" has been created that requires your attention.	booking_created	f	385	2025-06-22 11:01:13.436
415	9	Booking Confirmation	Your booking for Fox News Hit has been created successfully.	booking_created	f	386	2025-06-22 11:03:11.775
426	9	Booking Updated	Your booking for "TBN Germany" has been updated.	booking_updated	f	201	2025-06-23 18:45:20.14
427	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	181	2025-06-23 19:03:17.986
428	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	392	2025-06-23 19:48:37.969
435	16	Booking Confirmation	Your booking for Staks YouTube/Podcast has been created successfully.	booking_created	f	395	2025-06-24 17:31:22.892
436	16	Booking Updated	Your booking for "Staks YouTube/Podcast" has been updated.	booking_updated	f	395	2025-06-24 17:31:37.471
437	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	396	2025-06-24 17:51:09.068
438	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	396	2025-06-24 17:52:54.128
439	1	Booking Updated	Your booking for "Staks Hit" has been updated.	booking_updated	f	396	2025-06-24 17:53:08.099
440	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	372	2025-06-24 18:28:50.803
441	16	Booking Confirmation	Your booking for SFC READS has been created successfully.	booking_created	f	397	2025-06-24 20:08:30.684
442	9	New Booking Notification	A new booking "SFC READS" has been created that requires your attention.	booking_created	f	397	2025-06-24 20:08:31.307
443	11	New Booking Notification	A new booking "SFC READS" has been created that requires your attention.	booking_created	f	397	2025-06-24 20:08:31.318
444	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	157	2025-06-24 20:11:47.594
445	16	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	398	2025-06-24 21:58:15.493
446	9	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	398	2025-06-24 21:58:16.213
447	7	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	398	2025-06-24 21:58:16.223
448	16	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	398	2025-06-24 21:59:21.145
449	16	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	399	2025-06-24 22:00:29.182
450	9	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	399	2025-06-24 22:00:29.498
451	1	Booking Updated	Your booking for "DP Show" has been updated.	booking_updated	f	333	2025-06-25 19:41:58.277
455	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	332	2025-06-25 19:48:25.872
459	1	Booking Updated	Your booking for "DP Show" has been updated.	booking_updated	f	333	2025-06-26 17:45:00.544
460	1	Booking Deleted	Your booking for "Stakelbeck Tonight" has been deleted by administrator.	booking_deleted	f	157	2025-06-26 18:50:40.554
461	9	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	312	2025-06-26 19:44:51.479
462	1	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	312	2025-06-26 19:45:17.069
463	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	357	2025-06-26 19:45:53.338
464	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	181	2025-06-26 19:45:55.843
466	1	Booking Confirmation	Your booking for Test Booking *PLEASE IGNORE* has been created successfully.	booking_created	f	427	2025-06-26 19:46:53.908
465	1	Booking Updated	Your booking for "Living Legacy Testimony" has been updated.	booking_updated	f	312	2025-06-26 19:46:04.578
467	16	Booking Updated	Your booking for "SFC READS" has been updated.	booking_updated	f	397	2025-06-26 22:57:04.107
468	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	363	2025-06-27 07:53:15.809
469	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	356	2025-06-27 21:28:10.278
470	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	359	2025-06-27 21:48:24.703
471	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	362	2025-06-27 21:49:29.518
472	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	367	2025-06-27 21:50:06.004
473	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	368	2025-06-27 21:50:29.609
474	1	Booking Updated	Your booking for "TBN Germany" has been updated.	booking_updated	f	201	2025-06-27 22:47:51.919
475	1	Booking Updated	Your booking for "TBN Germany" has been updated.	booking_updated	f	201	2025-06-27 23:00:47.618
476	1	Booking Updated	Your booking for "TBN Germany" has been updated.	booking_updated	f	201	2025-06-27 23:04:50.777
477	1	Booking Confirmation	Your booking for Test Mobile Booking *Ignore* has been created successfully.	booking_created	f	428	2025-06-28 19:09:47.818
478	1	Booking Updated	Your booking for "Test Mobile Booking *Ignore*" has been updated.	booking_updated	f	428	2025-06-28 19:10:14.067
479	1	Booking Updated	Your booking for "TRS Special / Merit Midnight " has been updated.	booking_updated	f	400	2025-06-30 06:34:24.602
480	1	Booking Updated	Your booking for "TRS Special / Merit Midnight " has been updated.	booking_updated	f	400	2025-06-30 06:34:31.14
481	1	Booking Updated	Your booking for "TRS Special / Merit Midnight " has been updated.	booking_updated	f	400	2025-06-30 06:34:53.572
482	1	Booking Updated	Your booking for "TRS Special / Merit Midnight " has been updated.	booking_updated	f	400	2025-06-30 06:35:36.967
483	1	Booking Updated	Your booking for "TRS Special / Merit Midnight " has been updated.	booking_updated	f	400	2025-06-30 06:55:40.931
484	1	Booking Updated	Your booking for "TRS Special / Merit Midnight " has been updated.	booking_updated	f	400	2025-06-30 06:55:48.914
486	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	218	2025-06-30 19:44:47.817
487	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	373	2025-06-30 19:44:57.922
488	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	373	2025-06-30 19:47:00.872
489	9	Booking Confirmation	Your booking for Teton Ridge - Training has been created successfully.	booking_created	f	430	2025-07-01 21:28:47.673
490	9	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	431	2025-07-01 21:29:19.556
491	9	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	430	2025-07-01 21:29:35.612
492	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	431	2025-07-01 21:29:42.683
493	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	197	2025-07-02 17:35:41.568
494	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	198	2025-07-02 17:35:57.1
495	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	287	2025-07-02 17:57:27.012
496	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	286	2025-07-02 17:57:41.285
497	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	286	2025-07-02 17:57:49.069
498	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	287	2025-07-02 17:57:56.553
499	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	286	2025-07-02 18:41:54.086
500	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	287	2025-07-02 18:42:06.502
501	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	286	2025-07-02 18:42:22.449
502	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	288	2025-07-02 18:43:07.257
503	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	289	2025-07-02 18:43:17.708
504	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	290	2025-07-02 18:43:26.973
505	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	291	2025-07-02 18:43:35.604
506	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	292	2025-07-02 18:43:43.64
507	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	325	2025-07-02 18:44:11.558
508	1	Booking Updated	Your booking for "Through The Drama " has been updated.	booking_updated	f	342	2025-07-02 18:44:28.185
510	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	326	2025-07-02 18:44:54.434
511	1	Booking Updated	Your booking for "Through The Drama " has been updated.	booking_updated	f	343	2025-07-02 18:45:04.648
512	1	Booking Updated	Your booking for "Through The Drama " has been updated.	booking_updated	f	344	2025-07-02 18:45:11.734
513	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	363	2025-07-02 18:45:49.088
514	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	359	2025-07-02 18:45:58.367
515	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	324	2025-07-02 18:46:34.517
516	1	Booking Updated	Your booking for "Through The Drama " has been updated.	booking_updated	f	341	2025-07-02 18:46:49.4
517	1	Booking Updated	Your booking for "MSM News" has been updated.	booking_updated	f	285	2025-07-02 18:46:56.561
518	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	373	2025-07-02 21:52:26.382
530	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	367	2025-07-03 15:01:58.781
531	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	368	2025-07-03 15:02:10.617
533	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	430	2025-07-03 20:18:41.832
534	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	431	2025-07-03 20:18:48.599
535	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	430	2025-07-07 14:37:48.129
536	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	431	2025-07-07 14:37:56.027
537	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	217	2025-07-07 14:38:25.911
538	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	388	2025-07-07 15:30:33.76
539	1	Booking Updated	Your booking for "DP" has been updated.	booking_updated	f	389	2025-07-07 15:31:18.341
540	9	Booking Confirmation	Your booking for TBN Special Report has been created successfully.	booking_created	f	432	2025-07-07 16:07:37.936
541	9	New Booking Notification	A new booking "TBN Special Report" has been created that requires your attention.	booking_created	f	432	2025-07-07 16:07:38.517
542	9	Booking Updated	Your booking for "TBN Special Report" has been updated.	booking_updated	f	432	2025-07-07 16:18:59.513
543	1	Booking Updated	Your booking for "TBN Special Report - Lifting Up Texas" has been updated.	booking_updated	f	432	2025-07-07 16:37:39.252
544	1	Booking Updated	Your booking for "TBN Special Report - Lifting Up Texas" has been updated.	booking_updated	f	432	2025-07-07 17:06:01.656
545	1	Booking Updated	Your booking for "TBN Special Report - Lifting Up Texas" has been updated.	booking_updated	f	432	2025-07-07 19:33:58.865
546	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	246	2025-07-08 14:22:49.985
547	9	Booking Confirmation	Your booking for SFC - Investor Video has been created successfully.	booking_created	f	434	2025-07-08 14:26:00.007
548	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	237	2025-07-08 14:26:25.509
549	9	Booking Updated	Your booking for "SFC - Investor Video" has been updated.	booking_updated	f	434	2025-07-08 14:26:34.247
550	23	Booking Confirmation	Your booking for Trilogy Shoot: Psychia has been created successfully.	booking_created	f	435	2025-07-08 15:14:25.7
551	23	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	435	2025-07-08 15:15:04.476
552	23	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	436	2025-07-08 15:15:39.204
553	23	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	437	2025-07-08 15:15:54.757
554	23	Booking Confirmation	Your booking for TRILOGY ALL STAGES: FM Creator Camp has been created successfully.	booking_created	f	438	2025-07-08 15:25:37.935
555	23	Booking Confirmation	Your booking for Trilogy: RED Camera Event has been created successfully.	booking_created	f	439	2025-07-08 15:29:39.24
556	23	Booking Updated	Your booking for "Trilogy: RED Camera Event" has been updated.	booking_updated	f	439	2025-07-08 15:30:26.512
557	1	Booking Updated	Your booking for "Trilogy: RED Camera Event" has been updated.	booking_updated	f	439	2025-07-08 15:31:07.272
558	1	Booking Updated	Your booking for "Trilogy: RED Camera Event" has been updated.	booking_updated	f	439	2025-07-08 15:31:52.804
559	23	Booking Confirmation	Your booking for Trilogy Event: AAF + DPA Mixer has been created successfully.	booking_created	f	442	2025-07-08 15:33:14.843
560	23	Booking Updated	Your booking for "TRILOGY ALL STAGES: FM Creator Camp" has been updated.	booking_updated	f	438	2025-07-08 15:34:00.462
561	1	Booking Updated	Your booking for "TRILOGY ALL STAGES: FM Creator Camp" has been updated.	booking_updated	f	438	2025-07-08 15:43:02.712
562	1	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	435	2025-07-08 16:05:18.938
563	1	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	436	2025-07-08 16:05:27.456
564	1	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	435	2025-07-08 16:11:32.414
565	1	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	436	2025-07-08 16:12:00.338
566	1	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	437	2025-07-08 16:12:13.764
567	1	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	435	2025-07-08 16:26:09.259
568	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	363	2025-07-08 16:33:46.553
569	1	Booking Updated	Your booking for "Trilogy Shoot: Psychia" has been updated.	booking_updated	f	435	2025-07-08 16:33:49.714
570	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	359	2025-07-08 16:33:55.124
571	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	366	2025-07-08 16:35:21.412
572	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	261	2025-07-08 19:02:46.166
573	1	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	261	2025-07-08 19:03:03.313
574	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	373	2025-07-09 16:00:14.671
575	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	242	2025-07-09 18:32:40.588
576	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	444	2025-07-09 18:32:58.117
577	9	Booking Confirmation	Your booking for Youtube Shoutouts with Blynda has been created successfully.	booking_created	f	457	2025-07-09 18:51:49.461
578	9	Booking Updated	Your booking for "Youtube Shoutouts with Blynda" has been updated.	booking_updated	f	457	2025-07-09 18:52:22.989
579	7	Booking Confirmation	Your booking for Test file upload *ignore* has been created successfully.	booking_created	f	458	2025-07-10 05:58:24.485
580	1	Booking Updated	Your booking for "SFC - Investor Video" has been updated.	booking_updated	f	434	2025-07-10 15:10:57.68
581	1	Booking Updated	Your booking for "SFC - Investor Video" has been updated.	booking_updated	f	434	2025-07-10 16:02:57.111
582	1	Booking Updated	Your booking for "SFC - Investor Video" has been updated.	booking_updated	f	434	2025-07-10 16:03:12.758
583	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	218	2025-07-10 16:04:56.257
584	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	204	2025-07-10 19:29:58.886
585	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	239	2025-07-10 19:51:53.385
586	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	240	2025-07-10 19:52:52.626
587	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	247	2025-07-10 19:53:18.138
588	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	433	2025-07-10 19:53:45.756
589	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	214	2025-07-10 19:54:00.094
590	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	221	2025-07-10 19:54:21.617
591	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	222	2025-07-10 19:54:35.595
592	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	204	2025-07-11 14:11:54.038
593	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	433	2025-07-11 14:12:04.386
594	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	233	2025-07-11 14:12:14.942
595	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	214	2025-07-11 14:12:24.658
596	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	221	2025-07-11 14:12:35.972
597	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	222	2025-07-11 14:12:45.496
598	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	239	2025-07-11 14:13:29.499
599	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	239	2025-07-11 14:13:43.074
600	1	Booking Updated	Your booking for "Youtube Shoutouts with Blynda" has been updated.	booking_updated	f	457	2025-07-11 14:13:58.396
601	1	Booking Deleted	Your booking for "Praise" has been deleted by administrator.	booking_deleted	f	444	2025-07-11 17:07:05.999
602	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	242	2025-07-11 17:07:52.588
603	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	242	2025-07-11 17:08:09.543
604	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	243	2025-07-11 17:09:15.892
605	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	244	2025-07-11 17:09:26.665
606	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	245	2025-07-11 17:09:36.889
607	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	249	2025-07-11 17:09:53.315
608	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	202	2025-07-11 17:10:01.013
609	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	241	2025-07-11 17:10:11.499
610	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	248	2025-07-11 17:10:28.133
611	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	205	2025-07-11 17:11:01.814
612	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	210	2025-07-11 17:11:09.886
613	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	215	2025-07-11 17:11:23.188
614	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	223	2025-07-11 17:11:33.08
615	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	224	2025-07-11 17:11:42.236
616	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	211	2025-07-11 17:12:28.884
617	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	206	2025-07-11 17:12:36.548
618	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	216	2025-07-11 17:12:45.097
619	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	219	2025-07-11 17:12:54.191
620	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	234	2025-07-11 17:13:06.821
621	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	430	2025-07-11 20:00:57.515
622	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	431	2025-07-11 20:01:06.876
623	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	430	2025-07-11 20:04:26.656
624	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	431	2025-07-11 20:04:32.884
625	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	359	2025-07-12 19:02:47.626
626	1	Booking Confirmation	Your booking for Test API Entry has been created successfully.	booking_created	f	459	2025-07-13 08:02:15.239
627	1	Booking Updated	Your booking for "Test API Entry" has been updated.	booking_updated	f	459	2025-07-13 08:40:02.255
628	1	Booking Confirmation	Your booking for Test API call has been created successfully.	booking_created	f	460	2025-07-13 08:43:43.146
629	1	Booking Updated	Your booking for "TRILOGY: FM Creator Camp" has been updated.	booking_updated	f	438	2025-07-14 15:19:29.553
630	1	Booking Updated	Your booking for "TRILOGY: FM Creator Camp" has been updated.	booking_updated	f	438	2025-07-14 15:20:02.042
631	1	Booking Updated	Your booking for "TRILOGY: FM Creator Camp" has been updated.	booking_updated	f	438	2025-07-14 15:20:41.682
632	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	445	2025-07-14 17:25:40.524
633	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	446	2025-07-14 17:25:47.827
634	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	454	2025-07-14 17:25:55.488
635	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	447	2025-07-14 17:26:01.568
636	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	455	2025-07-14 17:26:11.676
637	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	225	2025-07-14 17:26:21.17
638	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	226	2025-07-14 17:26:27.865
639	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	448	2025-07-14 17:28:27.541
640	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	449	2025-07-14 17:28:33.773
641	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	450	2025-07-14 17:28:39.085
642	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	451	2025-07-14 17:28:45.496
646	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	477	2025-07-14 17:33:47.417
647	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	478	2025-07-14 17:33:56.852
643	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	456	2025-07-14 17:28:51.881
644	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	452	2025-07-14 17:29:18.635
645	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	453	2025-07-14 17:29:24.24
648	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	479	2025-07-14 17:34:09.279
649	9	Booking Confirmation	Your booking for TBN Special Report - LIVE has been created successfully.	booking_created	f	482	2025-07-14 18:02:02.221
650	9	New Booking Notification	A new booking "TBN Special Report - LIVE" has been created that requires your attention.	booking_created	f	482	2025-07-14 18:02:02.933
652	7	New Booking Notification	A new booking "TBN Special Report - LIVE" has been created that requires your attention.	booking_created	f	482	2025-07-14 18:02:02.948
653	1	Booking Updated	Your booking for "TRILOGY: FM Creator Camp" has been updated.	booking_updated	f	438	2025-07-14 18:39:37.509
654	9	Booking Updated	Your booking for "TBN Special Report - LIVE" has been updated.	booking_updated	f	482	2025-07-14 19:23:41.203
655	9	Booking Confirmation	Your booking for Prerecords with Blynda has been created successfully.	booking_created	f	483	2025-07-14 19:40:02.684
657	1	Booking Updated	Your booking for "TBN Special Report - LIVE" has been updated.	booking_updated	f	482	2025-07-14 19:48:50.501
658	1	Booking Updated	Your booking for "TBN Special Report - LIVE" has been updated.	booking_updated	f	482	2025-07-14 19:49:31.238
659	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	484	2025-07-14 20:09:11.455
661	9	Booking Confirmation	Your booking for Erick Stakelbeck - Outbounds has been created successfully.	booking_created	f	485	2025-07-14 20:54:13.29
663	9	Booking Updated	Your booking for "Erick Stakelbeck - Outbounds" has been updated.	booking_updated	f	485	2025-07-14 20:55:28.851
664	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	484	2025-07-15 13:19:53.412
665	9	Booking Updated	Your booking for "Prerecords with Blynda" has been updated.	booking_updated	f	483	2025-07-15 14:35:59.112
666	1	Booking Updated	Your booking for "TBN Special Report - LIVE" has been updated.	booking_updated	f	482	2025-07-15 15:18:05.667
667	23	Booking Confirmation	Your booking for TOUR: Creator Camp has been created successfully.	booking_created	f	486	2025-07-15 18:25:44.614
668	24	New Booking Notification	A new booking "TOUR: Creator Camp" has been created that requires your attention.	booking_created	f	486	2025-07-15 18:25:45.216
669	7	New Booking Notification	A new booking "TOUR: Creator Camp" has been created that requires your attention.	booking_created	f	486	2025-07-15 18:25:45.227
670	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	249	2025-07-15 20:12:17.008
671	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	205	2025-07-15 20:14:01.659
672	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	202	2025-07-15 20:14:27.291
673	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	487	2025-07-15 20:35:10.998
674	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	443	2025-07-15 21:09:52.755
675	1	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	261	2025-07-15 21:10:04.469
676	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	262	2025-07-15 21:10:15.703
677	1	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	262	2025-07-15 21:10:20.778
678	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	263	2025-07-15 21:10:30.269
679	1	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	263	2025-07-15 21:10:43.765
680	23	Booking Confirmation	Your booking for EVENT: David Film Investor Event has been created successfully.	booking_created	f	488	2025-07-15 21:13:16.381
681	24	New Booking Notification	A new booking "EVENT: David Film Investor Event" has been created that requires your attention.	booking_created	f	488	2025-07-15 21:13:16.673
682	7	New Booking Notification	A new booking "EVENT: David Film Investor Event" has been created that requires your attention.	booking_created	f	488	2025-07-15 21:13:16.681
683	23	Booking Updated	Your booking for "EVENT: David Film Investor Event" has been updated.	booking_updated	f	488	2025-07-15 21:13:32.928
684	1	Booking Updated	Your booking for "Prerecords with Blynda" has been updated.	booking_updated	f	483	2025-07-16 16:24:19.302
685	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	487	2025-07-16 16:24:31.611
686	9	Booking Confirmation	Your booking for Breaking Sunday School with Jason Sobel has been created successfully.	booking_created	f	489	2025-07-16 20:26:34.986
687	9	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	489	2025-07-16 20:27:12.743
688	9	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	490	2025-07-16 20:27:21.094
689	1	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	489	2025-07-16 20:27:26.531
690	1	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	490	2025-07-16 20:27:31.32
691	9	Booking Confirmation	Your booking for Paul Venter has been created successfully.	booking_created	f	491	2025-07-17 20:39:36.387
693	1	Booking Updated	Your booking for "EVENT: David Film Investor Event" has been updated.	booking_updated	f	488	2025-07-17 20:43:27.904
694	9	Booking Updated	Your booking for "Paul Venter" has been updated.	booking_updated	f	491	2025-07-17 20:45:11.161
695	23	Booking Confirmation	Your booking for SHOOT: Team People  has been created successfully.	booking_created	f	492	2025-07-17 20:46:38.25
1132	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	622	2025-09-24 17:59:28.285
696	24	New Booking Notification	A new booking "SHOOT: Team People " has been created that requires your attention.	booking_created	f	492	2025-07-17 20:46:38.743
697	7	New Booking Notification	A new booking "SHOOT: Team People " has been created that requires your attention.	booking_created	f	492	2025-07-17 20:46:38.75
698	23	Booking Updated	Your booking for "SHOOT: Team People " has been updated.	booking_updated	f	492	2025-07-17 20:47:18.315
699	1	Booking Updated	Your booking for "SHOOT: Team People " has been updated.	booking_updated	f	492	2025-07-17 20:51:22.339
700	23	Booking Updated	Your booking for "SHOOT: Team People " has been updated.	booking_updated	f	493	2025-07-17 20:51:42.182
701	9	Booking Updated	Your booking for "AMAC Spots" has been updated.	booking_updated	f	494	2025-07-18 16:39:23.776
702	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	205	2025-07-18 20:15:18.068
703	1	Booking Updated	Your booking for "Trilogy: RED Camera Prep Day" has been updated.	booking_updated	f	439	2025-07-21 15:00:32.464
704	1	Booking Updated	Your booking for "Trilogy: RED Camera Event" has been updated.	booking_updated	f	441	2025-07-21 15:00:46.569
705	9	Booking Confirmation	Your booking for MROs with Blynda has been created successfully.	booking_created	f	495	2025-07-21 17:46:54.209
706	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	224	2025-07-21 17:47:26.899
707	9	Booking Updated	Your booking for "MROs with Blynda" has been updated.	booking_updated	f	495	2025-07-21 17:47:42.522
708	1	Booking Deleted	Your booking for "SHOOT: Team People Car Shoot" has been deleted by administrator.	booking_deleted	f	496	2025-07-21 17:50:35.756
709	23	Booking Confirmation	Your booking for EVENT: David Film Screening Prep Day has been created successfully.	booking_created	f	497	2025-07-21 17:51:32.145
710	24	New Booking Notification	A new booking "EVENT: David Film Screening Prep Day" has been created that requires your attention.	booking_created	f	497	2025-07-21 17:51:32.536
711	7	New Booking Notification	A new booking "EVENT: David Film Screening Prep Day" has been created that requires your attention.	booking_created	f	497	2025-07-21 17:51:32.543
712	22	Booking Confirmation	Your booking for Trilogy: TBN Eschatology Project has been created successfully.	booking_created	f	498	2025-07-21 18:15:06.868
713	24	New Booking Notification	A new booking "Trilogy: TBN Eschatology Project" has been created that requires your attention.	booking_created	f	498	2025-07-21 18:15:07.543
714	7	New Booking Notification	A new booking "Trilogy: TBN Eschatology Project" has been created that requires your attention.	booking_created	f	498	2025-07-21 18:15:07.554
715	22	Booking Updated	Your booking for "Trilogy: TBN Eschatology Project" has been updated.	booking_updated	f	498	2025-07-21 18:16:06.14
716	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	366	2025-07-21 19:01:39.534
717	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	368	2025-07-21 19:02:19.894
718	1	Booking Deleted	Your booking for "Boxing " has been deleted by administrator.	booking_deleted	f	394	2025-07-21 19:02:41.673
719	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	499	2025-07-21 19:03:31.436
720	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	499	2025-07-21 19:03:38.398
721	1	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	365	2025-07-21 19:07:18.532
722	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	187	2025-07-21 19:07:27.487
723	1	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	187	2025-07-21 21:39:51.309
724	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	210	2025-07-21 22:11:10.457
725	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	455	2025-07-22 13:57:40.232
726	1	Booking Deleted	Your booking for "Centerpoint News Updates" has been deleted by administrator.	booking_deleted	f	225	2025-07-22 13:58:06.282
727	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	190	2025-07-22 15:43:07.748
728	1	Booking Deleted	Your booking for "TCL Boxing " has been deleted by administrator.	booking_deleted	f	366	2025-07-22 15:44:24.708
729	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	191	2025-07-22 15:44:33.682
730	1	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	398	2025-07-22 22:11:13.899
731	16	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	399	2025-07-22 22:11:23.945
732	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	244	2025-07-23 14:23:46.73
733	1	Booking Updated	Your booking for "Trilogy: TBN Eschatology Project" has been updated.	booking_updated	f	498	2025-07-23 15:07:27.633
734	23	Booking Updated	Your booking for "Trilogy Event: AAF + DPA Mixer" has been updated.	booking_updated	f	442	2025-07-23 17:08:31.928
735	1	Booking Updated	Your booking for "Trilogy: RED Camera Prep Day" has been updated.	booking_updated	f	439	2025-07-23 17:09:59.551
736	9	Booking Confirmation	Your booking for Trilogy Publishing Programs has been created successfully.	booking_created	f	500	2025-07-23 18:33:52.784
737	1	Booking Updated	Your booking for "Trilogy Event: AAF + DPA Mixer" has been updated.	booking_updated	f	442	2025-07-24 02:35:08.855
738	1	Booking Updated	Your booking for "Trilogy: RED Camera Event" has been updated.	booking_updated	f	441	2025-07-24 14:08:05.292
739	1	Booking Updated	Your booking for "Trilogy: TBN Eschatology Project" has been updated.	booking_updated	f	501	2025-07-24 14:13:58.044
740	1	Booking Updated	Your booking for "Trilogy: TBN Eschatology Project" has been updated.	booking_updated	f	498	2025-07-24 14:14:08.412
741	23	Booking Confirmation	Your booking for (TENT) Trilogy: Think Branded Media Shoot CAT has been created successfully.	booking_created	f	502	2025-07-24 14:15:18.192
742	24	New Booking Notification	A new booking "(TENT) Trilogy: Think Branded Media Shoot CAT" has been created that requires your attention.	booking_created	f	502	2025-07-24 14:15:18.501
743	7	New Booking Notification	A new booking "(TENT) Trilogy: Think Branded Media Shoot CAT" has been created that requires your attention.	booking_created	f	502	2025-07-24 14:15:18.509
744	23	Booking Updated	Your booking for "(TENT) Trilogy: Think Branded Media Shoot CAT" has been updated.	booking_updated	f	502	2025-07-24 14:15:35.116
745	23	Booking Updated	Your booking for "(TENT) Trilogy: Think Branded Media Shoot CAT" has been updated.	booking_updated	f	503	2025-07-24 14:15:53.417
746	23	Booking Updated	Your booking for "(TENT) Trilogy: Think Branded Media Shoot CAT" has been updated.	booking_updated	f	504	2025-07-24 14:16:02.588
747	1	Booking Updated	Your booking for "(TENT) Trilogy: Think Branded Media Shoot CAT" has been updated.	booking_updated	f	502	2025-07-24 14:17:28.769
748	1	Booking Updated	Your booking for "SHOOT: Team People Car Shoot" has been updated.	booking_updated	f	492	2025-07-24 14:25:11.063
749	1	Booking Deleted	Your booking for "SFC" has been deleted by administrator.	booking_deleted	f	187	2025-07-24 15:25:15.817
750	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	446	2025-07-24 18:52:07.332
751	1	Booking Updated	Your booking for "Trilogy Event: AAF + DPA Mixer" has been updated.	booking_updated	f	442	2025-07-24 22:11:02.167
752	16	Booking Confirmation	Your booking for Erick / Stakscast has been created successfully.	booking_created	f	505	2025-07-25 15:25:24.882
754	16	Booking Updated	Your booking for "Erick / Stakscast" has been updated.	booking_updated	f	505	2025-07-25 15:25:54.348
755	1	Booking Updated	Your booking for "Erick / Stakscast" has been updated.	booking_updated	f	505	2025-07-25 15:29:04.267
756	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	206	2025-07-25 16:13:29.14
757	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	211	2025-07-25 16:14:21.79
758	23	Booking Confirmation	Your booking for Trilogy Tour has been created successfully.	booking_created	f	506	2025-07-25 17:26:55.643
759	24	New Booking Notification	A new booking "Trilogy Tour" has been created that requires your attention.	booking_created	f	506	2025-07-25 17:26:56.287
760	7	New Booking Notification	A new booking "Trilogy Tour" has been created that requires your attention.	booking_created	f	506	2025-07-25 17:26:56.294
761	1	Booking Updated	Your booking for "Erick / Stakscast" has been updated.	booking_updated	f	505	2025-07-25 17:28:29.585
762	1	Booking Updated	Your booking for "Stakscast Episode" has been updated.	booking_updated	f	505	2025-07-25 17:48:02.169
763	1	Booking Updated	Your booking for "Stakscast Episode" has been updated.	booking_updated	f	505	2025-07-25 18:00:52.41
764	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	243	2025-07-25 18:02:27.279
765	1	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	243	2025-07-25 18:18:58.728
766	1	Booking Updated	Your booking for "Trilogy: RED Camera Prep Day" has been updated.	booking_updated	f	439	2025-07-28 15:31:31.935
767	23	Booking Confirmation	Your booking for (TENT) Fashion Shoot has been created successfully.	booking_created	f	507	2025-07-28 15:45:45.041
768	24	New Booking Notification	A new booking "(TENT) Fashion Shoot" has been created that requires your attention.	booking_created	f	507	2025-07-28 15:45:45.656
769	7	New Booking Notification	A new booking "(TENT) Fashion Shoot" has been created that requires your attention.	booking_created	f	507	2025-07-28 15:45:45.666
770	23	Booking Updated	Your booking for "(TENT) Fashion Shoot" has been updated.	booking_updated	f	507	2025-07-28 15:45:55.251
771	1	Booking Updated	Your booking for "(TENT) Fashion Shoot" has been updated.	booking_updated	f	507	2025-07-28 15:46:09.115
772	1	Booking Updated	Your booking for "(TENT) Fashion Shoot" has been updated.	booking_updated	f	507	2025-07-28 15:59:23.431
773	1	Booking Updated	Your booking for "(TENT) Fashion Shoot" has been updated.	booking_updated	f	508	2025-07-28 15:59:29.546
774	1	Booking Updated	Your booking for "(TENT) Fashion Shoot" has been updated.	booking_updated	f	509	2025-07-28 15:59:35.274
775	23	Booking Updated	Your booking for "EVENT: David Film Screening Prep Day" has been updated.	booking_updated	f	497	2025-07-28 16:00:00.204
776	1	Booking Updated	Your booking for "(TENT) Fashion Shoot" has been updated.	booking_updated	f	510	2025-07-28 16:00:11.173
777	1	Booking Updated	Your booking for "SHOOT: Team People Car Shoot" has been updated.	booking_updated	f	492	2025-07-28 17:17:10.17
778	1	Booking Updated	Your booking for "SHOOT: Team People Car Shoot" has been updated.	booking_updated	f	492	2025-07-28 17:18:36.776
779	1	Booking Updated	Your booking for "SHOOT: Team People Car Shoot" has been updated.	booking_updated	f	492	2025-07-28 17:19:22.08
780	1	Booking Deleted	Your booking for "(TENT) Fashion Shoot" has been deleted by administrator.	booking_deleted	f	510	2025-07-28 18:51:29.524
781	1	Booking Updated	Your booking for "EVENT: David Film Screening Prep Day" has been updated.	booking_updated	f	497	2025-07-28 18:51:42.631
782	1	Booking Deleted	Your booking for "(TENT) Fashion Shoot" has been deleted by administrator.	booking_deleted	f	507	2025-07-28 18:51:58.352
783	1	Booking Deleted	Your booking for "(TENT) Fashion Shoot" has been deleted by administrator.	booking_deleted	f	508	2025-07-28 18:52:04.376
784	1	Booking Deleted	Your booking for "(TENT) Fashion Shoot" has been deleted by administrator.	booking_deleted	f	509	2025-07-28 18:52:09.28
785	1	Booking Updated	Your booking for "SHOOT: Team People Car Shoot" has been updated.	booking_updated	f	492	2025-07-29 15:55:41.871
786	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	430	2025-07-29 15:56:12.535
787	1	Booking Updated	Your booking for "Teton Ridge - Training" has been updated.	booking_updated	f	431	2025-07-29 15:56:20.645
788	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	511	2025-07-29 20:57:58.791
789	9	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	511	2025-07-29 20:57:59.52
790	7	New Booking Notification	A new booking "Stakelbeck Tonight" has been created that requires your attention.	booking_created	f	511	2025-07-29 20:57:59.53
792	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	219	2025-07-30 14:21:13.162
793	1	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	512	2025-07-30 14:21:36.747
794	1	Booking Deleted	Your booking for "EVENT: David Film Screening Prep Day" has been deleted by administrator.	booking_deleted	f	497	2025-07-31 15:27:04.974
795	1	Booking Deleted	Your booking for "EVENT: David Film Investor Event" has been deleted by administrator.	booking_deleted	f	488	2025-07-31 15:27:14.492
796	1	Booking Updated	Your booking for "Trilogy: TBN Eschatology Project" has been updated.	booking_updated	f	501	2025-07-31 16:07:59.696
797	1	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	234	2025-08-01 14:28:09.001
798	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	513	2025-08-01 16:42:17.335
799	1	Booking Deleted	Your booking for "(TENT) Trilogy: Think Branded Media Shoot CAT" has been deleted by administrator.	booking_deleted	f	502	2025-08-01 17:38:29.637
800	23	Booking Confirmation	Your booking for (TENT) Mary Kay Project has been created successfully.	booking_created	f	514	2025-08-01 19:39:35.623
801	24	New Booking Notification	A new booking "(TENT) Mary Kay Project" has been created that requires your attention.	booking_created	f	514	2025-08-01 19:39:36.234
802	7	New Booking Notification	A new booking "(TENT) Mary Kay Project" has been created that requires your attention.	booking_created	f	514	2025-08-01 19:39:36.245
803	23	Booking Updated	Your booking for "(TENT) Mary Kay Project" has been updated.	booking_updated	f	514	2025-08-01 19:40:17.222
804	1	Booking Confirmation	Your booking for Test linked copies has been created successfully.	booking_created	f	516	2025-08-02 10:33:35.812
805	1	Booking Updated	Your booking for "Test linked copies" has been updated.	booking_updated	f	516	2025-08-02 10:35:57.85
806	1	Booking Updated	Your booking for "Test linked copies" has been updated.	booking_updated	f	516	2025-08-02 10:36:14.929
807	1	Booking Updated	Your booking for "Linked copies" has been updated.	booking_updated	f	516	2025-08-02 10:36:27.686
808	1	Booking Confirmation	Your booking for Test *ingore* has been created successfully.	booking_created	f	521	2025-08-02 11:02:48.938
809	1	Booking Updated	Your booking for "Test *ingore*" has been updated.	booking_updated	f	521	2025-08-02 11:03:13.261
810	1	Booking Updated	Your booking for "Test *ingore*" has been updated.	booking_updated	f	521	2025-08-02 11:03:20.691
811	1	Booking Updated	Your booking for "Test " has been updated.	booking_updated	f	521	2025-08-02 11:03:47.244
812	1	Booking Updated	Your booking for "Test " has been updated.	booking_updated	f	521	2025-08-02 11:03:58.376
813	1	Booking Updated	Your booking for "Test Ignore" has been updated.	booking_updated	f	521	2025-08-02 11:04:13.225
814	23	Booking Updated	Your booking for "(TENT) Trilogy: Think Branded Media Shoot CAT" has been updated.	booking_updated	f	503	2025-08-04 19:11:11.866
815	23	Booking Updated	Your booking for "(TENT) Trilogy: Think Branded Media Shoot CAT" has been updated.	booking_updated	f	504	2025-08-04 19:11:38.407
816	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	503	2025-08-04 20:39:33.049
817	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	504	2025-08-04 20:39:59.994
818	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	500	2025-08-05 16:26:41.132
819	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	480	2025-08-05 21:50:06.846
820	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	503	2025-08-06 20:29:59.878
821	22	Booking Confirmation	Your booking for CAR: TBN Rabbi Sobel Prep Day has been created successfully.	booking_created	f	553	2025-08-06 20:44:51.304
822	24	New Booking Notification	A new booking "CAR: TBN Rabbi Sobel Prep Day" has been created that requires your attention.	booking_created	f	553	2025-08-06 20:44:51.934
823	7	New Booking Notification	A new booking "CAR: TBN Rabbi Sobel Prep Day" has been created that requires your attention.	booking_created	f	553	2025-08-06 20:44:51.945
824	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	556	2025-08-06 21:24:28.818
825	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	557	2025-08-06 21:25:20.486
826	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	558	2025-08-06 21:25:30.999
827	9	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	489	2025-08-07 13:44:31.444
828	9	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	490	2025-08-07 13:44:39.42
829	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	503	2025-08-07 19:09:59.908
830	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	504	2025-08-07 19:18:20.635
831	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	503	2025-08-07 19:18:30.144
832	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	504	2025-08-07 20:09:44.694
833	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	227	2025-08-08 15:24:28.151
834	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	228	2025-08-08 15:24:38.923
835	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	229	2025-08-08 15:24:54.693
836	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	231	2025-08-08 15:25:43.719
837	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	232	2025-08-08 15:26:11.426
838	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	530	2025-08-08 15:26:29.283
839	23	Booking Confirmation	Your booking for (TENT) The Korey with a K Show Production has been created successfully.	booking_created	f	560	2025-08-08 19:30:21.648
840	24	New Booking Notification	A new booking "(TENT) The Korey with a K Show Production" has been created that requires your attention.	booking_created	f	560	2025-08-08 19:30:22.298
841	7	New Booking Notification	A new booking "(TENT) The Korey with a K Show Production" has been created that requires your attention.	booking_created	f	560	2025-08-08 19:30:22.309
842	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	560	2025-08-08 19:31:46.749
843	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	503	2025-08-10 21:56:13.157
844	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	503	2025-08-10 22:05:01.575
845	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	500	2025-08-11 20:04:15.943
846	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	500	2025-08-11 20:04:25.205
847	23	Booking Updated	Your booking for "SHOOT: Think Branded Media CAT" has been updated.	booking_updated	f	503	2025-08-11 21:44:40.753
848	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	500	2025-08-12 14:18:11.075
849	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	576	2025-08-12 18:48:09.066
850	16	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	368	2025-08-13 16:04:27.436
851	16	Booking Updated	Your booking for "TCL Boxing " has been updated.	booking_updated	f	499	2025-08-13 16:04:47.884
852	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	227	2025-08-13 18:06:41.995
853	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	530	2025-08-13 20:57:48.881
854	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	443	2025-08-13 21:14:11.137
855	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	261	2025-08-13 21:14:36.854
856	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	262	2025-08-13 21:14:45.07
857	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	263	2025-08-13 21:15:01.362
858	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	262	2025-08-13 21:15:13.986
859	9	Booking Updated	Your booking for "Rabbi Jason Sobel Shoot - TBN" has been updated.	booking_updated	f	261	2025-08-13 21:15:30.861
860	23	Booking Confirmation	Your booking for Trilogy Intern Project Production has been created successfully.	booking_created	f	581	2025-08-14 15:37:53.749
861	24	New Booking Notification	A new booking "Trilogy Intern Project Production" has been created that requires your attention.	booking_created	f	581	2025-08-14 15:37:54.342
862	7	New Booking Notification	A new booking "Trilogy Intern Project Production" has been created that requires your attention.	booking_created	f	581	2025-08-14 15:37:54.352
863	9	Booking Updated	Your booking for "KLove Fan Awards Rewind" has been updated.	booking_updated	f	576	2025-08-14 18:33:19.382
864	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	530	2025-08-14 18:46:58.73
865	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	451	2025-08-14 20:51:52.325
866	9	Booking Confirmation	Your booking for 5 Minutes with Jesus has been created successfully.	booking_created	f	583	2025-08-15 16:47:56.428
867	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	474	2025-08-15 17:07:58.87
868	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	475	2025-08-15 17:08:06.674
869	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	500	2025-08-15 17:25:02.752
870	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	584	2025-08-15 19:35:13.321
871	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	585	2025-08-15 19:35:44.066
872	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	452	2025-08-15 19:35:56.323
873	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	584	2025-08-15 19:36:05.337
874	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	227	2025-08-18 21:53:20.992
875	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	586	2025-08-18 21:54:22.345
876	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	228	2025-08-18 21:54:34.411
877	23	Booking Confirmation	Your booking for Trilogy: DP Workshop has been created successfully.	booking_created	f	587	2025-08-19 16:25:04.277
878	24	New Booking Notification	A new booking "Trilogy: DP Workshop" has been created that requires your attention.	booking_created	f	587	2025-08-19 16:25:04.844
879	7	New Booking Notification	A new booking "Trilogy: DP Workshop" has been created that requires your attention.	booking_created	f	587	2025-08-19 16:25:04.854
880	23	Booking Updated	Your booking for "Trilogy: DP Workshop" has been updated.	booking_updated	f	587	2025-08-19 16:25:20.626
881	9	Booking Confirmation	Your booking for MRO Segments with Blynda has been created successfully.	booking_created	f	589	2025-08-19 17:22:08.927
882	9	Booking Updated	Your booking for "MRO Segments with Blynda" has been updated.	booking_updated	f	589	2025-08-19 17:27:25.362
883	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	476	2025-08-19 20:48:52.304
884	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	580	2025-08-19 20:49:02.96
885	9	Booking Confirmation	Your booking for Segments with Pastor D has been created successfully.	booking_created	f	590	2025-08-19 20:49:16.505
886	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	476	2025-08-19 20:49:29.941
887	9	Booking Confirmation	Your booking for Vinia Segments has been created successfully.	booking_created	f	591	2025-08-20 18:54:31.803
888	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	585	2025-08-20 20:27:05.659
889	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	478	2025-08-20 20:30:27.186
890	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	585	2025-08-20 20:30:38.589
891	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	564	2025-08-20 21:11:22.412
892	9	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	600	2025-08-21 17:40:17.417
893	9	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	600	2025-08-21 17:40:46.023
894	9	Booking Confirmation	Your booking for Better Together has been created successfully.	booking_created	f	601	2025-08-21 17:52:18.465
895	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	601	2025-08-21 17:52:36.581
896	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	601	2025-08-21 17:53:09.222
897	9	Booking Updated	Your booking for "MRO Segments with Blynda" has been updated.	booking_updated	f	589	2025-08-21 22:01:50.941
898	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	229	2025-08-22 01:49:08.976
899	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	586	2025-08-22 01:49:25.407
900	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	500	2025-08-22 16:48:51.672
901	9	Booking Updated	Your booking for "Trilogy Publishing Programs" has been updated.	booking_updated	f	500	2025-08-22 16:50:56.598
902	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	481	2025-08-22 17:19:22.975
903	9	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	490	2025-08-22 17:20:11.733
904	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	473	2025-08-25 15:19:01.852
905	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	464	2025-08-25 15:19:10.893
906	9	Booking Confirmation	Your booking for Man Camp Cincinnati has been created successfully.	booking_created	f	602	2025-08-25 16:34:51.9
907	9	Booking Updated	Your booking for "Man Camp Cincinnati" has been updated.	booking_updated	f	603	2025-08-25 16:35:25.033
908	9	Booking Updated	Your booking for "Man Camp Cincinnati" has been updated.	booking_updated	f	604	2025-08-25 16:35:30.625
909	9	Booking Updated	Your booking for "Man Camp Cincinnati" has been updated.	booking_updated	f	605	2025-08-25 16:35:36.689
910	9	Booking Updated	Your booking for "Segments with Pastor D" has been updated.	booking_updated	f	590	2025-08-25 19:05:48.911
911	9	Booking Updated	Your booking for "KLove Fan Awards Rewind" has been updated.	booking_updated	f	576	2025-08-25 20:24:33.439
912	9	Booking Updated	Your booking for "KLove Fan Awards Rewind" has been updated.	booking_updated	f	576	2025-08-26 14:19:16.899
913	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	564	2025-08-26 14:20:28.407
914	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	591	2025-08-26 20:22:06.678
915	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	593	2025-08-26 20:22:15.593
916	9	Booking Confirmation	Your booking for SFC Awards Show has been created successfully.	booking_created	f	606	2025-08-26 20:28:21.61
917	23	Booking Confirmation	Your booking for (TENT) TBN Client has been created successfully.	booking_created	f	607	2025-08-26 20:40:08.102
918	24	New Booking Notification	A new booking "(TENT) TBN Client" has been created that requires your attention.	booking_created	f	607	2025-08-26 20:40:08.713
919	7	New Booking Notification	A new booking "(TENT) TBN Client" has been created that requires your attention.	booking_created	f	607	2025-08-26 20:40:08.723
920	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	474	2025-08-27 14:28:39.473
921	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	591	2025-08-27 21:07:12.508
922	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	593	2025-08-27 21:07:21.892
923	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	593	2025-08-27 21:07:33.04
924	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	608	2025-08-27 21:09:22.973
925	9	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	608	2025-08-27 21:09:23.529
926	7	New Booking Notification	A new booking "Praise" has been created that requires your attention.	booking_created	f	608	2025-08-27 21:09:23.54
927	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	608	2025-08-27 21:09:32.424
928	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	608	2025-08-27 21:51:19.404
929	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	475	2025-08-28 13:47:18.22
930	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	591	2025-08-28 15:21:02.476
931	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	608	2025-08-28 15:22:39.789
932	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	476	2025-08-28 16:24:32.212
933	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	608	2025-08-28 19:55:21.801
934	9	Booking Confirmation	Your booking for Praise (Plex) has been created successfully.	booking_created	f	609	2025-09-02 14:18:37.015
935	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	608	2025-09-02 16:17:31.525
936	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	593	2025-09-02 22:38:58.715
937	9	Booking Updated	Your booking for "Vinia Segments" has been updated.	booking_updated	f	591	2025-09-02 22:39:05.492
938	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	537	2025-09-03 15:05:56.468
939	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	538	2025-09-03 15:06:08.511
940	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	608	2025-09-04 15:04:19.895
941	9	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	489	2025-09-04 20:41:10.716
942	9	Booking Updated	Your booking for "Breaking Sunday School with Jason Sobel" has been updated.	booking_updated	f	490	2025-09-04 20:41:19.98
943	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	541	2025-09-05 15:12:14.232
944	9	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	609	2025-09-05 15:54:39.801
945	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	566	2025-09-05 16:01:52.905
946	22	Booking Confirmation	Your booking for TBN Promo Shoot has been created successfully.	booking_created	f	610	2025-09-05 17:05:32.444
947	24	New Booking Notification	A new booking "TBN Promo Shoot" has been created that requires your attention.	booking_created	f	610	2025-09-05 17:05:33.071
948	7	New Booking Notification	A new booking "TBN Promo Shoot" has been created that requires your attention.	booking_created	f	610	2025-09-05 17:05:33.078
949	22	Booking Updated	Your booking for "TBN Promo Shoot" has been updated.	booking_updated	f	610	2025-09-05 17:05:54.007
950	22	Booking Confirmation	Your booking for TBN Tour of Trilogy Stages for SFC has been created successfully.	booking_created	f	611	2025-09-05 17:12:36.169
951	24	New Booking Notification	A new booking "TBN Tour of Trilogy Stages for SFC" has been created that requires your attention.	booking_created	f	611	2025-09-05 17:12:36.645
952	7	New Booking Notification	A new booking "TBN Tour of Trilogy Stages for SFC" has been created that requires your attention.	booking_created	f	611	2025-09-05 17:12:36.654
953	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	562	2025-09-05 17:15:29.714
954	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	571	2025-09-05 17:15:38.867
955	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	612	2025-09-05 17:15:43.785
956	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	613	2025-09-05 17:16:49.466
957	9	Booking Confirmation	Your booking for Praise has been created successfully.	booking_created	f	614	2025-09-05 19:09:11.506
958	16	Booking Confirmation	Your booking for 5 Min w/ Jesus has been created successfully.	booking_created	f	615	2025-09-05 20:41:20.886
959	16	Booking Confirmation	Your booking for DOVES PROMOS has been created successfully.	booking_created	f	616	2025-09-05 21:39:52.773
960	16	Booking Updated	Your booking for "DOVES PROMOS" has been updated.	booking_updated	f	616	2025-09-05 22:08:55.18
961	16	Booking Updated	Your booking for "DOVES PROMOS" has been updated.	booking_updated	f	616	2025-09-05 22:38:52.369
962	16	Booking Updated	Your booking for "5 Min w/ Jesus" has been updated.	booking_updated	f	615	2025-09-08 14:53:48.094
963	16	Booking Confirmation	Your booking for Love Language Series has been created successfully.	booking_created	f	617	2025-09-08 17:14:38.293
964	7	New Booking Notification	A new booking "Love Language Series" has been created that requires your attention.	booking_created	f	617	2025-09-08 17:14:39.014
965	22	Booking Confirmation	Your booking for CCSWB Live Stream has been created successfully.	booking_created	f	618	2025-09-08 21:36:31.029
966	24	New Booking Notification	A new booking "CCSWB Live Stream" has been created that requires your attention.	booking_created	f	618	2025-09-08 21:36:31.611
967	7	New Booking Notification	A new booking "CCSWB Live Stream" has been created that requires your attention.	booking_created	f	618	2025-09-08 21:36:31.623
968	16	Booking Updated	Your booking for "5 Min w/ Jesus" has been updated.	booking_updated	f	615	2025-09-08 22:46:16.622
969	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	609	2025-09-09 17:45:06.363
970	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	609	2025-09-09 17:45:29.929
971	23	Booking Deleted	Your booking for "(TENT) The Korey with a K Show Production" has been deleted by administrator.	booking_deleted	f	560	2025-09-10 16:21:44.329
972	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	561	2025-09-10 16:22:06.215
973	23	Booking Deleted	Your booking for "(TENT) The Korey with a K Show Production" has been deleted by administrator.	booking_deleted	f	613	2025-09-10 16:23:23.644
974	16	Booking Confirmation	Your booking for (TENT) The Korey with a K Show Production has been created successfully.	booking_created	f	619	2025-09-10 16:23:38.2
975	16	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	619	2025-09-10 16:23:48.841
976	16	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	619	2025-09-10 16:24:11.778
977	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	561	2025-09-10 16:24:20.391
978	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	562	2025-09-10 16:24:26.662
979	16	Booking Confirmation	Your booking for LIVE: SPECIAL REPORT has been created successfully.	booking_created	f	620	2025-09-11 03:39:42.372
980	16	Booking Updated	Your booking for "LIVE: SPECIAL REPORT" has been updated.	booking_updated	f	620	2025-09-11 03:39:58.338
981	16	Booking Confirmation	Your booking for LIVE STAKS has been created successfully.	booking_created	f	621	2025-09-11 03:43:04.401
982	7	New Booking Notification	A new booking "LIVE STAKS" has been created that requires your attention.	booking_created	f	621	2025-09-11 03:43:04.693
983	16	Booking Updated	Your booking for "LIVE: SPECIAL REPORT" has been updated.	booking_updated	f	620	2025-09-11 03:43:56.806
984	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	577	2025-09-11 03:46:10.995
985	16	Booking Updated	Your booking for "LIVE STAKS" has been updated.	booking_updated	f	621	2025-09-11 16:09:02.596
986	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	568	2025-09-11 18:19:52.001
987	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	568	2025-09-11 18:20:01.697
988	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	575	2025-09-11 18:22:27.124
989	16	Booking Updated	Your booking for "LIVE STAKS" has been updated.	booking_updated	f	621	2025-09-11 19:05:17.003
990	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	573	2025-09-12 18:29:25.105
991	16	Booking Confirmation	Your booking for Praise (Plex) has been created successfully.	booking_created	f	622	2025-09-12 18:31:32.735
992	7	New Booking Notification	A new booking "Praise (Plex)" has been created that requires your attention.	booking_created	f	622	2025-09-12 18:31:33.545
993	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	614	2025-09-12 18:33:28.243
994	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	614	2025-09-12 18:34:15.98
995	16	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	619	2025-09-12 19:10:56.258
996	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	561	2025-09-12 19:11:33.371
997	23	Booking Updated	Your booking for "(TENT) The Korey with a K Show Production" has been updated.	booking_updated	f	562	2025-09-12 19:11:47.843
998	16	Booking Confirmation	Your booking for Chasing Hope has been created successfully.	booking_created	f	623	2025-09-12 19:58:45.708
999	24	New Booking Notification	A new booking "Chasing Hope" has been created that requires your attention.	booking_created	f	623	2025-09-12 19:58:46.388
1000	16	Booking Confirmation	Your booking for Chasing Hope has been created successfully.	booking_created	f	624	2025-09-12 20:05:22.172
1001	24	New Booking Notification	A new booking "Chasing Hope" has been created that requires your attention.	booking_created	f	624	2025-09-12 20:05:22.635
1002	16	Booking Updated	Your booking for "Chasing Hope" has been updated.	booking_updated	f	624	2025-09-12 20:06:22.243
1003	16	Booking Confirmation	Your booking for Chasing Hope has been created successfully.	booking_created	f	625	2025-09-12 20:12:26.972
1004	24	New Booking Notification	A new booking "Chasing Hope" has been created that requires your attention.	booking_created	f	625	2025-09-12 20:12:27.636
1005	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	619	2025-09-12 20:13:54.694
1006	23	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	561	2025-09-12 20:14:02.295
1007	23	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	562	2025-09-12 20:14:12.943
1008	22	Booking Updated	Your booking for "CCSWB Live Stream" has been updated.	booking_updated	f	618	2025-09-12 20:40:05.876
1009	23	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	561	2025-09-12 20:45:16.83
1010	23	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	562	2025-09-12 20:45:24.935
1011	16	Booking Updated	Your booking for "5 Min w/ Jesus" has been updated.	booking_updated	f	615	2025-09-12 20:50:18.967
1012	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	619	2025-09-12 20:51:05.085
1013	16	Booking Updated	Your booking for "5 Min w/ Jesus" has been updated.	booking_updated	f	615	2025-09-12 21:06:44.524
1014	16	Booking Confirmation	Your booking for Trilogy has been created successfully.	booking_created	f	626	2025-09-12 21:07:11.835
1015	24	New Booking Notification	A new booking "Trilogy" has been created that requires your attention.	booking_created	f	626	2025-09-12 21:07:12.525
1016	7	New Booking Notification	A new booking "Trilogy" has been created that requires your attention.	booking_created	f	626	2025-09-12 21:07:12.537
1017	16	Booking Updated	Your booking for "Trilogy" has been updated.	booking_updated	f	626	2025-09-12 21:07:23.12
1018	16	Booking Confirmation	Your booking for The Korey with a K Show Production has been created successfully.	booking_created	f	627	2025-09-12 21:11:10.927
1019	24	New Booking Notification	A new booking "The Korey with a K Show Production" has been created that requires your attention.	booking_created	f	627	2025-09-12 21:11:10.944
1020	16	Booking Confirmation	Your booking for The Korey with a K Show Production has been created successfully.	booking_created	f	628	2025-09-12 21:11:50.711
1021	24	New Booking Notification	A new booking "The Korey with a K Show Production" has been created that requires your attention.	booking_created	f	628	2025-09-12 21:11:50.726
1022	16	Booking Confirmation	Your booking for The Korey with a K Show Production has been created successfully.	booking_created	f	629	2025-09-12 21:12:10.858
1023	7	New Booking Notification	A new booking "The Korey with a K Show Production" has been created that requires your attention.	booking_created	f	629	2025-09-12 21:12:11.231
1024	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	629	2025-09-12 21:12:27.27
1025	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	626	2025-09-12 21:12:51.036
1026	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	627	2025-09-12 21:20:54.694
1027	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	628	2025-09-12 21:20:59.476
1028	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	629	2025-09-12 21:21:03.854
1029	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	626	2025-09-12 21:21:47.455
1030	16	Booking Confirmation	Your booking for Trilogy has been created successfully.	booking_created	f	630	2025-09-12 21:22:50.247
1031	24	New Booking Notification	A new booking "Trilogy" has been created that requires your attention.	booking_created	f	630	2025-09-12 21:22:50.262
1032	16	Booking Confirmation	Your booking for Trilogy has been created successfully.	booking_created	f	631	2025-09-12 21:24:27.796
1033	24	New Booking Notification	A new booking "Trilogy" has been created that requires your attention.	booking_created	f	631	2025-09-12 21:24:27.812
1034	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	626	2025-09-12 21:24:50.131
1035	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	628	2025-09-12 21:25:16.384
1036	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	628	2025-09-12 21:25:31.894
1037	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	627	2025-09-12 21:25:53.142
1038	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	629	2025-09-12 21:26:01.747
1039	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	626	2025-09-12 21:26:14.857
1040	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	619	2025-09-12 21:27:09.834
1041	23	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	561	2025-09-12 21:27:17.014
1042	23	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	562	2025-09-12 21:27:23.693
1043	16	Booking Confirmation	Your booking for Trilogy has been created successfully.	booking_created	f	632	2025-09-12 21:30:15.579
1044	24	New Booking Notification	A new booking "Trilogy" has been created that requires your attention.	booking_created	f	632	2025-09-12 21:30:15.596
1045	16	Booking Updated	Your booking for "Trilogy" has been updated.	booking_updated	f	632	2025-09-12 21:30:25.966
1046	16	Booking Updated	Your booking for "Trilogy" has been updated.	booking_updated	f	630	2025-09-12 22:06:38.359
1047	16	Booking Updated	Your booking for "Trilogy" has been updated.	booking_updated	f	632	2025-09-12 22:06:48.372
1048	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	630	2025-09-12 22:07:06.215
1049	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	556	2025-09-12 22:18:39.424
1050	16	Booking Confirmation	Your booking for CP NEWS: Remembering Charlie Kirk has been created successfully.	booking_created	f	633	2025-09-12 23:07:07.591
1051	7	New Booking Notification	A new booking "CP NEWS: Remembering Charlie Kirk" has been created that requires your attention.	booking_created	f	633	2025-09-12 23:07:08.321
1052	16	Booking Updated	Your booking for "CP NEWS: Remembering Charlie Kirk" has been updated.	booking_updated	f	633	2025-09-12 23:18:40.106
1053	16	Booking Confirmation	Your booking for LIVE PRAISE has been created successfully.	booking_created	f	634	2025-09-13 19:23:23.916
1054	7	New Booking Notification	A new booking "LIVE PRAISE" has been created that requires your attention.	booking_created	f	634	2025-09-13 19:23:24.627
1055	16	Booking Updated	Your booking for "LIVE PRAISE" has been updated.	booking_updated	f	634	2025-09-13 19:23:53.455
1056	16	Booking Updated	Your booking for "LIVE PRAISE" has been updated.	booking_updated	f	634	2025-09-13 19:51:40.143
1057	16	Booking Updated	Your booking for "LIVE PRAISE" has been updated.	booking_updated	f	634	2025-09-13 20:48:23.121
1058	16	Booking Updated	Your booking for "LIVE PRAISE" has been updated.	booking_updated	f	634	2025-09-13 20:48:47.337
1059	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	577	2025-09-13 21:06:53.744
1060	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	578	2025-09-13 21:07:47.354
1061	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	578	2025-09-13 21:07:54.084
1062	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	578	2025-09-13 21:08:08.985
1063	9	Booking Updated	Your booking for "SFC" has been updated.	booking_updated	f	579	2025-09-13 21:08:47.654
1064	9	Booking Updated	Your booking for "SFC: ZG Championship" has been updated.	booking_updated	f	577	2025-09-13 21:09:20.081
1065	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	578	2025-09-13 21:10:20.243
1066	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	578	2025-09-13 21:10:40.174
1067	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	577	2025-09-13 21:11:09.189
1068	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	579	2025-09-13 21:11:29.448
1069	16	Booking Confirmation	Your booking for CHARLIE KIRK MEMORIAL has been created successfully.	booking_created	f	635	2025-09-15 14:23:32.877
1070	7	New Booking Notification	A new booking "CHARLIE KIRK MEMORIAL" has been created that requires your attention.	booking_created	f	635	2025-09-15 14:23:33.614
1071	16	Booking Updated	Your booking for "CHARLIE KIRK MEMORIAL" has been updated.	booking_updated	f	635	2025-09-15 14:23:56.661
1072	16	Booking Updated	Your booking for "LIVE PRAISE" has been updated.	booking_updated	f	634	2025-09-15 15:56:38.307
1073	16	Booking Updated	Your booking for "LIVE: NIGHT OF PRAYER" has been updated.	booking_updated	f	634	2025-09-15 16:36:43.288
1074	16	Booking Updated	Your booking for "CHARLIE KIRK MEMORIAL" has been updated.	booking_updated	f	635	2025-09-15 16:37:00.617
1075	16	Booking Updated	Your booking for "LIVE: NIGHT OF PRAYER" has been updated.	booking_updated	f	634	2025-09-15 16:43:06.498
1076	16	Booking Updated	Your booking for "LIVE: NIGHT OF PRAYER" has been updated.	booking_updated	f	634	2025-09-15 17:45:26.197
1077	9	Booking Updated	Your booking for "KLove Fan Awards Rewind" has been updated.	booking_updated	f	576	2025-09-15 17:45:47.896
1078	22	Booking Updated	Your booking for "CCSWB Live Stream" has been updated.	booking_updated	f	618	2025-09-15 19:06:04.588
1079	16	Booking Updated	Your booking for "CHARLIE KIRK MEMORIAL" has been updated.	booking_updated	f	635	2025-09-15 19:34:28.709
1080	9	Booking Updated	Your booking for "KLove Fan Awards Rewind" has been updated.	booking_updated	f	576	2025-09-15 21:09:00.165
1081	16	Booking Updated	Your booking for "CHARLIE KIRK MEMORIAL" has been updated.	booking_updated	f	635	2025-09-15 21:24:11.352
1082	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	573	2025-09-15 22:14:44.307
1083	16	Booking Confirmation	Your booking for SFC Pre-Pro has been created successfully.	booking_created	f	636	2025-09-15 23:06:04.733
1084	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	627	2025-09-16 16:10:35.161
1085	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	628	2025-09-16 16:10:43.584
1086	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	629	2025-09-16 16:11:16.586
1087	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	630	2025-09-16 16:19:06.328
1088	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	626	2025-09-16 16:19:20.659
1089	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	632	2025-09-16 16:19:55.671
1090	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	628	2025-09-16 16:20:30.228
1091	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	627	2025-09-16 16:20:39.085
1092	16	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	629	2025-09-16 16:20:47.075
1093	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	546	2025-09-16 19:09:55.749
1094	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	546	2025-09-16 19:10:13.241
1095	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	547	2025-09-16 19:10:21.759
1096	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	548	2025-09-16 19:10:27.785
1097	16	Booking Confirmation	Your booking for CODY RECORDS has been created successfully.	booking_created	f	637	2025-09-16 19:11:31.816
1098	16	Booking Updated	Your booking for "CODY RECORDS" has been updated.	booking_updated	f	637	2025-09-16 19:11:45.352
1099	16	Booking Updated	Your booking for "CODY RECORDS" has been updated.	booking_updated	f	637	2025-09-16 19:12:14.292
1100	16	Booking Updated	Your booking for "CODY RECORDS" has been updated.	booking_updated	f	637	2025-09-16 19:12:36.309
1101	16	Booking Updated	Your booking for "CODY RECORDS" has been updated.	booking_updated	f	637	2025-09-16 19:25:00.583
1102	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	546	2025-09-16 21:01:11.982
1103	9	Booking Deleted	Your booking for "Stakelbeck Tonight" has been deleted by administrator.	booking_deleted	f	574	2025-09-16 21:08:20.226
1104	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	513	2025-09-16 21:08:32.122
1105	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	638	2025-09-16 21:09:10.005
1106	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	638	2025-09-16 21:09:30.622
1107	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	513	2025-09-16 21:09:39.696
1108	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	513	2025-09-16 21:09:48.977
1109	23	Booking Updated	Your booking for "The Korey with a K Show Production" has been updated.	booking_updated	f	562	2025-09-18 16:29:55.212
1110	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	571	2025-09-18 16:30:23.761
1111	16	Booking Updated	Your booking for "5 Min w/ Jesus" has been updated.	booking_updated	f	615	2025-09-19 13:55:03.148
1112	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	638	2025-09-19 18:30:08.746
1113	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	639	2025-09-19 18:34:21.266
1114	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	639	2025-09-19 18:34:31.081
1115	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	640	2025-09-19 18:35:02.56
1116	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	641	2025-09-19 18:36:09.751
1117	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	642	2025-09-19 18:36:34.074
1118	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	643	2025-09-19 18:37:00.18
1119	16	Booking Updated	Your booking for "CHARLIE KIRK MEMORIAL" has been updated.	booking_updated	f	635	2025-09-19 18:38:11.239
1120	22	Booking Updated	Your booking for "CCSWB Live Stream" has been updated.	booking_updated	f	618	2025-09-22 14:47:05.626
1121	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	572	2025-09-22 21:00:23.092
1122	9	Booking Confirmation	Your booking for MRO Segments with Blynda has been created successfully.	booking_created	f	644	2025-09-22 21:02:26.484
1123	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	612	2025-09-23 15:58:25.891
1124	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	550	2025-09-23 20:38:26.825
1125	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	550	2025-09-23 20:39:42.67
1126	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	545	2025-09-23 20:40:03.298
1127	9	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	645	2025-09-23 20:40:50.026
1128	9	Booking Updated	Your booking for "5 Minutes with Jesus" has been updated.	booking_updated	f	646	2025-09-24 17:58:07.595
1129	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	573	2025-09-24 17:58:28.562
1130	9	Booking Updated	Your booking for "5 Minutes with Jesus" has been updated.	booking_updated	f	646	2025-09-24 17:58:40.695
1131	9	Booking Updated	Your booking for "5 Minutes with Jesus" has been updated.	booking_updated	f	646	2025-09-24 17:58:55.008
1133	9	Booking Updated	Your booking for "5 Minutes with Jesus" has been updated.	booking_updated	f	646	2025-09-24 17:59:36.439
1134	9	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	534	2025-09-25 17:44:18.175
1135	9	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	573	2025-09-25 17:44:33.738
1136	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	614	2025-09-26 14:07:52.308
1137	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	639	2025-09-29 15:02:03.428
1138	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	639	2025-09-29 15:02:19.56
1139	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	513	2025-09-29 15:43:37.629
1140	22	Booking Confirmation	Your booking for Trilogy has been created successfully.	booking_created	f	647	2025-09-29 15:59:33.709
1141	24	New Booking Notification	A new booking "Trilogy" has been created that requires your attention.	booking_created	f	647	2025-09-29 15:59:34.341
1142	7	New Booking Notification	A new booking "Trilogy" has been created that requires your attention.	booking_created	f	647	2025-09-29 15:59:34.352
1143	22	Booking Confirmation	Your booking for Veritcal Shorts Production has been created successfully.	booking_created	f	648	2025-09-29 16:00:29.242
1144	24	New Booking Notification	A new booking "Veritcal Shorts Production" has been created that requires your attention.	booking_created	f	648	2025-09-29 16:00:29.894
1145	7	New Booking Notification	A new booking "Veritcal Shorts Production" has been created that requires your attention.	booking_created	f	648	2025-09-29 16:00:29.902
1146	22	Booking Updated	Your booking for "Trilogy" has been updated.	booking_updated	f	647	2025-09-29 16:01:46.255
1147	22	Booking Updated	Your booking for "Trilogy" has been updated.	booking_updated	f	650	2025-09-29 16:04:05.438
1148	22	Booking Updated	Your booking for "Trilogy" has been updated.	booking_updated	f	651	2025-09-29 16:04:20.809
1149	22	Booking Updated	Your booking for "Veritcal Shorts Production" has been updated.	booking_updated	f	648	2025-09-29 16:04:32.897
1150	22	Booking Updated	Your booking for "Veritcal Shorts Production" has been updated.	booking_updated	f	648	2025-09-29 16:08:08.675
1151	22	Booking Updated	Your booking for "Vertical Shorts Production" has been updated.	booking_updated	f	650	2025-09-29 16:08:17.511
1152	22	Booking Updated	Your booking for "Veritcal Shorts Production" has been updated.	booking_updated	f	651	2025-09-29 16:08:29.405
1153	16	Booking Confirmation	Your booking for Wintley Phipps Special has been created successfully.	booking_created	f	652	2025-09-29 16:44:55.525
1154	16	Booking Updated	Your booking for "Wintley Phipps Special" has been updated.	booking_updated	f	652	2025-09-29 16:45:46.231
1155	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	641	2025-09-29 16:50:22.259
1156	22	Booking Confirmation	Your booking for TBN B-ROLL SHOOT has been created successfully.	booking_created	f	653	2025-09-29 17:55:53.851
1157	24	New Booking Notification	A new booking "TBN B-ROLL SHOOT" has been created that requires your attention.	booking_created	f	653	2025-09-29 17:55:54.432
1158	7	New Booking Notification	A new booking "TBN B-ROLL SHOOT" has been created that requires your attention.	booking_created	f	653	2025-09-29 17:55:54.442
1159	9	Booking Updated	Your booking for "Praise" has been updated.	booking_updated	f	513	2025-09-29 19:07:22.075
1160	16	Booking Updated	Your booking for "Chasing Hope" has been updated.	booking_updated	f	624	2025-10-01 18:00:28.994
1161	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	654	2025-10-01 20:55:50.233
1162	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	655	2025-10-01 20:56:23.166
1163	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	656	2025-10-01 20:56:59.427
1164	16	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	654	2025-10-01 20:57:06.074
1165	16	Booking Confirmation	Your booking for BT Robo Training has been created successfully.	booking_created	f	657	2025-10-01 21:12:43.441
1166	9	Booking Confirmation	Your booking for Venue Rental has been created successfully.	booking_created	f	658	2025-10-02 14:46:22.251
1167	16	Booking Deleted	Your booking for "Wintley Phipps Special" has been deleted by administrator.	booking_deleted	f	652	2025-10-02 17:32:58.981
1168	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	659	2025-10-02 19:07:11.257
1169	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	660	2025-10-02 19:07:41.383
1170	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	661	2025-10-02 19:09:00.434
1171	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	662	2025-10-02 19:10:40.669
1172	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	663	2025-10-02 19:11:09.342
1173	22	Booking Confirmation	Your booking for TBN Project Set Up Day has been created successfully.	booking_created	f	664	2025-10-02 19:31:16.335
1174	24	New Booking Notification	A new booking "TBN Project Set Up Day" has been created that requires your attention.	booking_created	f	664	2025-10-02 19:31:16.776
1175	7	New Booking Notification	A new booking "TBN Project Set Up Day" has been created that requires your attention.	booking_created	f	664	2025-10-02 19:31:16.785
1176	22	Booking Confirmation	Your booking for TBN Project Shoot Day has been created successfully.	booking_created	f	665	2025-10-02 19:31:42.675
1177	24	New Booking Notification	A new booking "TBN Project Shoot Day" has been created that requires your attention.	booking_created	f	665	2025-10-02 19:31:43.242
1178	7	New Booking Notification	A new booking "TBN Project Shoot Day" has been created that requires your attention.	booking_created	f	665	2025-10-02 19:31:43.249
1179	22	Booking Updated	Your booking for "TBN B-ROLL SHOOT" has been updated.	booking_updated	f	653	2025-10-02 19:33:08.804
1180	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	643	2025-10-02 19:47:24.299
1181	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	643	2025-10-02 19:47:33.597
1182	16	Booking Confirmation	Your booking for Praise w/ M&L has been created successfully.	booking_created	f	666	2025-10-02 20:07:40.137
1183	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	643	2025-10-02 20:08:00.19
1184	16	Booking Confirmation	Your booking for Praise w/ M&L has been created successfully.	booking_created	f	667	2025-10-02 20:09:22.482
1185	16	Booking Updated	Your booking for "Praise w/ M&L" has been updated.	booking_updated	f	666	2025-10-02 20:09:47.521
1186	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	643	2025-10-02 21:08:45.39
1187	16	Booking Confirmation	Your booking for Praise (Plex) has been created successfully.	booking_created	f	668	2025-10-02 21:09:55.699
1188	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	668	2025-10-02 21:10:17.657
1189	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	669	2025-10-02 21:12:43.659
1190	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	670	2025-10-03 15:52:15.435
1191	16	Booking Confirmation	Your booking for Praise (Plex) has been created successfully.	booking_created	f	671	2025-10-06 15:51:32.398
1192	7	New Booking Notification	A new booking "Praise (Plex)" has been created that requires your attention.	booking_created	f	671	2025-10-06 15:51:33.099
1193	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	671	2025-10-06 18:10:21.505
1194	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	671	2025-10-06 18:10:33.322
1195	16	Booking Confirmation	Your booking for Praise (Irving) has been created successfully.	booking_created	f	672	2025-10-06 20:42:47.205
1196	16	Booking Updated	Your booking for "Praise (Irving)" has been updated.	booking_updated	f	672	2025-10-06 20:43:04.704
1197	16	Booking Updated	Your booking for "Praise (Irving)" has been updated.	booking_updated	f	672	2025-10-06 20:43:14.598
1198	9	Booking Updated	Your booking for "Venue Rental" has been updated.	booking_updated	f	658	2025-10-06 21:31:31.048
1199	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	673	2025-10-06 21:32:03.115
1200	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	674	2025-10-06 21:32:32.286
1201	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	675	2025-10-06 21:33:06.148
1202	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	676	2025-10-06 21:34:35.684
1203	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	677	2025-10-06 21:35:33.321
1204	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	678	2025-10-06 21:41:23.819
1205	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	679	2025-10-06 21:47:25.677
1206	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	680	2025-10-06 21:47:59.326
1207	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	681	2025-10-06 21:49:05.843
1208	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	682	2025-10-06 21:49:30.957
1209	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	683	2025-10-06 21:49:53.93
1210	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	684	2025-10-06 21:52:03.419
1211	16	Booking Confirmation	Your booking for Praise (Plex) has been created successfully.	booking_created	f	685	2025-10-06 21:53:50.516
1212	16	Booking Updated	Your booking for "Praise (Irving)" has been updated.	booking_updated	f	672	2025-10-06 22:13:43.94
1213	16	Booking Updated	Your booking for "Praise (Irving)" has been updated.	booking_updated	f	672	2025-10-06 22:13:53.65
1214	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	671	2025-10-07 15:35:31.571
1215	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	671	2025-10-07 15:35:56.459
1216	16	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	673	2025-10-07 19:47:31.028
1217	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	678	2025-10-07 20:50:35.825
1218	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	678	2025-10-07 20:50:46.673
1219	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	678	2025-10-07 21:21:21.385
1220	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	671	2025-10-08 14:19:17.784
1221	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	555	2025-10-08 18:08:30.881
1222	16	Booking Confirmation	Your booking for Praise (Plex) has been created successfully.	booking_created	f	686	2025-10-09 21:56:07.152
1223	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	686	2025-10-09 21:57:35.618
1224	16	Booking Confirmation	Your booking for BT PICK UPS has been created successfully.	booking_created	f	687	2025-10-10 16:53:48.937
1225	16	Booking Updated	Your booking for "BT PICK UPS" has been updated.	booking_updated	f	687	2025-10-10 16:54:20.083
1226	16	Booking Updated	Your booking for "BT PICK UPS" has been updated.	booking_updated	f	687	2025-10-10 16:55:17.416
1227	16	Booking Confirmation	Your booking for STAKS LIVE has been created successfully.	booking_created	f	688	2025-10-10 17:10:11.936
1228	7	New Booking Notification	A new booking "STAKS LIVE" has been created that requires your attention.	booking_created	f	688	2025-10-10 17:10:12.438
1229	16	Booking Updated	Your booking for "STAKS LIVE" has been updated.	booking_updated	f	688	2025-10-10 17:12:27.334
1230	16	Booking Confirmation	Your booking for STAKS READS has been created successfully.	booking_created	f	689	2025-10-10 17:16:23.081
1231	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	678	2025-10-10 17:17:09.963
1232	16	Booking Updated	Your booking for "Love Language Series" has been updated.	booking_updated	f	617	2025-10-10 17:17:59.37
1233	9	Booking Updated	Your booking for "Better Together" has been updated.	booking_updated	f	555	2025-10-10 22:06:27.96
1234	16	Booking Updated	Your booking for "BT PICK UPS" has been updated.	booking_updated	f	687	2025-10-10 22:07:42.697
1235	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	577	2025-10-14 15:34:18.407
1236	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	578	2025-10-14 15:35:03.97
1237	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	579	2025-10-14 15:35:21.646
1238	16	Booking Confirmation	Your booking for TBN Christmas Products has been created successfully.	booking_created	f	690	2025-10-14 19:00:05.808
1239	16	Booking Updated	Your booking for "Chasing Hope" has been updated.	booking_updated	f	625	2025-10-14 22:29:30.248
1240	24	Booking Confirmation	Your booking for Forsure AI  has been created successfully.	booking_created	f	691	2025-10-14 22:41:07.437
1241	24	New Booking Notification	A new booking "Forsure AI " has been created that requires your attention.	booking_created	f	691	2025-10-14 22:41:08.124
1242	7	New Booking Notification	A new booking "Forsure AI " has been created that requires your attention.	booking_created	f	691	2025-10-14 22:41:08.136
1243	24	Booking Updated	Your booking for "Forsure AI " has been updated.	booking_updated	f	691	2025-10-14 22:41:31.226
1244	24	Booking Updated	Your booking for "Forsure AI " has been updated.	booking_updated	f	691	2025-10-14 22:42:23.162
1245	24	Booking Confirmation	Your booking for Halloween Wicked Shoot has been created successfully.	booking_created	f	692	2025-10-14 22:45:33.179
1246	24	New Booking Notification	A new booking "Halloween Wicked Shoot" has been created that requires your attention.	booking_created	f	692	2025-10-14 22:45:33.828
1247	7	New Booking Notification	A new booking "Halloween Wicked Shoot" has been created that requires your attention.	booking_created	f	692	2025-10-14 22:45:33.839
1248	24	Booking Confirmation	Your booking for Samsung Pay Commercial Shoot has been created successfully.	booking_created	f	693	2025-10-14 22:49:11.987
1249	24	New Booking Notification	A new booking "Samsung Pay Commercial Shoot" has been created that requires your attention.	booking_created	f	693	2025-10-14 22:49:12.546
1250	7	New Booking Notification	A new booking "Samsung Pay Commercial Shoot" has been created that requires your attention.	booking_created	f	693	2025-10-14 22:49:12.557
1251	16	Booking Updated	Your booking for "Chasing Hope" has been updated.	booking_updated	f	624	2025-10-14 22:50:39.936
1252	16	Booking Updated	Your booking for "Chasing Hope" has been updated.	booking_updated	f	625	2025-10-14 22:54:29.808
1253	24	Booking Confirmation	Your booking for Silver Sail Entertainment  has been created successfully.	booking_created	f	694	2025-10-14 22:57:34.457
1254	24	New Booking Notification	A new booking "Silver Sail Entertainment " has been created that requires your attention.	booking_created	f	694	2025-10-14 22:57:34.857
1255	7	New Booking Notification	A new booking "Silver Sail Entertainment " has been created that requires your attention.	booking_created	f	694	2025-10-14 22:57:34.866
1256	16	Booking Confirmation	Your booking for 5 MIN W/ JESUS has been created successfully.	booking_created	f	695	2025-10-15 17:34:57.251
1257	16	Booking Updated	Your booking for "5 MIN W/ JESUS" has been updated.	booking_updated	f	695	2025-10-15 17:35:13.913
1258	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	696	2025-10-15 17:44:20.386
1259	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	697	2025-10-15 17:45:07.301
1260	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	698	2025-10-15 17:50:48.648
1261	16	Booking Updated	Your booking for "5 MIN W/ JESUS" has been updated.	booking_updated	f	695	2025-10-15 17:51:03.748
1262	16	Booking Updated	Your booking for "5 MIN W/ JESUS" has been updated.	booking_updated	f	695	2025-10-15 17:51:13.32
1263	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	699	2025-10-15 17:51:49.791
1264	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	700	2025-10-15 17:52:46.086
1265	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	701	2025-10-15 17:53:12.853
1266	16	Booking Confirmation	Your booking for Centerpoint News Updates has been created successfully.	booking_created	f	702	2025-10-15 17:53:34.314
1267	16	Booking Confirmation	Your booking for Praise (Plex) has been created successfully.	booking_created	f	703	2025-10-15 17:55:33.024
1268	16	Booking Confirmation	Your booking for MATT X SUNIL has been created successfully.	booking_created	f	704	2025-10-15 20:30:45.822
1269	16	Booking Updated	Your booking for "MATT X SUNIL" has been updated.	booking_updated	f	704	2025-10-15 20:31:05.999
1270	16	Booking Updated	Your booking for "MATT X SUNIL: New Show" has been updated.	booking_updated	f	704	2025-10-15 20:31:58.24
1271	16	Booking Updated	Your booking for "MATT X SUNIL: New Show" has been updated.	booking_updated	f	704	2025-10-15 20:32:51.659
1272	16	Booking Updated	Your booking for "MATT X SUNIL: New Show" has been updated.	booking_updated	f	704	2025-10-15 20:33:07.169
1273	16	Booking Updated	Your booking for "MATT X SUNIL: New Show" has been updated.	booking_updated	f	704	2025-10-15 20:33:24.384
1274	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	705	2025-10-15 20:35:24.897
1275	16	Booking Confirmation	Your booking for Stakelbeck Tonight has been created successfully.	booking_created	f	706	2025-10-15 20:36:20.209
1276	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	670	2025-10-15 21:03:54.813
1277	16	Booking Updated	Your booking for "Praise (Plex)" has been updated.	booking_updated	f	686	2025-10-15 21:04:00.794
1278	24	Booking Confirmation	Your booking for CCSWB Live Stream has been created successfully.	booking_created	f	707	2025-10-16 16:44:49.082
1279	24	New Booking Notification	A new booking "CCSWB Live Stream" has been created that requires your attention.	booking_created	f	707	2025-10-16 16:44:49.715
1280	7	New Booking Notification	A new booking "CCSWB Live Stream" has been created that requires your attention.	booking_created	f	707	2025-10-16 16:44:49.726
1281	16	Booking Updated	Your booking for "MATT X SUNIL: New Show" has been updated.	booking_updated	f	704	2025-10-16 21:38:25.898
1282	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	577	2025-10-17 20:55:08.867
1283	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	578	2025-10-17 20:55:18.305
1284	9	Booking Updated	Your booking for "SFC: Zane Gray" has been updated.	booking_updated	f	579	2025-10-17 20:55:24.936
1285	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	696	2025-10-17 22:26:37.748
1286	16	Booking Updated	Your booking for "Stakelbeck Tonight" has been updated.	booking_updated	f	696	2025-10-17 22:26:50.111
1287	9	Booking Confirmation	Your booking for Praise  has been created successfully.	booking_created	f	708	2025-10-18 19:39:29.078
1288	9	Booking Updated	Your booking for "Praise " has been updated.	booking_updated	f	708	2025-10-20 14:03:19.083
1289	16	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	683	2025-10-20 19:31:33.307
1290	16	Booking Updated	Your booking for "Centerpoint News Updates" has been updated.	booking_updated	f	683	2025-10-20 22:06:13.474
1291	24	Booking Updated	Your booking for "CCSWB Live Stream" has been updated.	booking_updated	f	707	2025-10-21 01:34:41.636
1292	24	Booking Updated	Your booking for "CCSWB Stream + Live Event " has been updated.	booking_updated	f	707	2025-10-21 01:34:56.01
1293	1	Booking Confirmation	Your booking for Test in use filtering has been created successfully.	booking_created	f	709	2025-12-23 08:03:09.466
1294	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 17:58:01.972
1300	1	Booking Confirmation	Your booking for Test Studio Status has been created successfully.	booking_created	f	711	2025-12-28 17:37:45.145
1302	1	Booking Confirmation	Your booking for test copying booking has been created successfully.	booking_created	f	712	2026-02-16 01:42:20.739
1295	1	Booking Confirmation	Your booking for Testing timeline 2 day has been created successfully.	booking_created	f	710	2025-12-23 18:09:31.679
1301	1	Booking Updated	Your booking for "Test Studio Status" has been updated.	booking_updated	f	711	2025-12-28 17:44:57.115
1303	1	Booking Confirmation	Your booking for test linked booking has been created successfully.	booking_created	f	716	2026-02-16 01:56:46.186
1296	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:11:19.99
1297	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:15:57.667
1298	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:16:08.228
1299	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:16:15.605
1304	1	Booking Confirmation	Your booking for Test booking with assets has been created successfully.	booking_created	f	721	2026-03-14 04:51:34.956
1305	1	Booking Confirmation	Your booking for Test assets booking has been created successfully.	booking_created	f	722	2026-03-15 04:43:20.242
1306	1	Booking Updated	Your booking for "Test assets booking" has been updated.	booking_updated	f	722	2026-03-15 04:44:08.381
1307	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	723	2026-05-28 18:27:46.411
1308	1	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	723	2026-05-28 19:57:12.43
1309	1	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	723	2026-06-01 01:50:20.27
\.


--
-- TOC entry 3828 (class 0 OID 24659)
-- Dependencies: 235
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, token, user_id, expires, created_at, used) FROM stdin;
1	1c6fe6b5274f36dabadabc3a4a1cd0ea78839381112e18f05aee45f55a23ef2a	12	2025-09-12 21:47:30.461	2025-09-12 16:17:30.462511	t
\.


--
-- TOC entry 3830 (class 0 OID 24667)
-- Dependencies: 237
-- Data for Name: pcr_rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcr_rooms (id, name, description, status) FROM stdin;
1	PCR 1- ACR 1		available
2	PCR 2 - ACR 2		available
65	PCR 5 - ACR 3		available
112	PCR 3 - ACR 3		available
64	PCR 4 - ACR 4		available
\.


--
-- TOC entry 3832 (class 0 OID 24674)
-- Dependencies: 239
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
RnKUoG7tMq6dTnznnKfY1-ACikzrWvz9	{"cookie":{"originalMaxAge":86400000,"expires":"2026-06-01T19:12:08.341Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":1}}	2026-06-02 02:00:01
\.


--
-- TOC entry 3833 (class 0 OID 24679)
-- Dependencies: 240
-- Data for Name: studios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.studios (id, name, description, location, status, created_at, attributes) FROM stdin;
13	Remote	\N	\N	available	2025-05-07 04:15:49.627085	\N
14	Irving	Irving Studio	\N	available	2025-05-08 17:05:51.802515	\N
1	Studio A	Newsroom	\N	available	2025-05-07 01:42:14.966735	\N
2	Studio B	News discussion	\N	available	2025-05-07 01:42:23.467643	\N
3	Studio C	New main sit down	\N	available	2025-05-07 01:42:31.234309	\N
4	Studio D	News main stand up	\N	available	2025-05-07 01:42:36.549378	\N
5	Studio E	Dr. Phil	\N	available	2025-05-07 01:42:42.872982	\N
6	Studio F	Better Together	\N	available	2025-05-07 01:42:47.537763	\N
7	Studio O	Lower hit studio (furthest from Better Together set)	\N	available	2025-05-07 01:42:58.552137	\N
8	Studio P	Lower hit studio (between O & Q)	\N	available	2025-05-07 01:43:04.486931	\N
17	Studio Q	Lower hit studio (Closest to Better Together set)	\N	available	2025-05-14 14:56:26.987312	\N
10	Studio W	Far left mezzanine (facing news set)	\N	available	2025-05-07 01:43:45.550382	\N
11	Studio X	Mid left mezzanine 	\N	available	2025-05-07 01:43:57.130881	\N
9	Studio Y	Mid right mezzanine	\N	available	2025-05-07 01:43:34.559512	\N
12	Studio Z	Far right mezzanine (facing news studio)	\N	available	2025-05-07 01:44:02.203006	\N
19	Trilogy Car Stage	\N	\N	available	2025-06-10 10:53:57.297397	\N
20	Trilogy Cinematic Stage	\N	\N	available	2025-06-10 10:54:10.118601	\N
18	Trilogy Commercial Stage	Cinematic Stage	\N	available	2025-06-10 10:53:43.75917	\N
21	*Special Event	Space for facility special events	\N	available	2025-07-11 15:03:49.97013	\N
22	Studio G	Better Together White Cyc	\N	available	2025-07-29 08:56:40.229272	\N
23	Studio J	Audience Holding	\N	available	2025-08-07 16:34:44.948073	\N
\.


--
-- TOC entry 3835 (class 0 OID 24687)
-- Dependencies: 242
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (key, value, description, updated_at, id, created_at) FROM stdin;
siteName	The Plex Studios	The name of the facility displayed throughout the application	2025-05-08 21:35:01.620846+00	1	2025-05-08 22:36:16.723075+00
site_name	BookStud.io	\N	2025-08-02 23:38:43.650914+00	36	2025-08-02 23:38:43.650914+00
facility_name	Production Facility	\N	2025-08-02 23:38:43.658499+00	37	2025-08-02 23:38:43.658499+00
backup_enabled	true	\N	2025-08-02 23:38:43.665427+00	38	2025-08-02 23:38:43.665427+00
backup_retention_days	7	\N	2025-08-02 23:38:43.671919+00	39	2025-08-02 23:38:43.671919+00
\.


--
-- TOC entry 3836 (class 0 OID 24694)
-- Dependencies: 243
-- Data for Name: system_settings_backup; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings_backup (key, value, description, updated_at) FROM stdin;
siteName	The Plex Studios	The name of the facility displayed throughout the application	2025-05-08 21:35:01.620846+00
\.


--
-- TOC entry 3838 (class 0 OID 24700)
-- Dependencies: 245
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.team_members (id, team_id, user_id, role, joined_at) FROM stdin;
3	2	23	member	2025-08-03 14:15:33.5989
4	2	24	member	2025-08-03 14:15:40.411979
5	2	22	member	2025-08-03 14:15:46.248894
9	2	6	member	2025-08-04 03:53:22.843539
\.


--
-- TOC entry 3840 (class 0 OID 24708)
-- Dependencies: 247
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teams (id, name, description, created_by, created_at, updated_at) FROM stdin;
2	Trilogy Studios		1	2025-08-03 14:15:21.562285	2025-08-03 14:15:21.562285
\.


--
-- TOC entry 3842 (class 0 OID 24716)
-- Dependencies: 249
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.templates (id, name, description, type, duration, created_by, user_id, created_at, start_time, end_time, studio_ids, pcr_room_id, color, status, notify_list) FROM stdin;
13	Better Together	\N	production	60	1	\N	2025-05-14 15:48:12.772171	\N	\N	[6,16,7,8,17]	\N	#942192	confirmed	[9,7]
20	Mic Production (Plex)		production	60	9	\N	2025-06-12 12:21:22.654673	9:00am	10:00am	[3]	\N	#4f7a28	confirmed	[]
18	Misc Production	\N	production	30	9	\N	2025-05-22 10:11:37.461142	\N	\N	[14]	\N	#4f7a28	confirmed	[]
21	TCL Boxing 	Boxing 	production	-840	1	\N	2025-06-18 10:42:53.803087	2:00pm	12:00am	[3,4]	64	#77bb41	confirmed	[]
24	Trilogy Template test	\N	production	360	1	\N	2025-07-09 13:08:16.973717	10:00am	4:00pm	[18]	\N	#814bd2	confirmed	[]
2	Praise	\N	production	60	1	\N	2025-05-08 17:04:06.681885	\N	\N	[3,4]	65	#3259f5	confirmed	[9,7]
8	Praise (Plex)	\N	production	120	9	\N	2025-05-14 14:19:14.275358	\N	\N	[3,4]	65	#ff40ff	confirmed	[9,7]
10	Praise (Irving)	\N	production	180	9	\N	2025-05-14 14:20:28.323407	\N	\N	[14]	\N	#ff40ff	confirmed	[9]
12	Centerpoint News Updates	\N	production	30	9	\N	2025-05-14 14:21:40.293973	\N	\N	[9]	\N	#ffaa00	confirmed	[9]
14	Remote Shoot	\N	production	60	9	\N	2025-05-22 10:08:33.229609	\N	\N	[13]	\N	#008cb4	confirmed	[]
15	SFC	Director: Ryan Tyler	production	420	9	\N	2025-05-22 10:08:46.576199	\N	\N	[3,4]	64	#ff2600	confirmed	[]
23	Trilogy	\N	production	480	23	\N	2025-07-08 10:13:58.668211	9:00am	5:00pm	[]	\N	#814bd2	confirmed	[24,7]
6	Stakelbeck Tonight	\N	production	270	9	\N	2025-05-14 09:18:28.422207	\N	\N	[3,4]	1	#008cb4	confirmed	[9,7]
\.


--
-- TOC entry 3844 (class 0 OID 24727)
-- Dependencies: 251
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, email, name, role, calendar_token, sso_provider, sso_id) FROM stdin;
8	DHarvilla	de595f4de1dd1f8fabce5dc40b49d68bf17b395d933b1fdeff669bbbf70a5c113d66b5a0ab873e55169c537f7007334d66da65ed9d256d66d2c283300569f905.3ccb32961d192fe4b3e653329dca57e1	dharvilla@tbn.tv	David Harvilla	it	\N	\N	\N
9	LMercado@tbn.tv	32e175dcbc58dbe5ace440b5786972e5269da89edd23badf6d2faf10bd18720f3eab6ba21f9086f14fd596c0b8db3c67b56429ae136d32ecdcb2e7331cafcfc4.020337313a7fa4c2d0d90a1acb42dda0	lmercado@tbn.tv	Lindsay Mercado	site_manager	\N	\N	\N
10	ddigello	da653f032b623e0463efa7d76f81999880b6f2447257b39c182c0ab5bf3aac0a0d939a0fc84a1709e8600bf593f3ef117a4a6945bda732497d42973535d1f21f.89f43619687f5ae0fb7db534d1171e0c	ddigello@tbn.tv	Daniel DiGello	it	\N	\N	\N
11	tmontez@tbn.tv	a454e5a2a16477e946b1ee81bdc5bacf8b4127a643c206249c3f90efafc29409930421d4dbd949856e09cd45e797bd66792770cd9b518a4b1f583be379fbfaea.730b05ccfee76f6c152bc72846cf7306	tmontez@tbn.tv	Antonio Montez	it	\N	\N	\N
6	osandoval	e503e3c7eacbfe17282a5195cb014323a9d1251fdb4bbb9ab31a30446c12f8da6daf92c818d2781db98964568151d2b67c65fe9590b0a3e29241f1d960ec91a8.9cdb1e2c8eea6f5ba45264d8ab2863d0	osandoval@tbn.tv	Obed Sandoval	site_manager	\N	\N	\N
20	obedtest2	b4852e3df0d1b598916951d134253bb7b572d35c0e1b06476076230f5bebd7a0564beb790a79039882135b6ed5482ac9b316d12f7135fe4ded0a3034b67fb809.e1a5e975cf15d251d62d267287672e1a	obedconference@tbn.tv	Obed Engineer	engineer	\N	\N	\N
13	dobryan	4aa6f9944dc6dbecc1f375c9d1a1630807831e653b9bb070dbd613df5eed91dca601e23f7642ea804793e269e8ea3ff8859919f2dfe0f74db9b323aef6de0784.2345d3227a00777bcc3ed7cdf8bcda69	dobryan@tbn.tv	Dalin OBryan	engineer	\N	\N	\N
15	sprimm@tbn.tv	3ac3f930d81c168bcdfc4722463a57af36c409e826a9e8710d0df2e91d1ba16e35601de989b84ac1d93ff4541984df496ce9538fba9f4f757f4b95a827d78f80.d10bb82c9f96c28544120f90195e0c28	sprimm@tbn.tv	Scott Primm	engineer	\N	\N	\N
16	Grace W	4122913b9f5481725da46ee986559d3b8c78d9c9f012fde93a4c6ad00e7c442354a14b0aac2c79feb1a0c62de6c972c702789eac6b969bfabf4d6c882caf6c2f.b4d7b44699ded4ed8951caec7d37eb55	gwoodward@tbn.tv	Grace Woodward	producer	\N	\N	\N
7	Obedtest	26f23ee2d82ac1acbadee1f09c6314857c79c16d14262ffa96274d953701d44e876f708220c05d74eb6944fa813eb259b708b29d3e5e1bbad25b4b09112f6e21.cbdfd7c227155bb71f5c27e64c7c05ae	obedtest@tbn.tv	Obed Test	producer	\N	\N	\N
27	obedview	5d6990559a0c0c6335bd9a0a891cbc469d0cbe3880190a457d64b23d1410af62680c464d17d2a791e3a402b8b85bce833ad0c9d21397f3e37db6afdbbc619037.ee46808f864eb4fc6b69962caafee07a	tbnobed@gmail.com	Obed Viewer	viewer	\N	\N	\N
28	ejeannerat@tbn.tv	6f45fd2a471883d2e2e981244a0835128e75389dfe0ba706c29b2c92f7f9cd27d72077766e54b7a981eacaec6b73b648b7dbeb769257c864bcd01326a8209377.6f830da2ceada6c785e13f9c5a293dbd	ejeannerat@tbn.tv	Eric Jeannerat	engineer	\N	\N	\N
19	sblack	d04fcb4ae06b67e7e32e6df0d1e27dd7b055b1050c8f9939bbddb893e741b293e6511328f66365cb252e7826cf966b10233be6852811017d650aedbdc4bb4e97.650ce59b17bb391b1a761306194d5a13	sblack@tbn.tv	Stan Black	engineer	\N	\N	\N
21	plexengineering	TBN@Plex456$$	plexengineering@tbn.tv	Plex Engineering	engineer	\N	\N	\N
22	PMay	8284448ebfb45035a65e39b7678dafa5ccb1c29efe25919fdf8c81195ca958c3aa026d860a4612247ef5cf5f65c6ae86e2a3ec4569378023e4864c623ec7a0e0.1a15c9196d66a50c0956527edfc89de0	pmay@trilogystudios.com	Parke May	producer	\N	\N	\N
23	sarajoyner66	db6f32516f1430b8e61ec998dbde0199c143200d2df9e40e352c83d1cddb657a9e20bb1028d86ae36863e2495eb84ebbee0ea3aa9af9de8e24ea14dbce1e8e83.f51bafce4d4af38b8d68a62cc6083eb3	SJoyner@trilogystudios.com	Sara Joyner	producer	\N	\N	\N
24	Ttucker	9f90b7921efd084f68f58505f0d983c44cb4ac5f4ac7f619705c459b9f35bad89466b96e468ae33a420f7cf99cac0d071008605f6b741165cdd5279775d6c166.0b496c1a31a5b2595784e186a4f9258c	TTucker@trilogystudios.com	Taylor Tucker	producer	\N	\N	\N
25	martinjw001	ab729e872dd5e4874cb54cce2fee8f2dd429e06b855178334cbc7a819a3c06c7583b278473d83823d9b24c88c823c59bfe1081c66e8e1a8ca94b9562e7a28b9a.b52c08b53664f687594dbb7c37eb72d8	jmartin@tbn.tv	Jonathan Martin	producer	\N	\N	\N
26	Steve Fjordbak	67873b74e9c294908bf9add8f02eaae4030ee836970f9277d83b2c15c2b739ec7be9af73e420a3577858f621598465a720b7523776a164affbb0d667a957dc13.1f6c63b33cf11fec5c33e2798b95c203	sfjordbak@tbn.tv	STEVE FJORDBAK	producer	\N	\N	\N
12	zmorales	ac140804e6ccc5579fc2a5ce8230de218f2393df2477192389256aad097ca10bc3e1a514c03850e089101262dc62382918bb4f8979d80cb1360ab42aa805682d.17d07d438d4cf10946243c5beb04a528	zmorales@tbn.tv	Zachariah Morales	admin	\N	\N	\N
1	admin	c6797af737da3138fad234f76f8338c7849c9d7d7dc8d62a65ca7af2efecbfa4f306965db0cf05b6fd51ed59c3955f01b9fe94b82e2b98c19204c3cf5e94ffd8.2933513279923aa05df079d0f74c034e	admin@obedtv.com	Admin User	admin	63028a553d0584d1c6015bbe3190f98fa4d090513738797898efccc68cbe4f10	\N	\N
\.


--
-- TOC entry 3900 (class 0 OID 0)
-- Dependencies: 216
-- Name: alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alerts_id_seq', 73, true);


--
-- TOC entry 3901 (class 0 OID 0)
-- Dependencies: 255
-- Name: asset_checkouts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asset_checkouts_id_seq', 29, true);


--
-- TOC entry 3902 (class 0 OID 0)
-- Dependencies: 257
-- Name: asset_photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asset_photos_id_seq', 2, true);


--
-- TOC entry 3903 (class 0 OID 0)
-- Dependencies: 253
-- Name: assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.assets_id_seq', 41, true);


--
-- TOC entry 3904 (class 0 OID 0)
-- Dependencies: 218
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1086, true);


--
-- TOC entry 3905 (class 0 OID 0)
-- Dependencies: 259
-- Name: booking_assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.booking_assets_id_seq', 6, true);


--
-- TOC entry 3906 (class 0 OID 0)
-- Dependencies: 271
-- Name: booking_crew_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.booking_crew_id_seq', 4, true);


--
-- TOC entry 3907 (class 0 OID 0)
-- Dependencies: 220
-- Name: booking_studios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.booking_studios_id_seq', 13325, true);


--
-- TOC entry 3908 (class 0 OID 0)
-- Dependencies: 222
-- Name: booking_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.booking_types_id_seq', 14, true);


--
-- TOC entry 3909 (class 0 OID 0)
-- Dependencies: 224
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bookings_id_seq', 723, true);


--
-- TOC entry 3910 (class 0 OID 0)
-- Dependencies: 265
-- Name: crew_member_positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.crew_member_positions_id_seq', 3, true);


--
-- TOC entry 3911 (class 0 OID 0)
-- Dependencies: 263
-- Name: crew_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.crew_members_id_seq', 2, true);


--
-- TOC entry 3912 (class 0 OID 0)
-- Dependencies: 261
-- Name: crew_positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.crew_positions_id_seq', 25, true);


--
-- TOC entry 3913 (class 0 OID 0)
-- Dependencies: 269
-- Name: crew_template_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.crew_template_slots_id_seq', 1, false);


--
-- TOC entry 3914 (class 0 OID 0)
-- Dependencies: 267
-- Name: crew_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.crew_templates_id_seq', 1, false);


--
-- TOC entry 3915 (class 0 OID 0)
-- Dependencies: 226
-- Name: file_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.file_attachments_id_seq', 15, true);


--
-- TOC entry 3916 (class 0 OID 0)
-- Dependencies: 228
-- Name: invite_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invite_tokens_id_seq', 29, true);


--
-- TOC entry 3917 (class 0 OID 0)
-- Dependencies: 230
-- Name: linked_bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.linked_bookings_id_seq', 1, false);


--
-- TOC entry 3918 (class 0 OID 0)
-- Dependencies: 232
-- Name: notification_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_groups_id_seq', 43, true);


--
-- TOC entry 3919 (class 0 OID 0)
-- Dependencies: 234
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1309, true);


--
-- TOC entry 3920 (class 0 OID 0)
-- Dependencies: 236
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, true);


--
-- TOC entry 3921 (class 0 OID 0)
-- Dependencies: 238
-- Name: pcr_rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pcr_rooms_id_seq', 241, true);


--
-- TOC entry 3922 (class 0 OID 0)
-- Dependencies: 241
-- Name: studios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.studios_id_seq', 23, true);


--
-- TOC entry 3923 (class 0 OID 0)
-- Dependencies: 244
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 39, true);


--
-- TOC entry 3924 (class 0 OID 0)
-- Dependencies: 246
-- Name: team_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.team_members_id_seq', 9, true);


--
-- TOC entry 3925 (class 0 OID 0)
-- Dependencies: 248
-- Name: teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.teams_id_seq', 2, true);


--
-- TOC entry 3926 (class 0 OID 0)
-- Dependencies: 250
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.templates_id_seq', 24, true);


--
-- TOC entry 3927 (class 0 OID 0)
-- Dependencies: 252
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 28, true);


--
-- TOC entry 3500 (class 2606 OID 24753)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 3590 (class 2606 OID 24940)
-- Name: asset_checkouts asset_checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_checkouts
    ADD CONSTRAINT asset_checkouts_pkey PRIMARY KEY (id);


--
-- TOC entry 3594 (class 2606 OID 24963)
-- Name: asset_photos asset_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_photos
    ADD CONSTRAINT asset_photos_pkey PRIMARY KEY (id);


--
-- TOC entry 3584 (class 2606 OID 24930)
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- TOC entry 3507 (class 2606 OID 24755)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3598 (class 2606 OID 32778)
-- Name: booking_assets booking_assets_booking_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_assets
    ADD CONSTRAINT booking_assets_booking_id_asset_id_key UNIQUE (booking_id, asset_id);


--
-- TOC entry 3600 (class 2606 OID 32776)
-- Name: booking_assets booking_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_assets
    ADD CONSTRAINT booking_assets_pkey PRIMARY KEY (id);


--
-- TOC entry 3627 (class 2606 OID 65646)
-- Name: booking_crew booking_crew_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_crew
    ADD CONSTRAINT booking_crew_pkey PRIMARY KEY (id);


--
-- TOC entry 3629 (class 2606 OID 65648)
-- Name: booking_crew booking_crew_response_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_crew
    ADD CONSTRAINT booking_crew_response_token_key UNIQUE (response_token);


--
-- TOC entry 3514 (class 2606 OID 24757)
-- Name: booking_studios booking_studios_booking_id_studio_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT booking_studios_booking_id_studio_id_key UNIQUE (booking_id, studio_id);


--
-- TOC entry 3516 (class 2606 OID 24759)
-- Name: booking_studios booking_studios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT booking_studios_pkey PRIMARY KEY (id);


--
-- TOC entry 3520 (class 2606 OID 24761)
-- Name: booking_types booking_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_types
    ADD CONSTRAINT booking_types_name_key UNIQUE (name);


--
-- TOC entry 3522 (class 2606 OID 24763)
-- Name: booking_types booking_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_types
    ADD CONSTRAINT booking_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3524 (class 2606 OID 24765)
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 3614 (class 2606 OID 65584)
-- Name: crew_member_positions crew_member_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_member_positions
    ADD CONSTRAINT crew_member_positions_pkey PRIMARY KEY (id);


--
-- TOC entry 3616 (class 2606 OID 65586)
-- Name: crew_member_positions crew_member_positions_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_member_positions
    ADD CONSTRAINT crew_member_positions_unique UNIQUE (crew_member_id, position_id);


--
-- TOC entry 3608 (class 2606 OID 65565)
-- Name: crew_members crew_members_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_email_key UNIQUE (email);


--
-- TOC entry 3610 (class 2606 OID 65563)
-- Name: crew_members crew_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_pkey PRIMARY KEY (id);


--
-- TOC entry 3604 (class 2606 OID 65549)
-- Name: crew_positions crew_positions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_positions
    ADD CONSTRAINT crew_positions_name_key UNIQUE (name);


--
-- TOC entry 3606 (class 2606 OID 65547)
-- Name: crew_positions crew_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_positions
    ADD CONSTRAINT crew_positions_pkey PRIMARY KEY (id);


--
-- TOC entry 3624 (class 2606 OID 65623)
-- Name: crew_template_slots crew_template_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_template_slots
    ADD CONSTRAINT crew_template_slots_pkey PRIMARY KEY (id);


--
-- TOC entry 3620 (class 2606 OID 65610)
-- Name: crew_templates crew_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_templates
    ADD CONSTRAINT crew_templates_name_key UNIQUE (name);


--
-- TOC entry 3622 (class 2606 OID 65608)
-- Name: crew_templates crew_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_templates
    ADD CONSTRAINT crew_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 3530 (class 2606 OID 24767)
-- Name: file_attachments file_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 3532 (class 2606 OID 24769)
-- Name: invite_tokens invite_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3534 (class 2606 OID 24771)
-- Name: invite_tokens invite_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_token_key UNIQUE (token);


--
-- TOC entry 3538 (class 2606 OID 24773)
-- Name: linked_bookings linked_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT linked_bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 3540 (class 2606 OID 24775)
-- Name: linked_bookings linked_bookings_primary_booking_id_linked_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT linked_bookings_primary_booking_id_linked_booking_id_key UNIQUE (primary_booking_id, linked_booking_id);


--
-- TOC entry 3542 (class 2606 OID 24777)
-- Name: notification_groups notification_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_groups
    ADD CONSTRAINT notification_groups_name_key UNIQUE (name);


--
-- TOC entry 3544 (class 2606 OID 24779)
-- Name: notification_groups notification_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_groups
    ADD CONSTRAINT notification_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3546 (class 2606 OID 24781)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3548 (class 2606 OID 24783)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3550 (class 2606 OID 24785)
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- TOC entry 3552 (class 2606 OID 24787)
-- Name: pcr_rooms pcr_rooms_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcr_rooms
    ADD CONSTRAINT pcr_rooms_name_key UNIQUE (name);


--
-- TOC entry 3554 (class 2606 OID 24789)
-- Name: pcr_rooms pcr_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcr_rooms
    ADD CONSTRAINT pcr_rooms_pkey PRIMARY KEY (id);


--
-- TOC entry 3557 (class 2606 OID 24791)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 3559 (class 2606 OID 24793)
-- Name: studios studios_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_name_key UNIQUE (name);


--
-- TOC entry 3561 (class 2606 OID 24795)
-- Name: studios studios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_pkey PRIMARY KEY (id);


--
-- TOC entry 3563 (class 2606 OID 24797)
-- Name: system_settings system_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_unique UNIQUE (key);


--
-- TOC entry 3565 (class 2606 OID 24799)
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3569 (class 2606 OID 24801)
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- TOC entry 3571 (class 2606 OID 24803)
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- TOC entry 3574 (class 2606 OID 24805)
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- TOC entry 3576 (class 2606 OID 24807)
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- TOC entry 3579 (class 2606 OID 24809)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3582 (class 2606 OID 24811)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3555 (class 1259 OID 24812)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 3501 (class 1259 OID 24813)
-- Name: idx_alerts_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_created_by ON public.alerts USING btree (created_by);


--
-- TOC entry 3502 (class 1259 OID 24814)
-- Name: idx_alerts_end; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_end ON public.alerts USING btree ("end");


--
-- TOC entry 3503 (class 1259 OID 24815)
-- Name: idx_alerts_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_start ON public.alerts USING btree (start);


--
-- TOC entry 3504 (class 1259 OID 24816)
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- TOC entry 3505 (class 1259 OID 24817)
-- Name: idx_alerts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_type ON public.alerts USING btree (alert_type);


--
-- TOC entry 3595 (class 1259 OID 24969)
-- Name: idx_asset_photos_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_photos_asset_id ON public.asset_photos USING btree (asset_id);


--
-- TOC entry 3596 (class 1259 OID 24970)
-- Name: idx_asset_photos_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_photos_created_at ON public.asset_photos USING btree (created_at);


--
-- TOC entry 3585 (class 1259 OID 24951)
-- Name: idx_assets_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_category ON public.assets USING btree (category);


--
-- TOC entry 3586 (class 1259 OID 32768)
-- Name: idx_assets_decommission_reason; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_decommission_reason ON public.assets USING btree (decommission_reason) WHERE (decommission_reason IS NOT NULL);


--
-- TOC entry 3587 (class 1259 OID 40966)
-- Name: idx_assets_parent_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_parent_asset_id ON public.assets USING btree (parent_asset_id);


--
-- TOC entry 3588 (class 1259 OID 24950)
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- TOC entry 3508 (class 1259 OID 24818)
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- TOC entry 3509 (class 1259 OID 24819)
-- Name: idx_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs USING btree (entity_id);


--
-- TOC entry 3510 (class 1259 OID 24820)
-- Name: idx_audit_logs_entity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs USING btree (entity_type);


--
-- TOC entry 3511 (class 1259 OID 24821)
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- TOC entry 3512 (class 1259 OID 24822)
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- TOC entry 3630 (class 1259 OID 65669)
-- Name: idx_bc_booking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_booking ON public.booking_crew USING btree (booking_id);


--
-- TOC entry 3631 (class 1259 OID 65670)
-- Name: idx_bc_crew_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_crew_member ON public.booking_crew USING btree (crew_member_id);


--
-- TOC entry 3632 (class 1259 OID 65672)
-- Name: idx_bc_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_status ON public.booking_crew USING btree (status);


--
-- TOC entry 3633 (class 1259 OID 65671)
-- Name: idx_bc_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bc_token ON public.booking_crew USING btree (response_token);


--
-- TOC entry 3601 (class 1259 OID 32780)
-- Name: idx_booking_assets_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_assets_asset_id ON public.booking_assets USING btree (asset_id);


--
-- TOC entry 3602 (class 1259 OID 32779)
-- Name: idx_booking_assets_booking_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_assets_booking_id ON public.booking_assets USING btree (booking_id);


--
-- TOC entry 3517 (class 1259 OID 24823)
-- Name: idx_booking_studios_booking_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_studios_booking_id ON public.booking_studios USING btree (booking_id);


--
-- TOC entry 3518 (class 1259 OID 24824)
-- Name: idx_booking_studios_studio_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_studios_studio_id ON public.booking_studios USING btree (studio_id);


--
-- TOC entry 3525 (class 1259 OID 24825)
-- Name: idx_bookings_end; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_end ON public.bookings USING btree ("end");


--
-- TOC entry 3526 (class 1259 OID 24826)
-- Name: idx_bookings_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_start ON public.bookings USING btree (start);


--
-- TOC entry 3527 (class 1259 OID 24827)
-- Name: idx_bookings_studio_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_studio_id ON public.bookings USING btree (studio_id);


--
-- TOC entry 3528 (class 1259 OID 24828)
-- Name: idx_bookings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_user_id ON public.bookings USING btree (user_id);


--
-- TOC entry 3591 (class 1259 OID 24952)
-- Name: idx_checkouts_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_checkouts_asset_id ON public.asset_checkouts USING btree (asset_id);


--
-- TOC entry 3592 (class 1259 OID 24953)
-- Name: idx_checkouts_checked_in; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_checkouts_checked_in ON public.asset_checkouts USING btree (checked_in_at);


--
-- TOC entry 3617 (class 1259 OID 65597)
-- Name: idx_cmp_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cmp_member ON public.crew_member_positions USING btree (crew_member_id);


--
-- TOC entry 3618 (class 1259 OID 65598)
-- Name: idx_cmp_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cmp_position ON public.crew_member_positions USING btree (position_id);


--
-- TOC entry 3611 (class 1259 OID 65576)
-- Name: idx_crew_members_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crew_members_email ON public.crew_members USING btree (email);


--
-- TOC entry 3612 (class 1259 OID 65577)
-- Name: idx_crew_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crew_members_user_id ON public.crew_members USING btree (user_id);


--
-- TOC entry 3625 (class 1259 OID 65634)
-- Name: idx_cts_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cts_template ON public.crew_template_slots USING btree (template_id);


--
-- TOC entry 3535 (class 1259 OID 24829)
-- Name: idx_linked_bookings_linked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_linked_bookings_linked ON public.linked_bookings USING btree (linked_booking_id);


--
-- TOC entry 3536 (class 1259 OID 24830)
-- Name: idx_linked_bookings_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_linked_bookings_primary ON public.linked_bookings USING btree (primary_booking_id);


--
-- TOC entry 3566 (class 1259 OID 24831)
-- Name: idx_team_members_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_members_team_id ON public.team_members USING btree (team_id);


--
-- TOC entry 3567 (class 1259 OID 24832)
-- Name: idx_team_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_members_user_id ON public.team_members USING btree (user_id);


--
-- TOC entry 3572 (class 1259 OID 24833)
-- Name: idx_teams_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_teams_created_by ON public.teams USING btree (created_by);


--
-- TOC entry 3577 (class 1259 OID 49152)
-- Name: users_calendar_token_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_calendar_token_unique ON public.users USING btree (calendar_token) WHERE (calendar_token IS NOT NULL);


--
-- TOC entry 3580 (class 1259 OID 57344)
-- Name: users_sso_provider_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_sso_provider_id_idx ON public.users USING btree (sso_provider, sso_id) WHERE ((sso_provider IS NOT NULL) AND (sso_id IS NOT NULL));


--
-- TOC entry 3652 (class 2606 OID 24941)
-- Name: asset_checkouts asset_checkouts_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_checkouts
    ADD CONSTRAINT asset_checkouts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- TOC entry 3653 (class 2606 OID 24964)
-- Name: asset_photos asset_photos_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_photos
    ADD CONSTRAINT asset_photos_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- TOC entry 3651 (class 2606 OID 40961)
-- Name: assets assets_parent_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_parent_asset_id_fkey FOREIGN KEY (parent_asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- TOC entry 3661 (class 2606 OID 65649)
-- Name: booking_crew booking_crew_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_crew
    ADD CONSTRAINT booking_crew_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3662 (class 2606 OID 65664)
-- Name: booking_crew booking_crew_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_crew
    ADD CONSTRAINT booking_crew_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3663 (class 2606 OID 65659)
-- Name: booking_crew booking_crew_crew_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_crew
    ADD CONSTRAINT booking_crew_crew_member_id_fkey FOREIGN KEY (crew_member_id) REFERENCES public.crew_members(id) ON DELETE SET NULL;


--
-- TOC entry 3664 (class 2606 OID 65654)
-- Name: booking_crew booking_crew_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_crew
    ADD CONSTRAINT booking_crew_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.crew_positions(id);


--
-- TOC entry 3636 (class 2606 OID 24834)
-- Name: bookings bookings_pcr_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pcr_room_id_fkey FOREIGN KEY (pcr_room_id) REFERENCES public.pcr_rooms(id) ON DELETE SET NULL;


--
-- TOC entry 3637 (class 2606 OID 24839)
-- Name: bookings bookings_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id);


--
-- TOC entry 3638 (class 2606 OID 24844)
-- Name: bookings bookings_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- TOC entry 3639 (class 2606 OID 24849)
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3656 (class 2606 OID 65587)
-- Name: crew_member_positions crew_member_positions_crew_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_member_positions
    ADD CONSTRAINT crew_member_positions_crew_member_id_fkey FOREIGN KEY (crew_member_id) REFERENCES public.crew_members(id) ON DELETE CASCADE;


--
-- TOC entry 3657 (class 2606 OID 65592)
-- Name: crew_member_positions crew_member_positions_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_member_positions
    ADD CONSTRAINT crew_member_positions_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.crew_positions(id) ON DELETE CASCADE;


--
-- TOC entry 3654 (class 2606 OID 65571)
-- Name: crew_members crew_members_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3655 (class 2606 OID 65566)
-- Name: crew_members crew_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3659 (class 2606 OID 65629)
-- Name: crew_template_slots crew_template_slots_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_template_slots
    ADD CONSTRAINT crew_template_slots_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.crew_positions(id) ON DELETE CASCADE;


--
-- TOC entry 3660 (class 2606 OID 65624)
-- Name: crew_template_slots crew_template_slots_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_template_slots
    ADD CONSTRAINT crew_template_slots_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.crew_templates(id) ON DELETE CASCADE;


--
-- TOC entry 3658 (class 2606 OID 65611)
-- Name: crew_templates crew_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_templates
    ADD CONSTRAINT crew_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3640 (class 2606 OID 24854)
-- Name: file_attachments file_attachments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3641 (class 2606 OID 24859)
-- Name: file_attachments file_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3634 (class 2606 OID 24864)
-- Name: booking_studios fk_booking_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT fk_booking_id FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3643 (class 2606 OID 24869)
-- Name: linked_bookings fk_linked_bookings_linked; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT fk_linked_bookings_linked FOREIGN KEY (linked_booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3644 (class 2606 OID 24874)
-- Name: linked_bookings fk_linked_bookings_primary; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT fk_linked_bookings_primary FOREIGN KEY (primary_booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3635 (class 2606 OID 24879)
-- Name: booking_studios fk_studio_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT fk_studio_id FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- TOC entry 3642 (class 2606 OID 24884)
-- Name: invite_tokens invite_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3645 (class 2606 OID 24889)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3646 (class 2606 OID 24894)
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3647 (class 2606 OID 24899)
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- TOC entry 3648 (class 2606 OID 24904)
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3649 (class 2606 OID 24909)
-- Name: teams teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3650 (class 2606 OID 24914)
-- Name: templates templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


-- Completed on 2026-06-01 02:00:00 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict g55Wz2XjBZyOcaDdbBRUprmwJY8LfbfKv2Pkn0vtMaCYBZe0xfuqHc8ZWpEezL6

