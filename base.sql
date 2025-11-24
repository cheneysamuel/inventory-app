-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.action_statuses (
  id integer NOT NULL DEFAULT nextval('action_statuses_id_seq'::regclass),
  inv_action_id integer NOT NULL,
  status_id integer NOT NULL,
  CONSTRAINT action_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT action_statuses_inv_action_id_fkey FOREIGN KEY (inv_action_id) REFERENCES public.inv_action_types(id),
  CONSTRAINT action_statuses_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statuses(id)
);
CREATE TABLE public.areas (
  id integer NOT NULL DEFAULT nextval('areas_id_seq'::regclass),
  name character varying NOT NULL,
  sloc_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT areas_pkey PRIMARY KEY (id),
  CONSTRAINT dfns_sloc_id_fkey FOREIGN KEY (sloc_id) REFERENCES public.slocs(id)
);
CREATE TABLE public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clients (
  id integer NOT NULL DEFAULT nextval('clients_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  address character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.config (
  key character varying NOT NULL,
  value character varying,
  CONSTRAINT config_pkey PRIMARY KEY (key)
);
CREATE TABLE public.crews (
  id integer NOT NULL DEFAULT nextval('crews_id_seq'::regclass),
  name character varying NOT NULL,
  market_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT crews_pkey PRIMARY KEY (id),
  CONSTRAINT crews_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id)
);
CREATE TABLE public.inv_action_types (
  id integer NOT NULL DEFAULT nextval('inv_action_types_id_seq'::regclass),
  name character varying NOT NULL,
  loc_type_id integer,
  description character varying,
  button_bg_color character varying,
  button_text_color character varying,
  allow_pdf boolean,
  CONSTRAINT inv_action_types_pkey PRIMARY KEY (id),
  CONSTRAINT inv_action_types_loc_type_id_fkey FOREIGN KEY (loc_type_id) REFERENCES public.location_types(id)
);
CREATE TABLE public.inventory (
  id integer NOT NULL DEFAULT nextval('inventory_id_seq'::regclass),
  location_id integer NOT NULL,
  assigned_crew_id integer,
  area_id integer,
  item_type_id integer NOT NULL,
  mfgrsn character varying,
  tilsonsn character varying,
  quantity integer NOT NULL,
  status_id integer NOT NULL,
  sloc_id integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  json_data character varying,
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT inventory_assigned_crew_id_fkey FOREIGN KEY (assigned_crew_id) REFERENCES public.crews(id),
  CONSTRAINT inventory_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES public.item_types(id),
  CONSTRAINT inventory_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statuses(id),
  CONSTRAINT inventory_sloc_id_fkey FOREIGN KEY (sloc_id) REFERENCES public.slocs(id),
  CONSTRAINT inventory_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE TABLE public.inventory_providers (
  id integer NOT NULL DEFAULT nextval('inventory_providers_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT inventory_providers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventory_types (
  id integer NOT NULL DEFAULT nextval('inventory_types_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT inventory_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.item_type_markets (
  id integer NOT NULL DEFAULT nextval('item_type_markets_id_seq'::regclass),
  item_type_id integer NOT NULL,
  market_id integer NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT item_type_markets_pkey PRIMARY KEY (id),
  CONSTRAINT item_type_markets_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id),
  CONSTRAINT item_type_markets_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES public.item_types(id)
);
CREATE TABLE public.item_types (
  id integer NOT NULL DEFAULT nextval('item_types_id_seq'::regclass),
  inventory_type_id integer NOT NULL,
  name character varying NOT NULL,
  manufacturer character varying,
  part_number character varying,
  unit_of_measure_id integer NOT NULL,
  units_per_package integer NOT NULL,
  description text,
  provider_id integer NOT NULL,
  low_units_quantity integer,
  category_id integer,
  image_path character varying,
  meta text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT item_types_pkey PRIMARY KEY (id),
  CONSTRAINT item_types_inventory_type_id_fkey FOREIGN KEY (inventory_type_id) REFERENCES public.inventory_types(id),
  CONSTRAINT item_types_unit_of_measure_id_fkey FOREIGN KEY (unit_of_measure_id) REFERENCES public.units_of_measure(id),
  CONSTRAINT item_types_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.inventory_providers(id),
  CONSTRAINT item_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.location_types (
  id integer NOT NULL DEFAULT nextval('location_types_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT location_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.locations (
  id integer NOT NULL DEFAULT nextval('locations_id_seq'::regclass),
  name character varying NOT NULL,
  loc_type_id integer NOT NULL,
  is_system_required integer DEFAULT 0,
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_loc_type_id_fkey FOREIGN KEY (loc_type_id) REFERENCES public.location_types(id)
);
CREATE TABLE public.markets (
  id integer NOT NULL DEFAULT nextval('markets_id_seq'::regclass),
  name character varying NOT NULL,
  client_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT markets_pkey PRIMARY KEY (id),
  CONSTRAINT markets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.qty_allocations (
  id integer NOT NULL DEFAULT nextval('qty_allocations_id_seq'::regclass),
  quantity_id integer NOT NULL,
  area_id integer,
  allocated_quantity integer NOT NULL,
  installed_quantity integer DEFAULT 0,
  allocated_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  allocation_name character varying,
  notes text,
  CONSTRAINT qty_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT qty_allocations_quantity_id_fkey FOREIGN KEY (quantity_id) REFERENCES public.inventory(id),
  CONSTRAINT qty_allocations_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE TABLE public.slocs (
  id integer NOT NULL DEFAULT nextval('slocs_id_seq'::regclass),
  name character varying NOT NULL,
  address character varying,
  market_id integer NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT slocs_pkey PRIMARY KEY (id),
  CONSTRAINT slocs_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id)
);
CREATE TABLE public.statuses (
  id integer NOT NULL DEFAULT nextval('statuses_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT statuses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transaction_types (
  id integer NOT NULL DEFAULT nextval('transaction_types_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT transaction_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id integer NOT NULL DEFAULT nextval('transactions_id_seq'::regclass),
  inventory_id integer,
  transaction_type character varying NOT NULL,
  action character varying NOT NULL,
  client character varying,
  market character varying,
  sloc character varying,
  item_type_name character varying,
  inventory_type_name character varying,
  manufacturer character varying,
  part_number character varying,
  description text,
  unit_of_measure character varying,
  units_per_package integer,
  provider_name character varying,
  category_name character varying,
  mfgrsn character varying,
  tilsonsn character varying,
  from_location_name character varying,
  from_location_type character varying,
  to_location_name character varying,
  to_location_type character varying,
  assigned_crew_name character varying,
  area_name character varying,
  status_name character varying,
  old_status_name character varying,
  quantity integer,
  old_quantity integer,
  user_name character varying DEFAULT 'system'::character varying,
  date_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  session_id character varying,
  notes character varying,
  ip_address character varying,
  user_agent character varying,
  before_state text,
  after_state text,
  CONSTRAINT transactions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.units_of_measure (
  id integer NOT NULL DEFAULT nextval('units_of_measure_id_seq'::regclass),
  name character varying NOT NULL,
  CONSTRAINT units_of_measure_pkey PRIMARY KEY (id)
);