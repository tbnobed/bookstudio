--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.5

-- Started on 2025-06-24 02:00:00 UTC

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
-- TOC entry 3487 (class 1262 OID 16389)
-- Name: neondb; Type: DATABASE; Schema: -; Owner: neondb_owner
--

CREATE DATABASE neondb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE neondb OWNER TO neondb_owner;

\connect neondb

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 235 (class 1259 OID 73738)
-- Name: booking_studios; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.booking_studios (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    studio_id integer NOT NULL
);


ALTER TABLE public.booking_studios OWNER TO neondb_owner;

--
-- TOC entry 234 (class 1259 OID 73737)
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
-- TOC entry 3489 (class 0 OID 0)
-- Dependencies: 234
-- Name: booking_studios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.booking_studios_id_seq OWNED BY public.booking_studios.id;


--
-- TOC entry 216 (class 1259 OID 24577)
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
    template_id integer,
    notify_list json DEFAULT '[]'::json,
    created_at timestamp without time zone DEFAULT now(),
    severity text DEFAULT 'medium'::text,
    pcr_room_id integer,
    status text DEFAULT 'confirmed'::text,
    color text
);


ALTER TABLE public.bookings OWNER TO neondb_owner;

--
-- TOC entry 215 (class 1259 OID 24576)
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
-- TOC entry 3490 (class 0 OID 0)
-- Dependencies: 215
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- TOC entry 233 (class 1259 OID 65537)
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
-- TOC entry 232 (class 1259 OID 65536)
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
-- TOC entry 3491 (class 0 OID 0)
-- Dependencies: 232
-- Name: file_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.file_attachments_id_seq OWNED BY public.file_attachments.id;


--
-- TOC entry 229 (class 1259 OID 57345)
-- Name: invite_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invite_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    role text NOT NULL,
    email text NOT NULL,
    expires timestamp without time zone NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    used boolean DEFAULT false
);


ALTER TABLE public.invite_tokens OWNER TO neondb_owner;

--
-- TOC entry 228 (class 1259 OID 57344)
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
-- TOC entry 3492 (class 0 OID 0)
-- Dependencies: 228
-- Name: invite_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invite_tokens_id_seq OWNED BY public.invite_tokens.id;


--
-- TOC entry 227 (class 1259 OID 49153)
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
-- TOC entry 226 (class 1259 OID 49152)
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
-- TOC entry 3493 (class 0 OID 0)
-- Dependencies: 226
-- Name: notification_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notification_groups_id_seq OWNED BY public.notification_groups.id;


--
-- TOC entry 218 (class 1259 OID 24588)
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
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO neondb_owner;

--
-- TOC entry 217 (class 1259 OID 24587)
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
-- TOC entry 3494 (class 0 OID 0)
-- Dependencies: 217
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 231 (class 1259 OID 57358)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    token text NOT NULL,
    user_id integer NOT NULL,
    expires timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    used boolean DEFAULT false
);


ALTER TABLE public.password_reset_tokens OWNER TO neondb_owner;

--
-- TOC entry 230 (class 1259 OID 57357)
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
-- TOC entry 3495 (class 0 OID 0)
-- Dependencies: 230
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- TOC entry 239 (class 1259 OID 73759)
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
-- TOC entry 238 (class 1259 OID 73758)
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
-- TOC entry 3496 (class 0 OID 0)
-- Dependencies: 238
-- Name: pcr_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pcr_rooms_id_seq OWNED BY public.pcr_rooms.id;


--
-- TOC entry 225 (class 1259 OID 40960)
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- TOC entry 220 (class 1259 OID 24599)
-- Name: studios; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.studios (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'available'::text NOT NULL
);


ALTER TABLE public.studios OWNER TO neondb_owner;

--
-- TOC entry 219 (class 1259 OID 24598)
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
-- TOC entry 3497 (class 0 OID 0)
-- Dependencies: 219
-- Name: studios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.studios_id_seq OWNED BY public.studios.id;


--
-- TOC entry 237 (class 1259 OID 73746)
-- Name: system_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.system_settings OWNER TO neondb_owner;

--
-- TOC entry 236 (class 1259 OID 73745)
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
-- TOC entry 3498 (class 0 OID 0)
-- Dependencies: 236
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- TOC entry 222 (class 1259 OID 24611)
-- Name: templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    duration integer NOT NULL,
    created_by integer NOT NULL,
    studio_ids json DEFAULT '[]'::json,
    pcr_room_id integer,
    status text DEFAULT 'confirmed'::text,
    color text,
    notify_list json DEFAULT '[]'::json,
    start_time text,
    end_time text
);


ALTER TABLE public.templates OWNER TO neondb_owner;

--
-- TOC entry 221 (class 1259 OID 24610)
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
-- TOC entry 3499 (class 0 OID 0)
-- Dependencies: 221
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- TOC entry 224 (class 1259 OID 24622)
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'producer'::text NOT NULL
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- TOC entry 223 (class 1259 OID 24621)
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
-- TOC entry 3500 (class 0 OID 0)
-- Dependencies: 223
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3265 (class 2604 OID 73741)
-- Name: booking_studios id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_studios ALTER COLUMN id SET DEFAULT nextval('public.booking_studios_id_seq'::regclass);


--
-- TOC entry 3239 (class 2604 OID 24580)
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- TOC entry 3263 (class 2604 OID 65540)
-- Name: file_attachments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments ALTER COLUMN id SET DEFAULT nextval('public.file_attachments_id_seq'::regclass);


--
-- TOC entry 3257 (class 2604 OID 57348)
-- Name: invite_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invite_tokens ALTER COLUMN id SET DEFAULT nextval('public.invite_tokens_id_seq'::regclass);


--
-- TOC entry 3255 (class 2604 OID 49156)
-- Name: notification_groups id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notification_groups ALTER COLUMN id SET DEFAULT nextval('public.notification_groups_id_seq'::regclass);


--
-- TOC entry 3244 (class 2604 OID 24591)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 3260 (class 2604 OID 57361)
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- TOC entry 3269 (class 2604 OID 73762)
-- Name: pcr_rooms id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pcr_rooms ALTER COLUMN id SET DEFAULT nextval('public.pcr_rooms_id_seq'::regclass);


--
-- TOC entry 3247 (class 2604 OID 24602)
-- Name: studios id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.studios ALTER COLUMN id SET DEFAULT nextval('public.studios_id_seq'::regclass);


--
-- TOC entry 3266 (class 2604 OID 73749)
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- TOC entry 3249 (class 2604 OID 24614)
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- TOC entry 3253 (class 2604 OID 24625)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3477 (class 0 OID 73738)
-- Dependencies: 235
-- Data for Name: booking_studios; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.booking_studios (id, booking_id, studio_id) FROM stdin;
1	12	3
2	15	5
3	16	2
5	24	5
6	25	1
7	26	3
9	20	5
10	28	6
11	29	5
13	29	8
36	34	3
41	35	6
42	35	3
43	36	5
48	38	1
49	38	2
54	49	2
55	31	3
56	31	6
57	30	6
58	30	7
59	50	6
60	50	7
61	51	1
63	27	6
64	27	7
65	33	2
66	33	1
71	52	5
76	60	6
80	64	3
81	65	9
82	65	1
83	23	2
86	67	2
87	67	1
88	68	2
89	68	1
92	70	2
93	70	1
100	74	2
101	74	1
102	75	2
103	75	1
104	76	2
105	76	1
106	69	2
107	69	1
108	77	2
109	77	1
110	78	1
111	78	2
112	72	2
113	72	1
114	79	1
115	79	2
116	73	2
117	73	1
123	83	2
126	84	6
127	84	3
128	82	1
129	71	2
130	71	1
152	116	5
185	145	5
186	146	7
188	148	2
190	151	5
191	161	3
193	149	5
194	170	1
195	170	5
\.


--
-- TOC entry 3458 (class 0 OID 24577)
-- Dependencies: 216
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.bookings (id, title, description, studio_id, user_id, start, "end", type, template_id, notify_list, created_at, severity, pcr_room_id, status, color) FROM stdin;
31	Test 5/14 1am to 6am 	This is a test entry	3	1	2025-05-14 06:00:00	2025-05-14 11:00:00	production	\N	[]	2025-05-11 07:18:50.304	medium	1	confirmed	#4B83E2
30	Test 5/13 12:30 am to 12 pm 		6	1	2025-05-13 05:30:00	2025-05-13 17:00:00	production	\N	[]	2025-05-11 07:11:51.488	medium	\N	confirmed	#d84be2
64	test	test	3	1	2025-05-11 16:00:00	2025-05-11 17:00:00	production	\N	[]	2025-06-04 17:53:42.753	medium	\N	confirmed	\N
50	Test 5/13 11 am to 12 pm  - copy to 5/14, 5/15		6	1	2025-05-16 16:00:00	2025-05-16 17:00:00	production	\N	[]	2025-05-11 09:35:17.896	medium	\N	confirmed	#d84be2
65	Test booking		9	1	2025-06-06 16:00:00	2025-06-06 17:00:00	production	\N	[1]	2025-06-05 20:06:53.345	medium	\N	confirmed	#4B83E2
23	Morning news	MSM Morning news	2	1	2025-04-30 14:00:00	2025-04-30 17:00:00	production	\N	[null]	2025-05-04 01:34:04.572	medium	\N	confirmed	\N
51	News Update		1	1	2025-05-08 16:00:00	2025-05-08 17:00:00	production	\N	[]	2025-05-11 16:26:11.722	medium	\N	confirmed	#4B83E2
12	Better Together - Laurie with Sheyla		3	1	2025-04-27 16:00:00	2025-04-27 23:30:00	production	\N	["Camera Operators","Lighting Technicians","Directors","Sound Engineers","Production Assistants"]	2025-05-03 22:34:44.822	medium	\N	confirmed	\N
14	Network update		\N	1	2025-05-01 05:00:00	2025-05-01 06:30:00	maintenance	\N	[]	2025-05-03 22:35:39.938	medium	\N	confirmed	\N
15	DP Podcast		5	1	2025-04-28 16:00:00	2025-04-28 23:30:00	rehearsal	\N	[]	2025-05-03 22:43:52.254	medium	\N	confirmed	\N
13	Comms Outage		\N	1	2025-04-29 07:00:00	2025-04-30 06:59:59.999	all-day:maintenance	\N	[]	2025-05-03 22:35:18.449	critical	\N	confirmed	\N
16	Stacks Tonight		2	1	2025-04-30 23:00:00	2025-05-01 03:00:00	production	\N	["Camera Operators"]	2025-05-03 22:51:53.412	medium	\N	confirmed	\N
19	MU2 TOA Space issue	MU2 TOA ran out of space.  Working on a fix	\N	1	2025-05-03 07:00:00	2025-05-04 06:59:59.999	all-day:maintenance	\N	[]	2025-05-03 23:36:16.646	medium	\N	confirmed	\N
34	5/13 1am to 7am		3	1	2025-05-13 06:00:00	2025-05-13 12:00:00	production	\N	[1]	2025-05-11 07:52:58.677	medium	\N	confirmed	#06b17e
24	DP Townhall		5	1	2025-04-29 02:30:00	2025-04-29 05:30:00	production	\N	[]	2025-05-04 01:41:26.296	medium	\N	confirmed	\N
25	MSM PM News	Prep starts at 6pm then we walk away at 9pm	1	1	2025-05-02 01:00:00	2025-05-02 04:00:00	production	\N	["Engineering","Production Assistants","Sound Engineers"]	2025-05-04 02:54:42.986	medium	\N	confirmed	\N
27	test 5/11 7am to 5pm 	test 5/11 7am to 5pm description 	6	1	2025-05-11 16:00:00	2025-05-11 17:00:00	production	\N	[]	2025-05-04 04:40:23.009	medium	1	confirmed	#069004
33	New 5/11 6am to 7pm 	New 5/11 6am to 7pm 	2	1	2025-05-11 11:00:00	2025-05-12 00:00:00	production	\N	[]	2025-05-11 07:36:08.652	medium	1	confirmed	#d30da8
26	Morning News 		3	1	2025-05-04 16:00:00	2025-05-04 21:30:00	production	\N	["Camera Operators","Lighting Technicians","Directors","Engineering","Sound Engineers","Production Assistants"]	2025-05-04 03:24:28.799	medium	\N	confirmed	\N
67	News	Test template update	2	1	2025-05-13 11:00:00	2025-05-14 03:00:00	production	8	[1,5]	2025-06-05 20:38:35.904	medium	1	confirmed	#d30da8
35	5/15 1am to 6am 	test 5/15 1am to 6am 	6	1	2025-05-15 06:00:00	2025-05-15 11:00:00	production	\N	[]	2025-05-11 07:57:32.171	medium	\N	confirmed	#be9a19
36	Test 12:30am to 4am 		5	1	2025-05-11 05:30:00	2025-05-11 06:00:00	production	\N	[]	2025-05-11 08:02:28.493	medium	\N	confirmed	#2f3d56
20	TCL 	TCL out of MU2	5	1	2025-05-03 23:00:00	2025-05-04 05:30:00	production	\N	["Engineering","Camera Operators","Production Assistants","Sound Engineers","Lighting Technicians","Directors"]	2025-05-03 23:36:58.731	medium	\N	confirmed	\N
28	DP Podcast		6	1	2025-05-05 16:00:00	2025-05-05 18:00:00	production	\N	[]	2025-05-05 00:57:01.07	medium	\N	confirmed	\N
29	Stacks Tonight		5	1	2025-05-07 00:00:00	2025-05-07 05:00:00	production	\N	[]	2025-05-05 05:59:54.617	medium	\N	confirmed	\N
38	5/15 1am to 3:30am		1	1	2025-05-15 06:00:00	2025-05-15 08:30:00	production	\N	[1]	2025-05-11 08:29:20.68	medium	\N	confirmed	#d84be2
68	News	Test template update	2	1	2025-05-14 16:00:00	2025-05-15 03:00:00	production	8	[1,5]	2025-06-05 22:59:41.676	medium	1	confirmed	#d30da8
48	Test alert		\N	1	2025-05-11 14:00:00	2025-05-11 15:00:00	maintenance	\N	[]	2025-05-11 09:03:41.755	low	\N	confirmed	\N
49	booking 5/16 1am to 3am		2	1	2025-05-16 06:00:00	2025-05-16 08:00:00	production	\N	[]	2025-05-11 09:13:34.127	medium	\N	confirmed	#33703a
52	Test booking 5/11 am to 5pm test edit		5	1	2025-05-10 06:00:00	2025-05-10 17:00:00	production	\N	[]	2025-05-11 16:27:34.848	medium	\N	confirmed	#4B83E2
70	News 2	New 5/11 6am to 7pm 	2	1	2025-06-10 11:00:00	2025-06-11 00:00:00	production	9	[]	2025-06-05 23:35:36.913	medium	1	confirmed	#d30da8
60	5/20 1am to 4am		6	7	2025-05-20 06:00:00	2025-05-20 09:00:00	production	\N	[]	2025-05-14 16:17:37.889	medium	\N	confirmed	#4B83E2
74	News 3	Test template update	2	1	2025-06-05 11:00:00	2025-06-06 03:00:00	production	11	[1,5]	2025-06-06 00:10:23.892	medium	1	confirmed	#d30da8
75	News 3	Test template update	2	1	2025-06-04 11:00:00	2025-06-05 03:00:00	production	11	[1,5]	2025-06-06 00:10:35.201	medium	1	confirmed	#d30da8
76	News 2	New 5/11 6am to 7pm 	2	1	2025-06-07 11:00:00	2025-06-08 00:00:00	production	9	[]	2025-06-06 00:13:13.263	medium	1	confirmed	#d30da8
69	News 2	New 5/11 6am to 7pm 	2	1	2025-05-19 11:00:00	2025-05-20 00:00:00	production	9	[]	2025-06-05 23:35:25.998	medium	1	cancelled	#d30da8
77	News 2	New 5/11 6am to 7pm 	2	1	2025-05-22 11:00:00	2025-05-23 00:00:00	production	9	[]	2025-06-12 06:33:24.67	medium	1	confirmed	#d30da8
78	News 2	New 5/11 6am to 7pm 	1	1	2025-05-23 11:00:00	2025-05-24 00:00:00	production	9	[]	2025-06-12 06:34:51.896	medium	1	confirmed	#d30da8
72	News 2	New 5/11 6am to 7pm 	2	1	2025-06-12 11:00:00	2025-06-13 00:00:00	production	9	[]	2025-06-05 23:35:37.039	medium	1	cancelled	#d30da8
79	test june 12th 11am to 12pm	test june 12th 11am to 12pm	1	1	2025-06-12 16:00:00	2025-06-12 17:00:00	production	\N	[]	2025-06-12 07:12:27.704	medium	\N	confirmed	#4B83E2
73	News 2	New 5/11 6am to 7pm 	2	1	2025-06-13 11:00:00	2025-06-14 00:00:00	production	9	[]	2025-06-05 23:35:37.102	medium	1	cancelled	#d30da8
83	test3		2	1	2025-06-14 16:00:00	2025-06-14 17:00:00	production	\N	[7]	2025-06-12 10:15:20.518	medium	\N	confirmed	#4B83E2
84	test 4		6	1	2025-06-14 16:00:00	2025-06-14 17:00:00	production	\N	[7]	2025-06-12 10:16:16.641	medium	1	confirmed	#4B83E2
82	test 2		1	1	2025-06-14 16:00:00	2025-06-14 17:00:00	production	\N	[7]	2025-06-12 10:14:54.329	medium	\N	confirmed	#4B83E2
71	News 2	New 5/11 6am to 7pm 	2	1	2025-06-11 11:00:00	2025-06-12 00:00:00	production	9	[7]	2025-06-05 23:35:36.974	medium	1	confirmed	#d30da8
96	Notification Test Booking	Testing the fixed notification system	5	1	2025-06-14 15:00:00	2025-06-14 16:00:00	production	\N	[8]	2025-06-13 06:31:16.893	medium	\N	confirmed	\N
98	Final Notification System Test	Testing the complete notification workflow	5	1	2025-06-15 14:00:00	2025-06-15 15:00:00	production	\N	[8]	2025-06-13 07:06:05.508	medium	\N	confirmed	\N
100	Storage Layer Notification Test	Testing notifications from storage layer	5	1	2025-06-16 14:00:00	2025-06-16 15:00:00	production	\N	[8]	2025-06-13 07:11:06.379	medium	\N	confirmed	\N
102	Final Email Fix Test	Testing complete notification system fix	5	1	2025-06-16 16:00:00	2025-06-16 17:00:00	production	\N	[8]	2025-06-13 07:13:48.517	medium	\N	confirmed	\N
105	Final Test - No Duplicate Emails	Testing unified notification system without duplicates	5	1	2025-06-17 14:00:00	2025-06-17 15:00:00	production	\N	[8]	2025-06-13 07:23:37.998	medium	\N	confirmed	\N
107	Styled Email Test - Production Booking	Testing the new stylized email format for all notification types	5	1	2025-06-17 16:00:00	2025-06-17 17:00:00	production	\N	[8]	2025-06-13 07:30:35.294	medium	\N	confirmed	\N
110	Email Format Test - HVAC Maintenance	Testing HTML email formatting for site managers in maintenance alerts	\N	1	2025-06-20 09:00:00	2025-06-20 17:00:00	maintenance	\N	[]	2025-06-13 07:34:49.188	high	\N	confirmed	\N
112	Test Maintenance Alert		\N	1	2025-06-14 14:00:00	2025-06-14 15:00:00	maintenance	\N	[]	2025-06-13 07:43:32.961	medium	\N	confirmed	\N
116	test email 44		5	1	2025-06-13 16:00:00	2025-06-13 17:00:00	production	\N	[8]	2025-06-13 07:57:28.555	medium	\N	confirmed	#4B83E2
118	test facility alert		\N	1	2025-06-19 12:00:00	2025-06-19 13:00:00	maintenance	\N	[]	2025-06-18 04:56:33.521	medium	\N	confirmed	\N
145	test new 2222		5	1	2025-06-21 16:00:00	2025-06-21 17:00:00	production	\N	[]	2025-06-21 08:02:16.707	medium	\N	cancelled	#4B83E2
146	test new 333		7	1	2025-06-21 16:00:00	2025-06-21 17:00:00	production	\N	[8]	2025-06-21 08:02:26.57	medium	\N	cancelled	#4B83E2
148	test 62155		2	1	2025-06-21 16:00:00	2025-06-21 17:00:00	production	\N	[]	2025-06-22 05:33:32.62	medium	\N	confirmed	#4B83E2
150	test 44444444		\N	1	2025-06-18 14:00:00	2025-06-18 15:00:00	maintenance	\N	[]	2025-06-22 06:50:35.61	medium	\N	confirmed	\N
151	test larger logo		5	1	2025-06-22 16:00:00	2025-06-22 17:00:00	production	\N	[]	2025-06-22 06:51:30.441	medium	\N	confirmed	#4B83E2
152	test maintenance		\N	1	2025-06-17 14:00:00	2025-06-17 15:00:00	maintenance	\N	[]	2025-06-22 06:57:48.785	medium	\N	confirmed	\N
153	test maintenance		\N	1	2025-06-21 14:00:00	2025-06-21 15:00:00	maintenance	\N	[]	2025-06-22 07:01:47.742	critical	\N	confirmed	\N
154	test maintenance 2		\N	1	2025-06-21 14:00:00	2025-06-21 15:00:00	maintenance	\N	[]	2025-06-22 07:05:44.845	high	\N	confirmed	\N
156	News 3	Test template update	0	1	2025-06-22 07:15:41.557	2025-06-22 23:15:41.557	production	11	[1,5,"8"]	2025-06-22 07:21:22.16	low	1	confirmed	#d30da8
157	test	test	3	1	2025-06-22 07:23:52.964	2025-06-22 08:23:52.964	production	0	[]	2025-06-22 07:24:02.065	low	0	draft	#3b82f6
159	test	sttt	7	1	2025-06-22 07:41:52.54	2025-06-22 08:41:52.54	production	\N	[]	2025-06-22 07:42:03.861	low	\N	draft	#3b82f6
161	dfddddddd		3	1	2025-06-21 16:00:00	2025-06-21 17:00:00	production	\N	[]	2025-06-22 08:05:24.205	medium	\N	confirmed	#4B83E2
163	test mobile		\N	1	2025-06-22 15:22:26.537	2025-06-22 16:22:26.537	production	\N	[]	2025-06-22 15:22:47.197	low	\N	draft	#3b82f6
149	test 77773		5	1	2025-06-20 16:00:00	2025-06-20 17:00:00	production	\N	[8]	2025-06-22 06:47:46.234	medium	\N	confirmed	#a87915
170	test multiple studios A and W	test multiple studios A and W	1	1	2025-06-24 16:00:00	2025-06-24 17:00:00	production	\N	[]	2025-06-23 08:26:40.293	medium	\N	confirmed	#4B83E2
187	Test Y and Z		7	1	2025-06-23 23:24:32.006	2025-06-24 00:24:32.006	production	\N	[]	2025-06-23 23:28:57.607	low	\N	draft	#3b82f6
188	Test Booking A and B		1	1	2025-06-23 23:29:56.839	2025-06-24 00:29:56.839	production	\N	[]	2025-06-23 23:52:33.574	low	\N	draft	#3b82f6
\.


--
-- TOC entry 3475 (class 0 OID 65537)
-- Dependencies: 233
-- Data for Name: file_attachments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.file_attachments (id, booking_id, file_name, file_size, mime_type, path, uploaded_by, uploaded_at, description) FROM stdin;
1	28	toll9.00.pdf	285035	application/pdf	/home/runner/workspace/uploads/w3ksxpr0vo15c1xielyfwrbi.pdf	1	2025-05-05 05:43:24.775561+00	\N
2	28	toll9.00.pdf	285035	application/pdf	/home/runner/workspace/uploads/k2qnixjmthkcz5katxu6e3lz.pdf	1	2025-05-05 05:55:36.554254+00	\N
3	28	match-data.csv	452	text/csv	/home/runner/workspace/uploads/sut95lk13uxkhizrcdebdfj5.csv	1	2025-05-05 05:56:03.186255+00	\N
4	29	playlists.csv	7875	text/csv	/home/runner/workspace/uploads/i5jym98fqflhgee8mlaem6nl.csv	1	2025-05-05 06:00:23.613364+00	\N
6	84	test.txt	0	text/plain	/home/runner/workspace/uploads/elzrjbfnel01c3xh2xc93nxm.txt	1	2025-06-12 10:17:00.623945+00	\N
8	82	test.txt	0	text/plain	/home/runner/workspace/uploads/j0beaf7pr4jkh7lbigusvqb3.txt	1	2025-06-12 10:25:35.10262+00	\N
\.


--
-- TOC entry 3471 (class 0 OID 57345)
-- Dependencies: 229
-- Data for Name: invite_tokens; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.invite_tokens (id, token, role, email, expires, created_by, created_at, used) FROM stdin;
1	6709186cfeb88a173fc1022ec01e5514439048964c77bf13ddb2399e900474ad	producer	tbnapps@gmail.com	2025-05-12 02:52:04.837	1	2025-05-05 02:52:04.85406	f
2	df854a44f661eeefbca5b36230c6cec64b00750ea389e721123256fcebc751cb	producer	test@example.com	2025-05-12 02:55:42.562	1	2025-05-05 02:55:42.789318	f
3	a4b53a9e732ec537160065be3002226542a727a5ce8d20813c8fb738ea2ee3fa	producer	test@example.com	2025-05-12 02:58:43.851	1	2025-05-05 02:58:43.867445	t
4	8d5450efac5e88be44e1b440accc0538f6fa7bca602857f7232ac11d75dc5582	producer	test@example.com	2025-05-12 03:02:50.613	1	2025-05-05 03:02:50.629884	f
5	0db1e6ae6985544a362af46d101a021c9c5e9d23e3e3a66a7fd9287d314b1302	producer	test@example.com	2025-05-12 03:03:50.628	1	2025-05-05 03:03:50.64532	f
6	002dc8afeed8337f0b2485a925c6fb68485c223a709c6ee995192e2135ee53ac	producer	tbnapps@gamil.com	2025-05-12 03:10:31.39	1	2025-05-05 03:10:31.408162	f
7	db5af6aaffc7ded8d122317a43d038ffa5f7e86e90e17a3d619444aae30e0f68	producer	obed@obedtv.com	2025-05-12 04:36:10.308	1	2025-05-05 04:36:10.323506	f
\.


--
-- TOC entry 3469 (class 0 OID 49153)
-- Dependencies: 227
-- Data for Name: notification_groups; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.notification_groups (id, name, email, group_type, description, enabled) FROM stdin;
7	Test Notification	obedtest@tbn.tv	department		t
8	test 23	obedconference@tbn.tv	department		t
9	Site Management	obedtest@tbn.tv	site_management	Site management notification group for administrative alerts	t
\.


--
-- TOC entry 3460 (class 0 OID 24588)
-- Dependencies: 218
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.notifications (id, user_id, title, message, type, read, booking_id, created_at) FROM stdin;
1	1	Booking Confirmation	Your booking for Network outage has been created successfully.	booking_created	f	1	2025-05-03 21:14:18.315
2	1	Booking Confirmation	Your booking for comms outage has been created successfully.	booking_created	f	2	2025-05-03 21:14:53.101
3	1	Booking Updated	Your booking for "comms outage" has been updated.	booking_updated	f	2	2025-05-03 21:15:04.382
4	1	Booking Confirmation	Your booking for Comms are down has been created successfully.	booking_created	f	3	2025-05-03 21:18:26.463
5	1	Booking Updated	Your booking for "Comms are down" has been updated.	booking_updated	f	3	2025-05-03 21:18:50.518
6	1	Booking Confirmation	Your booking for Comms outage has been created successfully.	booking_created	f	4	2025-05-03 21:21:52.215
7	1	Booking Confirmation	Your booking for Test alert has been created successfully.	booking_created	f	5	2025-05-03 21:30:37.807
8	1	Booking Confirmation	Your booking for Test alert 4 has been created successfully.	booking_created	f	6	2025-05-03 21:35:54.284
11	1	Booking Updated	Your booking for "Test alert 4" has been updated.	booking_updated	f	6	2025-05-03 21:47:48.352
12	1	Booking Updated	Your booking for "Test alert 4" has been updated.	booking_updated	f	6	2025-05-03 21:49:11.058
13	1	Booking Updated	Your booking for "Network outage" has been updated.	booking_updated	f	1	2025-05-03 22:06:41.306
14	1	Booking Updated	Your booking for "Test alert 4" has been updated.	booking_updated	f	6	2025-05-03 22:07:15.426
15	1	Booking Updated	Your booking for "Test alert 4" has been updated.	booking_updated	f	6	2025-05-03 22:07:31.805
16	1	Booking Updated	Your booking for "Test alert 4" has been updated.	booking_updated	f	6	2025-05-03 22:07:44.125
17	1	Booking Confirmation	Your booking for Network has been created successfully.	booking_created	f	7	2025-05-03 22:13:42.873
18	1	Booking Confirmation	Your booking for Network outage has been created successfully.	booking_created	f	8	2025-05-03 22:19:40.521
19	1	Booking Confirmation	Your booking for Netowork Maintenance has been created successfully.	booking_created	f	9	2025-05-03 22:22:15.879
20	1	Booking Updated	Your booking for "Test alert" has been updated.	booking_updated	f	5	2025-05-03 22:22:56.165
21	1	Booking Updated	Your booking for "Test alert" has been updated.	booking_updated	f	5	2025-05-03 22:23:35.332
22	1	Booking Updated	Your booking for "Netowork Maintenance" has been updated.	booking_updated	f	9	2025-05-03 22:24:06.699
23	1	Booking Confirmation	Your booking for Test for the 29th  has been created successfully.	booking_created	f	10	2025-05-03 22:24:40.413
24	1	Booking Confirmation	Your booking for Prompter out has been created successfully.	booking_created	f	11	2025-05-03 22:27:39.52
25	1	Booking Confirmation	Your booking for Better Together - Laurie with Sheyla has been created successfully.	booking_created	f	12	2025-05-03 22:34:44.865
26	1	Booking Confirmation	Your booking for Comms Outage has been created successfully.	booking_created	f	13	2025-05-03 22:35:18.486
27	1	Booking Confirmation	Your booking for Network update has been created successfully.	booking_created	f	14	2025-05-03 22:35:39.976
28	1	Booking Confirmation	Your booking for DP Podcast has been created successfully.	booking_created	f	15	2025-05-03 22:43:52.291
29	1	Booking Updated	Your booking for "Comms Outage" has been updated.	booking_updated	f	13	2025-05-03 22:49:20.888
30	1	Booking Confirmation	Your booking for Stacks Tonight has been created successfully.	booking_created	f	16	2025-05-03 22:51:53.45
31	1	Booking Confirmation	Your booking for Prompter Issue has been created successfully.	booking_created	f	17	2025-05-03 23:00:54.352
32	1	Booking Confirmation	Your booking for TCL in MU2 has been created successfully.	booking_created	f	18	2025-05-03 23:01:38.848
33	1	Booking Confirmation	Your booking for MU2 TOA Space issue has been created successfully.	booking_created	f	19	2025-05-03 23:36:16.716
34	1	Booking Confirmation	Your booking for TCL  has been created successfully.	booking_created	f	20	2025-05-03 23:36:58.764
35	1	Booking Confirmation	Your booking for Morning News has been created successfully.	booking_created	f	21	2025-05-04 00:09:02.172
36	1	Booking Confirmation	Your booking for AM News MSM has been created successfully.	booking_created	f	22	2025-05-04 01:27:24.487
37	1	Booking Confirmation	Your booking for Morning news has been created successfully.	booking_created	f	23	2025-05-04 01:34:04.615
38	1	Booking Confirmation	Your booking for DP Townhall has been created successfully.	booking_created	f	24	2025-05-04 01:41:26.332
39	1	Booking Updated	Your booking for "DP Townhall" has been updated.	booking_updated	f	24	2025-05-04 01:41:35.559
40	1	Booking Updated	Your booking for "DP Townhall" has been updated.	booking_updated	f	24	2025-05-04 01:41:41.555
41	1	Booking Confirmation	Your booking for MSM PM News has been created successfully.	booking_created	f	25	2025-05-04 02:54:43.058
42	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	20	2025-05-04 03:15:10.88
43	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	20	2025-05-04 03:18:04.511
44	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	20	2025-05-04 03:18:14.696
45	1	Booking Confirmation	Your booking for Morning News  has been created successfully.	booking_created	f	26	2025-05-04 03:24:28.835
46	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	20	2025-05-04 04:08:30.757
47	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	20	2025-05-04 04:39:51.936
48	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	27	2025-05-04 04:40:23.066
49	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	20	2025-05-04 04:46:58.213
50	1	Booking Updated	Your booking for "TCL " has been updated.	booking_updated	f	20	2025-05-04 05:04:48.796
51	1	Booking Confirmation	Your booking for DP Podcast has been created successfully.	booking_created	f	28	2025-05-05 00:57:01.108
52	1	Booking Updated	Your booking for "DP Podcast" has been updated.	booking_updated	f	28	2025-05-05 00:57:08.583
53	1	Booking Confirmation	Your booking for Stacks Tonight has been created successfully.	booking_created	f	29	2025-05-05 05:59:54.674
54	1	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	27	2025-05-11 07:07:51.573
55	1	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	27	2025-05-11 07:07:58.56
56	1	Booking Confirmation	Your booking for Test 5/13 11 am to 12 pm  has been created successfully.	booking_created	f	30	2025-05-11 07:11:51.557
57	1	Booking Updated	Your booking for "Test 5/13 11 am to 12 pm " has been updated.	booking_updated	f	30	2025-05-11 07:12:01.547
58	1	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	27	2025-05-11 07:15:40.815
59	1	Booking Confirmation	Your booking for Test 5/14 2am to 6am  has been created successfully.	booking_created	f	31	2025-05-11 07:18:50.402
60	1	Booking Updated	Your booking for "Test 5/14 2am to 6am " has been updated.	booking_updated	f	31	2025-05-11 07:23:53.21
61	1	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	27	2025-05-11 07:31:53.913
62	1	Booking Confirmation	Your booking for Test 5/11 2PM to 6PM  has been created successfully.	booking_created	f	32	2025-05-11 07:35:40.538
63	1	Booking Confirmation	Your booking for New 5/11 6am to 7pm  has been created successfully.	booking_created	f	33	2025-05-11 07:36:08.729
64	1	Booking Updated	Your booking for "New 5/11 6am to 7pm " has been updated.	booking_updated	f	33	2025-05-11 07:50:58.958
65	1	Booking Updated	Your booking for "New 5/11 6am to 7pm " has been updated.	booking_updated	f	33	2025-05-11 07:51:56.222
66	1	Booking Confirmation	Your booking for 5/13 1am to 7am has been created successfully.	booking_created	f	34	2025-05-11 07:52:58.745
67	1	New Booking Notification	A new booking "5/13 1am to 7am" has been created that requires your attention.	booking_created	f	34	2025-05-11 07:52:59.111
68	1	Booking Updated	Your booking for "Test 5/11 2PM to 6PM " has been updated.	booking_updated	f	32	2025-05-11 07:54:11.296
69	1	Booking Updated	Your booking for "Test 5/11 2PM to 6PM " has been updated.	booking_updated	f	32	2025-05-11 07:54:38.869
70	1	Booking Updated	Your booking for "Test 5/11 2PM to 6PM " has been updated.	booking_updated	f	32	2025-05-11 07:54:47.37
71	1	Booking Updated	Your booking for "Test 5/11 2PM to 6PM " has been updated.	booking_updated	f	32	2025-05-11 07:54:59.936
72	1	Booking Confirmation	Your booking for 5/15 1am to 6am  has been created successfully.	booking_created	f	35	2025-05-11 07:57:32.238
73	1	Booking Confirmation	Your booking for Test 12:30am to 4am  has been created successfully.	booking_created	f	36	2025-05-11 08:02:28.568
74	1	Booking Confirmation	Your booking for Test Alert has been created successfully.	booking_created	f	37	2025-05-11 08:04:39.838
75	1	Booking Updated	Your booking for "Test Alert" has been updated.	booking_updated	f	37	2025-05-11 08:15:57.567
76	1	Booking Confirmation	Your booking for 5/15 1am to 3:30am has been created successfully.	booking_created	f	38	2025-05-11 08:29:20.767
77	1	New Booking Notification	A new booking "5/15 1am to 3:30am" has been created that requires your attention.	booking_created	f	38	2025-05-11 08:29:21.296
78	1	Booking Updated	Your booking for "5/15 1am to 3:30am" has been updated.	booking_updated	f	38	2025-05-11 08:29:50.072
79	1	Booking Updated	Your booking for "5/15 1am to 3:30am" has been updated.	booking_updated	f	38	2025-05-11 08:30:13.291
80	1	Booking Confirmation	Your booking for Network outage has been created successfully.	booking_created	f	39	2025-05-11 08:40:23.896
81	1	Booking Confirmation	Your booking for Test alert has been created successfully.	booking_created	f	40	2025-05-11 08:41:49.994
82	1	Booking Confirmation	Your booking for Medium severity has been created successfully.	booking_created	f	41	2025-05-11 08:46:08.255
83	1	Booking Confirmation	Your booking for TEst medium severity has been created successfully.	booking_created	f	42	2025-05-11 08:52:23.708
84	1	Booking Confirmation	Your booking for Comms down has been created successfully.	booking_created	f	45	2025-05-11 08:59:04.326
85	1	Booking Confirmation	Your booking for Network outage has been created successfully.	booking_created	f	46	2025-05-11 08:59:23.91
86	1	Booking Confirmation	Your booking for Power outage has been created successfully.	booking_created	f	47	2025-05-11 08:59:48.581
87	1	Booking Confirmation	Your booking for Test alert has been created successfully.	booking_created	f	48	2025-05-11 09:03:42.112
88	1	Booking Confirmation	Your booking for booking 5/16 1am to 3am has been created successfully.	booking_created	f	49	2025-05-11 09:13:34.193
89	1	Booking Updated	Your booking for "Test 5/14 2am to 6am " has been updated.	booking_updated	f	31	2025-05-11 09:14:27.415
90	1	Booking Updated	Your booking for "Test 5/13 11 am to 12 pm " has been updated.	booking_updated	f	30	2025-05-11 09:15:37.725
91	1	Booking Confirmation	Your booking for News Update has been created successfully.	booking_created	f	51	2025-05-11 16:26:11.811
92	1	Booking Confirmation	Your booking for Test booking 5/11 am to 5pm has been created successfully.	booking_created	f	52	2025-05-11 16:27:34.906
93	1	Booking Updated	Your booking for "test 5/11 7am to 5pm " has been updated.	booking_updated	f	27	2025-05-11 18:18:24
94	1	Booking Updated	Your booking for "New 5/11 6am to 7pm " has been updated.	booking_updated	f	33	2025-05-11 19:51:15.122
95	1	Booking Confirmation	Your booking for Test Studio w 5/12 1am to 5pm has been created successfully.	booking_created	f	53	2025-05-12 16:03:10.999
96	7	Booking Confirmation	Your booking for test booking as site manager has been created successfully.	booking_created	f	54	2025-05-14 14:28:02.093
97	7	Booking Confirmation	Your booking for test booking as site manager has been created successfully.	booking_created	f	55	2025-05-14 14:28:16.346
98	7	Booking Confirmation	Your booking for tEst booking as site manager has been created successfully.	booking_created	f	56	2025-05-14 14:38:17.722
99	7	Booking Confirmation	Your booking for tEst booking as site manager has been created successfully.	booking_created	f	57	2025-05-14 14:38:29.897
100	1	Booking Deleted	Your booking for "Test Studio w 5/12 1am to 5pm" has been deleted by administrator.	booking_deleted	f	53	2025-05-14 14:40:55.226
101	1	Booking Updated	Your booking for "Test booking 5/11 am to 5pm" has been updated.	booking_updated	f	52	2025-05-14 14:41:03.538
102	7	Booking Confirmation	Your booking for Test edit 5/13 has been created successfully.	booking_created	f	58	2025-05-14 14:41:54.624
103	7	Booking Updated	Your booking for "Test edit 5/13" has been updated.	booking_updated	f	58	2025-05-14 14:43:26.206
104	1	Booking Updated	Your booking for "Test 5/11 2PM to 6PM " has been updated.	booking_updated	f	32	2025-05-14 14:43:42.202
105	1	Booking Deleted	Your booking for "Test 5/11 2PM to 6PM " has been deleted by administrator.	booking_deleted	f	32	2025-05-14 14:43:46.788
106	7	Booking Confirmation	Your booking for test 5/13 12:30am to 1am has been created successfully.	booking_created	f	59	2025-05-14 14:56:45.441
107	7	Booking Confirmation	Your booking for 5/20 1am to 4am has been created successfully.	booking_created	f	60	2025-05-14 16:17:37.965
108	7	Booking Confirmation	Your booking for 5/21 1am to 4am has been created successfully.	booking_created	f	61	2025-05-14 16:19:28.988
109	1	Booking Deleted	Your booking for "Test 5/13 11 am to 12 pm " has been deleted by administrator.	booking_deleted	f	43	2025-05-14 18:10:16.969
110	1	Booking Deleted	Your booking for "Test 5/13 11 am to 12 pm  - copy to 5/14, 5/15" has been deleted by administrator.	booking_deleted	f	44	2025-05-14 18:10:20.476
111	7	Booking Deleted	Your booking for "5/21 1am to 4am" has been deleted by administrator.	booking_deleted	f	63	2025-05-14 21:49:37.741
112	7	Booking Deleted	Your booking for "5/21 1am to 4am" has been deleted by administrator.	booking_deleted	f	62	2025-05-14 21:49:40.742
113	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	64	2025-06-04 17:53:42.842
114	1	Booking Confirmation	Your booking for Test booking has been created successfully.	booking_created	f	65	2025-06-05 20:06:53.435
115	1	New Booking Notification	A new booking "Test booking" has been created that requires your attention.	booking_created	f	65	2025-06-05 20:06:54.06
116	1	Booking Updated	Your booking for "Morning news" has been updated.	booking_updated	f	23	2025-06-05 20:31:40.704
117	7	Booking Deleted	Your booking for "5/21 1am to 4am" has been deleted by administrator.	booking_deleted	f	61	2025-06-05 20:32:28.242
118	1	Booking Confirmation	Your booking for News has been created successfully.	booking_created	f	66	2025-06-05 20:36:32.853
119	1	New Booking Notification	A new booking "News" has been created that requires your attention.	booking_created	f	66	2025-06-05 20:36:33.954
120	5	New Booking Notification	A new booking "News" has been created that requires your attention.	booking_created	f	66	2025-06-05 20:36:33.986
121	1	Booking Confirmation	Your booking for News has been created successfully.	booking_created	f	67	2025-06-05 20:38:35.982
122	1	New Booking Notification	A new booking "News" has been created that requires your attention.	booking_created	f	67	2025-06-05 20:38:36.833
123	5	New Booking Notification	A new booking "News" has been created that requires your attention.	booking_created	f	67	2025-06-05 20:38:36.863
124	1	Booking Confirmation	Your booking for News has been created successfully.	booking_created	f	68	2025-06-05 22:59:41.757
125	1	New Booking Notification	A new booking "News" has been created that requires your attention.	booking_created	f	68	2025-06-05 22:59:42.79
126	5	New Booking Notification	A new booking "News" has been created that requires your attention.	booking_created	f	68	2025-06-05 22:59:42.821
127	1	Booking Confirmation	Your booking for News 2 has been created successfully.	booking_created	f	69	2025-06-05 23:35:26.071
128	1	Booking Confirmation	Your booking for News 3 has been created successfully.	booking_created	f	74	2025-06-06 00:10:23.961
129	1	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	74	2025-06-06 00:10:24.979
130	5	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	74	2025-06-06 00:10:25.009
131	1	Booking Confirmation	Your booking for News 3 has been created successfully.	booking_created	f	75	2025-06-06 00:10:35.27
132	1	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	75	2025-06-06 00:10:35.763
133	5	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	75	2025-06-06 00:10:35.794
134	1	Booking Confirmation	Your booking for News 2 has been created successfully.	booking_created	f	76	2025-06-06 00:13:13.334
135	1	Booking Updated	Your booking for "News 2" has been updated.	booking_updated	f	69	2025-06-12 00:08:17.68
136	1	Booking Confirmation	Your booking for News 2 has been created successfully.	booking_created	f	77	2025-06-12 06:33:24.775
137	1	Booking Confirmation	Your booking for News 2 has been created successfully.	booking_created	f	78	2025-06-12 06:34:51.967
138	1	Booking Updated	Your booking for "News 2" has been updated.	booking_updated	f	72	2025-06-12 06:43:18.019
139	1	Booking Confirmation	Your booking for test june 12th 11am to 12pm has been created successfully.	booking_created	f	79	2025-06-12 07:12:27.781
140	1	Booking Updated	Your booking for "News 2" has been updated.	booking_updated	f	73	2025-06-12 09:33:25.602
141	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	80	2025-06-12 09:40:09.62
142	1	Booking Updated	Your booking for "test" has been updated.	booking_updated	f	80	2025-06-12 10:04:47.671
143	1	Booking Confirmation	Your booking for Test email  has been created successfully.	booking_created	f	81	2025-06-12 10:07:04.05
144	7	New Booking Notification	A new booking "Test email " has been created that requires your attention.	booking_created	f	81	2025-06-12 10:07:04.55
145	1	Booking Confirmation	Your booking for test 2 has been created successfully.	booking_created	f	82	2025-06-12 10:14:54.398
146	1	Booking Confirmation	Your booking for test3 has been created successfully.	booking_created	f	83	2025-06-12 10:15:20.584
147	7	New Booking Notification	A new booking "test3" has been created that requires your attention.	booking_created	f	83	2025-06-12 10:15:21.116
148	1	Booking Confirmation	Your booking for test 4 has been created successfully.	booking_created	f	84	2025-06-12 10:16:16.709
149	1	Booking Updated	Your booking for "test 4" has been updated.	booking_updated	f	84	2025-06-12 10:17:16.688
150	1	Booking Updated	Your booking for "test 2" has been updated.	booking_updated	f	82	2025-06-12 10:25:18.683
151	1	Booking Updated	Your booking for "News 2" has been updated.	booking_updated	f	71	2025-06-12 10:26:21.39
152	1	Booking Confirmation	Your booking for test file upload has been created successfully.	booking_created	f	85	2025-06-12 10:26:45.729
153	7	New Booking Notification	A new booking "test file upload" has been created that requires your attention.	booking_created	f	85	2025-06-12 10:26:46.095
154	1	Booking Confirmation	Your booking for test file upload has been created successfully.	booking_created	f	86	2025-06-12 10:27:15.257
155	7	New Booking Notification	A new booking "test file upload" has been created that requires your attention.	booking_created	f	86	2025-06-12 10:27:15.616
156	1	Booking Confirmation	Your booking for test 6/12 11am to 12pm has been created successfully.	booking_created	f	87	2025-06-12 10:31:35.343
157	7	New Booking Notification	A new booking "test 6/12 11am to 12pm" has been created that requires your attention.	booking_created	f	87	2025-06-12 10:31:35.876
158	1	Booking Confirmation	Your booking for test 6/12 11am to 12pm has been created successfully.	booking_created	f	88	2025-06-12 10:35:18.036
159	7	New Booking Notification	A new booking "test 6/12 11am to 12pm" has been created that requires your attention.	booking_created	f	88	2025-06-12 10:35:18.72
160	1	Booking Confirmation	Your booking for test 6/12 11am to 12pm has been created successfully.	booking_created	f	89	2025-06-12 10:37:38.707
161	7	New Booking Notification	A new booking "test 6/12 11am to 12pm" has been created that requires your attention.	booking_created	f	89	2025-06-12 10:37:39.164
162	1	Booking Confirmation	Your booking for Test 33 has been created successfully.	booking_created	f	90	2025-06-12 10:40:40.042
163	7	New Booking Notification	A new booking "Test 33" has been created that requires your attention.	booking_created	f	90	2025-06-12 10:40:40.518
164	1	Booking Confirmation	Your booking for test34 has been created successfully.	booking_created	f	91	2025-06-12 10:42:31.407
165	8	New Booking Notification	A new booking "test34" has been created that requires your attention.	booking_created	f	91	2025-06-12 10:42:32.008
166	1	Booking Confirmation	Your booking for Test 36 has been created successfully.	booking_created	f	92	2025-06-12 15:53:39.44
167	8	New Booking Notification	A new booking "Test 36" has been created that requires your attention.	booking_created	f	92	2025-06-12 15:53:40.108
168	1	Booking Confirmation	Your booking for test 37 has been created successfully.	booking_created	f	93	2025-06-12 16:00:36.383
169	8	New Booking Notification	A new booking "test 37" has been created that requires your attention.	booking_created	f	93	2025-06-12 16:00:36.762
170	1	Booking Confirmation	Your booking for test 38 has been created successfully.	booking_created	f	94	2025-06-12 16:09:40.146
171	8	New Booking Notification	A new booking "test 38" has been created that requires your attention.	booking_created	f	94	2025-06-12 16:09:40.685
172	1	Booking Confirmation	Your booking for Test email  has been created successfully.	booking_created	f	95	2025-06-13 06:20:49.121
173	8	New Booking Notification	A new booking "Test email " has been created that requires your attention.	booking_created	f	95	2025-06-13 06:20:49.802
174	1	Booking Confirmation	Your booking for test email 2 has been created successfully.	booking_created	f	97	2025-06-13 07:01:52.942
175	8	New Booking Notification	A new booking "test email 2" has been created that requires your attention.	booking_created	f	97	2025-06-13 07:01:53.655
176	1	Booking Confirmation	Your booking for test email 5 has been created successfully.	booking_created	f	99	2025-06-13 07:06:54.347
177	8	New Booking Notification	A new booking "test email 5" has been created that requires your attention.	booking_created	f	99	2025-06-13 07:06:54.721
178	1	Booking Confirmation	Your booking for test email 6 has been created successfully.	booking_created	f	101	2025-06-13 07:12:08.153
179	8	New Booking Notification	A new booking "test email 6" has been created that requires your attention.	booking_created	f	101	2025-06-13 07:12:08.659
180	1	Booking Confirmation	Your booking for test email 7 has been created successfully.	booking_created	f	103	2025-06-13 07:14:36.757
181	8	New Booking Notification	A new booking "test email 7" has been created that requires your attention.	booking_created	f	103	2025-06-13 07:14:37.348
182	1	Booking Confirmation	Your booking for test email 9 has been created successfully.	booking_created	f	104	2025-06-13 07:19:12.675
183	8	New Booking Notification	A new booking "test email 9" has been created that requires your attention.	booking_created	f	104	2025-06-13 07:19:13.314
184	1	Booking Confirmation	Your booking for test email 10 has been created successfully.	booking_created	f	106	2025-06-13 07:25:01.748
185	8	New Booking Notification	A new booking "test email 10" has been created that requires your attention.	booking_created	f	106	2025-06-13 07:25:02.243
186	7	New Booking Notification	A new booking "test email 10" has been created that requires your attention.	booking_created	f	106	2025-06-13 07:25:02.277
187	1	Booking Confirmation	Your booking for test email 11 has been created successfully.	booking_created	f	108	2025-06-13 07:31:59.442
188	8	New Booking Notification	A new booking "test email 11" has been created that requires your attention.	booking_created	f	108	2025-06-13 07:32:00.275
189	1	Booking Confirmation	Your booking for Test facility alert has been created successfully.	booking_created	f	111	2025-06-13 07:36:29.419
190	1	Booking Confirmation	Your booking for Test Maintenance Alert has been created successfully.	booking_created	f	112	2025-06-13 07:43:33.478
191	1	Booking Confirmation	Your booking for Test email 13 has been created successfully.	booking_created	f	113	2025-06-13 07:44:16.26
192	8	New Booking Notification	A new booking "Test email 13" has been created that requires your attention.	booking_created	f	113	2025-06-13 07:44:17.096
193	1	Booking Confirmation	Your booking for test email 14 has been created successfully.	booking_created	f	114	2025-06-13 07:48:12.476
194	8	New Booking Notification	A new booking "test email 14" has been created that requires your attention.	booking_created	f	114	2025-06-13 07:48:13.259
195	1	Booking Confirmation	Your booking for test email 20 has been created successfully.	booking_created	f	115	2025-06-13 07:50:33.418
196	8	New Booking Notification	A new booking "test email 20" has been created that requires your attention.	booking_created	f	115	2025-06-13 07:50:34.062
197	1	Booking Confirmation	Your booking for test email 44 has been created successfully.	booking_created	f	116	2025-06-13 07:57:28.628
198	8	New Booking Notification	A new booking "test email 44" has been created that requires your attention.	booking_created	f	116	2025-06-13 07:57:29.319
199	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	117	2025-06-18 04:54:14.177
200	8	New Booking Notification	A new booking "test" has been created that requires your attention.	booking_created	f	117	2025-06-18 04:54:14.743
201	1	Booking Confirmation	Your booking for test facility alert has been created successfully.	booking_created	f	118	2025-06-18 04:56:34.092
202	1	Booking Updated	Your booking for "test facility alert" has been updated.	booking_updated	f	118	2025-06-18 04:57:20.275
203	1	Booking Confirmation	Your booking for Test email new has been created successfully.	booking_created	f	119	2025-06-18 05:10:22.77
204	8	New Booking Notification	A new booking "Test email new" has been created that requires your attention.	booking_created	f	119	2025-06-18 05:10:23.232
205	1	Booking Confirmation	Your booking for Test new email  has been created successfully.	booking_created	f	120	2025-06-18 05:18:36.263
206	1	Booking Confirmation	Your booking for new 6/19 11-12pm booking has been created successfully.	booking_created	f	121	2025-06-18 05:21:24.986
207	1	Booking Confirmation	Your booking for 6/19 has been created successfully.	booking_created	f	122	2025-06-18 05:23:46.189
208	1	Booking Confirmation	Your booking for EMAIL SYSTEM TEST has been created successfully.	booking_created	f	123	2025-06-18 05:23:58.912
209	8	New Booking Notification	A new booking "EMAIL SYSTEM TEST" has been created that requires your attention.	booking_created	f	123	2025-06-18 05:23:59.262
210	1	Booking Confirmation	Your booking for Test 6/20 has been created successfully.	booking_created	f	124	2025-06-20 18:37:41.516
211	8	New Booking Notification	A new booking "Test 6/20" has been created that requires your attention.	booking_created	f	124	2025-06-20 18:37:42.175
212	1	Booking Confirmation	Your booking for Test 6/20 has been created successfully.	booking_created	f	125	2025-06-20 18:44:30.935
213	8	New Booking Notification	A new booking "Test 6/20" has been created that requires your attention.	booking_created	f	125	2025-06-20 18:44:31.503
214	1	Booking Confirmation	Your booking for Test email 2 6/20 has been created successfully.	booking_created	f	126	2025-06-20 18:49:20.565
215	1	Booking Confirmation	Your booking for test 621 has been created successfully.	booking_created	f	127	2025-06-20 18:54:20.941
216	8	New Booking Notification	A new booking "test 621" has been created that requires your attention.	booking_created	f	127	2025-06-20 18:54:21.541
217	1	Booking Confirmation	Your booking for test 6/21 11-12 has been created successfully.	booking_created	f	128	2025-06-20 18:59:41.239
218	8	New Booking Notification	A new booking "test 6/21 11-12" has been created that requires your attention.	booking_created	f	128	2025-06-20 18:59:41.729
219	1	Booking Confirmation	Your booking for Test 6/20 v2 has been created successfully.	booking_created	f	129	2025-06-20 20:01:00.117
220	8	New Booking Notification	A new booking "Test 6/20 v2" has been created that requires your attention.	booking_created	f	129	2025-06-20 20:01:00.72
221	1	Booking Confirmation	Your booking for test booking 2 no groups has been created successfully.	booking_created	f	130	2025-06-20 20:05:13.794
222	1	Booking Confirmation	Your booking for Test new entry 6/20 has been created successfully.	booking_created	f	131	2025-06-20 20:15:29.094
223	8	New Booking Notification	A new booking "Test new entry 6/20" has been created that requires your attention.	booking_created	f	131	2025-06-20 20:15:29.721
224	1	Booking Confirmation	Your booking for test new email template has been created successfully.	booking_created	f	132	2025-06-20 20:16:46.504
225	1	Booking Confirmation	Your booking for Test "fixed" email template has been created successfully.	booking_created	f	133	2025-06-20 20:21:42.366
226	8	New Booking Notification	A new booking "Test "fixed" email template" has been created that requires your attention.	booking_created	f	133	2025-06-20 20:21:42.84
227	1	Booking Confirmation	Your booking for Test 33 has been created successfully.	booking_created	f	134	2025-06-20 22:13:23.851
228	1	Booking Confirmation	Your booking for test 44 has been created successfully.	booking_created	f	135	2025-06-20 22:58:33.835
229	1	Booking Confirmation	Your booking for test 6/21 has been created successfully.	booking_created	f	136	2025-06-21 06:38:07.041
230	1	Booking Confirmation	Your booking for test 6/20 has been created successfully.	booking_created	f	137	2025-06-21 07:10:57.121
231	1	Booking Confirmation	Your booking for test 6/21 has been created successfully.	booking_created	f	138	2025-06-21 07:19:34.783
232	8	New Booking Notification	A new booking "test 6/21" has been created that requires your attention.	booking_created	f	138	2025-06-21 07:19:35.222
233	1	Booking Confirmation	Your booking for test 21 has been created successfully.	booking_created	f	139	2025-06-21 07:23:19.715
234	1	Booking Confirmation	Your booking for New background color test has been created successfully.	booking_created	f	140	2025-06-21 07:25:00.315
235	8	New Booking Notification	A new booking "New background color test" has been created that requires your attention.	booking_created	f	140	2025-06-21 07:25:00.585
236	1	Booking Confirmation	Your booking for test no header has been created successfully.	booking_created	f	141	2025-06-21 07:35:32.786
237	8	New Booking Notification	A new booking "test no header" has been created that requires your attention.	booking_created	f	141	2025-06-21 07:35:33.276
238	1	Booking Confirmation	Your booking for test 22222 has been created successfully.	booking_created	f	142	2025-06-21 07:42:33.957
239	1	Booking Confirmation	Your booking for test 33333 has been created successfully.	booking_created	f	143	2025-06-21 07:46:11.305
240	8	New Booking Notification	A new booking "test 33333" has been created that requires your attention.	booking_created	f	143	2025-06-21 07:46:11.655
241	1	Booking Confirmation	Your booking for test new has been created successfully.	booking_created	f	144	2025-06-21 07:56:26.402
242	8	New Booking Notification	A new booking "test new" has been created that requires your attention.	booking_created	f	144	2025-06-21 07:56:26.849
243	1	Booking Confirmation	Your booking for test new 2222 has been created successfully.	booking_created	f	145	2025-06-21 08:02:16.779
244	1	Booking Confirmation	Your booking for test new 333 has been created successfully.	booking_created	f	146	2025-06-21 08:02:26.641
245	8	New Booking Notification	A new booking "test new 333" has been created that requires your attention.	booking_created	f	146	2025-06-21 08:02:26.893
246	1	Booking Updated	Your booking for "test new 2222" has been updated.	booking_updated	f	145	2025-06-21 08:09:48.67
247	1	Booking Updated	Your booking for "test new 333" has been updated.	booking_updated	f	146	2025-06-21 08:09:58.857
248	1	Booking Confirmation	Your booking for test 6.22 has been created successfully.	booking_created	f	147	2025-06-22 05:21:45.66
249	8	New Booking Notification	A new booking "test 6.22" has been created that requires your attention.	booking_created	f	147	2025-06-22 05:21:46.21
250	1	Booking Confirmation	Your booking for test 62155 has been created successfully.	booking_created	f	148	2025-06-22 05:33:32.693
251	1	Booking Confirmation	Your booking for test 7777 has been created successfully.	booking_created	f	149	2025-06-22 06:47:46.333
252	8	New Booking Notification	A new booking "test 7777" has been created that requires your attention.	booking_created	f	149	2025-06-22 06:47:46.817
253	1	Booking Confirmation	Your booking for test 44444444 has been created successfully.	booking_created	f	150	2025-06-22 06:50:35.674
254	1	Booking Confirmation	Your booking for test larger logo has been created successfully.	booking_created	f	151	2025-06-22 06:51:30.506
255	1	Booking Confirmation	Your booking for test maintenance has been created successfully.	booking_created	f	152	2025-06-22 06:57:48.879
256	1	Booking Confirmation	Your booking for test maintenance has been created successfully.	booking_created	f	153	2025-06-22 07:01:47.821
257	1	Booking Confirmation	Your booking for test maintenance 2 has been created successfully.	booking_created	f	154	2025-06-22 07:05:45.439
258	1	Booking Confirmation	Your booking for TEst new modal has been created successfully.	booking_created	f	155	2025-06-22 07:07:54.302
259	1	Booking Confirmation	Your booking for News 3 has been created successfully.	booking_created	f	156	2025-06-22 07:21:22.225
260	1	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	156	2025-06-22 07:21:22.259
261	5	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	156	2025-06-22 07:21:22.289
262	8	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	156	2025-06-22 07:21:22.32
263	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	157	2025-06-22 07:24:02.098
264	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	158	2025-06-22 07:24:31.414
265	8	New Booking Notification	A new booking "test" has been created that requires your attention.	booking_created	f	158	2025-06-22 07:24:31.671
266	1	Booking Confirmation	Your booking for test has been created successfully.	booking_created	f	159	2025-06-22 07:42:03.909
267	1	Booking Confirmation	Your booking for test 8:30-9:30 has been created successfully.	booking_created	f	160	2025-06-22 07:59:40.02
268	1	Booking Confirmation	Your booking for dfddddddd has been created successfully.	booking_created	f	161	2025-06-22 08:05:24.296
269	1	Booking Confirmation	Your booking for 1-4am has been created successfully.	booking_created	f	162	2025-06-22 08:06:23.75
270	1	Booking Confirmation	Your booking for test mobile has been created successfully.	booking_created	f	163	2025-06-22 15:22:47.238
271	1	Booking Updated	Your booking for "News 3" has been updated.	booking_updated	f	156	2025-06-22 15:23:38.931
272	1	Booking Confirmation	Your booking for Test no Studio has been created successfully.	booking_created	f	164	2025-06-23 07:14:46.437
273	1	Booking Confirmation	Your booking for Test Template has been created successfully.	booking_created	f	165	2025-06-23 08:04:08.385
274	1	Booking Confirmation	Your booking for News 3 has been created successfully.	booking_created	f	166	2025-06-23 08:05:18.161
275	1	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	166	2025-06-23 08:05:18.254
276	5	New Booking Notification	A new booking "News 3" has been created that requires your attention.	booking_created	f	166	2025-06-23 08:05:18.287
277	1	Booking Updated	Your booking for "test 7777" has been updated.	booking_updated	f	149	2025-06-23 08:07:04.222
278	1	Booking Updated	Your booking for "test 77773" has been updated.	booking_updated	f	149	2025-06-23 08:07:11.202
279	1	Booking Confirmation	Your booking for MSM News has been created successfully.	booking_created	f	167	2025-06-23 08:20:43.727
280	1	Booking Confirmation	Your booking for test multiple studios A and W has been created successfully.	booking_created	f	168	2025-06-23 08:23:44.785
281	1	Booking Confirmation	Your booking for test multiple studios A and W has been created successfully.	booking_created	f	169	2025-06-23 08:26:01.087
282	1	Booking Confirmation	Your booking for test multiple studios A and W has been created successfully.	booking_created	f	170	2025-06-23 08:26:40.396
283	1	Booking Confirmation	Your booking for Test multi Studio has been created successfully.	booking_created	f	171	2025-06-23 16:25:32.137
284	1	Booking Confirmation	Your booking for test multi studio has been created successfully.	booking_created	f	172	2025-06-23 16:29:31.131
285	1	Booking Confirmation	Your booking for Test Studio A and F has been created successfully.	booking_created	f	173	2025-06-23 16:58:48.396
286	1	Booking Confirmation	Your booking for Test Studio A and F has been created successfully.	booking_created	f	174	2025-06-23 17:07:44.513
287	1	Booking Confirmation	Your booking for Test studio A and F has been created successfully.	booking_created	f	175	2025-06-23 17:11:49.9
288	1	Booking Confirmation	Your booking for Testing Studio A and F has been created successfully.	booking_created	f	176	2025-06-23 18:47:40.101
289	1	Booking Confirmation	Your booking for Testing Studio A and F has been created successfully.	booking_created	f	177	2025-06-23 20:46:59.616
290	1	Booking Confirmation	Your booking for Test Studio A and Z has been created successfully.	booking_created	f	178	2025-06-23 20:56:01.423
291	1	Booking Confirmation	Your booking for Test new A and F has been created successfully.	booking_created	f	179	2025-06-23 21:02:33.822
292	1	Booking Confirmation	Your booking for Studio A and F has been created successfully.	booking_created	f	180	2025-06-23 21:06:46.357
293	1	Booking Confirmation	Your booking for Test Studio E and F has been created successfully.	booking_created	f	181	2025-06-23 21:12:15.672
294	1	Booking Confirmation	Your booking for Test studio e and f has been created successfully.	booking_created	f	182	2025-06-23 21:24:24.867
295	1	Booking Confirmation	Your booking for Testing E and F has been created successfully.	booking_created	f	183	2025-06-23 21:29:37.546
296	1	Booking Confirmation	Your booking for Studio A and B has been created successfully.	booking_created	f	184	2025-06-23 21:33:41.858
297	1	Booking Confirmation	Your booking for Testing studios A and B has been created successfully.	booking_created	f	185	2025-06-23 21:53:48.203
298	1	Booking Confirmation	Your booking for Studios A and B has been created successfully.	booking_created	f	186	2025-06-23 23:16:23.822
299	1	Booking Confirmation	Your booking for Test Y and Z has been created successfully.	booking_created	f	187	2025-06-23 23:28:57.644
300	1	Booking Confirmation	Your booking for Test Booking A and B has been created successfully.	booking_created	f	188	2025-06-23 23:52:33.608
\.


--
-- TOC entry 3473 (class 0 OID 57358)
-- Dependencies: 231
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.password_reset_tokens (id, token, user_id, expires, created_at, used) FROM stdin;
1	32e805d5b307688ac542237dd762208aaced85cb43b75bec644ac1eedd73a572	1	2025-05-05 03:26:22.868	2025-05-05 02:56:22.886008	f
2	cb17f7e98a237e933dfe468537687e8dbab562190509aac7a68ddf7baf6308a5	1	2025-05-05 03:34:09.848	2025-05-05 03:04:09.864666	f
3	65d7eca1fc6056a4d785a58624cfac23a0e6e4d89e9ea6d7d217696641bce7d2	4	2025-06-21 07:57:23.444	2025-06-21 07:27:23.462392	f
\.


--
-- TOC entry 3481 (class 0 OID 73759)
-- Dependencies: 239
-- Data for Name: pcr_rooms; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pcr_rooms (id, name, description, status) FROM stdin;
1	PCR 1	Main Production Control Room	available
2	PCR 2	Secondary Production Control Room	available
3	PCR 3	Tertiary Production Control Room	available
4	PCR 4		available
\.


--
-- TOC entry 3467 (class 0 OID 40960)
-- Dependencies: 225
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
YOh3OY2Bna_oklUcYPSpIqKpVq3XB_as	{"cookie":{"originalMaxAge":86400000,"expires":"2025-06-24T20:46:16.545Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":1}}	2025-06-25 01:59:19
k5ihI9yWJk6gFdd0tgtGhYOv2AGiEOp3	{"cookie":{"originalMaxAge":86400000,"expires":"2025-06-23T07:41:32.121Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":1}}	2025-06-24 07:41:33
wiWEDLR_pAsA07ilSNb13jdHXvVfB3ed	{"cookie":{"originalMaxAge":86400000,"expires":"2025-06-24T07:45:53.973Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":1}}	2025-06-24 22:11:48
\.


--
-- TOC entry 3462 (class 0 OID 24599)
-- Dependencies: 220
-- Data for Name: studios; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.studios (id, name, description, status) FROM stdin;
2	Studio B	News Studio	available
3	Studio F	Better Together	available
5	Studio W	Core 2 by hallway\n	available
6	Studio E	News Studio	available
1	Studio A	Studio A	available
7	Studio Y	Mezzanine studio	available
9	Remote	\N	available
8	Studio Z	Stacks studio	available
\.


--
-- TOC entry 3479 (class 0 OID 73746)
-- Dependencies: 237
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.system_settings (id, key, value, created_at, updated_at) FROM stdin;
1	siteName	The Plex Studios	2025-05-11 06:49:47.529565	2025-05-11 06:49:47.529565
\.


--
-- TOC entry 3464 (class 0 OID 24611)
-- Dependencies: 222
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.templates (id, name, description, type, duration, created_by, studio_ids, pcr_room_id, status, color, notify_list, start_time, end_time) FROM stdin;
10	Test Template 2	Test template update	production	960	1	[2,1]	1	confirmed	#d30da8	[1,5]	6:00am	10:00pm
11	News 3	Test template update	production	960	1	[2,1]	1	confirmed	#d30da8	[1,5]	6:00am	10:00pm
7	Remote Production 1	Remote Production 1 for demo	production	420	7	[9]	1	confirmed	#4B83E2	[]	\N	\N
1	Test Template	\N	production	60	1	[7]	\N	confirmed	#cb0b0b	[]	\N	\N
3	DP	\N	production	300	1	[7]	1	confirmed	#8000ff	[]	\N	\N
4	MSM News	\N	production	780	6	[1,2]	1	confirmed	#800000	[]	\N	\N
5	Stakelbeck Tonight	\N	production	270	9	[3,4]	1	confirmed	#4B83E2	[]	\N	\N
6	Stakelbeck Tonight v2	\N	production	270	9	[3,4]	1	confirmed	#4B83E2	[]	\N	\N
9	News 2	New 5/11 6am to 7pm 	production	780	1	[1,2]	1	confirmed	#d30da8	[]	6:00am	7:00pm
\.


--
-- TOC entry 3466 (class 0 OID 24622)
-- Dependencies: 224
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, email, name, role) FROM stdin;
1	admin	db07d10facb51d510866eb5a2a420cfff6d848708101ecdaaed4e3b9fe3f9b6531c3a393e1eb5034d8ef223976eea53d20730609890782a582e09bbf01ca7b6b.3f9fa84c4de87b8aaba17ab9ca8eaffd	admin@example.com	Admin User	admin
4	obedtest	1680eaf406d58f03cd510db4e2034884a5fc71d47a9aa243198951d5bffef871fc6ca30d7c3ec04c9f1b93b979f2b39101b6487a8805894c45dcfae2e1240733.c81a59e1c183ec8595a90b450c06219c	obedtest@tbn.tv	obedtest	producer
2	engineer	52e68ffa4272799b0668776744a6ac46be6f2c51a55ebc6a1ebaf4937214cc864ca204a9ae7f5067a0f5051bf2ba7b9c263fa499cbe56954d3d902901f7cb6ad.20921c6bbd329eb01e385cecac65ef66	engineer@example.com	Engineer User	it
7	obedtest2	tbn123	obedtest2@gmail.com	obedtest2	site_manager
\.


--
-- TOC entry 3501 (class 0 OID 0)
-- Dependencies: 234
-- Name: booking_studios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.booking_studios_id_seq', 195, true);


--
-- TOC entry 3502 (class 0 OID 0)
-- Dependencies: 215
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.bookings_id_seq', 188, true);


--
-- TOC entry 3503 (class 0 OID 0)
-- Dependencies: 232
-- Name: file_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.file_attachments_id_seq', 8, true);


--
-- TOC entry 3504 (class 0 OID 0)
-- Dependencies: 228
-- Name: invite_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invite_tokens_id_seq', 7, true);


--
-- TOC entry 3505 (class 0 OID 0)
-- Dependencies: 226
-- Name: notification_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.notification_groups_id_seq', 9, true);


--
-- TOC entry 3506 (class 0 OID 0)
-- Dependencies: 217
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.notifications_id_seq', 300, true);


--
-- TOC entry 3507 (class 0 OID 0)
-- Dependencies: 230
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 3, true);


--
-- TOC entry 3508 (class 0 OID 0)
-- Dependencies: 238
-- Name: pcr_rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pcr_rooms_id_seq', 4, true);


--
-- TOC entry 3509 (class 0 OID 0)
-- Dependencies: 219
-- Name: studios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.studios_id_seq', 9, true);


--
-- TOC entry 3510 (class 0 OID 0)
-- Dependencies: 236
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, true);


--
-- TOC entry 3511 (class 0 OID 0)
-- Dependencies: 221
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.templates_id_seq', 11, true);


--
-- TOC entry 3512 (class 0 OID 0)
-- Dependencies: 223
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- TOC entry 3303 (class 2606 OID 73743)
-- Name: booking_studios booking_studios_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.booking_studios
    ADD CONSTRAINT booking_studios_pkey PRIMARY KEY (id);


--
-- TOC entry 3272 (class 2606 OID 24586)
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 3301 (class 2606 OID 65545)
-- Name: file_attachments file_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 3293 (class 2606 OID 57354)
-- Name: invite_tokens invite_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3295 (class 2606 OID 57356)
-- Name: invite_tokens invite_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invite_tokens
    ADD CONSTRAINT invite_tokens_token_key UNIQUE (token);


--
-- TOC entry 3289 (class 2606 OID 49163)
-- Name: notification_groups notification_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notification_groups
    ADD CONSTRAINT notification_groups_name_key UNIQUE (name);


--
-- TOC entry 3291 (class 2606 OID 49161)
-- Name: notification_groups notification_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notification_groups
    ADD CONSTRAINT notification_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3274 (class 2606 OID 24597)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3297 (class 2606 OID 57367)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3299 (class 2606 OID 57369)
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- TOC entry 3309 (class 2606 OID 73769)
-- Name: pcr_rooms pcr_rooms_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pcr_rooms
    ADD CONSTRAINT pcr_rooms_name_key UNIQUE (name);


--
-- TOC entry 3311 (class 2606 OID 73767)
-- Name: pcr_rooms pcr_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pcr_rooms
    ADD CONSTRAINT pcr_rooms_pkey PRIMARY KEY (id);


--
-- TOC entry 3287 (class 2606 OID 40966)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 3276 (class 2606 OID 24609)
-- Name: studios studios_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_name_unique UNIQUE (name);


--
-- TOC entry 3278 (class 2606 OID 24607)
-- Name: studios studios_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_pkey PRIMARY KEY (id);


--
-- TOC entry 3305 (class 2606 OID 73757)
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- TOC entry 3307 (class 2606 OID 73755)
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3280 (class 2606 OID 24620)
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- TOC entry 3282 (class 2606 OID 24630)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3284 (class 2606 OID 24632)
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- TOC entry 3285 (class 1259 OID 40967)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 3312 (class 2606 OID 65546)
-- Name: file_attachments file_attachments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 3313 (class 2606 OID 65551)
-- Name: file_attachments file_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3488 (class 0 OID 0)
-- Dependencies: 3487
-- Name: DATABASE neondb; Type: ACL; Schema: -; Owner: neondb_owner
--

GRANT ALL ON DATABASE neondb TO neon_superuser;


--
-- TOC entry 2098 (class 826 OID 16392)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- TOC entry 2097 (class 826 OID 16391)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


-- Completed on 2025-06-24 02:00:04 UTC

--
-- PostgreSQL database dump complete
--

