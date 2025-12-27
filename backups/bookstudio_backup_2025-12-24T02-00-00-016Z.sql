--
-- PostgreSQL database dump
--

\restrict OlYeQTwbzPPnbb6cU6xRoKN7eaEjvfWyGKlqV8kxjGfAoeLrZOck4lKEoOlTx3H

-- Dumped from database version 16.11 (74c6bb6)
-- Dumped by pg_dump version 16.10

-- Started on 2025-12-24 02:00:00 UTC

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

DROP DATABASE neondb;
--
-- TOC entry 3619 (class 1262 OID 16389)
-- Name: neondb; Type: DATABASE; Schema: -; Owner: neondb_owner
--

CREATE DATABASE neondb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE neondb OWNER TO neondb_owner;

\unrestrict OlYeQTwbzPPnbb6cU6xRoKN7eaEjvfWyGKlqV8kxjGfAoeLrZOck4lKEoOlTx3H
\connect neondb
\restrict OlYeQTwbzPPnbb6cU6xRoKN7eaEjvfWyGKlqV8kxjGfAoeLrZOck4lKEoOlTx3H

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
-- TOC entry 264 (class 1255 OID 156032)
-- Name: copy_booking_to_multiple_dates(integer, date[]); Type: FUNCTION; Schema: public; Owner: neondb_owner
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


ALTER FUNCTION public.copy_booking_to_multiple_dates(booking_id integer, dates date[]) OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 156033)
-- Name: alerts; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.alerts OWNER TO neondb_owner;

--
-- TOC entry 216 (class 1259 OID 156043)
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3621 (class 0 OID 0)
-- Dependencies: 216
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- TOC entry 217 (class 1259 OID 156044)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.audit_logs OWNER TO neondb_owner;

--
-- TOC entry 218 (class 1259 OID 156051)
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3622 (class 0 OID 0)
-- Dependencies: 218
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- TOC entry 219 (class 1259 OID 156052)
-- Name: booking_studios; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.booking_studios (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    studio_id integer NOT NULL
);


ALTER TABLE public.booking_studios OWNER TO neondb_owner;

--
-- TOC entry 220 (class 1259 OID 156055)
-- Name: booking_studios_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.booking_studios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_studios_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3623 (class 0 OID 0)
-- Dependencies: 220
-- Name: booking_studios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.booking_studios_id_seq OWNED BY public.booking_studios.id;


--
-- TOC entry 221 (class 1259 OID 156056)
-- Name: booking_types; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.booking_types OWNER TO neondb_owner;

--
-- TOC entry 222 (class 1259 OID 156066)
-- Name: booking_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.booking_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_types_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3624 (class 0 OID 0)
-- Dependencies: 222
-- Name: booking_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.booking_types_id_seq OWNED BY public.booking_types.id;


--
-- TOC entry 223 (class 1259 OID 156067)
-- Name: bookings; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.bookings OWNER TO neondb_owner;

--
-- TOC entry 224 (class 1259 OID 156077)
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bookings_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3625 (class 0 OID 0)
-- Dependencies: 224
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- TOC entry 225 (class 1259 OID 156078)
-- Name: file_attachments; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.file_attachments OWNER TO neondb_owner;

--
-- TOC entry 226 (class 1259 OID 156084)
-- Name: file_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.file_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.file_attachments_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3626 (class 0 OID 0)
-- Dependencies: 226
-- Name: file_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.file_attachments_id_seq OWNED BY public.file_attachments.id;


--
-- TOC entry 227 (class 1259 OID 156085)
-- Name: invite_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.invite_tokens OWNER TO neondb_owner;

--
-- TOC entry 228 (class 1259 OID 156092)
-- Name: invite_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invite_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invite_tokens_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3627 (class 0 OID 0)
-- Dependencies: 228
-- Name: invite_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invite_tokens_id_seq OWNED BY public.invite_tokens.id;


--
-- TOC entry 229 (class 1259 OID 156093)
-- Name: linked_bookings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.linked_bookings (
    id integer NOT NULL,
    primary_booking_id integer NOT NULL,
    linked_booking_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT linked_bookings_check CHECK ((primary_booking_id <> linked_booking_id))
);


ALTER TABLE public.linked_bookings OWNER TO neondb_owner;

--
-- TOC entry 230 (class 1259 OID 156098)
-- Name: linked_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.linked_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.linked_bookings_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3628 (class 0 OID 0)
-- Dependencies: 230
-- Name: linked_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.linked_bookings_id_seq OWNED BY public.linked_bookings.id;


--
-- TOC entry 231 (class 1259 OID 156099)
-- Name: notification_groups; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notification_groups (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    group_type text NOT NULL,
    description text,
    enabled boolean DEFAULT true
);


ALTER TABLE public.notification_groups OWNER TO neondb_owner;

--
-- TOC entry 232 (class 1259 OID 156105)
-- Name: notification_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notification_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_groups_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3629 (class 0 OID 0)
-- Dependencies: 232
-- Name: notification_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notification_groups_id_seq OWNED BY public.notification_groups.id;


--
-- TOC entry 233 (class 1259 OID 156106)
-- Name: notifications; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.notifications OWNER TO neondb_owner;

--
-- TOC entry 234 (class 1259 OID 156113)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3630 (class 0 OID 0)
-- Dependencies: 234
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 235 (class 1259 OID 156114)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    user_id integer NOT NULL,
    expires timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    used boolean DEFAULT false
);


ALTER TABLE public.password_reset_tokens OWNER TO neondb_owner;

--
-- TOC entry 236 (class 1259 OID 156121)
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3631 (class 0 OID 0)
-- Dependencies: 236
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- TOC entry 237 (class 1259 OID 156122)
-- Name: pcr_rooms; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pcr_rooms (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'available'::text NOT NULL
);


ALTER TABLE public.pcr_rooms OWNER TO neondb_owner;

--
-- TOC entry 238 (class 1259 OID 156128)
-- Name: pcr_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pcr_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pcr_rooms_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3632 (class 0 OID 0)
-- Dependencies: 238
-- Name: pcr_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pcr_rooms_id_seq OWNED BY public.pcr_rooms.id;


--
-- TOC entry 239 (class 1259 OID 156129)
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- TOC entry 240 (class 1259 OID 156134)
-- Name: studios; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.studios OWNER TO neondb_owner;

--
-- TOC entry 241 (class 1259 OID 156141)
-- Name: studios_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.studios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.studios_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3633 (class 0 OID 0)
-- Dependencies: 241
-- Name: studios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.studios_id_seq OWNED BY public.studios.id;


--
-- TOC entry 242 (class 1259 OID 156142)
-- Name: system_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_settings OWNER TO neondb_owner;

--
-- TOC entry 243 (class 1259 OID 156149)
-- Name: system_settings_backup; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.system_settings_backup (
    key text,
    value text,
    description text,
    updated_at timestamp with time zone
);


ALTER TABLE public.system_settings_backup OWNER TO neondb_owner;

--
-- TOC entry 244 (class 1259 OID 156154)
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3634 (class 0 OID 0)
-- Dependencies: 244
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- TOC entry 245 (class 1259 OID 156155)
-- Name: team_members; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.team_members (
    id integer NOT NULL,
    team_id integer NOT NULL,
    user_id integer NOT NULL,
    role text DEFAULT 'member'::text,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.team_members OWNER TO neondb_owner;

--
-- TOC entry 246 (class 1259 OID 156162)
-- Name: team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.team_members_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3635 (class 0 OID 0)
-- Dependencies: 246
-- Name: team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;


--
-- TOC entry 247 (class 1259 OID 156163)
-- Name: teams; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.teams OWNER TO neondb_owner;

--
-- TOC entry 248 (class 1259 OID 156170)
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3636 (class 0 OID 0)
-- Dependencies: 248
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- TOC entry 249 (class 1259 OID 156171)
-- Name: templates; Type: TABLE; Schema: public; Owner: neondb_owner
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


ALTER TABLE public.templates OWNER TO neondb_owner;

--
-- TOC entry 250 (class 1259 OID 156181)
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.templates_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3637 (class 0 OID 0)
-- Dependencies: 250
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- TOC entry 251 (class 1259 OID 156182)
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- TOC entry 252 (class 1259 OID 156188)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- TOC entry 3638 (class 0 OID 0)
-- Dependencies: 252
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3274 (class 2604 OID 156189)
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- TOC entry 3280 (class 2604 OID 156190)
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- TOC entry 3283 (class 2604 OID 156191)
-- Name: booking_studios id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_studios ALTER COLUMN id SET DEFAULT nextval('public.booking_studios_id_seq'::regclass);


--
-- TOC entry 3284 (class 2604 OID 156192)
-- Name: booking_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_types ALTER COLUMN id SET DEFAULT nextval('public.booking_types_id_seq'::regclass);


--
-- TOC entry 3290 (class 2604 OID 156193)
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- TOC entry 3296 (class 2604 OID 156194)
-- Name: file_attachments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments ALTER COLUMN id SET DEFAULT nextval('public.file_attachments_id_seq'::regclass);


--
-- TOC entry 3298 (class 2604 OID 156195)
-- Name: invite_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invite_tokens ALTER COLUMN id SET DEFAULT nextval('public.invite_tokens_id_seq'::regclass);


--
-- TOC entry 3301 (class 2604 OID 156196)
-- Name: linked_bookings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.linked_bookings ALTER COLUMN id SET DEFAULT nextval('public.linked_bookings_id_seq'::regclass);


--
-- TOC entry 3303 (class 2604 OID 156197)
-- Name: notification_groups id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notification_groups ALTER COLUMN id SET DEFAULT nextval('public.notification_groups_id_seq'::regclass);


--
-- TOC entry 3305 (class 2604 OID 156198)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 3308 (class 2604 OID 156199)
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- TOC entry 3311 (class 2604 OID 156200)
-- Name: pcr_rooms id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pcr_rooms ALTER COLUMN id SET DEFAULT nextval('public.pcr_rooms_id_seq'::regclass);


--
-- TOC entry 3313 (class 2604 OID 156201)
-- Name: studios id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.studios ALTER COLUMN id SET DEFAULT nextval('public.studios_id_seq'::regclass);


--
-- TOC entry 3317 (class 2604 OID 156202)
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- TOC entry 3319 (class 2604 OID 156203)
-- Name: team_members id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);


--
-- TOC entry 3322 (class 2604 OID 156204)
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- TOC entry 3325 (class 2604 OID 156205)
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- TOC entry 3331 (class 2604 OID 156206)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3576 (class 0 OID 156033)
-- Dependencies: 215
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
\.


--
-- TOC entry 3578 (class 0 OID 156044)
-- Dependencies: 217
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, entity_title, details, ip_address, user_agent, "timestamp") FROM stdin;
2	0	migration_completed	system	\N	Migration v1.5.2	{"migration":"v1.5.2","description":"Comprehensive audit logging enhancement completed","features":["Enhanced audit logging for user management","Template operations audit logging","Alert management audit logging","System configuration audit logging","Studio and PCR room management audit logging","Notification group management audit logging"],"completedAt":"2025-08-02T23:38:45.519Z"}	\N	\N	2025-08-02 18:38:45.344434
3	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:52:05.378101
5	6	LOGIN	authentication	6	User osandoval logged in	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:52:15.630986
6	6	LOGOUT	authentication	6	User osandoval logged out	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:52:38.851089
7	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:52:47.170313
8	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:53:01.881536
18	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:53:48.434011
19	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:54:19.365687
20	20	LOGIN	authentication	20	User obedtest2 logged in	{"username":"obedtest2","name":"Obed Engineer","role":"engineer","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:54:25.498937
21	20	LOGOUT	authentication	20	User obedtest2 logged out	{"username":"obedtest2","name":"Obed Engineer","role":"engineer","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-02 18:55:20.828821
22	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 12:43:53.408816
25	0	migration_completed	system	\N	Migration v1.5.2	{"migration":"v1.5.2","description":"Comprehensive audit logging enhancement completed","features":["Enhanced audit logging for user management","Template operations audit logging","Alert management audit logging","System configuration audit logging","Studio and PCR room management audit logging","Notification group management audit logging"],"completedAt":"2025-08-03T19:13:12.756Z"}	\N	\N	2025-08-03 14:13:12.698316
26	1	CREATE	team	2	Trilogy Studios	{"teamData":{"name":"Trilogy Studios","description":"","createdBy":1}}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:15:21.584555
27	1	CREATE	team_member	3	Sara Joyner added to team	{"teamId":2,"userId":23,"role":"member"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:15:33.608817
28	1	CREATE	team_member	4	Taylor Tucker added to team	{"teamId":2,"userId":24,"role":"member"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:15:40.419565
29	1	CREATE	team_member	5	Parke May added to team	{"teamId":2,"userId":22,"role":"member"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:15:46.25597
30	1	DELETE	team_member	\N	Admin User removed from team	{"teamId":2,"userId":1}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:15:49.932328
31	1	DELETE	team	1	Demo Production Team	{}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:15:53.005013
32	1	CREATE	team_member	6	Admin User added to team	{"teamId":2,"userId":1,"role":"member"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:16:21.626094
33	1	DELETE	team_member	\N	Admin User removed from team	{"teamId":2,"userId":1}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:16:53.098787
34	1	CREATE	team_member	7	Obed Sandoval added to team	{"teamId":2,"userId":6,"role":"member"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:30:53.910507
35	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:30:59.200305
38	6	LOGIN	authentication	6	User osandoval logged in	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:31:11.650971
39	6	LOGOUT	authentication	6	User osandoval logged out	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:35:02.163522
41	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:35:12.689535
42	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:37:23.989545
45	6	LOGIN	authentication	6	User osandoval logged in	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:37:47.300561
46	6	LOGOUT	authentication	6	User osandoval logged out	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:39:10.409185
48	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:39:22.59895
49	1	DELETE	team_member	\N	Obed Sandoval removed from team	{"teamId":2,"userId":6}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:41:35.276007
50	1	CREATE	team_member	8	Obed Test added to team	{"teamId":2,"userId":7,"role":"member"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:41:57.702712
51	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:41:59.646582
55	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:42:21.071282
56	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:42:41.590793
57	7	LOGIN	authentication	7	User Obedtest logged in	{"username":"Obedtest","name":"Obed Test","role":"producer","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:42:45.910708
58	7	LOGOUT	authentication	7	User Obedtest logged out	{"username":"Obedtest","name":"Obed Test","role":"producer","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:44:36.288862
59	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-03 14:44:41.765031
62	0	migration_completed	system	\N	Migration v1.5.2	{"migration":"v1.5.2","description":"Comprehensive audit logging enhancement completed","features":["Enhanced audit logging for user management","Template operations audit logging","Alert management audit logging","System configuration audit logging","Studio and PCR room management audit logging","Notification group management audit logging"],"completedAt":"2025-08-03T19:59:54.469Z"}	\N	\N	2025-08-03 14:59:54.390639
63	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"174.195.129.21"}	174.195.129.21	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-03 15:57:34.11274
64	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.197.65.66"}	174.197.65.66	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-03 21:20:04.127693
67	0	migration_completed	system	\N	Migration v1.5.2	{"migration":"v1.5.2","description":"Comprehensive audit logging enhancement completed","features":["Enhanced audit logging for user management","Template operations audit logging","Alert management audit logging","System configuration audit logging","Studio and PCR room management audit logging","Notification group management audit logging"],"completedAt":"2025-08-04T08:37:06.992Z"}	\N	\N	2025-08-04 03:37:06.915898
68	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-04 03:52:42.272518
70	6	LOGIN	authentication	6	User osandoval logged in	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-04 03:52:54.115736
71	6	DELETE	team_member	\N	Obed Test removed from team	{"teamId":2,"userId":7}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-04 03:53:18.287274
72	6	CREATE	team_member	9	Obed Sandoval added to team	{"teamId":2,"userId":6,"role":"member"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-04 03:53:22.852504
75	0	migration_completed	system	\N	Migration v1.5.2	{"migration":"v1.5.2","description":"Comprehensive audit logging enhancement completed","features":["Enhanced audit logging for user management","Template operations audit logging","Alert management audit logging","System configuration audit logging","Studio and PCR room management audit logging","Notification group management audit logging"],"completedAt":"2025-08-04T09:01:27.789Z"}	\N	\N	2025-08-04 04:01:27.721978
76	6	LOGOUT	authentication	6	User osandoval logged out	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-04 04:18:26.718119
77	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-04 04:18:34.163424
78	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 07:53:04.305478
79	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 08:14:36.656152
80	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 08:33:08.89107
81	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-04 09:23:39.251937
82	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0	2025-08-04 09:56:58.517731
83	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 10:00:48.317749
84	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-04 10:01:28.903689
85	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 10:40:09.249787
86	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 10:40:58.308596
87	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 12:45:49.21104
88	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 12:52:08.55238
89	23	DELETE	booking	514	(TENT) Mary Kay Project	{"deletedBookingIds":[514],"bookingTitle":"(TENT) Mary Kay Project","bookingType":"production","studioId":20,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 14:10:42.011471
90	23	DELETE	booking	515	(TENT) Mary Kay Project	{"deletedBookingIds":[515],"bookingTitle":"(TENT) Mary Kay Project","bookingType":"production","studioId":20,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 14:10:47.625583
91	23	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"(TENT) Trilogy: Think Branded Media Shoot CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"please reference Aug 8 booking for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 14:11:11.857701
92	23	UPDATE	booking	504	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"(TENT) Trilogy: Think Branded Media Shoot CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"please reference Aug 8 booking for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 14:11:38.399051
93	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15	2025-08-04 14:58:41.044452
94	23	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 15:39:33.040965
95	23	UPDATE	booking	504	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"please reference Aug 11 booking for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-04 15:39:59.986985
96	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-05 07:53:54.162616
97	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-05 09:41:03.685143
98	9	UPDATE	booking	500	Trilogy Publishing Programs	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":14,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Trilogy Publishing Programs","description":"Recording two or three 30 minute book author programs with Trilogy Publishing","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":14,"templateId":20,"pcrRoomId":null,"studioIds":[14]},"studioIds":[14],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-05 11:26:41.124337
100	26	LOGIN	authentication	26	User Steve Fjordbak logged in	{"username":"Steve Fjordbak","name":"STEVE FJORDBAK","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-05 11:39:21.92647
101	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-05 12:57:06.913927
102	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-05 13:53:32.110782
103	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-05 15:00:02.848491
104	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-05 16:12:27.720929
105	9	UPDATE	booking	480	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-05 16:50:06.837504
106	9	DELETE	booking	480	Better Together	{"deletedBookingIds":[480],"bookingTitle":"Better Together","bookingType":"production","studioId":6,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-05 16:51:19.531812
107	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.246.130.20"}	174.246.130.20	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-06 08:17:21.746377
108	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-06 09:13:46.115783
109	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-06 09:27:08.21701
110	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-06 09:28:44.005755
111	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-06 11:15:30.924267
112	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-06 13:56:10.762067
113	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-06 14:15:44.546865
114	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-06 14:47:26.586418
115	22	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"Additional info TBD\\n\\nProduction Company: Think Branded Media\\nTrilogy Onsite contact: Parke May\\nHaze Machine: NO\\nTrilogy Reception: Cristina Trejo\\n \\nAugust 11th: Prep Day ( hours)\\nEst Start time: \\nEst wrap time: \\nEst # of people: \\n \\n \\nAugust 12th: Shoot Day (10 hours)\\nEst Start time: \\nEst wrap time: \\nEst # of people:\\n \\nAttendee Names: \\nBeau W Ethridge\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-06 15:29:59.869875
116	22	CREATE	booking	553	CAR: TBN Rabbi Sobel Prep Day	{"bookingType":"setup","studioId":19,"studioIds":[19],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-06 15:44:51.261765
117	9	UPDATE	booking	556	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-06 16:24:28.809533
118	9	UPDATE	booking	557	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-06 16:25:20.480931
119	9	UPDATE	booking	558	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-06 16:25:30.990894
120	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-06 18:22:59.812341
121	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-07 08:34:46.622717
122	9	UPDATE	booking	489	Breaking Sunday School with Jason Sobel	{"originalBooking":{"title":"Breaking Sunday School with Jason Sobel","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Breaking Sunday School with Jason Sobel","description":"Set-up day","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":64,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-07 08:44:31.436201
123	9	UPDATE	booking	490	Breaking Sunday School with Jason Sobel	{"originalBooking":{"title":"Breaking Sunday School with Jason Sobel","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Breaking Sunday School with Jason Sobel","description":"Shoot day","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":64,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-07 08:44:39.411568
124	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-07 09:32:07.793191
125	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-07 09:40:30.147231
126	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-07 11:19:11.906883
127	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-07 14:09:29.159177
128	22	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"Additional info TBD\\n\\nProduction Company: Think Branded Media\\nTrilogy Onsite contact: Parke May\\nHaze Machine: NO\\nTrilogy Reception: Cristina Trejo\\n \\nAugust 11th: Prep Day ( hours)\\nEst Start time: 7AM\\nEst wrap time: \\nEst # of people: \\n \\n \\nAugust 12th: Shoot Day (10 hours)\\nEst Start time: 7AM\\nEst wrap time: \\nEst # of people:\\n \\nAttendee Names: \\nBeau W Ethridge\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-07 14:09:59.899939
129	22	UPDATE	booking	504	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"please reference Aug 11 booking for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-07 14:18:20.62455
130	22	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"Additional info TBD\\n\\nProduction Company: Think Branded Media\\nTrilogy Onsite contact: Parke May\\nHaze Machine: NO\\nTrilogy Reception: Cristina Trejo\\n \\nAugust 11th: Prep Day ( hours)\\nEst Start time: 7AM\\nEst wrap time: \\nEst # of people: \\n \\n \\nAugust 12th: Shoot Day (10 hours)\\nEst Start time: 7AM\\nEst wrap time: \\nEst # of people:\\n \\nAttendee Names: \\nBeau W Ethridge\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-07 14:18:30.135534
131	22	UPDATE	booking	504	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"please reference Aug 11 booking for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-07 15:09:44.685551
132	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-07 15:43:17.747579
133	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-08 02:32:57.788754
134	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-08 07:50:49.284482
135	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-08 08:33:18.571926
136	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-08 09:05:42.76141
677	16	CREATE	booking	640	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":6,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:35:02.542625
137	9	UPDATE	booking	227	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-08 10:24:28.142872
138	9	UPDATE	booking	228	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-08 10:24:38.917547
139	9	UPDATE	booking	229	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-08 10:24:54.685394
140	9	UPDATE	booking	231	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-08 10:25:43.711906
141	9	UPDATE	booking	232	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-08 10:26:11.417981
142	9	UPDATE	booking	530	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-08 10:26:29.277473
143	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-08 13:24:44.88892
144	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-08 14:28:47.539104
145	23	CREATE	booking	560	(TENT) The Korey with a K Show Production	{"bookingType":"production","studioId":3,"studioIds":[3,4,5,18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-08 14:30:21.627942
146	23	UPDATE	booking	560	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4,5,18]},"studioIds":[3,4,5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-08 14:31:46.742165
147	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-08 15:17:38.480412
148	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"199.115.166.110"}	199.115.166.110	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-08 19:23:10.398545
149	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-08 23:24:07.91033
150	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-08 23:25:55.879436
151	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"107.212.15.36"}	107.212.15.36	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-10 16:55:48.055945
170	6	LOGOUT	authentication	6	User osandoval logged out	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 15:16:05.681894
198	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-13 10:22:05.999359
678	16	CREATE	booking	641	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:36:09.732854
152	22	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"\\nProduction Company: Think Branded Media\\nTrilogy Onsite contact: Parke May\\nHaze Machine: NO\\nTrilogy Reception: Cameron Wadsworth\\n \\nAugust 11th: Prep Day (10 hours)\\nEst Start time: 7AM\\nEst wrap time: 5PM\\nEst # of people: 10\\n \\n \\nAugust 12th: Shoot Day (12 hours)\\nEst Start time: 7AM\\nEst wrap time: 7PM\\nEst # of people: 19\\n \\nAttendee Names: \\nBeau W Ethridge\\nVince Monsaint\\nJT Huffer\\nJoey Huffer\\nWinona Wenying Yu\\nConor Mooney\\nPate Sanders\\nDaniel Nanasi\\nCody Gray\\nBobby Kurtz\\nMatt Aslan\\nLorenzo Torres\\nDylan Ngyuen\\nElainia Eads\\n\\nJosh Ewing\\nJaime\\nCarrie\\nElle\\nOgi","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	107.212.15.36	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-10 16:56:13.149069
153	22	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"\\nProduction Company: Think Branded Media\\nTrilogy Onsite contact: Parke May\\nHaze Machine: NO\\nTrilogy Reception: Cameron Wadsworth\\n \\nAugust 11th: Prep Day (10 hours)\\nEst Start time: 7AM\\nEst wrap time: 5PM\\nEst # of people: 10\\n \\n \\nAugust 12th: Shoot Day (12 hours)\\nEst Start time: 7AM\\nEst wrap time: 7PM\\nEst # of people: 19\\n \\nAttendee Names: \\nBeau W Ethridge\\nVince Monsaint\\nJT Huffer\\nJoey Huffer\\nWinona Wenying Yu\\nConor Mooney\\nPate Sanders\\nDaniel Nanasi\\nCody Gray\\nBobby Kurtz\\nMatt Aslan\\nLorenzo Torres\\nDylan Ngyuen\\nElainia Eads\\n\\nBelow are the CAT Team Members who will show up Tuesday. Last names have been requested.\\nJosh Ewing\\nJaime\\nCarrie\\nElle\\nOgi","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	107.212.15.36	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-10 17:05:01.566182
154	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.130.197.86"}	107.130.197.86	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-10 22:11:48.320696
155	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 08:54:41.834911
156	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-11 09:02:22.458281
157	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-11 09:05:10.324059
158	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 09:10:59.843906
159	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 10:59:10.105264
160	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 11:00:08.603412
161	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-11 11:46:40.535699
162	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-11 12:10:15.200177
164	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 14:35:03.941913
165	9	UPDATE	booking	500	Trilogy Publishing Programs	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":14,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Trilogy Publishing Programs","description":"Recording two or three 30 minute book author programs with Trilogy Publishing","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":1,"templateId":20,"pcrRoomId":65,"studioIds":[1,2]},"studioIds":[1,2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-11 15:04:15.934348
166	9	UPDATE	booking	500	Trilogy Publishing Programs	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Trilogy Publishing Programs","description":"Recording two or three 30 minute book author programs with Trilogy Publishing","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":1,"templateId":20,"pcrRoomId":65,"studioIds":[1,2]},"studioIds":[1,2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-11 15:04:25.197278
167	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 15:15:40.090336
169	6	LOGIN	authentication	6	User osandoval logged in	{"username":"osandoval","name":"Obed Sandoval","role":"site_manager","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-11 15:15:51.358652
175	22	UPDATE	booking	503	SHOOT: Think Branded Media CAT	{"originalBooking":{"title":"SHOOT: Think Branded Media CAT","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SHOOT: Think Branded Media CAT","description":"\\nProduction Company: Think Branded Media\\nTrilogy Onsite contact: Parke May\\nHaze Machine: NO\\nTrilogy Reception: Cameron Wadsworth\\n \\nAugust 11th: Prep Day (10 hours)\\nEst Start time: 7AM\\nEst wrap time: 5PM\\nEst # of people: 10\\n \\n \\nAugust 12th: Shoot Day (12 hours)\\nEst Start time: 6:45AM\\nEst wrap time: 7PM\\nEst # of people: 19\\n \\nAttendee Names: \\nBeau W Ethridge\\nVince Monsaint\\nJT Huffer\\nJoey Huffer\\nWinona Wenying Yu\\nConor Mooney\\nPate Sanders\\nDaniel Nanasi\\nCody Gray\\nBobby Kurtz\\nMatt Aslan\\nLorenzo Torres\\nDylan Ngyuen\\nElainia Eads\\n\\nBelow are the CAT Team Members who will show up Tuesday. \\n\\nJosh Ewing\\nJaime Mineart\\nCarrie Wallendal\\nElle Auer\\nOgi Rezic\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-11 16:44:40.743069
176	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-11 17:03:29.089221
177	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-12 08:41:28.483081
178	9	UPDATE	booking	500	Trilogy Publishing Programs	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Trilogy Publishing Programs","description":"Recording two or three 30 minute book author programs with Trilogy Publishing. Hosted by Blynda Lane.","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":1,"templateId":20,"pcrRoomId":65,"studioIds":[1,2]},"studioIds":[1,2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-12 09:18:11.065114
179	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-12 09:58:57.517222
180	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-12 10:15:41.806859
181	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-12 10:35:02.387915
182	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-12 11:05:58.508267
183	9	UPDATE	booking	576	KLove Fan Awards Rewind	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"KLove Fan Awards Rewind","description":"Hosted by Blynda Lane.","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":65,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-12 13:48:09.057292
185	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-12 16:28:52.949515
186	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-12 16:32:05.886898
187	27	LOGIN	authentication	27	User obedview logged in	{"username":"obedview","name":"Obed Viewer","role":"viewer","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-12 16:32:11.322721
188	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-12 18:17:15.224967
191	0	migration_completed	system	\N	Migration v1.5.2	{"migration":"v1.5.2","description":"Comprehensive audit logging enhancement completed","features":["Enhanced audit logging for user management","Template operations audit logging","Alert management audit logging","System configuration audit logging","Studio and PCR room management audit logging","Notification group management audit logging"],"completedAt":"2025-08-13T07:34:14.282Z"}	\N	\N	2025-08-13 02:34:14.202298
192	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-13 02:35:23.310131
195	0	migration_completed	system	\N	Migration v1.5.2	{"migration":"v1.5.2","description":"Comprehensive audit logging enhancement completed","features":["Enhanced audit logging for user management","Template operations audit logging","Alert management audit logging","System configuration audit logging","Studio and PCR room management audit logging","Notification group management audit logging"],"completedAt":"2025-08-13T07:57:03.145Z"}	\N	\N	2025-08-13 02:57:03.082187
196	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-13 08:24:42.999102
197	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-13 10:02:58.859349
985	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.2.82"}	10.81.2.82	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-21 07:03:57.260849
199	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-13 10:34:34.431936
200	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-13 10:38:57.916886
201	9	UPDATE	booking	368	TCL Boxing 	{"originalBooking":{"title":"TCL Boxing ","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"TCL Boxing ","description":"Boxing ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#77bb41","studioId":3,"templateId":21,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-13 11:04:27.428466
202	9	UPDATE	booking	499	TCL Boxing 	{"originalBooking":{"title":"TCL Boxing ","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"TCL Boxing ","description":"Boxing ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#77bb41","studioId":3,"templateId":21,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-13 11:04:47.877078
203	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-13 12:15:01.938048
204	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-13 12:36:13.346015
205	9	UPDATE	booking	227	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-13 13:06:41.987021
206	9	UPDATE	booking	530	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-13 15:57:48.871932
207	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-13 16:01:43.082071
208	22	UPDATE	booking	443	Rabbi Jason Sobel Shoot - TBN	{"originalBooking":{"title":"Rabbi Jason Sobel Shoot - TBN","type":"production","studioId":19,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Rabbi Jason Sobel Shoot - TBN","description":"Rabbi Jason Sobel shoot - Set day\\n\\nProduction Company: TBN\\nTrilogy Onsite contact: Sara Joyner & Parke May\\nHaze Machine: YES\\nTrilogy Reception: Cameron Wadsworth\\n\\nCall times 8:30am-5:30pm all Production Days\\n\\nMonday, 8/18/25\\n\\nAiden Franklin\\nElizabeth Suter\\nNick Foster\\nBrenner Sherrard\\nScott LaCroix\\nElisea Betancourt\\nGrace Woodward\\nLindsay Stewart\\n\\nGuest - Pastor Allen Jackson and assistant\\nHost - Rabbi Jason Sobel and his manager, Ted Squires\\n \\n\\nTuesday, 8/19/2025\\n\\nAiden Franklin\\n\\nElizabeth Suter\\nNick Foster\\nSam Baker\\nAustin Hines\\nScott LaCroix\\nElisea Betancourt\\nScarlett DeMoss\\nBrenner Sherrard\\nGrace Woodward\\nAshley Andrews\\nAandrews@tbn.tv\\nBrian Gandy\\nBGandy@tbn.tv\\nKevin Gandy\\nMarcus Olivas\\nLindsay Stewart\\nJacob Dapar\\nBriana Tyson\\nSalange Shepard\\n \\nGuest - Nicole C and her manager, Karen Brockington\\nHost - Rabbi Jason Sobel and his manager, Ted Squires\\n \\nWednesday, 8/20/2025\\n\\nAiden Franklin\\nElizabeth Suter\\nNick Foster\\nSam Baker\\nAustin Hines\\nScott LaCroix\\nElisea Betancourt\\nScarlett DeMoss\\nBrenner Sherrard\\nGrace Woodard\\nAshley Andrews\\nBrian Gandy\\nKevin Gandy\\nMarcus Olivas\\nLindsay Stewart\\nCassandra Ortega\\n\\nThursday, 8/21/2025\\n\\nAiden Franklin\\nElizabeth Suter\\nNick Foster\\nSam Baker\\nAustin Hines\\nScott LaCroix\\nElisea Betancourt\\nScarlett DeMoss\\nBrenner Sherrard\\nGrace Woodward\\nAshley Andrews\\nBrian Gandy\\nKevin Gandy\\nMarcus Olivas\\nLindsay Stewart\\n\\nGuest - GUEST and assistant\\nHost - Rabbi Jason Sobel and his manager, Ted Squires\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19]},"studioIds":[19],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-13 16:14:11.127974
209	22	UPDATE	booking	261	Rabbi Jason Sobel Shoot - TBN	{"originalBooking":{"title":"Rabbi Jason Sobel Shoot - TBN","type":"production","studioId":19,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Rabbi Jason Sobel Shoot - TBN","description":"Please refer to 8/18 for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19]},"studioIds":[19],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-13 16:14:36.845182
210	22	UPDATE	booking	262	Rabbi Jason Sobel Shoot - TBN	{"originalBooking":{"title":"Rabbi Jason Sobel Shoot - TBN","type":"production","studioId":19,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Rabbi Jason Sobel Shoot - TBN","description":"Please refer to 8/18 for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19]},"studioIds":[19],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-13 16:14:45.064581
211	22	UPDATE	booking	263	Rabbi Jason Sobel Shoot - TBN	{"originalBooking":{"title":"Rabbi Jason Sobel Shoot - TBN","type":"production","studioId":19,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Rabbi Jason Sobel Shoot - TBN","description":"Please refer to 8/18 for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19]},"studioIds":[19],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-13 16:15:01.356635
212	22	UPDATE	booking	262	Rabbi Jason Sobel Shoot - TBN	{"originalBooking":{"title":"Rabbi Jason Sobel Shoot - TBN","type":"production","studioId":19,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Rabbi Jason Sobel Shoot - TBN","description":"Please refer to 8/18 for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19]},"studioIds":[19],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-13 16:15:13.977808
213	22	UPDATE	booking	261	Rabbi Jason Sobel Shoot - TBN	{"originalBooking":{"title":"Rabbi Jason Sobel Shoot - TBN","type":"production","studioId":19,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Rabbi Jason Sobel Shoot - TBN","description":"Please refer to 8/18 for details","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19]},"studioIds":[19],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-13 16:15:30.855998
214	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"166.199.242.127"}	166.199.242.127	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-14 07:58:03.165321
215	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-14 08:40:50.440043
216	19	LOGOUT	authentication	19	User sblack logged out	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-14 09:39:25.151907
217	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"104.28.50.135"}	104.28.50.135	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-14 09:40:14.852161
218	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-14 10:36:13.716044
219	23	CREATE	booking	581	Trilogy Intern Project Production	{"bookingType":"production","studioId":20,"studioIds":[20],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-14 10:37:53.731845
220	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-14 10:49:19.335126
221	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-14 11:36:22.351495
222	13	LOGIN	authentication	13	User dobryan logged in	{"username":"dobryan","name":"Dalin OBryan","role":"engineer","ipAddress":"64.58.141.194"}	64.58.141.194	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-14 12:41:29.382225
223	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-14 12:49:42.453958
224	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-14 13:23:48.425283
225	9	UPDATE	booking	576	KLove Fan Awards Rewind	{"originalBooking":{"title":"KLove Fan Awards Rewind","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"KLove Fan Awards Rewind","description":"Hosted by Blynda Lane.","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":65,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-14 13:33:19.376475
226	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-14 13:46:26.898711
227	9	DELETE	booking	230	SFC	{"deletedBookingIds":[230],"bookingTitle":"SFC","bookingType":"production","studioId":9,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-14 13:46:45.594886
228	9	UPDATE	booking	530	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-14 13:46:58.722818
229	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-14 15:00:00.105859
230	9	UPDATE	booking	451	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-14 15:51:52.317123
231	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-14 21:36:25.189321
232	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15	2025-08-15 09:34:08.199145
233	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-15 09:38:12.290893
234	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 11:46:43.28083
235	9	CREATE	booking	583	5 Minutes with Jesus	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":20,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 11:47:56.41015
236	9	UPDATE	booking	474	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 12:07:58.861767
237	9	UPDATE	booking	475	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 12:08:06.666106
238	9	UPDATE	booking	500	Trilogy Publishing Programs	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Trilogy Publishing Programs","description":"Recording two or three 30 minute book author programs with Trilogy Publishing. Hosted by Blynda Lane.","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":1,"templateId":20,"pcrRoomId":65,"studioIds":[1,2]},"studioIds":[1,2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 12:25:02.744012
239	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"174.244.21.39"}	174.244.21.39	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-08-15 13:10:20.272271
240	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-15 13:37:51.115972
241	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-15 14:34:24.518765
242	9	CREATE	booking	584	Stakelbeck Tonight	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 14:35:13.30304
243	9	UPDATE	booking	585	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"We will still have our normal production schedule on the following days. However, we'll also need to pop into a hit studio for quick hits that aren't within our scheduled production time. Is it possible to use studio P next week during the following dates/times? \\n\\n8/20 11 AM (10-15 minutes) \\n8/21 9:30 AM (approximately 20-35 mins) ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":8,"templateId":6,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 14:35:44.058081
244	9	UPDATE	booking	452	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 14:35:56.31814
245	9	UPDATE	booking	584	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"We will still have our normal production schedule on the following days. However, we'll also need to pop into a hit studio for quick hits that aren't within our scheduled production time. Is it possible to use studio P next week during the following dates/times? \\n\\n8/20 11 AM (10-15 minutes) \\n8/21 9:30 AM (approximately 20-35 mins) ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":8,"templateId":6,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-15 14:36:05.328569
246	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-15 15:45:59.61987
248	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-15 15:51:30.486437
249	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-15 16:30:54.585364
250	8	LOGIN	authentication	8	User DHarvilla logged in	{"username":"DHarvilla","name":"David Harvilla","role":"it","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0	2025-08-15 18:27:18.858507
251	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-16 12:20:18.248963
252	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"47.161.47.137"}	47.161.47.137	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-17 13:09:02.892523
253	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.130.197.86"}	107.130.197.86	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-18 06:43:57.472177
254	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-18 07:52:19.597932
255	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-18 07:53:01.367569
256	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-18 08:15:40.640016
257	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-18 08:56:50.052441
258	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-18 09:36:07.28977
259	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-18 10:07:11.983866
260	9	UPDATE	booking	227	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-18 16:53:20.983853
261	9	UPDATE	booking	586	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-18 16:54:22.336873
262	9	UPDATE	booking	228	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-18 16:54:34.405413
263	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"108.147.171.131"}	108.147.171.131	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-19 07:37:53.492805
264	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-19 08:35:27.95235
265	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-19 08:40:43.028414
266	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-19 09:13:01.641815
267	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0	2025-08-19 09:33:24.760314
268	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-19 11:23:37.325154
269	23	CREATE	booking	587	Trilogy: DP Workshop	{"bookingType":"other","studioId":21,"studioIds":[21,19,20,18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-19 11:25:04.256337
300	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-21 16:13:20.085
302	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"172.6.117.81"}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-21 20:48:36.545989
270	23	UPDATE	booking	587	Trilogy: DP Workshop	{"originalBooking":{"title":"Trilogy: DP Workshop","type":"other","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Trilogy: DP Workshop","description":"Overview: Trilogy Studios is hosting a workshop for DPs/ Cinematographers in the area. This is a ticketed only event, capped at 40 individuals attending the class. \\nTrilogy POC: Sara & Taylor \\nHaze Machine: TBD \\n\\nFriday Sept 12th: Prep Day \\nSmall group of crew onsite to prep scenes/ stages \\nEst start time: 9am \\nWrap time: 5pm \\nEst # of people: 15\\nNames: TBD \\n\\nSaturday Sept 13th: Workshop Day \\nDoors Open to attendees: 9:30am \\nEvent start time: 10am \\nWelcome/ Trilogy Presentation/ Shine Cine: 10:15am\\nSplit to groups A & B: 10:30am\\nLunch: 12:30pm \\nSwap groups A & B: 1:30pm \\nEst attendee wrap: 4pm \\nCrew wrap out: 5pm\\nEst # of People: 50 \\nNames: TBD ","type":"other","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19,20,18,21]},"studioIds":[19,20,18,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-19 11:25:20.617804
271	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-19 12:19:45.549582
272	9	CREATE	booking	589	MRO Segments with Blynda	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":20,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-19 12:22:08.908785
273	9	UPDATE	booking	589	MRO Segments with Blynda	{"originalBooking":{"title":"MRO Segments with Blynda","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MRO Segments with Blynda","description":"Start time 10:45am","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-19 12:27:25.354071
274	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-19 13:44:50.097208
275	9	UPDATE	booking	476	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-19 15:48:52.295899
276	9	UPDATE	booking	580	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-19 15:49:02.952273
277	9	CREATE	booking	590	Segments with Pastor D	{"bookingType":"production","studioId":3,"studioIds":[3],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":20,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-19 15:49:16.488257
278	9	UPDATE	booking	476	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-19 15:49:29.932815
279	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-20 06:17:58.395081
280	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"108.147.171.100"}	108.147.171.100	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-20 08:26:57.458597
281	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-20 08:36:25.931009
282	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-20 09:22:29.099877
283	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-20 13:53:22.004832
284	9	CREATE	booking	591	Vinia Segments	{"bookingType":"production","studioId":3,"studioIds":[3,1,2,4,5],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":20,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-20 13:54:31.784024
301	9	UPDATE	booking	589	MRO Segments with Blynda	{"originalBooking":{"title":"MRO Segments with Blynda","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MRO Segments with Blynda","description":"Start time 10:45am","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":1,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-21 17:01:50.932452
285	9	UPDATE	booking	585	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"We will still have our normal production schedule on the following days. However, we'll also need to pop into a hit studio for quick hits that aren't within our scheduled production time. Is it possible to use studio P next week during the following dates/times? \\n\\n8/20 11 AM (10-15 minutes) \\n8/21 9:30 AM (approximately 20-35 mins) ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":8,"templateId":6,"pcrRoomId":null,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-20 15:27:05.650772
286	9	UPDATE	booking	478	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-20 15:30:27.178316
287	9	UPDATE	booking	585	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"We will still have our normal production schedule on the following days. However, we'll also need to pop into a hit studio for quick hits that aren't within our scheduled production time. Is it possible to use studio P next week during the following dates/times? \\n\\n8/20 11 AM (10-15 minutes) \\n8/21 9:30 AM (approximately 20-35 mins) ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":8,"templateId":6,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-20 15:30:38.581092
288	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-20 15:36:52.307612
289	9	UPDATE	booking	564	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-20 16:11:22.403804
290	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-20 16:31:48.510761
291	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"104.28.50.173"}	104.28.50.173	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-21 05:31:12.868118
292	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-21 09:57:43.371544
293	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-21 10:14:29.776824
294	9	CREATE	booking	600	test	{"bookingType":"production","studioId":3,"studioIds":[3],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-21 12:40:17.397311
295	9	DELETE	booking	600	test	{"deletedBookingIds":[600],"bookingTitle":"test","bookingType":"production","studioId":3,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-21 12:40:59.90859
296	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-21 12:47:22.953795
297	9	CREATE	booking	601	Better Together	{"bookingType":"production","studioId":17,"studioIds":[17],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-21 12:52:18.445819
298	9	UPDATE	booking	601	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":17,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"Hi All,\\nIn Hit Studio Q, could we get the robo camera up (and the hallway monitor) up for a little test around 2PM on 8.25.25?\\nWe don’t need audio or comms.\\n \\nLet me know,\\nLauran","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#9929bd","studioId":17,"templateId":null,"pcrRoomId":null,"studioIds":[17]},"studioIds":[17],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-21 12:52:36.576136
299	9	UPDATE	booking	601	Better Together - Robo Test	{"originalBooking":{"title":"Better Together","type":"production","studioId":17,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together - Robo Test","description":"Hi All,\\nIn Hit Studio Q, could we get the robo camera up (and the hallway monitor) up for a little test around 2PM on 8.25.25?\\nWe don’t need audio or comms.\\n \\nLet me know,\\nLauran","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#9929bd","studioId":17,"templateId":null,"pcrRoomId":null,"studioIds":[17]},"studioIds":[17],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-21 12:53:09.214049
303	16	UPDATE	booking	229	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler\\nLIVE @ 11:30 AM - 2:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":9,"templateId":null,"pcrRoomId":64,"studioIds":[9,12]},"studioIds":[9,12],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-21 20:49:08.967867
304	16	UPDATE	booking	586	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler\\nLIVE @ 11:30 AM - 2:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-21 20:49:25.399711
305	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-22 08:01:33.856539
306	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-22 09:31:14.441692
307	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-22 09:58:30.868383
308	9	UPDATE	booking	500	Trilogy Publishing Programs	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Trilogy Publishing Programs","description":"Recording two or three 30 minute book author programs with Trilogy Publishing. Hosted by Blynda Lane.\\nGlass green room and news makeup room.","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":1,"templateId":20,"pcrRoomId":65,"studioIds":[1,2]},"studioIds":[1,2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-22 11:48:51.663867
309	9	UPDATE	booking	500	Trilogy Publishing Programs	{"originalBooking":{"title":"Trilogy Publishing Programs","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Trilogy Publishing Programs","description":"Recording two or three 30 minute book author programs with Trilogy Publishing. Hosted by Blynda Lane.\\nGlass green room and news makeup room.\\n11:30am - Blynda arrival for hair/makeup","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":1,"templateId":20,"pcrRoomId":65,"studioIds":[1,2]},"studioIds":[1,2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-22 11:50:56.591155
310	9	UPDATE	booking	481	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[9,7],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-22 12:19:22.967249
311	9	UPDATE	booking	490	Breaking Sunday School with Jason Sobel	{"originalBooking":{"title":"Breaking Sunday School with Jason Sobel","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Breaking Sunday School with Jason Sobel","description":"Shoot day","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":64,"studioIds":[5,23]},"studioIds":[5,23],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-22 12:20:11.724174
312	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-22 13:56:08.963895
313	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-22 14:38:10.63513
317	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0	2025-08-22 15:29:31.895979
318	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-22 15:47:21.888866
321	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.224"}	192.168.1.224	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-23 00:06:32.145921
322	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-23 10:58:19.794469
323	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-24 00:33:26.984008
324	10	LOGIN	authentication	10	User ddigello logged in	{"username":"ddigello","name":"Daniel DiGello","role":"it","ipAddress":"76.33.161.156"}	76.33.161.156	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.7258.76 Mobile/15E148 Safari/604.1	2025-08-24 11:06:52.242457
325	10	LOGOUT	authentication	10	User ddigello logged out	{"username":"ddigello","name":"Daniel DiGello","role":"it","ipAddress":"76.33.161.156"}	76.33.161.156	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.7258.76 Mobile/15E148 Safari/604.1	2025-08-24 11:18:32.091105
326	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"199.115.166.110"}	199.115.166.110	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-24 11:22:26.603338
327	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"172.225.19.25"}	172.225.19.25	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-25 06:33:56.350196
328	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-25 08:09:18.36562
329	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 08:43:06.674049
330	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-25 08:58:36.190158
331	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-25 08:58:41.427609
332	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 09:01:20.287076
333	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-08-25 10:07:32.761348
334	9	UPDATE	booking	473	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Blynda Lane","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 10:19:01.843765
335	9	UPDATE	booking	464	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Blynda Lane","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 10:19:10.888243
336	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-25 10:22:27.736186
337	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 11:21:43.802135
338	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 11:33:46.044064
339	9	CREATE	booking	602	Man Camp Cincinnati	{"bookingType":"production","studioId":13,"studioIds":[13],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":14,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 11:34:51.881989
340	9	UPDATE	booking	603	Man Camp Cincinnati	{"originalBooking":{"title":"Man Camp Cincinnati","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Man Camp Cincinnati","description":"Talent:\\nMatt Crouch, Brian Tome, Bear Grylls (Possibly Laurie as well)\\n\\nOther info:\\nhttps://www.mancamp.us/\\n\\nLocation:\\n45 minutes from Cincinnati (not sure which direction).  Airport is Cincinnati (CVG).\\n\\nDates/Rough schedule:\\n(Note-this is the week after the Dove Awards)\\nOct 15 (WED) travel and potential set up\\nOct 16 (THUR) main production day for full set up\\nOct 17 (FRI) Reduced crew stays for b-roll, etc of camp\\nOct 18 (SAT) Reduced crew stays for b-roll, etc of camp\\n\\nGear/Crew notes:\\nAs the location is a 4 to 5 hour drive from Hendersonville/Nashville the gear will come from there.\\nMost crew from Nashville, open to Dallas as well.  \\nNashville crew might want to drive as it would ultimately be faster than flying.  Also, no morning direct flights available between BNA and CVG.","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#aa7942","studioId":13,"templateId":14,"pcrRoomId":null,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 11:35:25.025674
354	9	UPDATE	booking	591	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-26 15:22:06.670181
373	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"97.176.82.133"}	97.176.82.133	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-08-28 08:00:44.43551
341	9	UPDATE	booking	604	Man Camp Cincinnati	{"originalBooking":{"title":"Man Camp Cincinnati","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Man Camp Cincinnati","description":"Talent:\\nMatt Crouch, Brian Tome, Bear Grylls (Possibly Laurie as well)\\n\\nOther info:\\nhttps://www.mancamp.us/\\n\\nLocation:\\n45 minutes from Cincinnati (not sure which direction).  Airport is Cincinnati (CVG).\\n\\nDates/Rough schedule:\\n(Note-this is the week after the Dove Awards)\\nOct 15 (WED) travel and potential set up\\nOct 16 (THUR) main production day for full set up\\nOct 17 (FRI) Reduced crew stays for b-roll, etc of camp\\nOct 18 (SAT) Reduced crew stays for b-roll, etc of camp\\n\\nGear/Crew notes:\\nAs the location is a 4 to 5 hour drive from Hendersonville/Nashville the gear will come from there.\\nMost crew from Nashville, open to Dallas as well.  \\nNashville crew might want to drive as it would ultimately be faster than flying.  Also, no morning direct flights available between BNA and CVG.","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#aa7942","studioId":13,"templateId":14,"pcrRoomId":null,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 11:35:30.617139
342	9	UPDATE	booking	605	Man Camp Cincinnati	{"originalBooking":{"title":"Man Camp Cincinnati","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Man Camp Cincinnati","description":"Talent:\\nMatt Crouch, Brian Tome, Bear Grylls (Possibly Laurie as well)\\n\\nOther info:\\nhttps://www.mancamp.us/\\n\\nLocation:\\n45 minutes from Cincinnati (not sure which direction).  Airport is Cincinnati (CVG).\\n\\nDates/Rough schedule:\\n(Note-this is the week after the Dove Awards)\\nOct 15 (WED) travel and potential set up\\nOct 16 (THUR) main production day for full set up\\nOct 17 (FRI) Reduced crew stays for b-roll, etc of camp\\nOct 18 (SAT) Reduced crew stays for b-roll, etc of camp\\n\\nGear/Crew notes:\\nAs the location is a 4 to 5 hour drive from Hendersonville/Nashville the gear will come from there.\\nMost crew from Nashville, open to Dallas as well.  \\nNashville crew might want to drive as it would ultimately be faster than flying.  Also, no morning direct flights available between BNA and CVG.","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#aa7942","studioId":13,"templateId":14,"pcrRoomId":null,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 11:35:36.675871
343	16	UPDATE	booking	590	Segments with Pastor D	{"originalBooking":{"title":"Segments with Pastor D","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Segments with Pastor D","description":"Studio B - shooting into Studio C","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":1,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-25 14:05:48.902584
344	9	UPDATE	booking	576	KLove Fan Awards Rewind	{"originalBooking":{"title":"KLove Fan Awards Rewind","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"KLove Fan Awards Rewind","description":"Hosted by Blynda Lane.","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":65,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-25 15:24:33.430641
345	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 15:39:59.725565
346	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"99.30.168.76"}	99.30.168.76	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-25 22:03:43.083833
347	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-26 09:18:57.515166
348	9	UPDATE	booking	576	KLove Fan Awards Rewind	{"originalBooking":{"title":"KLove Fan Awards Rewind","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"KLove Fan Awards Rewind","description":"Hosted by Blynda Lane.","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":65,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-26 09:19:16.891271
349	9	UPDATE	booking	564	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"cancelled"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-26 09:20:28.398903
350	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-26 10:56:59.4678
351	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-26 11:45:14.370663
352	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-26 14:47:41.313083
353	9	DELETE	booking	592	Vinia Segments	{"deletedBookingIds":[592],"bookingTitle":"Vinia Segments","bookingType":"production","studioId":3,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-26 15:21:59.106312
355	9	UPDATE	booking	593	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-26 15:22:15.584476
356	9	CREATE	booking	606	SFC Awards Show	{"bookingType":"production","studioId":5,"studioIds":[5,23],"startTime":{},"endTime":{},"pcrRoomId":64,"templateId":15,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-26 15:28:21.590623
357	23	LOGIN	authentication	23	User sarajoyner66 logged in	{"username":"sarajoyner66","name":"Sara Joyner","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-26 15:39:17.086825
358	23	CREATE	booking	607	(TENT) TBN Client	{"bookingType":"production","studioId":20,"studioIds":[20],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-26 15:40:08.083392
359	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.130.197.86"}	107.130.197.86	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-26 20:37:24.134158
360	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-27 08:37:15.604305
361	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 09:28:29.593827
362	9	UPDATE	booking	474	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 09:28:39.465339
363	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-08-27 10:49:32.057782
364	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-27 14:32:25.704146
365	9	UPDATE	booking	591	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 16:07:12.499986
366	9	UPDATE	booking	593	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 16:07:21.884501
367	9	UPDATE	booking	593	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"cancelled"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 16:07:33.032106
368	9	CREATE	booking	608	Praise	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":8,"linkedGroupId":null,"notifyList":[9,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 16:09:22.958781
369	9	UPDATE	booking	608	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Praise","description":"M&L hosting Cody Johnson","type":"production","status":"tentative","start":{},"end":{},"notifyList":[9,7],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 16:09:32.418674
370	9	UPDATE	booking	608	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Praise","description":"M&L hosting Cody Johnson","type":"production","status":"tentative","start":{},"end":{},"notifyList":[9,7],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-27 16:51:19.395583
372	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-28 02:31:09.399931
394	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-29 15:54:14.824259
374	9	UPDATE	booking	475	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-28 08:47:18.212004
375	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-28 10:20:50.772641
376	9	UPDATE	booking	591	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-28 10:21:02.470851
377	9	UPDATE	booking	608	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Praise","description":"M&L hosting Cody Johnson\\nM&L hosting Erwin McManus","type":"production","status":"tentative","start":{},"end":{},"notifyList":[9,7],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-28 10:22:39.780849
378	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.54"}	192.168.1.54	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-28 10:28:22.4846
379	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.54"}	192.168.1.54	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-28 10:29:15.187263
380	16	UPDATE	booking	476	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch - VO FROM CA ","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-28 11:24:32.203567
381	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-28 14:54:09.259976
382	9	UPDATE	booking	608	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Praise","description":"M&L hosting Cody Johnson (confirmed)\\nM&L hosting Erwin McManus (tentative)","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[9,7],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-28 14:55:21.793776
383	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.246.103.61"}	174.246.103.61	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-08-28 15:23:34.139654
384	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"172.6.117.81"}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-28 15:43:58.091356
385	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-28 15:59:40.549657
386	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"174.236.99.241"}	174.236.99.241	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-28 23:27:52.606698
387	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"97.176.82.133"}	97.176.82.133	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-29 05:48:16.459843
388	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-29 08:16:50.848696
389	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-29 08:18:32.552214
390	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-08-29 10:22:33.833871
392	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-29 12:24:21.733045
393	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-08-29 15:39:33.141174
395	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-08-29 16:10:40.45606
396	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-08-31 09:14:55.990994
397	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-31 09:46:18.316575
398	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-08-31 10:16:38.743083
399	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.100.1"}	192.168.100.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-08-31 12:03:03.766159
400	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-08-31 13:31:12.639426
401	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-02 07:58:31.093901
403	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-09-02 08:48:07.238944
406	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 08:49:17.63228
407	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.100.1"}	192.168.100.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-09-02 09:15:21.184092
408	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-02 09:15:59.248369
409	9	CREATE	booking	609	Praise (Plex)	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":8,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-02 09:18:36.999589
410	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-02 09:41:42.666054
411	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-02 10:02:06.3667
412	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-02 11:16:54.693447
413	9	UPDATE	booking	608	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"Sheila Walsh hosting Erwin McManus","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-02 11:17:31.519524
415	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-02 11:21:40.635024
416	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-02 17:38:44.63522
417	16	UPDATE	booking	593	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-02 17:38:58.707315
418	16	UPDATE	booking	591	Vinia Segments	{"originalBooking":{"title":"Vinia Segments","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Vinia Segments","description":"More details to come","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-02 17:39:05.483521
419	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-03 08:19:46.159226
420	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-09-03 08:55:55.744279
421	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-03 09:56:52.588168
422	9	UPDATE	booking	537	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-03 10:05:56.459097
423	9	UPDATE	booking	538	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-03 10:06:08.499427
424	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-03 13:22:37.295041
425	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-03 21:36:06.869982
426	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.130.197.86"}	107.130.197.86	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-04 08:26:33.429163
427	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-04 10:04:06.535167
428	9	UPDATE	booking	608	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"12:00pm Sheila Walsh hosting Erwin McManus","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-04 10:04:19.886981
429	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-04 10:05:44.685381
432	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-04 11:29:43.59034
433	9	UPDATE	booking	489	Breaking Sunday School with Jason Sobel	{"originalBooking":{"title":"Breaking Sunday School with Jason Sobel","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Breaking Sunday School with Jason Sobel","description":"Set-up day","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":64,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-04 15:41:10.708149
434	9	UPDATE	booking	490	Breaking Sunday School with Jason Sobel	{"originalBooking":{"title":"Breaking Sunday School with Jason Sobel","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Breaking Sunday School with Jason Sobel","description":"Shoot day","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":64,"studioIds":[5,23]},"studioIds":[5,23],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-04 15:41:19.971986
435	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-05 09:26:24.26455
436	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-05 09:28:02.086552
437	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-05 10:11:57.393176
438	16	UPDATE	booking	541	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-05 10:12:14.223251
439	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 10:53:45.828081
440	9	UPDATE	booking	609	Praise	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"M&L hosting both programs\\n12:00pm Mark Batterson Praise (confirming new updated time with Mark’s team)\\n1:30pm - Cody Jefferson Praise","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 10:54:39.793454
441	9	UPDATE	booking	566	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 11:01:52.89667
442	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-05 12:04:06.236128
443	22	CREATE	booking	610	TBN Promo Shoot	{"bookingType":"production","studioId":21,"studioIds":[21,18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-05 12:05:32.425139
444	22	UPDATE	booking	610	TBN Promo Shoot	{"originalBooking":{"title":"TBN Promo Shoot","type":"production","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"TBN Promo Shoot","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-05 12:05:54.001681
445	22	CREATE	booking	611	TBN Tour of Trilogy Stages for SFC	{"bookingType":"tour","studioId":20,"studioIds":[20],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-05 12:12:36.150663
446	9	UPDATE	booking	562	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 12:15:29.705295
447	9	UPDATE	booking	571	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 12:15:38.859925
448	9	CREATE	booking	612	Praise	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":8,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 12:15:43.765587
449	9	UPDATE	booking	613	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 12:16:49.45773
450	13	LOGIN	authentication	13	User dobryan logged in	{"username":"dobryan","name":"Dalin OBryan","role":"engineer","ipAddress":"64.58.141.194"}	64.58.141.194	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-05 13:12:32.838698
451	9	CREATE	booking	614	Praise	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":8,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-05 14:09:11.487545
452	16	CREATE	booking	615	5 Min w/ Jesus	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":20,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-05 15:41:20.868281
453	16	CREATE	booking	616	DOVES PROMOS	{"bookingType":"production","studioId":2,"studioIds":[2],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-05 16:39:52.755179
454	16	UPDATE	booking	616	DOVES PROMOS	{"originalBooking":{"title":"DOVES PROMOS","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"DOVES PROMOS","description":"TALENT: Kristin Adams\\nSTART TIME: 2:00 PM (Would start after Praise wraps)\\nCAMS: JIB / 1X PED\\nAUDIO: 1X LAV","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":2,"templateId":null,"pcrRoomId":null,"studioIds":[2]},"studioIds":[2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-05 17:08:55.172013
492	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-10 11:24:28.790349
494	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-10 11:24:32.636629
455	16	UPDATE	booking	616	DOVES PROMOS	{"originalBooking":{"title":"DOVES PROMOS","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"DOVES PROMOS","description":"TALENT: Kristin Adams\\nSTART TIME: 2:00 PM (Would start after Praise wraps)\\nCAMS: JIB / 1X PED\\nAUDIO: 1X LAV\\nPrompter Needed\\n1x Program Monitor ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":2,"templateId":null,"pcrRoomId":null,"studioIds":[2]},"studioIds":[2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-05 17:38:52.360292
456	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.246.128.155"}	174.246.128.155	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-05 18:09:13.472084
457	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.54"}	192.168.1.54	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-09-05 22:38:36.608993
458	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-08 08:59:28.199701
459	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-08 09:53:34.65305
460	16	UPDATE	booking	615	5 Min w/ Jesus	{"originalBooking":{"title":"5 Min w/ Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"5 Min w/ Jesus","description":"SHELIA - CALL TIME TBD","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-08 09:53:48.085409
461	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-09-08 10:38:45.559048
463	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-08 11:45:11.235971
464	16	CREATE	booking	617	Love Language Series	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[14,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-08 12:14:38.270414
465	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-08 12:22:05.374073
466	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-08 12:56:24.078371
467	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-08 13:05:24.519146
468	28	LOGIN	authentication	28	User ejeannerat@tbn.tv logged in	{"username":"ejeannerat@tbn.tv","name":"Eric Jeannerat","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-08 14:07:38.909418
469	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-08 16:33:25.382993
470	22	CREATE	booking	618	CCSWB Live Stream	{"bookingType":"production","studioId":18,"studioIds":[18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-08 16:36:31.01155
471	16	UPDATE	booking	615	5 Min w/ Jesus	{"originalBooking":{"title":"5 Min w/ Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 Min w/ Jesus","description":"SHELIA - CALL TIME: 1:00-4:00pm","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-08 17:46:16.614538
472	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"97.176.82.133"}	97.176.82.133	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-09-09 08:00:07.965309
473	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-09 08:21:56.758914
474	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-09 09:41:33.142695
475	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-09 12:41:22.975913
493	22	LOGOUT	authentication	22	User PMay logged out	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-10 11:24:31.332634
476	16	UPDATE	booking	609	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"M&L hosting both programs -\\n1:00pm - Cody Jefferson Praise\\n2:30pm Mark Batterson Praise ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14,7],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-09 12:45:06.354978
477	16	UPDATE	booking	609	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"M&L hosting both programs -\\n1:00pm - Cody Jefferson Praise\\n2:30pm Mark Batterson Praise ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-09 12:45:29.920972
478	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-09 14:09:59.736284
479	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-10 08:40:36.842112
480	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-10 09:22:12.521986
481	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-10 09:52:00.369802
482	16	DELETE	booking	560	(TENT) The Korey with a K Show Production	{"deletedBookingIds":[560],"bookingTitle":"(TENT) The Korey with a K Show Production","bookingType":"production","studioId":3,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:21:44.32088
483	16	UPDATE	booking	561	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:22:06.206994
484	16	DELETE	booking	613	(TENT) The Korey with a K Show Production	{"deletedBookingIds":[613],"bookingTitle":"(TENT) The Korey with a K Show Production","bookingType":"production","studioId":3,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:23:23.638591
485	16	CREATE	booking	619	(TENT) The Korey with a K Show Production	{"bookingType":"production","studioId":5,"studioIds":[5],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:23:38.182556
486	16	UPDATE	booking	619	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":5,"templateId":null,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:23:48.833092
487	16	UPDATE	booking	619	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#814bd2","studioId":5,"templateId":24,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:24:11.772656
488	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-10 11:24:20.06846
489	16	UPDATE	booking	561	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:24:20.384263
490	16	UPDATE	booking	562	(TENT) The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"(TENT) The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 11:24:26.657048
491	22	LOGOUT	authentication	22	User PMay logged out	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-10 11:24:27.013248
495	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-10 11:35:54.850891
496	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-10 15:03:52.716552
497	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"172.6.117.81"}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 22:37:23.429291
498	16	CREATE	booking	620	LIVE: SPECIAL REPORT	{"bookingType":"production","studioId":3,"studioIds":[3],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":18,"linkedGroupId":null,"notifyList":[]}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 22:39:42.353615
499	16	UPDATE	booking	620	LIVE: SPECIAL REPORT	{"originalBooking":{"title":"LIVE: SPECIAL REPORT","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE: SPECIAL REPORT","description":"Sheila / Erick / Cody","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":18,"pcrRoomId":null,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 22:39:58.333036
500	16	CREATE	booking	621	LIVE STAKS	{"bookingType":"production","studioId":13,"studioIds":[13],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[7,14]}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 22:43:04.383219
501	16	UPDATE	booking	620	LIVE: SPECIAL REPORT	{"originalBooking":{"title":"LIVE: SPECIAL REPORT","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE: SPECIAL REPORT","description":"Sheila / Erick / Cody","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":18,"pcrRoomId":1,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 22:43:56.797769
502	16	UPDATE	booking	577	SFC	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC","description":"Director: Ryan Tyler","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":3,"templateId":null,"pcrRoomId":64,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-10 22:46:10.986492
503	26	LOGIN	authentication	26	User Steve Fjordbak logged in	{"username":"Steve Fjordbak","name":"STEVE FJORDBAK","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-11 09:06:28.939307
504	28	LOGIN	authentication	28	User ejeannerat@tbn.tv logged in	{"username":"ejeannerat@tbn.tv","name":"Eric Jeannerat","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-11 09:59:09.394366
505	16	UPDATE	booking	621	LIVE STAKS	{"originalBooking":{"title":"LIVE STAKS","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE STAKS","description":"Stakelbeck Tonight going LIVE from 6:30-7:00 PM CT. (PLEX CONTROL ROOM)\\nErick remote in WASHINGTON DC. \\nCall Time: 5:30 - 7:30 PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":13,"templateId":6,"pcrRoomId":1,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-11 11:09:02.588187
506	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-11 12:18:14.290891
507	16	UPDATE	booking	568	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-11 13:19:51.992504
508	16	UPDATE	booking	568	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-11 13:20:01.689676
509	16	UPDATE	booking	575	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[7,14],"color":"#4B83E2","studioId":8,"templateId":6,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-11 13:22:27.117942
510	16	UPDATE	booking	621	LIVE STAKS	{"originalBooking":{"title":"LIVE STAKS","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE STAKS","description":"Stakelbeck Tonight going LIVE from 6:30-7:00 PM CT. (PLEX CONTROL ROOM)\\nErick remote in WASHINGTON DC. \\nCall Time: 5:30 - 7:30 PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":13,"templateId":6,"pcrRoomId":1,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-11 14:05:16.995094
511	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-11 15:05:36.627086
512	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-11 15:09:29.840331
513	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-12 08:23:40.505774
514	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-09-12 09:02:08.575766
517	26	LOGIN	authentication	26	User Steve Fjordbak logged in	{"username":"Steve Fjordbak","name":"STEVE FJORDBAK","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-12 10:13:06.671518
518	26	LOGIN	authentication	26	User Steve Fjordbak logged in	{"username":"Steve Fjordbak","name":"STEVE FJORDBAK","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-12 10:20:47.631371
520	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-12 12:06:58.692794
521	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 13:28:53.188034
522	16	UPDATE	booking	573	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 13:29:25.097026
523	16	CREATE	booking	622	Praise (Plex)	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":8,"linkedGroupId":null,"notifyList":[7,14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 13:31:32.719214
524	16	UPDATE	booking	614	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"M&L host Les and Leslie Parrot and Gary Chapman","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 13:33:28.23516
525	16	UPDATE	booking	614	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"M&L HOST: Les + Leslie Parrot and Gary Chapman.\\nSTART: 11:00 AM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 13:34:15.971916
526	16	UPDATE	booking	619	The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14,7],"color":"#814bd2","studioId":5,"templateId":24,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 14:10:56.249077
527	16	UPDATE	booking	561	The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 14:11:33.363007
528	16	UPDATE	booking	562	The Korey with a K Show Production	{"originalBooking":{"title":"(TENT) The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,14,7],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 14:11:47.834967
529	16	CREATE	booking	623	Chasing Hope	{"bookingType":"production","studioId":2,"studioIds":[2],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 14:58:45.690424
530	16	CREATE	booking	624	Chasing Hope	{"bookingType":"production","studioId":5,"studioIds":[5],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:05:22.155843
697	13	LOGIN	authentication	13	User dobryan logged in	{"username":"dobryan","name":"Dalin OBryan","role":"engineer","ipAddress":"64.58.141.194"}	64.58.141.194	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-22 17:05:05.170914
531	16	UPDATE	booking	624	Chasing Hope	{"originalBooking":{"title":"Chasing Hope","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Chasing Hope","description":"TRILOGY CLIENT - TBD\\nALL FIELD CAMS","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:06:22.233668
532	16	CREATE	booking	625	Chasing Hope	{"bookingType":"production","studioId":5,"studioIds":[5],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:12:26.953386
533	16	UPDATE	booking	619	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#814bd2","studioId":5,"templateId":24,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:13:54.685825
534	16	UPDATE	booking	561	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:14:02.287319
535	16	UPDATE	booking	562	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5,18]},"studioIds":[5,18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:14:12.935065
536	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-12 15:39:11.195288
537	22	UPDATE	booking	618	CCSWB Live Stream	{"originalBooking":{"title":"CCSWB Live Stream","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CCSWB Live Stream","description":"Coca Cola South West Beverage \\n\\nGuests:\\nJean Claude Tissot ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-12 15:40:05.865995
538	16	UPDATE	booking	561	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:45:16.82141
539	16	UPDATE	booking	562	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:45:24.927081
540	16	UPDATE	booking	615	5 Min w/ Jesus	{"originalBooking":{"title":"5 Min w/ Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 Min w/ Jesus","description":"SHELIA - CALL TIME: 1:00-4:00pm","type":"production","status":"tentative","start":{},"end":{},"notifyList":[14],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:50:18.954279
541	16	UPDATE	booking	619	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS -\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#814bd2","studioId":5,"templateId":24,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 15:51:05.077889
542	16	UPDATE	booking	615	5 Min w/ Jesus	{"originalBooking":{"title":"5 Min w/ Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"5 Min w/ Jesus","description":"SHELIA - CALL TIME: 1:00-4:00pm","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:06:44.509471
543	16	CREATE	booking	626	Trilogy	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7,14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:07:11.817295
544	16	UPDATE	booking	626	The Korey with a K Show Production	{"originalBooking":{"title":"Trilogy","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:07:23.114373
545	16	CREATE	booking	627	The Korey with a K Show Production	{"bookingType":"production","studioId":1,"studioIds":[1],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:11:10.907152
546	16	CREATE	booking	628	The Korey with a K Show Production	{"bookingType":"production","studioId":1,"studioIds":[1],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:11:50.693442
547	16	CREATE	booking	629	The Korey with a K Show Production	{"bookingType":"production","studioId":1,"studioIds":[1],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[14,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:12:10.843484
548	16	UPDATE	booking	629	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:12:27.262796
549	16	UPDATE	booking	626	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:12:51.028125
550	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"70.187.205.62"}	70.187.205.62	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-12 16:16:17.157674
556	16	UPDATE	booking	627	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:20:54.685825
557	16	UPDATE	booking	628	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:20:59.468461
558	16	UPDATE	booking	629	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:21:03.848661
559	16	UPDATE	booking	626	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"Would load in AFTER CODY's Updates -\\nNO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:21:47.448569
560	16	CREATE	booking	630	Trilogy	{"bookingType":"production","studioId":4,"studioIds":[4,3],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:22:50.230354
561	16	CREATE	booking	631	Trilogy	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:24:27.776846
562	16	DELETE	booking	631	Trilogy	{"deletedBookingIds":[631],"bookingTitle":"Trilogy","bookingType":"production","studioId":3,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:24:39.24359
566	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"70.187.205.62"}	70.187.205.62	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-12 16:25:43.272871
563	16	UPDATE	booking	626	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"Would load in AFTER CODY's Updates -\\nNO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:24:50.122705
564	16	UPDATE	booking	628	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:25:16.376272
567	16	UPDATE	booking	627	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:25:53.136989
571	16	UPDATE	booking	561	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:27:17.008025
572	16	UPDATE	booking	562	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:27:23.686582
565	16	UPDATE	booking	628	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:25:31.888325
569	16	UPDATE	booking	626	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"Would load in AFTER CODY's Updates -\\nNO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:26:14.851707
568	16	UPDATE	booking	629	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:26:01.740908
570	16	UPDATE	booking	619	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS -\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#814bd2","studioId":5,"templateId":24,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:27:09.827865
573	16	CREATE	booking	632	Trilogy	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:30:15.561254
574	16	UPDATE	booking	632	Trilogy	{"originalBooking":{"title":"Trilogy","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Trilogy","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 16:30:25.952592
575	8	LOGIN	authentication	8	User DHarvilla logged in	{"username":"DHarvilla","name":"David Harvilla","role":"it","ipAddress":"35.150.136.15"}	35.150.136.15	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0	2025-09-12 16:40:12.160521
578	12	LOGIN	authentication	12	User zmorales logged in	{"username":"zmorales","name":"Zachariah Morales","role":"admin","ipAddress":"66.182.197.133"}	66.182.197.133	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-09-12 16:45:47.311864
579	28	LOGIN	authentication	28	User ejeannerat@tbn.tv logged in	{"username":"ejeannerat@tbn.tv","name":"Eric Jeannerat","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-12 16:57:01.722396
580	16	UPDATE	booking	630	The Korey with a K Show Production	{"originalBooking":{"title":"Trilogy","type":"production","studioId":4,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"Would load in AFTER CODY's Updates -\\nNO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 17:06:38.351032
581	16	UPDATE	booking	632	The Korey with a K Show Production	{"originalBooking":{"title":"Trilogy","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 17:06:48.364609
582	16	UPDATE	booking	630	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"tentative","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 17:07:06.206323
583	16	UPDATE	booking	556	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 17:18:39.415172
584	16	CREATE	booking	633	CP NEWS: Remembering Charlie Kirk	{"bookingType":"production","studioId":3,"studioIds":[3],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[14,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 18:07:07.573257
585	16	UPDATE	booking	633	CP NEWS: Remembering Charlie Kirk	{"originalBooking":{"title":"CP NEWS: Remembering Charlie Kirk","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CP NEWS: Remembering Charlie Kirk","description":"W/ CODY CROUCH\\n-CALL TIME: 10:00 AM\\n-10-15min segment","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14,7],"color":"#ffaa00","studioId":3,"templateId":12,"pcrRoomId":1,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-12 18:18:40.098025
586	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"172.6.117.81"}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 14:20:38.510943
587	16	CREATE	booking	634	LIVE PRAISE	{"bookingType":"production","studioId":2,"studioIds":[2,3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[14,7]}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 14:23:23.89671
588	16	UPDATE	booking	634	LIVE PRAISE	{"originalBooking":{"title":"LIVE PRAISE","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE PRAISE","description":"HOST: SHELIA WALSH\\nSTUDIO B / C / D (depending on amount of guests)\\nSTART : TBD","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[9,7,14],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4,2]},"studioIds":[3,4,2],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 14:23:53.447508
589	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"166.205.190.117"}	166.205.190.117	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-09-13 14:40:01.513575
590	16	UPDATE	booking	634	LIVE PRAISE	{"originalBooking":{"title":"LIVE PRAISE","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE PRAISE","description":"HOST: SHELIA WALSH\\nSTUDIO B / C / D (depending on amount of guests)\\nSTART : TBD","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":2,"templateId":8,"pcrRoomId":1,"studioIds":[2,3,4]},"studioIds":[2,3,4],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 14:51:40.133781
591	16	UPDATE	booking	634	LIVE PRAISE	{"originalBooking":{"title":"LIVE PRAISE","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE PRAISE","description":"HOST: SHELIA WALSH\\nSTUDIO B / C / D (depending on amount of guests)\\nLIVE @ 7:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":2,"templateId":8,"pcrRoomId":1,"studioIds":[2,3,4]},"studioIds":[2,3,4],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 15:48:23.112894
986	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.2.82"}	10.81.2.82	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-21 07:04:27.504237
592	16	UPDATE	booking	634	LIVE PRAISE	{"originalBooking":{"title":"LIVE PRAISE","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE PRAISE","description":"HOST: SHELIA WALSH\\nSTUDIO B / C / D (depending on guests)\\nLIVE @ 7:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":2,"templateId":8,"pcrRoomId":1,"studioIds":[2,3,4]},"studioIds":[2,3,4],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 15:48:47.328845
593	16	UPDATE	booking	577	SFC: ZG Championship	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: ZG Championship","description":"Director: Ryan Tyler\\nREMOTE IN CABO / Control Room @ PLEX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:06:53.735713
594	16	UPDATE	booking	578	SFC: Zane Gray	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler\\nREMOTE IN CABO / Control Room @ PLEX\\nLIVE @ 4:30 - 8:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:07:47.346634
595	16	UPDATE	booking	578	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler\\nREMOTE IN CABO / Control Room @ PLEX\\nLIVE @ 4:30 - 8:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:07:54.076468
596	16	UPDATE	booking	578	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler\\nREMOTE IN CABO / Control Room @ PLEX\\nLIVE @ 4:30 - 8:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:08:08.97971
597	16	UPDATE	booking	579	SFC: Zane Gray	{"originalBooking":{"title":"SFC","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler\\nREMOTE IN CABO / Control Room @ PLEX\\nLIVE @ 4:30 - 8:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:08:47.648412
598	16	UPDATE	booking	577	SFC: Zane Gray	{"originalBooking":{"title":"SFC: ZG Championship","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler\\nREMOTE IN CABO / Control Room @ PLEX\\nLIVE @ 4:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:09:20.076293
599	16	UPDATE	booking	578	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX\\n- LIVE @ 4:30 - 8:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:10:20.23445
600	16	UPDATE	booking	578	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX\\n- LIVE @ 4:30 - 8:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:10:40.168268
601	16	UPDATE	booking	577	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX -\\nLIVE @ 4:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:11:09.183173
602	16	UPDATE	booking	579	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX -\\nLIVE @ 4:30 - 8:30 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	172.6.117.81	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-13 16:11:29.442196
603	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-13 22:22:39.408508
604	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 07:57:46.07321
605	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 08:45:46.289158
606	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-15 08:51:57.822458
607	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 09:13:14.64771
608	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-15 09:17:55.082389
609	16	CREATE	booking	635	CHARLIE KIRK MEMORIAL	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[14,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 09:23:32.859442
610	16	UPDATE	booking	635	CHARLIE KIRK MEMORIAL	{"originalBooking":{"title":"CHARLIE KIRK MEMORIAL","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"CHARLIE KIRK MEMORIAL","description":"Feed from Memorial - TBD -\\nMemorial START @ 1:00 PM CT / 11:00 AM PST","type":"production","status":"tentative","start":{},"end":{},"notifyList":[14,7],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 09:23:56.653193
611	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-15 09:48:52.872798
612	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-15 10:35:31.869324
613	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-15 10:49:27.020458
614	16	UPDATE	booking	634	LIVE: NIGHT OF PRAYER	{"originalBooking":{"title":"LIVE PRAISE","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE: NIGHT OF PRAYER","description":"HOST: SHELIA WALSH\\nSTUDIO B / C / D (depending on guests)\\nLIVE @ 7:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":2,"templateId":8,"pcrRoomId":1,"studioIds":[2,3,4]},"studioIds":[2,3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 10:56:38.298567
615	16	UPDATE	booking	634	LIVE: NIGHT OF PRAYER	{"originalBooking":{"title":"LIVE: NIGHT OF PRAYER","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE: NIGHT OF PRAYER","description":"HOST: SHELIA WALSH\\nSTUDIO B / C / D (depending on guests)\\nLIVE @ 7:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 11:36:43.280194
616	16	UPDATE	booking	635	CHARLIE KIRK MEMORIAL	{"originalBooking":{"title":"CHARLIE KIRK MEMORIAL","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"CHARLIE KIRK MEMORIAL","description":"Feed from Memorial - TBD -\\nMemorial START @ 1:00 PM CT / 11:00 AM PST","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14,7],"color":"#4B83E2","studioId":1,"templateId":null,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 11:37:00.609759
617	16	UPDATE	booking	634	LIVE: NIGHT OF PRAYER	{"originalBooking":{"title":"LIVE: NIGHT OF PRAYER","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE: NIGHT OF PRAYER","description":"HOST: SHELIA WALSH\\nSTUDIO C \\nLIVE @ 7:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 11:43:06.49033
698	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-23 09:38:35.879762
618	16	UPDATE	booking	634	LIVE: NIGHT OF PRAYER	{"originalBooking":{"title":"LIVE: NIGHT OF PRAYER","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"LIVE: NIGHT OF PRAYER","description":"HOST: SHELIA WALSH -\\nSTUDIO C -\\nLIVE @ 7:00 - 8:00 PM CT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 12:45:26.185255
679	16	CREATE	booking	642	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:36:34.061048
619	16	UPDATE	booking	576	KLove Fan Awards Rewind	{"originalBooking":{"title":"KLove Fan Awards Rewind","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"KLove Fan Awards Rewind","description":"Hosted by Blynda Lane.","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":65,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 12:45:47.890199
620	22	UPDATE	booking	618	CCSWB Live Stream	{"originalBooking":{"title":"CCSWB Live Stream","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CCSWB Live Stream","description":"Coca Cola South West Beverage \\n\\nGuests:\\nJean Claude Tissot ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-15 14:06:04.579581
621	16	UPDATE	booking	635	CHARLIE KIRK MEMORIAL	{"originalBooking":{"title":"CHARLIE KIRK MEMORIAL","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CHARLIE KIRK MEMORIAL","description":"Feed from Memorial - STUDIO A -\\nMemorial START @ 1:00 PM CT / 11:00 AM PST\\nCrew Call Time: 10am - 6pm","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14,7],"color":"#4B83E2","studioId":1,"templateId":null,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 14:34:28.700885
622	16	UPDATE	booking	576	KLove Fan Awards Rewind	{"originalBooking":{"title":"KLove Fan Awards Rewind","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"KLove Fan Awards Rewind","description":"POSTPONED - NEW DATE TBD - Hosted by Blynda Lane.","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[14],"color":"#4f7a28","studioId":3,"templateId":20,"pcrRoomId":65,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 16:09:00.157114
623	16	UPDATE	booking	635	CHARLIE KIRK MEMORIAL	{"originalBooking":{"title":"CHARLIE KIRK MEMORIAL","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CHARLIE KIRK MEMORIAL","description":"Feed from Memorial - STUDIO A -\\nMemorial START @ 1:00 PM CT / 11:00 AM PST\\n- Crew Call Time: 10am - 6pm","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":1,"templateId":null,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 16:24:11.342302
624	16	UPDATE	booking	573	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#4B83E2","studioId":8,"templateId":null,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 17:14:44.298458
625	16	CREATE	booking	636	SFC Pre-Pro	{"bookingType":"other","studioId":21,"studioIds":[21],"startTime":{},"endTime":{},"pcrRoomId":64,"templateId":15,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-15 18:06:04.714904
626	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"70.187.205.62"}	70.187.205.62	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-09-15 20:58:00.509885
627	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-16 09:03:42.452304
628	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-16 10:05:03.923229
629	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-16 11:00:08.278391
630	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:01:52.43419
631	16	UPDATE	booking	627	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:10:35.152425
699	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-23 10:54:58.281661
632	16	UPDATE	booking	628	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:10:43.578001
633	16	UPDATE	booking	629	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:11:16.578224
634	16	UPDATE	booking	630	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:19:06.31971
635	16	UPDATE	booking	626	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"Would load in AFTER CODY's Updates -\\nNO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:19:20.653954
636	16	UPDATE	booking	632	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"The Korey with a K Show Production","description":"-ONLY START AFTER M&L PRAISE IS WRAPPED\\n-NO TBN CAMS - CLIENT FIELD CAMS\\n-LED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":3,"templateId":23,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:19:55.66359
637	16	UPDATE	booking	628	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\n- LED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:20:30.222837
638	16	UPDATE	booking	627	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\n- LED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:20:39.077219
639	16	UPDATE	booking	629	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\n- LED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":1,"templateId":23,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 11:20:47.070122
640	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-16 11:26:03.000702
641	16	UPDATE	booking	546	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"VO","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[14],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:09:55.740518
642	16	UPDATE	booking	546	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"cancelled"},"updatedFields":{"title":"Centerpoint News Updates","description":"CODY CROUCH","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:10:13.233748
643	16	UPDATE	booking	547	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:10:21.75065
644	16	UPDATE	booking	548	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:10:27.779826
645	16	CREATE	booking	637	CODY RECORDS	{"bookingType":"production","studioId":3,"studioIds":[3],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:11:31.802178
646	16	UPDATE	booking	637	CODY RECORDS	{"originalBooking":{"title":"CODY RECORDS","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CODY RECORDS","description":"Updated records for Sunday Night Specials w/ Cody Crouch.","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":null,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:11:45.343709
647	16	UPDATE	booking	637	CODY RECORDS	{"originalBooking":{"title":"CODY RECORDS","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CODY RECORDS","description":"Updated records for Sunday Night Specials w/ Cody Crouch.\\nStudio C Anchor Desk (1x Jib / 1x Ped)","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":null,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:12:14.283861
648	16	UPDATE	booking	637	CODY RECORDS	{"originalBooking":{"title":"CODY RECORDS","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CODY RECORDS","description":"Updated records for Sunday Night Specials w/ Cody Crouch -\\nStudio C Anchor Desk (1x Jib / 1x Ped) -\\nSTART @ 3:45PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":null,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:12:36.303606
649	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-16 14:24:47.554523
650	16	UPDATE	booking	637	CODY RECORDS	{"originalBooking":{"title":"CODY RECORDS","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CODY RECORDS","description":"Updated records for Sunday Night Specials w/ Cody Crouch -\\nStudio C Anchor Desk (1x Jib / 1x Ped) -\\nSTART @ 3:45PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":3,"templateId":12,"pcrRoomId":null,"studioIds":[3]},"studioIds":[3],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 14:25:00.575607
651	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-16 14:27:02.197409
652	16	UPDATE	booking	546	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"CODY CROUCH - START @ 9:30","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 16:01:11.97395
653	16	DELETE	booking	574	Stakelbeck Tonight	{"deletedBookingIds":[574],"bookingTitle":"Stakelbeck Tonight","bookingType":"production","studioId":3,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 16:08:20.217084
654	16	UPDATE	booking	513	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"11:00am M&L host Nick Vujicic\\n12:30pm M&L host David Green","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 16:08:32.113894
655	16	CREATE	booking	638	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 16:09:09.9898
656	16	UPDATE	booking	638	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 16:09:30.613899
657	16	UPDATE	booking	513	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"11:00am M&L host Nick Vujicic\\n12:30pm M&L host David Green","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 16:09:39.688691
658	16	UPDATE	booking	513	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"11:00am M&L host Nick Vujicic\\n12:30pm M&L host David Green\\nPCR1","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15	2025-09-16 16:09:48.968842
659	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-17 06:41:25.530389
660	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-17 15:05:50.735135
661	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-17 15:45:25.519895
662	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.54"}	192.168.1.54	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1	2025-09-18 03:38:36.12502
663	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-18 03:39:45.224395
664	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-09-18 10:42:06.775142
665	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-18 11:27:58.582732
666	9	UPDATE	booking	562	The Korey with a K Show Production	{"originalBooking":{"title":"The Korey with a K Show Production","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"The Korey with a K Show Production","description":"NO TBN CAMS - CLIENT FIELD CAMS\\nLED/GFX","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-18 11:29:55.201366
667	9	UPDATE	booking	571	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"Analysis set","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":5,"templateId":null,"pcrRoomId":1,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-18 11:30:23.753012
668	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-18 19:51:25.539135
669	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-19 08:11:19.493895
670	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-19 08:16:14.131192
671	9	UPDATE	booking	615	5 Min w/ Jesus	{"originalBooking":{"title":"5 Min w/ Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 Min w/ Jesus","description":"SHELIA - CALL TIME: 1:00-4:00pm","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-19 08:55:03.140094
672	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-19 10:38:29.511991
673	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:29:43.904064
674	16	UPDATE	booking	638	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:30:08.738067
675	16	CREATE	booking	639	Stakelbeck Tonight	{"bookingType":"production","studioId":2,"studioIds":[2],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:34:21.24686
735	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 09:58:44.738125
676	16	UPDATE	booking	639	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"**Dr. David Jeremiah** - \\nTBD / STUDIO C & D","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":2,"templateId":6,"pcrRoomId":65,"studioIds":[2]},"studioIds":[2],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:34:31.074639
680	16	CREATE	booking	643	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:37:00.16336
681	16	UPDATE	booking	635	CHARLIE KIRK MEMORIAL	{"originalBooking":{"title":"CHARLIE KIRK MEMORIAL","type":"production","studioId":1,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CHARLIE KIRK MEMORIAL","description":"Feed from Memorial - STUDIO A -\\nMemorial START @ 12:00 PM CT / 10:00 AM PST\\n- Crew Call Time: 8am - 7pm","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":1,"templateId":null,"pcrRoomId":null,"studioIds":[1]},"studioIds":[1],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-19 13:38:11.225002
682	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-19 13:38:20.689482
685	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-19 15:35:40.593815
686	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-20 21:58:39.325934
687	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-21 12:34:27.133144
688	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-21 14:28:35.794923
689	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-22 08:26:50.733835
690	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-22 08:53:54.727362
691	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-22 09:03:20.716883
692	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-22 09:38:56.722021
693	9	UPDATE	booking	618	CCSWB Live Stream	{"originalBooking":{"title":"CCSWB Live Stream","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CCSWB Live Stream","description":"Coca Cola South West Beverage \\n\\nGuests:\\nJean Claude Tissot ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":64,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-22 09:47:05.612351
694	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0	2025-09-22 13:06:39.330434
695	9	UPDATE	booking	572	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-22 16:00:23.082812
696	9	CREATE	booking	644	MRO Segments with Blynda	{"bookingType":"production","studioId":3,"studioIds":[3,2],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":20,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-22 16:02:26.466509
763	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-30 18:01:14.954006
700	9	UPDATE	booking	612	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"2:30pm M&L hosting Sean McNamara","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-23 10:58:25.881996
701	9	UPDATE	booking	550	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-23 15:38:26.816546
987	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:09:27.202704
702	9	UPDATE	booking	550	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-23 15:39:42.661645
703	9	UPDATE	booking	545	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":65,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-23 15:40:03.290142
704	9	CREATE	booking	645	Stakelbeck Tonight	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-23 15:40:50.008452
705	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-23 16:25:28.780257
706	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.115.171.117"}	107.115.171.117	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1	2025-09-24 08:12:10.154445
707	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-24 08:36:07.689908
708	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-24 09:58:40.434566
709	9	UPDATE	booking	646	5 Minutes with Jesus	{"originalBooking":{"title":"5 Minutes with Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 Minutes with Jesus","description":"Sheila Walsh hosting","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":null,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-24 12:58:07.586262
710	9	UPDATE	booking	573	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#4B83E2","studioId":8,"templateId":null,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-24 12:58:28.554185
711	9	UPDATE	booking	646	5 Minutes with Jesus	{"originalBooking":{"title":"5 Minutes with Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 Minutes with Jesus","description":"Sheila Walsh hosting","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-24 12:58:40.68805
712	9	UPDATE	booking	646	5 Minutes with Jesus	{"originalBooking":{"title":"5 Minutes with Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 Minutes with Jesus","description":"Sheila Walsh hosting","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":null,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-24 12:58:55.002943
713	9	UPDATE	booking	622	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"Via Bob: Matt & Laurie will host a “Praise” program at the Plex with Sheila Walsh on Monday 9/29 at 1:30pm. The topic will be Sheila’s book The Gifts of Christmas which TBN is offering in November and early December.\\n----> After the “Praise” Matt will record segments for the Eschatology Specials.\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[7,14],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-24 12:59:28.278868
714	9	UPDATE	booking	646	5 Minutes with Jesus	{"originalBooking":{"title":"5 Minutes with Jesus","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 Minutes with Jesus","description":"Sheila Walsh hosting","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":8,"templateId":20,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-24 12:59:36.433177
715	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-24 18:26:11.569464
716	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.246.133.22"}	174.246.133.22	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-25 06:40:07.146765
988	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:48:33.711687
717	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-25 09:10:39.501802
718	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-25 10:34:41.098184
719	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-25 10:46:42.138902
720	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-25 11:25:06.868902
721	16	UPDATE	booking	534	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"Cody Crouch","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":null,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-25 12:44:18.166614
722	16	UPDATE	booking	573	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":8,"templateId":null,"pcrRoomId":65,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-25 12:44:33.730355
724	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36	2025-09-25 19:09:19.252892
725	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-26 08:00:35.712066
726	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-26 08:00:49.78991
727	9	UPDATE	booking	614	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"M&L HOST: Les + Leslie Parrot and Gary Chapman.\\nSTART: 1:00 PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-26 09:07:52.299574
728	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-09-26 09:10:31.467716
729	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"174.195.195.242"}	174.195.195.242	Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1	2025-09-27 15:57:36.934871
730	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.246.134.237"}	174.246.134.237	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-28 15:25:15.144205
731	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-29 08:00:54.949452
732	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-09-29 08:17:06.649236
733	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-29 08:28:37.115367
734	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-29 08:35:01.079876
736	16	UPDATE	booking	639	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":2,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Stakelbeck Tonight","description":"Staks Reads / Dove Records\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#008cb4","studioId":5,"templateId":6,"pcrRoomId":65,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 10:02:03.419369
737	16	UPDATE	booking	639	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"Staks Reads / Dove Records\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":5,"templateId":6,"pcrRoomId":64,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 10:02:19.554717
738	16	UPDATE	booking	513	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"11:00am M&L host Nick Vujicic\\n12:30pm M&L host David Green + Bill\\nPCR1","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 10:43:37.620191
739	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 10:57:06.01384
740	22	CREATE	booking	647	Trilogy	{"bookingType":"production","studioId":21,"studioIds":[21,20],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 10:59:33.689371
741	22	CREATE	booking	648	Veritcal Shorts Production	{"bookingType":"production","studioId":21,"studioIds":[21,20],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:00:29.224656
742	22	UPDATE	booking	647	Vertical Shorts Production	{"originalBooking":{"title":"Trilogy","type":"production","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Vertical Shorts Production","description":"Pre-light- 30th\\nShoot day- 1-3rd\\n \\nNames of guests are in the attached PDF’s\\n \\n9am to 9PM\\n \\nProduction Company: IAJ Media\\nTrilogy Onsite contact: Parke May & Taylor Tucker\\nHaze Machine: YES\\nTrilogy Reception: Cristina Trejo\\n \\nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":20,"templateId":23,"pcrRoomId":null,"studioIds":[20,21]},"studioIds":[20,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:01:46.246133
743	22	DELETE	booking	649	Trilogy	{"deletedBookingIds":[649],"bookingTitle":"Trilogy","bookingType":"production","studioId":21,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:03:36.140429
744	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-09-29 11:03:53.265423
745	22	UPDATE	booking	650	Vertical Shorts Production	{"originalBooking":{"title":"Trilogy","type":"production","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Vertical Shorts Production","description":"Pre-light- 30th\\nShoot day- 1-3rd\\n \\nNames of guests are in the attached PDF’s\\n \\n9am to 9PM\\n \\nProduction Company: IAJ Media\\nTrilogy Onsite contact: Parke May & Taylor Tucker\\nHaze Machine: YES\\nTrilogy Reception: Cristina Trejo\\n \\nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":20,"templateId":23,"pcrRoomId":null,"studioIds":[20,21]},"studioIds":[20,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:04:05.432441
746	22	UPDATE	booking	651	Veritcal Shorts Production	{"originalBooking":{"title":"Trilogy","type":"production","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Veritcal Shorts Production","description":"Pre-light- 30th\\nShoot day- 1-3rd\\n \\nNames of guests are in the attached PDF’s\\n \\n9am to 9PM\\n \\nProduction Company: IAJ Media\\nTrilogy Onsite contact: Parke May & Taylor Tucker\\nHaze Machine: YES\\nTrilogy Reception: Cristina Trejo\\n \\nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":20,"templateId":23,"pcrRoomId":null,"studioIds":[20,21]},"studioIds":[20,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:04:20.801287
747	22	UPDATE	booking	648	Veritcal Shorts Production	{"originalBooking":{"title":"Veritcal Shorts Production","type":"production","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Veritcal Shorts Production","description":"Pre-light- 30th\\nShoot day- 1-3rd\\n \\nNames of guests are in the attached PDF’s\\n \\n9am to 9PM\\n \\nProduction Company: IAJ Media\\nTrilogy Onsite contact: Parke May & Taylor Tucker\\nHaze Machine: YES\\nTrilogy Reception: Cristina Trejo\\n \\nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":20,"templateId":23,"pcrRoomId":null,"studioIds":[20,21]},"studioIds":[20,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:04:32.891244
764	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-01 08:42:49.639763
748	22	UPDATE	booking	648	Veritcal Shorts Production	{"originalBooking":{"title":"Veritcal Shorts Production","type":"production","studioId":20,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Veritcal Shorts Production","description":"Pre-light- 30th\\nShoot day- 1-3rd\\n \\nNames of guests are in the attached PDF’s on Sept 30th date\\n \\n9am to 9PM\\n \\nProduction Company: IAJ Media\\nTrilogy Onsite contact: Parke May & Taylor Tucker\\nHaze Machine: YES\\nTrilogy Reception: Cristina Trejo\\n \\nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":20,"templateId":23,"pcrRoomId":null,"studioIds":[20,21]},"studioIds":[20,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:08:08.66587
989	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:49:25.688349
749	22	UPDATE	booking	650	Vertical Shorts Production	{"originalBooking":{"title":"Vertical Shorts Production","type":"production","studioId":20,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Vertical Shorts Production","description":"Pre-light- 30th\\nShoot day- 1-3rd\\n \\nNames of guests are in the attached PDF’s on Sept 30th date\\n \\n9am to 9PM\\n \\nProduction Company: IAJ Media\\nTrilogy Onsite contact: Parke May & Taylor Tucker\\nHaze Machine: YES\\nTrilogy Reception: Cristina Trejo\\n \\nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":20,"templateId":23,"pcrRoomId":null,"studioIds":[20,21]},"studioIds":[20,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:08:17.502161
750	22	UPDATE	booking	651	Veritcal Shorts Production	{"originalBooking":{"title":"Veritcal Shorts Production","type":"production","studioId":20,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Veritcal Shorts Production","description":"Pre-light- 30th\\nShoot day- 1-3rd\\n \\nNames of guests are in the attached PDF’s on Sept 30th date\\n \\n9am to 9PM\\n \\nProduction Company: IAJ Media\\nTrilogy Onsite contact: Parke May & Taylor Tucker\\nHaze Machine: YES\\nTrilogy Reception: Cristina Trejo\\n \\nWe will have a couple of other people that are extra PA's not on the list. Their names are Johnny Williams and Seth Omalza\\n ","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":20,"templateId":23,"pcrRoomId":null,"studioIds":[20,21]},"studioIds":[20,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 11:08:29.399124
751	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-29 11:32:02.753683
752	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-29 11:38:09.073746
753	16	CREATE	booking	652	Wintley Phipps Special	{"bookingType":"production","studioId":5,"studioIds":[5],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 11:44:55.505989
754	16	UPDATE	booking	652	Wintley Phipps Special	{"originalBooking":{"title":"Wintley Phipps Special","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Wintley Phipps Special","description":"M&L - Musical Special","type":"production","status":"tentative","start":{},"end":{},"notifyList":[14,7],"color":"#4B83E2","studioId":5,"templateId":null,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 11:45:46.222418
755	16	UPDATE	booking	641	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"Blynda - DOVE READS @ 11:00AM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":65,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 11:50:22.250555
756	22	CREATE	booking	653	TBN B-ROLL SHOOT	{"bookingType":"production","studioId":21,"studioIds":[21,18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-09-29 12:55:53.831052
757	16	UPDATE	booking	513	Praise	{"originalBooking":{"title":"Praise","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise","description":"11:00am M&L host Nick Vujicic\\n12:30pm M&L host David Green + Bill\\nPCR1","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-09-29 14:07:22.06609
758	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-29 14:15:17.804896
759	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-09-29 18:50:25.704385
760	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-09-30 09:21:50.996038
761	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-09-30 14:05:08.963935
762	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-09-30 14:20:02.178744
765	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36	2025-10-01 09:01:30.124614
768	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-01 09:29:45.814843
769	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-01 10:21:18.410623
770	24	LOGIN	authentication	24	User Ttucker logged in	{"username":"Ttucker","name":"Taylor Tucker","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-01 12:58:38.809986
771	24	UPDATE	booking	624	Chasing Hope	{"originalBooking":{"title":"Chasing Hope","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Chasing Hope","description":"TRILOGY CLIENT - TBD\\nALL FIELD CAMS","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-01 13:00:28.986805
772	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-01 15:54:56.986479
773	16	CREATE	booking	654	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":12,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-01 15:55:50.214
774	16	CREATE	booking	655	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-01 15:56:23.150265
775	16	CREATE	booking	656	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-01 15:56:59.406158
776	16	UPDATE	booking	654	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"CODY","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":9,"templateId":12,"pcrRoomId":1,"studioIds":[9]},"studioIds":[9],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-01 15:57:06.066009
777	16	CREATE	booking	657	BT Robo Training	{"bookingType":"production","studioId":6,"studioIds":[6,16,7,8,17],"startTime":{},"endTime":{},"pcrRoomId":2,"templateId":13,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-01 16:12:43.423694
778	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-01 16:41:35.172313
779	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-01 20:29:09.91176
780	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-02 07:55:16.395173
781	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-02 08:22:00.582266
782	9	CREATE	booking	658	Venue Rental	{"bookingType":"production","studioId":5,"studioIds":[5],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":20,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-02 09:46:22.232282
783	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-02 09:46:52.953988
784	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-02 10:16:54.088307
786	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"4.71.106.2"}	4.71.106.2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-02 11:47:37.85322
787	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-02 11:50:27.570232
788	9	DELETE	booking	652	Wintley Phipps Special	{"deletedBookingIds":[652],"bookingTitle":"Wintley Phipps Special","bookingType":"production","studioId":5,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-02 12:32:58.972579
789	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-02 12:45:17.931352
790	16	CREATE	booking	659	Centerpoint News Updates	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 14:07:11.239261
791	16	CREATE	booking	660	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 14:07:41.365881
792	16	CREATE	booking	661	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 14:09:00.418537
793	16	CREATE	booking	662	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 14:10:40.651076
794	16	CREATE	booking	663	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 14:11:09.323553
795	9	DELETE	booking	602	Man Camp Cincinnati	{"deletedBookingIds":[602],"bookingTitle":"Man Camp Cincinnati","bookingType":"production","studioId":13,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-02 14:20:56.389946
796	9	DELETE	booking	603	Man Camp Cincinnati	{"deletedBookingIds":[603],"bookingTitle":"Man Camp Cincinnati","bookingType":"production","studioId":13,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-02 14:21:01.780757
797	22	CREATE	booking	664	TBN Project Set Up Day	{"bookingType":"production","studioId":18,"studioIds":[18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-02 14:31:16.315814
798	22	CREATE	booking	665	TBN Project Shoot Day	{"bookingType":"production","studioId":18,"studioIds":[18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-02 14:31:42.655347
799	22	UPDATE	booking	653	TBN B-ROLL SHOOT	{"originalBooking":{"title":"TBN B-ROLL SHOOT","type":"production","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"TBN B-ROLL SHOOT","description":"Details from Angelique:\\n\\nThis will be a shoot filming a man (scholar looking) writing on a whiteboard, filming him writing, reading, on a desk, etc\\n \\nLighting: We will need moody lighting lots of contrast\\nAnd a smoke machine\\nProps: I will be ordering a white board and other props. Steve F is delivering a desk from Irving this week.\\nShooter: I have hired a shooter from Houston who shot Lanier Broll that Matt really liked. Aidan and others are not available.\\nLED walls: we will use similar ones to the panel shoot\\n\\n\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18,21]},"studioIds":[18,21],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-02 14:33:08.795842
800	16	UPDATE	booking	643	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":5,"templateId":6,"pcrRoomId":65,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 14:47:24.29045
801	16	UPDATE	booking	643	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":5,"templateId":6,"pcrRoomId":65,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 14:47:33.58869
802	16	CREATE	booking	666	Praise w/ M&L	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":8,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 15:07:40.102311
803	16	UPDATE	booking	643	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"TBD ON NEW START TIME","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":5,"templateId":6,"pcrRoomId":64,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 15:08:00.182906
804	16	CREATE	booking	667	Praise w/ M&L	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":8,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 15:09:22.464065
827	16	CREATE	booking	671	Praise (Plex)	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":8,"linkedGroupId":null,"notifyList":[14,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 10:51:32.379134
805	16	UPDATE	booking	666	Praise w/ M&L	{"originalBooking":{"title":"Praise w/ M&L","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise w/ M&L","description":"KEENAN CLARK w/ M&L\\nSTART @ 12:30 OR 1:00 PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 15:09:47.512999
806	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 16:08:20.660124
990	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.3.110"}	10.81.3.110	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:49:38.642334
807	16	UPDATE	booking	643	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"INBOUND @ 1:30PM CST","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":5,"templateId":6,"pcrRoomId":64,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 16:08:45.38128
808	16	CREATE	booking	668	Praise (Plex)	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":8,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 16:09:55.672816
809	16	UPDATE	booking	668	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"OS HAWKINS W/ M&L\\nSTART @ 2:00PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 16:10:17.651922
810	16	CREATE	booking	669	Stakelbeck Tonight	{"bookingType":"production","studioId":5,"studioIds":[5],"startTime":{},"endTime":{},"pcrRoomId":64,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-02 16:12:43.642495
811	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"47.161.47.137"}	47.161.47.137	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-02 19:54:59.864843
812	22	LOGIN	authentication	22	User PMay logged in	{"username":"PMay","name":"Parke May","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-02 21:08:13.170598
813	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-03 08:10:14.734002
814	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"174.195.129.197"}	174.195.129.197	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-03 10:10:06.325016
815	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-03 10:27:46.601929
816	16	CREATE	booking	670	Stakelbeck Tonight	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-03 10:52:15.41694
817	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-03 10:54:54.504261
818	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-03 17:43:11.951254
819	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.246.128.166"}	174.246.128.166	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-04 21:21:10.595325
820	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.115.171.134"}	107.115.171.134	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-06 07:03:54.790877
821	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-06 08:36:38.801834
822	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-06 08:37:08.21692
824	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-06 09:00:08.732251
825	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-06 09:58:46.725399
826	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 10:48:07.79625
828	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-06 11:38:58.894136
829	16	UPDATE	booking	671	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Praise (Plex)","description":"TIM DUNN @ 1:00PM\\nM&L","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14,7],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 13:10:21.495946
830	16	UPDATE	booking	671	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"TIM DUNN @ 1:00PM -\\nM&L","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 13:10:33.313774
831	16	CREATE	booking	672	Praise (Irving)	{"bookingType":"production","studioId":14,"studioIds":[14],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":10,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 15:42:47.187064
832	16	UPDATE	booking	672	Praise (Irving)	{"originalBooking":{"title":"Praise (Irving)","type":"production","studioId":14,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Irving)","description":"MUSICAL PRAISE - FIRST BAPTIST - START @ 3:00PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ff40ff","studioId":14,"templateId":10,"pcrRoomId":65,"studioIds":[14]},"studioIds":[14],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 15:43:04.695624
833	16	UPDATE	booking	672	Praise (Irving)	{"originalBooking":{"title":"Praise (Irving)","type":"production","studioId":14,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Irving)","description":"MUSICAL PRAISE - FIRST BAPTIST - START @ 3:00PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":14,"templateId":10,"pcrRoomId":null,"studioIds":[14]},"studioIds":[14],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 15:43:14.59007
834	16	UPDATE	booking	658	Venue Rental	{"originalBooking":{"title":"Venue Rental","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Venue Rental","description":"Street Pastors Podcast Tour (Tim Timberlake + Philip Mitchell)","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4f7a28","studioId":5,"templateId":20,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:31:31.034641
835	16	CREATE	booking	673	Centerpoint News Updates	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:32:03.102907
836	16	CREATE	booking	674	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:32:32.26932
837	16	CREATE	booking	675	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:33:06.131785
838	16	CREATE	booking	676	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:34:35.666302
839	16	CREATE	booking	677	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:35:33.304064
840	16	CREATE	booking	678	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:41:23.799332
841	16	CREATE	booking	679	Centerpoint News Updates	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:47:25.659415
842	16	CREATE	booking	680	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:47:59.309943
843	16	CREATE	booking	681	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:49:05.827034
844	16	CREATE	booking	682	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:49:30.940503
845	16	CREATE	booking	683	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:49:53.911492
846	16	CREATE	booking	684	Stakelbeck Tonight	{"bookingType":"production","studioId":14,"studioIds":[14],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":6,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:52:03.402368
847	16	CREATE	booking	685	Praise (Plex)	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":8,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 16:53:50.498673
848	16	UPDATE	booking	672	Praise (Irving)	{"originalBooking":{"title":"Praise (Irving)","type":"production","studioId":14,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Irving)","description":"MUSICAL PRAISE - FIRST BAPTIST - START @ 3:00PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":14,"templateId":10,"pcrRoomId":null,"studioIds":[14]},"studioIds":[14],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 17:13:43.932117
849	16	UPDATE	booking	672	Praise (Irving)	{"originalBooking":{"title":"Praise (Irving)","type":"production","studioId":14,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Irving)","description":"MUSICAL PRAISE - FIRST BAPTIST - START @ 3:00PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":14,"templateId":10,"pcrRoomId":null,"studioIds":[14]},"studioIds":[14],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-06 17:13:53.641504
850	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-07 09:31:02.714247
851	16	UPDATE	booking	671	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"TIM DUNN @ 1:30PM -\\nM&L","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-07 10:35:31.562878
852	16	UPDATE	booking	671	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"TIM DUNN @ 1:30PM -\\nM&L","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-07 10:35:56.451675
853	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-07 11:04:43.349936
854	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"192.168.1.140"}	192.168.1.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-07 11:57:15.120043
855	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-07 14:44:56.817108
856	16	UPDATE	booking	673	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"BLYNDA","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":12,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-07 14:47:31.023201
857	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-07 15:45:47.696996
858	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-07 15:45:48.918101
859	16	UPDATE	booking	678	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"IN-STUDIO GUESTS\\n11 AM + 2PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-07 15:50:35.81687
860	16	UPDATE	booking	678	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"IN-STUDIO GUESTS -\\n11 AM + 2PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-07 15:50:46.665153
861	16	UPDATE	booking	678	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"IN-STUDIO GUESTS -\\n11 AM + 2PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-07 16:21:21.376182
862	9	UPDATE	booking	671	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"1:30pm M&L host Tim Dunn\\n3:00pm M&L host Scott Hannen and Anthony (A T)","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-08 09:19:17.775853
863	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-08 09:29:25.297341
864	28	LOGIN	authentication	28	User ejeannerat@tbn.tv logged in	{"username":"ejeannerat@tbn.tv","name":"Eric Jeannerat","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-08 09:33:00.835365
865	28	LOGIN	authentication	28	User ejeannerat@tbn.tv logged in	{"username":"ejeannerat@tbn.tv","name":"Eric Jeannerat","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-08 10:24:58.039376
866	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"138.84.46.59"}	138.84.46.59	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-08 10:25:34.317454
867	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-08 11:33:21.209499
868	16	UPDATE	booking	555	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":1,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	108.147.171.47	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-08 13:08:30.872801
869	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-08 14:43:44.844216
870	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-08 15:23:17.214842
871	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.115.171.140"}	107.115.171.140	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-09 07:50:01.52268
872	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-09 11:12:57.767584
874	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-09 15:25:07.372284
875	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-09 16:53:21.719057
876	16	CREATE	booking	686	Praise (Plex)	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":8,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-09 16:56:07.134823
877	16	UPDATE	booking	686	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"TIM TIMBERLAKE + PHILLP W. - \\nM&L HOST - START @ 4:00PM (PCR1)","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-09 16:57:35.612632
878	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-09 17:08:01.747733
879	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-10 08:31:51.511138
880	16	CREATE	booking	687	BT PICK UPS	{"bookingType":"production","studioId":6,"studioIds":[6,16,7,8,17],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":13,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 11:53:48.920497
881	16	UPDATE	booking	687	BT PICK UPS	{"originalBooking":{"title":"BT PICK UPS","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"BT PICK UPS","description":"WHITE CYC - Christmas Decor - START @ 2:15/2:30pm","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6]},"studioIds":[6],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 11:54:20.075296
900	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-13 09:59:07.3614
882	16	UPDATE	booking	687	BT PICK UPS	{"originalBooking":{"title":"BT PICK UPS","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"BT PICK UPS","description":"WHITE CYC - Christmas Decor - START @ 3:15/3:30pm","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,22,23]},"studioIds":[6,22,23],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 11:55:17.410218
883	16	CREATE	booking	688	STAKS LIVE	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[14,7]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 12:10:11.918409
884	16	UPDATE	booking	688	STAKS LIVE	{"originalBooking":{"title":"STAKS LIVE","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"STAKS LIVE","description":"SPECIAL REPORT - LIVE @ 6:30-8:00PM CT - STUDIO C","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 12:12:27.326389
885	16	CREATE	booking	689	STAKS READS	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":65,"templateId":null,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 12:16:23.065192
886	16	UPDATE	booking	678	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"IN-STUDIO GUESTS -\\n11:45 AM + 2PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 12:17:09.957093
887	16	UPDATE	booking	617	Love Language Series	{"originalBooking":{"title":"Love Language Series","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Love Language Series","description":"MOVED TO TUSTIN","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":3,"templateId":null,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 12:17:59.363927
888	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-10 12:21:16.395952
889	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-10 15:04:08.816203
890	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-10 15:31:21.126454
891	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-10 16:03:31.600017
892	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 17:05:58.210651
893	16	UPDATE	booking	555	Better Together	{"originalBooking":{"title":"Better Together","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Better Together","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[14],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":1,"studioIds":[6,7,8,17,22]},"studioIds":[6,7,8,17,22],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 17:06:27.953109
894	16	UPDATE	booking	687	BT PICK UPS	{"originalBooking":{"title":"BT PICK UPS","type":"production","studioId":6,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"BT PICK UPS","description":"WHITE CYC - Christmas Decor - START TBD (Morning w/ Laurie)","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#942192","studioId":6,"templateId":13,"pcrRoomId":65,"studioIds":[6,22,23]},"studioIds":[6,22,23],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-10 17:07:42.689112
895	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-10 17:13:20.593999
896	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-10 17:13:43.515494
897	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-13 07:51:09.215729
898	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-13 09:24:40.768585
899	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-13 09:27:21.525053
901	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"138.84.46.118"}	138.84.46.118	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-13 10:25:43.992585
902	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"174.202.163.95"}	174.202.163.95	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-13 11:42:59.487935
903	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-13 11:48:49.251728
904	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.115.171.32"}	107.115.171.32	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-14 06:48:46.283475
905	9	DELETE	booking	604	Man Camp Cincinnati	{"deletedBookingIds":[604],"bookingTitle":"Man Camp Cincinnati","bookingType":"production","studioId":13,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-14 09:05:13.247714
906	9	DELETE	booking	605	Man Camp Cincinnati	{"deletedBookingIds":[605],"bookingTitle":"Man Camp Cincinnati","bookingType":"production","studioId":13,"startTime":{},"endTime":{},"linkedGroupId":null,"deleteLinked":false,"deletedCount":1}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-14 09:05:20.279138
907	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-14 10:33:32.43912
908	16	UPDATE	booking	577	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX -\\nLIVE @ 4:00 - 7:00 PM CT / 2:00 - 5:00 PM PT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-14 10:34:18.40215
909	16	UPDATE	booking	578	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX\\n- LIVE @ 4:30 - 7:30 PM CT / 2:30 - 5:30 PM PT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-14 10:35:03.960661
910	16	UPDATE	booking	579	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX\\n- LIVE @ 4:30 - 7:30 PM CT / 2:30 - 5:30 PM PT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-14 10:35:21.640549
911	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-14 10:40:00.932044
912	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-14 13:17:15.231783
913	16	CREATE	booking	690	TBN Christmas Products	{"bookingType":"production","studioId":1,"studioIds":[1],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-14 14:00:05.789169
914	16	UPDATE	booking	625	Chasing Hope	{"originalBooking":{"title":"Chasing Hope","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Chasing Hope","description":"TRILOGY CLIENT - TBD\\nALL FIELD CAMS","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-14 17:29:30.239554
915	24	LOGIN	authentication	24	User Ttucker logged in	{"username":"Ttucker","name":"Taylor Tucker","role":"producer","ipAddress":"107.115.171.42"}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:35:04.206178
916	24	CREATE	booking	691	Forsure AI 	{"bookingType":"production","studioId":18,"studioIds":[18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7,14]}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:41:07.418016
917	24	UPDATE	booking	691	Forsure AI 	{"originalBooking":{"title":"Forsure AI ","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Forsure AI ","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":null,"studioIds":[18]},"studioIds":[18],"linkedGroupId":null,"hasLinked":null}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:41:31.21799
936	16	CREATE	booking	699	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:51:49.779682
918	24	UPDATE	booking	691	Forsure AI 	{"originalBooking":{"title":"Forsure AI ","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Forsure AI ","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#bc4bd2","studioId":19,"templateId":23,"pcrRoomId":null,"studioIds":[19]},"studioIds":[19],"linkedGroupId":null,"hasLinked":null}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:42:23.156024
919	24	CREATE	booking	692	Halloween Wicked Shoot	{"bookingType":"production","studioId":18,"studioIds":[18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7,14]}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:45:33.164637
920	24	CREATE	booking	693	Samsung Pay Commercial Shoot	{"bookingType":"production","studioId":18,"studioIds":[18],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7,14]}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:49:11.96953
921	24	UPDATE	booking	624	Chasing Hope	{"originalBooking":{"title":"Chasing Hope","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Chasing Hope","description":"TRILOGY CLIENT - TBD\\nALL FIELD CAMS","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,14,7],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:50:39.928599
922	24	UPDATE	booking	625	Chasing Hope	{"originalBooking":{"title":"Chasing Hope","type":"production","studioId":5,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Chasing Hope","description":"TRILOGY CLIENT \\nALL FIELD CAMS\\nUSING: STUDIO E, Audience Holding, Better Together Greenroom. \\n\\nIn the afternoon they want to do a shot of 1 talent walking down the hallway by PCR 1 and 2. It will be quick. When I have a better time I will update here!","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24],"color":"#814bd2","studioId":5,"templateId":23,"pcrRoomId":null,"studioIds":[5]},"studioIds":[5],"linkedGroupId":null,"hasLinked":null}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:54:29.802066
923	24	CREATE	booking	694	Silver Sail Entertainment 	{"bookingType":"production","studioId":20,"studioIds":[20,19],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":23,"linkedGroupId":null,"notifyList":[24,7]}	107.115.171.42	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-14 17:57:34.440064
924	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-15 08:33:36.361121
925	25	LOGIN	authentication	25	User martinjw001 logged in	{"username":"martinjw001","name":"Jonathan Martin","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-15 08:38:52.856576
926	13	LOGIN	authentication	13	User dobryan logged in	{"username":"dobryan","name":"Dalin OBryan","role":"engineer","ipAddress":"64.58.141.194"}	64.58.141.194	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-15 09:08:13.838821
927	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"174.195.131.254"}	174.195.131.254	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36	2025-10-15 09:31:49.484722
928	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 11:29:17.15531
929	16	CREATE	booking	695	5 MIN W/ JESUS	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:34:57.233019
930	16	UPDATE	booking	695	5 MIN W/ JESUS	{"originalBooking":{"title":"5 MIN W/ JESUS","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 MIN W/ JESUS","description":"Sheila in P - START @ 1:00PM - 3:30PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":null,"pcrRoomId":null,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:35:13.906702
931	16	CREATE	booking	696	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:44:20.367986
932	16	CREATE	booking	697	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:45:07.28478
933	16	CREATE	booking	698	Centerpoint News Updates	{"bookingType":"production","studioId":8,"studioIds":[8],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:50:48.629427
934	16	UPDATE	booking	695	5 MIN W/ JESUS	{"originalBooking":{"title":"5 MIN W/ JESUS","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 MIN W/ JESUS","description":"Sheila in P - START @ 1:00PM - 3:30PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#d58400","studioId":8,"templateId":null,"pcrRoomId":null,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:51:03.739587
935	16	UPDATE	booking	695	5 MIN W/ JESUS	{"originalBooking":{"title":"5 MIN W/ JESUS","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"5 MIN W/ JESUS","description":"Sheila in P - START @ 1:00PM - 3:30PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#669c35","studioId":8,"templateId":null,"pcrRoomId":null,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:51:13.314215
991	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.9.254"}	10.81.9.254	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 06:49:57.157148
937	16	CREATE	booking	700	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:52:46.072214
938	16	CREATE	booking	701	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:53:12.835947
939	16	CREATE	booking	702	Centerpoint News Updates	{"bookingType":"production","studioId":9,"studioIds":[9],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":12,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:53:34.299702
940	16	CREATE	booking	703	Praise (Plex)	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":8,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 12:55:33.006199
941	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-15 12:57:28.869839
942	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-15 14:26:39.128782
943	16	CREATE	booking	704	MATT X SUNIL	{"bookingType":"production","studioId":11,"studioIds":[11],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:30:45.804756
944	16	UPDATE	booking	704	MATT X SUNIL: New Show	{"originalBooking":{"title":"MATT X SUNIL","type":"production","studioId":11,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MATT X SUNIL: New Show","description":"New Show - 1st Record - START 12:00 PM","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":11,"templateId":null,"pcrRoomId":null,"studioIds":[11]},"studioIds":[11],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:31:05.991545
945	16	UPDATE	booking	704	MATT X SUNIL: New Show	{"originalBooking":{"title":"MATT X SUNIL: New Show","type":"production","studioId":11,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MATT X SUNIL: New Show","description":"New Show - 1st Record - START 12:00 PM\\n\\nThis program will feature Matt Crouch and Sunil Isaac as they discuss stories that build our faith and give glory to God. -\\n\\nThe title for this program is still being worked on so for now, the graphics package for this program will be our Behind The Scenes package. We will also need LED wall content created for Studio C/D. -\\n\\nCamera plan:\\n4 cameras total\\n2 robos\\n1 dolly in the room \\n1 jib in studio D (locked off, shooting into Studio X)\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":11,"templateId":null,"pcrRoomId":null,"studioIds":[11]},"studioIds":[11],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:31:58.234133
946	16	UPDATE	booking	704	MATT X SUNIL: New Show	{"originalBooking":{"title":"MATT X SUNIL: New Show","type":"production","studioId":11,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MATT X SUNIL: New Show","description":"New Show - 1st Record - START 12:00 PM\\n\\nThis program will feature Matt Crouch and Sunil Isaac as they discuss stories that build our faith and give glory to God. - Camera plan:\\n\\n4 cameras total -\\n2 robos -\\n1 dolly in the room -\\n1 jib in studio D (locked off, shooting into Studio X)\\n\\n\\n\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":11,"templateId":null,"pcrRoomId":null,"studioIds":[11]},"studioIds":[11],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:32:51.651534
947	16	UPDATE	booking	704	MATT X SUNIL: New Show	{"originalBooking":{"title":"MATT X SUNIL: New Show","type":"production","studioId":11,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MATT X SUNIL: New Show","description":"New Show - 1st Record - START 12:00 PM\\n\\nThis program will feature Matt Crouch and Sunil Isaac as they discuss stories that build our faith and give glory to God. ---- Camera plan:\\n\\n4 cameras total -\\n2 robos -\\n1 dolly in the room -\\n1 jib in studio D (locked off, shooting into Studio X)\\n\\n\\n\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":11,"templateId":null,"pcrRoomId":null,"studioIds":[11]},"studioIds":[11],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:33:07.163908
948	16	UPDATE	booking	704	MATT X SUNIL: New Show	{"originalBooking":{"title":"MATT X SUNIL: New Show","type":"production","studioId":11,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MATT X SUNIL: New Show","description":"New Show - 1st Record - START 12:00 PM ---\\n\\nThis program will feature Matt Crouch and Sunil Isaac as they discuss stories that build our faith and give glory to God. ---- Camera plan:\\n\\n4 cameras total -\\n2 robos -\\n1 dolly in the room -\\n1 jib in studio D (locked off, shooting into Studio X)\\n\\n\\n\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#4B83E2","studioId":11,"templateId":null,"pcrRoomId":null,"studioIds":[11]},"studioIds":[11],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:33:24.378077
949	16	CREATE	booking	705	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:35:24.882979
950	16	CREATE	booking	706	Stakelbeck Tonight	{"bookingType":"production","studioId":3,"studioIds":[3,4],"startTime":{},"endTime":{},"pcrRoomId":1,"templateId":6,"linkedGroupId":null,"notifyList":[]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 15:36:20.195463
951	16	UPDATE	booking	670	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":8,"templateId":6,"pcrRoomId":64,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 16:03:54.805099
952	16	UPDATE	booking	686	Praise (Plex)	{"originalBooking":{"title":"Praise (Plex)","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise (Plex)","description":"TIM TIMBERLAKE + PHILLP W. - \\nM&L HOST - START @ 4:00PM (PCR1)","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-15 16:04:00.784467
953	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-15 16:21:13.914848
954	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-15 17:13:19.501736
955	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"138.84.46.90"}	138.84.46.90	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-15 18:17:42.953393
956	24	LOGIN	authentication	24	User Ttucker logged in	{"username":"Ttucker","name":"Taylor Tucker","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-16 11:39:53.600492
957	24	CREATE	booking	707	CCSWB Live Stream	{"bookingType":"production","studioId":21,"studioIds":[21],"startTime":{},"endTime":{},"pcrRoomId":112,"templateId":23,"linkedGroupId":null,"notifyList":[24,7,14]}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-16 11:44:49.05963
958	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-16 12:27:05.24787
959	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-16 16:37:03.427947
960	16	UPDATE	booking	704	MATT X SUNIL: New Show	{"originalBooking":{"title":"MATT X SUNIL: New Show","type":"production","studioId":11,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"MATT X SUNIL: New Show","description":"New Show - 1st Record - START 12:00 PM ---\\n\\nThis program will feature Matt Crouch and Sunil Isaac as they discuss stories that build our faith and give glory to God. ---- Camera plan:\\n\\n4 cameras total -\\n2 robos -\\n1 dolly in the room -\\n1 jib in studio D (locked off, shooting into Studio X)\\n\\n\\n\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":11,"templateId":null,"pcrRoomId":null,"studioIds":[11]},"studioIds":[11],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-16 16:38:25.892695
961	15	LOGIN	authentication	15	User sprimm@tbn.tv logged in	{"username":"sprimm@tbn.tv","name":"Scott Primm","role":"engineer","ipAddress":"75.7.109.162"}	75.7.109.162	Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1	2025-10-17 01:23:18.586282
962	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"172.108.191.78"}	172.108.191.78	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-17 14:44:54.333232
963	16	UPDATE	booking	577	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX -\\nLIVE @ 4:00 - 7:00 PM CT / 2:00 - 5:00 PM PT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-17 15:55:08.858939
964	16	UPDATE	booking	578	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX\\n- LIVE @ 4:30 - 7:30 PM CT / 2:30 - 5:30 PM PT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-17 15:55:18.296997
965	16	UPDATE	booking	579	SFC: Zane Gray	{"originalBooking":{"title":"SFC: Zane Gray","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"SFC: Zane Gray","description":"Director: Ryan Tyler -\\nREMOTE IN CABO - Control Room PCR4 @ PLEX\\n- LIVE @ 4:30 - 7:30 PM CT / 2:30 - 5:30 PM PT","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff2600","studioId":13,"templateId":null,"pcrRoomId":64,"studioIds":[13]},"studioIds":[13],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-17 15:55:24.930651
966	24	LOGIN	authentication	24	User Ttucker logged in	{"username":"Ttucker","name":"Taylor Tucker","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-17 17:20:15.957367
999	1	LOGOUT	authentication	1	User admin logged out	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.4.28"}	10.81.4.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 19:44:17.021819
967	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-17 17:26:04.608712
968	16	UPDATE	booking	696	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"3X INBOUND - 12:30 / 1:30 / 2:30\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[14],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-17 17:26:37.73998
969	16	UPDATE	booking	696	Stakelbeck Tonight	{"originalBooking":{"title":"Stakelbeck Tonight","type":"production","studioId":3,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Stakelbeck Tonight","description":"3X INBOUND - 12:30 / 1:30 / 2:30 CT\\n","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#008cb4","studioId":3,"templateId":6,"pcrRoomId":1,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-17 17:26:50.105421
970	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"47.161.47.137"}	47.161.47.137	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1	2025-10-18 14:34:40.131056
971	9	CREATE	booking	708	Praise 	{"bookingType":"production","studioId":4,"studioIds":[4,3],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	47.161.47.137	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1	2025-10-18 14:39:29.056998
972	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"107.130.197.86"}	107.130.197.86	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1	2025-10-20 06:38:55.9672
973	19	LOGIN	authentication	19	User sblack logged in	{"username":"sblack","name":"Stan Black","role":"engineer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 07:56:30.270303
974	9	LOGIN	authentication	9	User LMercado@tbn.tv logged in	{"username":"LMercado@tbn.tv","name":"Lindsay Mercado","role":"site_manager","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-20 09:02:16.51439
975	9	UPDATE	booking	708	Praise 	{"originalBooking":{"title":"Praise ","type":"production","studioId":4,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Praise ","description":"11:00am - M&L host Victor Marx","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ff40ff","studioId":3,"templateId":8,"pcrRoomId":null,"studioIds":[3,4]},"studioIds":[3,4],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-20 09:03:19.075262
976	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"63.209.39.210"}	63.209.39.210	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 09:13:43.160402
977	16	LOGIN	authentication	16	User Grace W logged in	{"username":"Grace W","name":"Grace Woodward","role":"producer","ipAddress":"65.56.123.17"}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-20 12:05:09.621578
978	16	UPDATE	booking	683	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":9,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"BLYNDA","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":12,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15	2025-10-20 14:31:33.297893
979	21	LOGIN	authentication	21	User plexengineering logged in	{"username":"plexengineering","name":"Plex Engineering","role":"engineer","ipAddress":"138.84.46.164"}	138.84.46.164	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 16:05:35.397584
980	9	UPDATE	booking	683	Centerpoint News Updates	{"originalBooking":{"title":"Centerpoint News Updates","type":"production","studioId":8,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Centerpoint News Updates","description":"BLYNDA","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#ffaa00","studioId":8,"templateId":12,"pcrRoomId":1,"studioIds":[8]},"studioIds":[8],"linkedGroupId":null,"hasLinked":null}	65.56.123.17	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15	2025-10-20 17:06:13.465745
981	24	LOGIN	authentication	24	User Ttucker logged in	{"username":"Ttucker","name":"Taylor Tucker","role":"producer","ipAddress":"104.181.253.217"}	104.181.253.217	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-20 20:29:02.292267
982	24	UPDATE	booking	707	CCSWB Stream + Live Event 	{"originalBooking":{"title":"CCSWB Live Stream","type":"production","studioId":21,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CCSWB Stream + Live Event ","description":"Client- Coca-Cola Southwest Beverages \\n\\n12PM-12:45- Stream pre-produced PKG out to their platform for a company wide Town Hall. \\n\\n12:45-1:15PM - 3 CCSWB talent on the commercial stage will present LIVE to the entire company. Taylor will be making graphics for this section of the broadcast. We will need a booth with director, audio, graphics and promotor. \\n\\nOn stage- 2 broadcast cameras with promotor attached. \\n\\n1:30- Wrap","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":112,"studioIds":[18,21]},"studioIds":[18,21],"linkedGroupId":null,"hasLinked":null}	104.181.253.217	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-20 20:34:41.627328
992	1	CREATE	booking	709	Test in use filtering	{"bookingType":"production","studioId":13,"studioIds":[13,10],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	10.81.13.100	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 08:03:09.313405
983	24	UPDATE	booking	707	CCSWB Stream + Live Event 	{"originalBooking":{"title":"CCSWB Stream + Live Event ","type":"production","studioId":18,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"CCSWB Stream + Live Event ","description":"Client- Coca-Cola Southwest Beverages \\n\\n12PM-12:45- Stream pre-produced PKG out to their platform for a company wide Town Hall. \\n\\n12:45-1:15PM - 3 CCSWB talent on the commercial stage will present LIVE to the entire company. Taylor will be making graphics for this section of the broadcast. We will need a booth with director, audio, graphics and promotor. \\n\\nOn stage- 2 broadcast cameras with promotor attached. \\n\\n1:30- Wrap","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[24,7,14],"color":"#814bd2","studioId":18,"templateId":23,"pcrRoomId":112,"studioIds":[18,21]},"studioIds":[18,21],"linkedGroupId":null,"hasLinked":null}	104.181.253.217	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2025-10-20 20:34:56.001559
993	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.10.112	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 17:58:01.925594
1000	1	LOGIN	authentication	1	User admin logged in	{"username":"admin","name":"Admin User","role":"admin","ipAddress":"10.81.5.166"}	10.81.5.166	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 19:44:36.15428
994	1	CREATE	booking	710	Testing timeline 2 day	{"bookingType":"production","studioId":21,"studioIds":[21,17,8],"startTime":{},"endTime":{},"pcrRoomId":null,"templateId":null,"linkedGroupId":null,"notifyList":[]}	10.81.5.166	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:09:31.595867
995	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.9.131	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:11:19.969629
996	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"tentative"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"cancelled","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.6.140	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:15:57.64666
997	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"cancelled"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"confirmed","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.5.166	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:16:08.21259
998	1	UPDATE	booking	709	Test in use filtering	{"originalBooking":{"title":"Test in use filtering","type":"production","studioId":13,"startTime":{},"endTime":{},"status":"confirmed"},"updatedFields":{"title":"Test in use filtering","description":"","type":"production","status":"tentative","start":{},"end":{},"notifyList":[],"color":"#4B83E2","studioId":13,"templateId":null,"pcrRoomId":null,"studioIds":[13,10]},"studioIds":[13,10],"linkedGroupId":null,"hasLinked":null}	10.81.11.23	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0	2025-12-23 18:16:15.589661
\.


--
-- TOC entry 3580 (class 0 OID 156052)
-- Dependencies: 219
-- Data for Name: booking_studios; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
\.


--
-- TOC entry 3582 (class 0 OID 156056)
-- Dependencies: 221
-- Data for Name: booking_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
-- TOC entry 3584 (class 0 OID 156067)
-- Dependencies: 223
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
\.


--
-- TOC entry 3586 (class 0 OID 156078)
-- Dependencies: 225
-- Data for Name: file_attachments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
-- TOC entry 3588 (class 0 OID 156085)
-- Dependencies: 227
-- Data for Name: invite_tokens; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
-- TOC entry 3590 (class 0 OID 156093)
-- Dependencies: 229
-- Data for Name: linked_bookings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.linked_bookings (id, primary_booking_id, linked_booking_id, created_at) FROM stdin;
\.


--
-- TOC entry 3592 (class 0 OID 156099)
-- Dependencies: 231
-- Data for Name: notification_groups; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.notification_groups (id, name, email, group_type, description, enabled) FROM stdin;
9	TBN Staff	TBN-Staff-Calendar@tbn.tv	department	Default group for facility management notifications.	t
14	Plex Engineering	plexengineering@tbn.tv	department	Plex Engineering group\n	t
7	Facility Management	Plex-facilities-calendar@tbn.tv	department	Default group for facility management notifications.	t
\.


--
-- TOC entry 3594 (class 0 OID 156106)
-- Dependencies: 233
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
1295	1	Booking Confirmation	Your booking for Testing timeline 2 day has been created successfully.	booking_created	f	710	2025-12-23 18:09:31.679
1296	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:11:19.99
1297	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:15:57.667
1298	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:16:08.228
1299	1	Booking Updated	Your booking for "Test in use filtering" has been updated.	booking_updated	f	709	2025-12-23 18:16:15.605
\.


--
-- TOC entry 3596 (class 0 OID 156114)
-- Dependencies: 235
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.password_reset_tokens (id, token, user_id, expires, created_at, used) FROM stdin;
1	1c6fe6b5274f36dabadabc3a4a1cd0ea78839381112e18f05aee45f55a23ef2a	12	2025-09-12 21:47:30.461	2025-09-12 16:17:30.462511	t
\.


--
-- TOC entry 3598 (class 0 OID 156122)
-- Dependencies: 237
-- Data for Name: pcr_rooms; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pcr_rooms (id, name, description, status) FROM stdin;
1	PCR 1- ACR 1		available
2	PCR 2 - ACR 2		available
65	PCR 5 - ACR 3		available
112	PCR 3 - ACR 3		available
64	PCR 4 - ACR 4		available
\.


--
-- TOC entry 3600 (class 0 OID 156129)
-- Dependencies: 239
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
I9NWmZLuQFSlJYuNUPtqlhGnU46imXNI	{"cookie":{"originalMaxAge":86400000,"expires":"2025-12-24T19:44:36.182Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":1}}	2025-12-25 02:00:00
\.


--
-- TOC entry 3601 (class 0 OID 156134)
-- Dependencies: 240
-- Data for Name: studios; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
-- TOC entry 3603 (class 0 OID 156142)
-- Dependencies: 242
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.system_settings (key, value, description, updated_at, id, created_at) FROM stdin;
siteName	The Plex Studios	The name of the facility displayed throughout the application	2025-05-08 21:35:01.620846+00	1	2025-05-08 22:36:16.723075+00
site_name	BookStud.io	\N	2025-08-02 23:38:43.650914+00	36	2025-08-02 23:38:43.650914+00
facility_name	Production Facility	\N	2025-08-02 23:38:43.658499+00	37	2025-08-02 23:38:43.658499+00
backup_enabled	true	\N	2025-08-02 23:38:43.665427+00	38	2025-08-02 23:38:43.665427+00
backup_retention_days	7	\N	2025-08-02 23:38:43.671919+00	39	2025-08-02 23:38:43.671919+00
\.


--
-- TOC entry 3604 (class 0 OID 156149)
-- Dependencies: 243
-- Data for Name: system_settings_backup; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.system_settings_backup (key, value, description, updated_at) FROM stdin;
siteName	The Plex Studios	The name of the facility displayed throughout the application	2025-05-08 21:35:01.620846+00
\.


--
-- TOC entry 3606 (class 0 OID 156155)
-- Dependencies: 245
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.team_members (id, team_id, user_id, role, joined_at) FROM stdin;
3	2	23	member	2025-08-03 14:15:33.5989
4	2	24	member	2025-08-03 14:15:40.411979
5	2	22	member	2025-08-03 14:15:46.248894
9	2	6	member	2025-08-04 03:53:22.843539
\.


--
-- TOC entry 3608 (class 0 OID 156163)
-- Dependencies: 247
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.teams (id, name, description, created_by, created_at, updated_at) FROM stdin;
2	Trilogy Studios		1	2025-08-03 14:15:21.562285	2025-08-03 14:15:21.562285
\.


--
-- TOC entry 3610 (class 0 OID 156171)
-- Dependencies: 249
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
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
-- TOC entry 3612 (class 0 OID 156182)
-- Dependencies: 251
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, email, name, role) FROM stdin;
8	DHarvilla	de595f4de1dd1f8fabce5dc40b49d68bf17b395d933b1fdeff669bbbf70a5c113d66b5a0ab873e55169c537f7007334d66da65ed9d256d66d2c283300569f905.3ccb32961d192fe4b3e653329dca57e1	dharvilla@tbn.tv	David Harvilla	it
9	LMercado@tbn.tv	32e175dcbc58dbe5ace440b5786972e5269da89edd23badf6d2faf10bd18720f3eab6ba21f9086f14fd596c0b8db3c67b56429ae136d32ecdcb2e7331cafcfc4.020337313a7fa4c2d0d90a1acb42dda0	lmercado@tbn.tv	Lindsay Mercado	site_manager
10	ddigello	da653f032b623e0463efa7d76f81999880b6f2447257b39c182c0ab5bf3aac0a0d939a0fc84a1709e8600bf593f3ef117a4a6945bda732497d42973535d1f21f.89f43619687f5ae0fb7db534d1171e0c	ddigello@tbn.tv	Daniel DiGello	it
11	tmontez@tbn.tv	a454e5a2a16477e946b1ee81bdc5bacf8b4127a643c206249c3f90efafc29409930421d4dbd949856e09cd45e797bd66792770cd9b518a4b1f583be379fbfaea.730b05ccfee76f6c152bc72846cf7306	tmontez@tbn.tv	Antonio Montez	it
6	osandoval	e503e3c7eacbfe17282a5195cb014323a9d1251fdb4bbb9ab31a30446c12f8da6daf92c818d2781db98964568151d2b67c65fe9590b0a3e29241f1d960ec91a8.9cdb1e2c8eea6f5ba45264d8ab2863d0	osandoval@tbn.tv	Obed Sandoval	site_manager
20	obedtest2	b4852e3df0d1b598916951d134253bb7b572d35c0e1b06476076230f5bebd7a0564beb790a79039882135b6ed5482ac9b316d12f7135fe4ded0a3034b67fb809.e1a5e975cf15d251d62d267287672e1a	obedconference@tbn.tv	Obed Engineer	engineer
13	dobryan	4aa6f9944dc6dbecc1f375c9d1a1630807831e653b9bb070dbd613df5eed91dca601e23f7642ea804793e269e8ea3ff8859919f2dfe0f74db9b323aef6de0784.2345d3227a00777bcc3ed7cdf8bcda69	dobryan@tbn.tv	Dalin OBryan	engineer
15	sprimm@tbn.tv	3ac3f930d81c168bcdfc4722463a57af36c409e826a9e8710d0df2e91d1ba16e35601de989b84ac1d93ff4541984df496ce9538fba9f4f757f4b95a827d78f80.d10bb82c9f96c28544120f90195e0c28	sprimm@tbn.tv	Scott Primm	engineer
16	Grace W	4122913b9f5481725da46ee986559d3b8c78d9c9f012fde93a4c6ad00e7c442354a14b0aac2c79feb1a0c62de6c972c702789eac6b969bfabf4d6c882caf6c2f.b4d7b44699ded4ed8951caec7d37eb55	gwoodward@tbn.tv	Grace Woodward	producer
7	Obedtest	26f23ee2d82ac1acbadee1f09c6314857c79c16d14262ffa96274d953701d44e876f708220c05d74eb6944fa813eb259b708b29d3e5e1bbad25b4b09112f6e21.cbdfd7c227155bb71f5c27e64c7c05ae	obedtest@tbn.tv	Obed Test	producer
27	obedview	5d6990559a0c0c6335bd9a0a891cbc469d0cbe3880190a457d64b23d1410af62680c464d17d2a791e3a402b8b85bce833ad0c9d21397f3e37db6afdbbc619037.ee46808f864eb4fc6b69962caafee07a	tbnobed@gmail.com	Obed Viewer	viewer
28	ejeannerat@tbn.tv	6f45fd2a471883d2e2e981244a0835128e75389dfe0ba706c29b2c92f7f9cd27d72077766e54b7a981eacaec6b73b648b7dbeb769257c864bcd01326a8209377.6f830da2ceada6c785e13f9c5a293dbd	ejeannerat@tbn.tv	Eric Jeannerat	engineer
19	sblack	d04fcb4ae06b67e7e32e6df0d1e27dd7b055b1050c8f9939bbddb893e741b293e6511328f66365cb252e7826cf966b10233be6852811017d650aedbdc4bb4e97.650ce59b17bb391b1a761306194d5a13	sblack@tbn.tv	Stan Black	engineer
21	plexengineering	TBN@Plex456$$	plexengineering@tbn.tv	Plex Engineering	engineer
22	PMay	8284448ebfb45035a65e39b7678dafa5ccb1c29efe25919fdf8c81195ca958c3aa026d860a4612247ef5cf5f65c6ae86e2a3ec4569378023e4864c623ec7a0e0.1a15c9196d66a50c0956527edfc89de0	pmay@trilogystudios.com	Parke May	producer
23	sarajoyner66	db6f32516f1430b8e61ec998dbde0199c143200d2df9e40e352c83d1cddb657a9e20bb1028d86ae36863e2495eb84ebbee0ea3aa9af9de8e24ea14dbce1e8e83.f51bafce4d4af38b8d68a62cc6083eb3	SJoyner@trilogystudios.com	Sara Joyner	producer
24	Ttucker	9f90b7921efd084f68f58505f0d983c44cb4ac5f4ac7f619705c459b9f35bad89466b96e468ae33a420f7cf99cac0d071008605f6b741165cdd5279775d6c166.0b496c1a31a5b2595784e186a4f9258c	TTucker@trilogystudios.com	Taylor Tucker	producer
25	martinjw001	ab729e872dd5e4874cb54cce2fee8f2dd429e06b855178334cbc7a819a3c06c7583b278473d83823d9b24c88c823c59bfe1081c66e8e1a8ca94b9562e7a28b9a.b52c08b53664f687594dbb7c37eb72d8	jmartin@tbn.tv	Jonathan Martin	producer
26	Steve Fjordbak	67873b74e9c294908bf9add8f02eaae4030ee836970f9277d83b2c15c2b739ec7be9af73e420a3577858f621598465a720b7523776a164affbb0d667a957dc13.1f6c63b33cf11fec5c33e2798b95c203	sfjordbak@tbn.tv	STEVE FJORDBAK	producer
1	admin	c6797af737da3138fad234f76f8338c7849c9d7d7dc8d62a65ca7af2efecbfa4f306965db0cf05b6fd51ed59c3955f01b9fe94b82e2b98c19204c3cf5e94ffd8.2933513279923aa05df079d0f74c034e	admin@obedtv.com	Admin User	admin
12	zmorales	ac140804e6ccc5579fc2a5ce8230de218f2393df2477192389256aad097ca10bc3e1a514c03850e089101262dc62382918bb4f8979d80cb1360ab42aa805682d.17d07d438d4cf10946243c5beb04a528	zmorales@tbn.tv	Zachariah Morales	admin
\.


--
-- TOC entry 3639 (class 0 OID 0)
-- Dependencies: 216
-- Name: alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.alerts_id_seq', 31, true);


--
-- TOC entry 3640 (class 0 OID 0)
-- Dependencies: 218
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1000, true);


--
-- TOC entry 3641 (class 0 OID 0)
-- Dependencies: 220
-- Name: booking_studios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.booking_studios_id_seq', 13302, true);


--
-- TOC entry 3642 (class 0 OID 0)
-- Dependencies: 222
-- Name: booking_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.booking_types_id_seq', 14, true);


--
-- TOC entry 3643 (class 0 OID 0)
-- Dependencies: 224
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.bookings_id_seq', 710, true);


--
-- TOC entry 3644 (class 0 OID 0)
-- Dependencies: 226
-- Name: file_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.file_attachments_id_seq', 15, true);


--
-- TOC entry 3645 (class 0 OID 0)
-- Dependencies: 228
-- Name: invite_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invite_tokens_id_seq', 29, true);


--
-- TOC entry 3646 (class 0 OID 0)
-- Dependencies: 230
-- Name: linked_bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.linked_bookings_id_seq', 1, false);


--
-- TOC entry 3647 (class 0 OID 0)
-- Dependencies: 232
-- Name: notification_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.notification_groups_id_seq', 40, true);


--
-- TOC entry 3648 (class 0 OID 0)
-- Dependencies: 234
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1299, true);


--
-- TOC entry 3649 (class 0 OID 0)
-- Dependencies: 236
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, true);


--
-- TOC entry 3650 (class 0 OID 0)
-- Dependencies: 238
-- Name: pcr_rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pcr_rooms_id_seq', 241, true);


--
-- TOC entry 3651 (class 0 OID 0)
-- Dependencies: 241
-- Name: studios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.studios_id_seq', 23, true);


--
-- TOC entry 3652 (class 0 OID 0)
-- Dependencies: 244
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 39, true);


--
-- TOC entry 3653 (class 0 OID 0)
-- Dependencies: 246
-- Name: team_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.team_members_id_seq', 9, true);


--
-- TOC entry 3654 (class 0 OID 0)
-- Dependencies: 248
-- Name: teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.teams_id_seq', 2, true);


--
-- TOC entry 3655 (class 0 OID 0)
-- Dependencies: 250
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.templates_id_seq', 24, true);


--
-- TOC entry 3656 (class 0 OID 0)
-- Dependencies: 252
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 28, true);


--
-- TOC entry 3335 (class 2606 OID 156208)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 3342 (class 2606 OID 156210)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3349 (class 2606 OID 156212)
-- Name: booking_studios booking_studios_booking_id_studio_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT booking_studios_booking_id_studio_id_key UNIQUE (booking_id, studio_id);


--
-- TOC entry 3351 (class 2606 OID 156214)
-- Name: booking_studios booking_studios_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT booking_studios_pkey PRIMARY KEY (id);


--
-- TOC entry 3355 (class 2606 OID 156216)
-- Name: booking_types booking_types_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_types
    ADD CONSTRAINT booking_types_name_key UNIQUE (name);


--
-- TOC entry 3357 (class 2606 OID 156218)
-- Name: booking_types booking_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_types
    ADD CONSTRAINT booking_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3359 (class 2606 OID 156220)
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 3365 (class 2606 OID 156222)
-- Name: file_attachments file_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 3367 (class 2606 OID 156224)
-- Name: invite_tokens invite_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3369 (class 2606 OID 156226)
-- Name: invite_tokens invite_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_token_key UNIQUE (token);


--
-- TOC entry 3373 (class 2606 OID 156228)
-- Name: linked_bookings linked_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT linked_bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 3375 (class 2606 OID 156230)
-- Name: linked_bookings linked_bookings_primary_booking_id_linked_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT linked_bookings_primary_booking_id_linked_booking_id_key UNIQUE (primary_booking_id, linked_booking_id);


--
-- TOC entry 3377 (class 2606 OID 156232)
-- Name: notification_groups notification_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notification_groups
    ADD CONSTRAINT notification_groups_name_key UNIQUE (name);


--
-- TOC entry 3379 (class 2606 OID 156234)
-- Name: notification_groups notification_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notification_groups
    ADD CONSTRAINT notification_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3381 (class 2606 OID 156236)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3383 (class 2606 OID 156238)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3385 (class 2606 OID 156240)
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- TOC entry 3387 (class 2606 OID 156242)
-- Name: pcr_rooms pcr_rooms_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pcr_rooms
    ADD CONSTRAINT pcr_rooms_name_key UNIQUE (name);


--
-- TOC entry 3389 (class 2606 OID 156244)
-- Name: pcr_rooms pcr_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pcr_rooms
    ADD CONSTRAINT pcr_rooms_pkey PRIMARY KEY (id);


--
-- TOC entry 3392 (class 2606 OID 156246)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 3394 (class 2606 OID 156248)
-- Name: studios studios_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_name_key UNIQUE (name);


--
-- TOC entry 3396 (class 2606 OID 156250)
-- Name: studios studios_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_pkey PRIMARY KEY (id);


--
-- TOC entry 3398 (class 2606 OID 156252)
-- Name: system_settings system_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_unique UNIQUE (key);


--
-- TOC entry 3400 (class 2606 OID 156254)
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3404 (class 2606 OID 156256)
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- TOC entry 3406 (class 2606 OID 156258)
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- TOC entry 3409 (class 2606 OID 156260)
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- TOC entry 3411 (class 2606 OID 156262)
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- TOC entry 3413 (class 2606 OID 156264)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3415 (class 2606 OID 156266)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3390 (class 1259 OID 156267)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 3336 (class 1259 OID 156268)
-- Name: idx_alerts_created_by; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_alerts_created_by ON public.alerts USING btree (created_by);


--
-- TOC entry 3337 (class 1259 OID 156269)
-- Name: idx_alerts_end; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_alerts_end ON public.alerts USING btree ("end");


--
-- TOC entry 3338 (class 1259 OID 156270)
-- Name: idx_alerts_start; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_alerts_start ON public.alerts USING btree (start);


--
-- TOC entry 3339 (class 1259 OID 156271)
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- TOC entry 3340 (class 1259 OID 156272)
-- Name: idx_alerts_type; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_alerts_type ON public.alerts USING btree (alert_type);


--
-- TOC entry 3343 (class 1259 OID 156273)
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- TOC entry 3344 (class 1259 OID 156274)
-- Name: idx_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs USING btree (entity_id);


--
-- TOC entry 3345 (class 1259 OID 156275)
-- Name: idx_audit_logs_entity_type; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs USING btree (entity_type);


--
-- TOC entry 3346 (class 1259 OID 156276)
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- TOC entry 3347 (class 1259 OID 156277)
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- TOC entry 3352 (class 1259 OID 156278)
-- Name: idx_booking_studios_booking_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_booking_studios_booking_id ON public.booking_studios USING btree (booking_id);


--
-- TOC entry 3353 (class 1259 OID 156279)
-- Name: idx_booking_studios_studio_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_booking_studios_studio_id ON public.booking_studios USING btree (studio_id);


--
-- TOC entry 3360 (class 1259 OID 156280)
-- Name: idx_bookings_end; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bookings_end ON public.bookings USING btree ("end");


--
-- TOC entry 3361 (class 1259 OID 156281)
-- Name: idx_bookings_start; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bookings_start ON public.bookings USING btree (start);


--
-- TOC entry 3362 (class 1259 OID 156282)
-- Name: idx_bookings_studio_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bookings_studio_id ON public.bookings USING btree (studio_id);


--
-- TOC entry 3363 (class 1259 OID 156283)
-- Name: idx_bookings_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_bookings_user_id ON public.bookings USING btree (user_id);


--
-- TOC entry 3370 (class 1259 OID 156284)
-- Name: idx_linked_bookings_linked; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_linked_bookings_linked ON public.linked_bookings USING btree (linked_booking_id);


--
-- TOC entry 3371 (class 1259 OID 156285)
-- Name: idx_linked_bookings_primary; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_linked_bookings_primary ON public.linked_bookings USING btree (primary_booking_id);


--
-- TOC entry 3401 (class 1259 OID 156286)
-- Name: idx_team_members_team_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_team_members_team_id ON public.team_members USING btree (team_id);


--
-- TOC entry 3402 (class 1259 OID 156287)
-- Name: idx_team_members_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_team_members_user_id ON public.team_members USING btree (user_id);


--
-- TOC entry 3407 (class 1259 OID 156288)
-- Name: idx_teams_created_by; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_teams_created_by ON public.teams USING btree (created_by);


--
-- TOC entry 3418 (class 2606 OID 156289)
-- Name: bookings bookings_pcr_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pcr_room_id_fkey FOREIGN KEY (pcr_room_id) REFERENCES public.pcr_rooms(id) ON DELETE SET NULL;


--
-- TOC entry 3419 (class 2606 OID 156294)
-- Name: bookings bookings_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id);


--
-- TOC entry 3420 (class 2606 OID 156299)
-- Name: bookings bookings_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- TOC entry 3421 (class 2606 OID 156304)
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3422 (class 2606 OID 156309)
-- Name: file_attachments file_attachments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3423 (class 2606 OID 156314)
-- Name: file_attachments file_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3416 (class 2606 OID 156319)
-- Name: booking_studios fk_booking_id; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT fk_booking_id FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3425 (class 2606 OID 156324)
-- Name: linked_bookings fk_linked_bookings_linked; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT fk_linked_bookings_linked FOREIGN KEY (linked_booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3426 (class 2606 OID 156329)
-- Name: linked_bookings fk_linked_bookings_primary; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.linked_bookings
    ADD CONSTRAINT fk_linked_bookings_primary FOREIGN KEY (primary_booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3417 (class 2606 OID 156334)
-- Name: booking_studios fk_studio_id; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT fk_studio_id FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- TOC entry 3424 (class 2606 OID 156339)
-- Name: invite_tokens invite_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 3427 (class 2606 OID 156344)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3428 (class 2606 OID 156349)
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3429 (class 2606 OID 156354)
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- TOC entry 3430 (class 2606 OID 156359)
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3431 (class 2606 OID 156364)
-- Name: teams teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3432 (class 2606 OID 156369)
-- Name: templates templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3620 (class 0 OID 0)
-- Dependencies: 3619
-- Name: DATABASE neondb; Type: ACL; Schema: -; Owner: neondb_owner
--

GRANT ALL ON DATABASE neondb TO neon_superuser;


--
-- TOC entry 2133 (class 826 OID 16392)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- TOC entry 2132 (class 826 OID 16391)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


-- Completed on 2025-12-24 02:00:04 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict OlYeQTwbzPPnbb6cU6xRoKN7eaEjvfWyGKlqV8kxjGfAoeLrZOck4lKEoOlTx3H

