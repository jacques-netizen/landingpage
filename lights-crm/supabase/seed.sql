-- =============================================
-- 17 Prime Home — Inventory Seed
-- Run this in Supabase SQL Editor AFTER schema.sql
-- Products sourced from KVI Lighting PI, Sinben order, and 17investment decorative order
-- unit_price = 0 by default — update selling prices in GH₵ via the app
-- =============================================

-- Add product-specific categories
insert into categories (name, slug) values
  ('Recessed Downlights', 'recessed-downlights'),
  ('Surface Mount Lights', 'surface-mount-lights'),
  ('Switches & Sockets', 'switches-sockets')
on conflict (slug) do nothing;

-- =============================================
-- SUPPLIERS
-- =============================================
insert into suppliers (name, contact_name, phone, email, notes) values
  ('KVI Lighting', 'KVI Team', '+86 18022049449', 'info@kvilight.com',
   'Zhongshan KVI Lighting Company — Henglan Town, Guangdong, China'),
  ('Sinben', null, null, null,
   'Sinben switches and sockets supplier')
on conflict do nothing;

-- =============================================
-- PRODUCTS — KVI LIGHTING
-- =============================================
do $$
declare
  kvi_id   uuid;
  cat_rec  uuid;  -- Recessed Downlights
  cat_smt  uuid;  -- Surface Mount Lights
  cat_out  uuid;  -- Outdoor Lighting
  cat_str  uuid;  -- LED Strips
  cat_acc  uuid;  -- Accessories
begin

  select id into kvi_id   from suppliers where name = 'KVI Lighting' limit 1;
  select id into cat_rec  from categories where slug = 'recessed-downlights' limit 1;
  select id into cat_smt  from categories where slug = 'surface-mount-lights' limit 1;
  select id into cat_out  from categories where slug = 'outdoor-lighting' limit 1;
  select id into cat_str  from categories where slug = 'led-strips' limit 1;
  select id into cat_acc  from categories where slug = 'accessories' limit 1;

  -- ── GU207C Double Square Spotlight (2×8W, 3CCT) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('GU207C-WW', 'GU207C Double Square Spotlight — White',
     '2×8W 3CCT recessed double spotlight. Body: White. Trim: White. Cut-out: L75×W160mm. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 510, 50),
    ('GU207C-BK', 'GU207C Double Square Spotlight — Black',
     '2×8W 3CCT recessed double spotlight. Body: Black. Trim: Black. Cut-out: L75×W160mm. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 510, 50);

  -- ── GU107C Single Square Spotlight (8W, 3CCT) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('GU107C-WW', 'GU107C Single Square Spotlight — White',
     '8W 3CCT recessed square spotlight. Body: White. Trim: White. Cut-out: Φ75mm. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 500, 50),
    ('GU107C-BK', 'GU107C Single Square Spotlight — Black',
     '8W 3CCT recessed square spotlight. Body: Black. Trim: Black. Cut-out: Φ75mm. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 500, 50);

  -- ── GU103B Adjustable Round Spotlight (8W, 3CCT, gimbal) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('GU103B-WG', 'GU103B Adjustable Round Spotlight — White/Gold',
     '8W 3CCT adjustable gimbal recessed spotlight. Body: White. Trim: UV Gold. Cut-out: Φ75mm. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 500, 50),
    ('GU103B-WS', 'GU103B Adjustable Round Spotlight — White/Silver',
     '8W 3CCT adjustable gimbal recessed spotlight. Body: White. Trim: Silver. Cut-out: Φ75mm. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 500, 50);

  -- ── MZGU710A Round Cylinder Spotlight (8W, 3CCT, surface mount) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('MZGU710A-BSB', 'MZGU710A Cylinder Spotlight — Black/Shiny Black',
     '8W 3CCT surface-mount cylinder spotlight. Body: Black. Finish: Shiny Black. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 200, 20),
    ('MZGU710A-WG', 'MZGU710A Cylinder Spotlight — White/Gold',
     '8W 3CCT surface-mount cylinder spotlight. Body: White. Finish: UV Gold. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 200, 20),
    ('MZGU710A-BSL', 'MZGU710A Cylinder Spotlight — Black/Silver',
     '8W 3CCT surface-mount cylinder spotlight. Body: Black. Finish: UV Silver. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 200, 20),
    ('MZGU710A-WW', 'MZGU710A Cylinder Spotlight — White/White',
     '8W 3CCT surface-mount cylinder spotlight. Body: White. Finish: White. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 200, 20);

  -- ── XG-909 Round LED Panel (24W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG-909-BK', 'XG-909 Round LED Panel 24W — Black',
     '24W 6500K recessed round LED panel. Φ221×H44mm. Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG-907 Rectangular LED Panel (24W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG-907-BK', 'XG-907 Rectangular LED Panel 24W — Black',
     '24W 6500K recessed rectangular LED panel. L267×W136.5×H44mm. Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG2408-30W Round LED Panel (30W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG2408-30W-WH', 'XG2408 Round LED Panel 30W — White',
     '30W 6500K recessed round LED panel. Φ240×H52mm. White. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 100, 10),
    ('XG2408-30W-BK', 'XG2408 Round LED Panel 30W — Black',
     '30W 6500K recessed round LED panel. Φ240×H52mm. Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG2406-30W Rectangular LED Panel (30W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG2406-30W-WH', 'XG2406 Rectangular LED Panel 30W — White',
     '30W 6500K recessed rectangular LED panel. L266×W134×H51mm. White. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 100, 10),
    ('XG2406-30W-BK', 'XG2406 Rectangular LED Panel 30W — Black',
     '30W 6500K recessed rectangular LED panel. L266×W134×H51mm. Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG 940-12W Surface Mount Light (12W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG940-12W-WH', 'XG940 Surface Mount Light 12W — White',
     '12W 6500K surface-mount light. 160×H125mm. White. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG 950-12W Surface Mount Light (12W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG950-12W-BK', 'XG950 Surface Mount Light 12W — Black',
     '12W 6500K surface-mount light. Φ168×H131mm. Black. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG 920-12W Surface Mount Light (12W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG920-12W-WH', 'XG920 Surface Mount Light 12W — White',
     '12W 6500K surface-mount light. 160×H125mm. White. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 100, 10),
    ('XG920-12W-BK', 'XG920 Surface Mount Light 12W — Black',
     '12W 6500K surface-mount light. 160×H125mm. Black. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG 960-12W Surface Mount Light (12W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG960-12W-BK', 'XG960 Surface Mount Light 12W — Black',
     '12W 6500K surface-mount light. 160×H106mm. Black. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 100, 10);

  -- ── XG 970-12W Surface Mount Light (12W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('XG970-12W-BK', 'XG970 Surface Mount Light 12W — Black',
     '12W 6500K surface-mount light. Φ168×H131mm. Black. 2-year warranty.',
     cat_smt, kvi_id, 'KVI', 0, 100, 10);

  -- ── S01–S06 Mini Spotlight/Baffle (3W, 3000K, 38mm) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('S01-3W-WH', 'S01 Mini Spotlight 3W — White',
     '3W 3000K mini recessed spotlight baffle. 38mm. White. 2-year warranty.',
     cat_acc, kvi_id, 'KVI', 0, 500, 50),
    ('S02-3W-BK', 'S02 Mini Spotlight 3W — Black',
     '3W 3000K mini recessed spotlight baffle. 38mm. Black. 2-year warranty.',
     cat_acc, kvi_id, 'KVI', 0, 500, 50),
    ('S03-3W-GD', 'S03 Mini Spotlight 3W — Gold',
     '3W 3000K mini recessed spotlight baffle. 38mm. Gold. 2-year warranty.',
     cat_acc, kvi_id, 'KVI', 0, 500, 50),
    ('S04-3W-SL', 'S04 Mini Spotlight 3W — Silver',
     '3W 3000K mini recessed spotlight baffle. 38mm. Silver. 2-year warranty.',
     cat_acc, kvi_id, 'KVI', 0, 500, 50),
    ('S05-3W-GD', 'S05 Mini Spotlight 3W — Gold (Premium)',
     '3W 3000K mini recessed spotlight premium baffle. 38mm. Gold. 2-year warranty.',
     cat_acc, kvi_id, 'KVI', 0, 500, 50),
    ('S06-3W-BK', 'S06 Mini Spotlight 3W — Black (Premium)',
     '3W 3000K mini recessed spotlight premium baffle. 38mm. Black. 2-year warranty.',
     cat_acc, kvi_id, 'KVI', 0, 500, 50);

  -- ── RAF-10W Downlight (Ø100mm, 75mm cut-out) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('RAF-10W-6K', 'RAF Round Downlight 10W — White/Black (6500K)',
     '10W 6500K recessed round downlight. Ø100×43mm, cut-out Φ75mm. White+Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 200, 20),
    ('RAF-10W-3CCT', 'RAF Round Downlight 10W — White/Black (3CCT)',
     '10W 3CCT recessed round downlight. Ø100×43mm, cut-out Φ75mm. White+Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 200, 20);

  -- ── BY-72 Slim Round Downlight (7W, 6500K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('BY-72-WH', 'BY-72 Slim Round Downlight 7W — White',
     '7W 6500K slim recessed round downlight. Ø100×25mm, cut-out Φ75mm. White. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 200, 20),
    ('BY-72-BK', 'BY-72 Slim Round Downlight 7W — Black',
     '7W 6500K slim recessed round downlight. Ø100×25mm, cut-out Φ75mm. Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 200, 20);

  -- ── CDS218 Adjustable Gimbal Downlight (12W, 3000K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('CDS218-BK', 'CDS218 Gimbal Downlight 12W — Black/UV Black',
     '12W 3000K adjustable gimbal recessed downlight. Ø85×H85mm. Black + UV Black. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 200, 20),
    ('CDS218-WH', 'CDS218 Gimbal Downlight 12W — White/UV Silver',
     '12W 3000K adjustable gimbal recessed downlight. Ø85×H85mm. White + UV Silver. 2-year warranty.',
     cat_rec, kvi_id, 'KVI', 0, 200, 20);

  -- ── FL02-50W LED Floodlight (6500K, Black) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('FL02-50W-S', 'FL02 LED Floodlight 50W Small — Black',
     '50W 6500K LED floodlight. L185×W131×H27mm. Black. 2-year warranty.',
     cat_out, kvi_id, 'KVI', 0, 50, 5),
    ('FL02-50W-L', 'FL02 LED Floodlight 50W Large — Black',
     '50W 6500K LED floodlight. L255×W181×H27mm. Black. 2-year warranty.',
     cat_out, kvi_id, 'KVI', 0, 50, 5);

  -- ── HW04 Decorative Outdoor Lantern (E27, Black) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('HW04-BK', 'HW04 Decorative Outdoor Lantern E27 — Black',
     'E27 decorative outdoor pedestal lantern. Black. 2-year warranty.',
     cat_out, kvi_id, 'KVI', 0, 100, 10);

  -- ── GL-88107/88109 Wall Lantern (E27) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('GL88107-WH', 'GL-88107 Wall Lantern E27 — White',
     'E27 decorative wall lantern. 90×90×240mm. White. 2-year warranty.',
     cat_out, kvi_id, 'KVI', 0, 50, 5),
    ('GL88109-BK', 'GL-88109 Wall Lantern E27 — Black',
     'E27 decorative wall lantern. 90×90×240mm. Black. 2-year warranty.',
     cat_out, kvi_id, 'KVI', 0, 50, 5);

  -- ── TY04 LED Strip Light 3m (2×30W, 3000K) ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('TY04-3M', 'TY04 LED Strip Light 3m — 2×30W 3000K',
     '3-metre LED strip light system. 2×30W. 3000K warm white. Mean driver. Gray. 2-year warranty.',
     cat_str, kvi_id, 'KVI', 0, 5, 2),
    ('TY03-3M', 'TY03 LED Strip Light 3m — 30W 3000K',
     '3-metre LED strip light system. 30W. 3000K warm white. Mean driver. Gray. 2-year warranty.',
     cat_str, kvi_id, 'KVI', 0, 5, 2),
    ('TY01-3M', 'TY01 LED Strip Light 3m — 30W 3000K',
     '3-metre LED strip light system. 30W. 3000K warm white. Mean driver. Gray. 2-year warranty.',
     cat_str, kvi_id, 'KVI', 0, 5, 2);

end $$;

-- =============================================
-- PRODUCTS — SINBEN SWITCHES & SOCKETS
-- =============================================
do $$
declare
  sinben_id uuid;
  cat_sw    uuid;
begin

  select id into sinben_id from suppliers where name = 'Sinben' limit 1;
  select id into cat_sw    from categories where slug = 'switches-sockets' limit 1;

  -- Light Switches
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('SW-1G1W-GR', 'Light Switch 1-Gang — Gray',
     '1-gang 1-way light switch. Gray. Available in multiple series.',
     cat_sw, sinben_id, 'Sinben', 0, 480, 50),
    ('SW-2G1W-GR', 'Light Switch 2-Gang — Gray',
     '2-gang 1-way light switch. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 480, 50),
    ('SW-3G1W-GR', 'Light Switch 3-Gang — Gray',
     '3-gang 1-way light switch. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 480, 50),
    ('SW-4G1W-GR', 'Light Switch 4-Gang — Gray',
     '4-gang 1-way light switch. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 480, 50),
    ('SW-1G1W-BK', 'Light Switch 1-Gang — Black',
     '1-gang 1-way light switch. Black.',
     cat_sw, sinben_id, 'Sinben', 0, 300, 50),
    ('SW-2G1W-BK', 'Light Switch 2-Gang — Black',
     '2-gang 1-way light switch. Black.',
     cat_sw, sinben_id, 'Sinben', 0, 300, 50),
    ('SW-3G1W-BK', 'Light Switch 3-Gang — Black',
     '3-gang 1-way light switch. Black.',
     cat_sw, sinben_id, 'Sinben', 0, 300, 50),
    ('SW-4G1W-BK', 'Light Switch 4-Gang — Black',
     '4-gang 1-way light switch. Black.',
     cat_sw, sinben_id, 'Sinben', 0, 300, 50),
    ('SW-1G1W-WH', 'Light Switch 1-Gang — White',
     '1-gang 1-way light switch. White.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SW-2G1W-WH', 'Light Switch 2-Gang — White',
     '2-gang 1-way light switch. White.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SW-3G1W-WH', 'Light Switch 3-Gang — White',
     '3-gang 1-way light switch. White.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SW-4G1W-WH', 'Light Switch 4-Gang — White',
     '4-gang 1-way light switch. White.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SW-1G1W-GD', 'Light Switch 1-Gang — Gold',
     '1-gang 1-way light switch. Gold premium finish.',
     cat_sw, sinben_id, 'Sinben', 0, 130, 20),
    ('SW-2G1W-GD', 'Light Switch 2-Gang — Gold',
     '2-gang 1-way light switch. Gold premium finish.',
     cat_sw, sinben_id, 'Sinben', 0, 130, 20),
    ('SW-3G1W-GD', 'Light Switch 3-Gang — Gold',
     '3-gang 1-way light switch. Gold premium finish.',
     cat_sw, sinben_id, 'Sinben', 0, 130, 20),
    ('SW-4G1W-GD', 'Light Switch 4-Gang — Gold',
     '4-gang 1-way light switch. Gold premium finish.',
     cat_sw, sinben_id, 'Sinben', 0, 130, 20);

  -- Sockets
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('SK-13A-GR', 'Socket 13A Single — Gray',
     'Single 13A wall socket. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SK-13A-BK', 'Socket 13A Single — Black',
     'Single 13A wall socket. Black.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SK-13A-WH', 'Socket 13A Single — White',
     'Single 13A wall socket. White.',
     cat_sw, sinben_id, 'Sinben', 0, 100, 20),
    ('SK-D13A-GR', 'Socket 13A Double — Gray',
     'Double 13A wall socket. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 100, 20),
    ('SK-13AUSBC-GR', 'Socket 13A with USB-C Single — Gray',
     'Single 13A wall socket with USB-A + USB-C ports. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SK-13AUSBC-BK', 'Socket 13A with USB-C Single — Black',
     'Single 13A wall socket with USB-A + USB-C ports. Black.',
     cat_sw, sinben_id, 'Sinben', 0, 200, 30),
    ('SK-D13AUSBC-GR', 'Socket 13A with USB-C Double — Gray',
     'Double 13A wall socket with USB-A + USB-C ports. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 100, 20),
    ('SK-RND-13A', 'Round Socket 13A',
     'Round 13A wall socket. White/Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 840, 100);

  -- Specialist outlets
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('SK-TV-GR', 'TV Outlet — Gray',
     'TV coaxial wall outlet. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 160, 20),
    ('SK-SAT-GR', 'Satellite Outlet — Gray',
     'Satellite coaxial wall outlet. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 160, 20),
    ('SK-TVSAT-GR', 'TV + Satellite Outlet — Gray',
     'Combined TV + Satellite coaxial wall outlet. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 160, 20),
    ('SW-20A-GR', '20A Switch — Gray',
     '20A double-pole switch. Gray. For AC units.',
     cat_sw, sinben_id, 'Sinben', 0, 160, 20),
    ('SW-45A-GR', '45A Isolator Switch — Gray',
     '45A double-pole isolator switch. Gray. For water heaters/cookers.',
     cat_sw, sinben_id, 'Sinben', 0, 160, 20),
    ('SW-BELL-GR', 'Doorbell Switch — Gray',
     'Doorbell push switch. Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 160, 20);

  -- Extension cables
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('EXT-30CM', 'Extension Cable 30cm',
     '30cm extension cable/lead. White/Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 40, 10),
    ('EXT-40CM', 'Extension Cable 40cm',
     '40cm extension cable/lead. White/Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 40, 10),
    ('EXT-50CM', 'Extension Cable 50cm',
     '50cm extension cable/lead. White/Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 40, 10),
    ('EXT-60CM', 'Extension Cable 60cm',
     '60cm extension cable/lead. White/Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 40, 10),
    ('EXT-80CM', 'Extension Cable 80cm',
     '80cm extension cable/lead. White/Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 40, 10),
    ('EXT-100CM', 'Extension Cable 100cm',
     '100cm extension cable/lead. White/Gray.',
     cat_sw, sinben_id, 'Sinben', 0, 40, 10);

end $$;

-- =============================================
-- PRODUCTS — 17INVESTMENT DECORATIVE ORDER
-- Wall sconces, chandeliers, pendants — all 3CCT LED
-- ~170 SKUs from April 2026 purchase order (¥204,000 RMB after discount)
-- =============================================

insert into suppliers (name, contact_name, phone, email, notes) values
  ('Premium Décor China', null, null, null,
   'Chinese manufacturer of decorative LED lighting. Order Apr 2026 — deposit USD 20,000 (¥135,400 RMB). Includes wall sconces, chandeliers, pendants.')
on conflict do nothing;

do $$
declare
  decor_id  uuid;
  cat_wall  uuid;
  cat_ceil  uuid;
  cat_chan  uuid;
  cat_pend  uuid;
begin

  select id into decor_id from suppliers  where name = 'Premium Décor China' limit 1;
  select id into cat_wall from categories where slug = 'wall-lights'    limit 1;
  select id into cat_ceil from categories where slug = 'ceiling-lights' limit 1;
  select id into cat_chan from categories where slug = 'chandeliers'    limit 1;
  select id into cat_pend from categories where slug = 'pendant-lights' limit 1;

  -- ── WALL SCONCES ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('7895CH',       '7895 Wall Sconce — Chrome',                '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7895BK',       '7895 Wall Sconce — Black',                 '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1492CH',      'A1492 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A343FGD',      'A343 Wall Sconce — French Gold',           '3CCT LED decorative wall sconce. French Gold finish.',           cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A343BK',       'A343 Wall Sconce — Black',                 '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A335-26CH',    'A335-26 Wall Sconce — Chrome',             '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A335-26BK',    'A335-26 Wall Sconce — Black',              '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A346FGD',      'A346 Wall Sconce — French Gold',           '3CCT LED decorative wall sconce. French Gold finish.',           cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1349FGD',     'A1349 Wall Sconce — French Gold',          '3CCT LED decorative wall sconce. French Gold finish.',           cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1349BK',      'A1349 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A326FGD',      'A326 Wall Sconce — French Gold',           '3CCT LED decorative wall sconce. French Gold finish.',           cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1518CH',      'A1518 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1518BK',      'A1518 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1733CH',      'A1733 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1733BK',      'A1733 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1580CH',      'A1580 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1580BK',      'A1580 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1582CH',      'A1582 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1582BK',      'A1582 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1576CH',      'A1576 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1576BK',      'A1576 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1579CH',      'A1579 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1579BK',      'A1579 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1578CH',      'A1578 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1578BK',      'A1578 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1530CH',      'A1530 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1530BK',      'A1530 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1732CH',      'A1732 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1732BK',      'A1732 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1465',        'A1465 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1455',        'A1455 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1459',        'A1459 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1461',        'A1461 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7004B-FGD',    '7004B Wall Sconce — French Gold',          '3CCT LED decorative wall sconce. French Gold finish.',           cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7004B-CH',     '7004B Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7004B-BK',     '7004B Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1355CH',      'A1355 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1355BK',      'A1355 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A309-1',       'A309-1 Wall Sconce',                       '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7821-100',     '7821 Linear Wall Bar 100cm',               '3CCT LED linear wall/ceiling bar. 100cm length.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1565',        'A1565 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1583CH',      'A1583 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1583BK',      'A1583 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1414CH',      'A1414 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1414BK',      'A1414 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1416CH',      'A1416 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1416BK',      'A1416 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1641CH',      'A1641 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1641BK',      'A1641 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1642CH',      'A1642 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1642BK',      'A1642 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1639CH',      'A1639 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1639BK',      'A1639 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1353CH',      'A1353 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1353BK',      'A1353 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1404CH',      'A1404 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1404BK',      'A1404 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7001-1C/CH',   '7001 Wall Lamp — Chrome',                  '3CCT LED decorative wall lamp with glass shade. Chrome finish.', cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7001-1C/BK',   '7001 Wall Lamp — Black',                   '3CCT LED decorative wall lamp with glass shade. Black finish.',  cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1318CH',      'A1318 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1318BK',      'A1318 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A823BK',       'A823 Wall Sconce — Black',                 '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('5071BK',       '5071 Wall Sconce — Black',                 '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1295',        'A1295 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1795AB',      'A1795 Wall Sconce — Brass',                '3CCT LED decorative wall sconce. Brass finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1795BK',      'A1795 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7149GD-120',   '7149 Linear Wall Bar 120cm — Gold',        '3CCT LED linear wall bar. 120cm. Spray gold finish.',            cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7149BK-120',   '7149 Linear Wall Bar 120cm — Black',       '3CCT LED linear wall bar. 120cm. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1149R-CH',    'A1149R Wall Sconce — Chrome',              '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1149R-BK',    'A1149R Wall Sconce — Black',               '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1320CH',      'A1320 Wall Sconce — Chrome',               '3CCT LED decorative wall sconce. Chrome finish.',                cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1320BK',      'A1320 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7846-80',      '7846 Linear Wall Bar 80cm',                '3CCT LED linear wall bar. 80cm length.',                         cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1374AB',      'A1374 Wall Sconce — Brass',                '3CCT LED decorative wall sconce. Brass finish.',                 cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1357',        'A1357 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1375-1',      'A1375 1-Light Wall Bracket',               '3CCT LED wall bracket. Single-arm.',                            cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1375-2',      'A1375 2-Light Wall Bracket',               '3CCT LED wall bracket. Double-arm.',                            cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1376-1',      'A1376 1-Light Wall Bracket',               '3CCT LED wall bracket. Single-arm.',                            cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1376-2',      'A1376 2-Light Wall Bracket',               '3CCT LED wall bracket. Double-arm.',                            cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1667',        'A1667 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1574',        'A1574 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1522',        'A1522 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1335FGD',     'A1335 Wall Sconce — French Gold',          '3CCT LED decorative wall sconce. French Gold finish.',           cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1334FGD',     'A1334 Wall Sconce — French Gold',          '3CCT LED decorative wall sconce. French Gold finish.',           cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1194-97',     'A1194 Linear Wall Bar 97cm',               '3CCT LED linear wall bar. 97cm length.',                         cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1092-1',      'A1092 1-Light Wall Sconce',                '3CCT LED wall sconce with fabric shade. Single light.',          cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1092-2',      'A1092 2-Light Wall Sconce',                '3CCT LED wall sconce with fabric shade. Double light.',          cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1412',        'A1412 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1365',        'A1365 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('7918',         '7918 Wall Sconce',                         '3CCT LED wall sconce. Oval glass globe.',                        cat_wall, decor_id, '17investment', 0, 24, 5),
    ('5081B',        '5081B Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1258',        'A1258 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1359',        'A1359 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('5131',         '5131 Industrial Wall Light',               '3CCT LED industrial-style cage wall light.',                     cat_wall, decor_id, '17investment', 0, 24, 5),
    ('5202',         '5202 Industrial Wall Light',               '3CCT LED industrial-style wall light.',                          cat_wall, decor_id, '17investment', 0, 24, 5),
    ('5133',         '5133 Wall Light',                          '3CCT LED decorative wall light.',                                cat_wall, decor_id, '17investment', 0, 24, 5),
    ('5349-2',       '5349-2 Globe Wall Sconce',                 '3CCT LED globe wall sconce.',                                    cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1073BK',      'A1073 Square Frame Wall Sconce — Black',   '3CCT LED wall sconce. Square frame with globe. Black.',          cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1074BK',      'A1074 Circle Wall Sconce — Black',         '3CCT LED wall sconce. Circle frame with globe. Black.',          cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1075BK',      'A1075 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1612A',       'A1612A Wall Sconce',                       '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A752',         'A752 Wall Sconce',                         '3CCT LED wall sconce. Stone/marble accent.',                     cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A818A',        'A818A Fabric Wall Sconce',                 '3CCT LED wall sconce. Fabric shade.',                            cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1786A',       'A1786A Picture Frame Wall Light',          '3CCT LED picture/art frame wall light.',                         cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A1786B',       'A1786B Picture Frame Wall Light',          '3CCT LED picture/art frame wall light (variant B).',             cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A821B',        'A821B Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 36, 5),
    ('A388',         'A388 Linear Bar Wall Light',               '3CCT LED linear bar wall light.',                                cat_wall, decor_id, '17investment', 0, 12, 3),
    ('A386',         'A386 Linear Bar Wall Light',               '3CCT LED linear bar wall light.',                                cat_wall, decor_id, '17investment', 0, 12, 3),
    ('A1502',        'A1502 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1504',        'A1504 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1474',        'A1474 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1418',        'A1418 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5),
    ('5304',         '5304 Wall Light',                          '3CCT LED decorative wall light.',                                cat_wall, decor_id, '17investment', 0, 12, 3),
    ('5460BK',       '5460 Circle Wall Light — Black',           '3CCT LED circular wall light. Black finish.',                    cat_wall, decor_id, '17investment', 0, 12, 3),
    ('5300GD',       '5300 Decorative Wall Clock Light — Gold',  '3CCT LED decorative clock-style wall light. Gold finish.',       cat_wall, decor_id, '17investment', 0, 12, 3),
    ('A1168BK',      'A1168 Wall Sconce — Black',                '3CCT LED decorative wall sconce. Black finish.',                 cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1724',        'A1724 Bird Wall Sconce',                   '3CCT LED bird-motif decorative wall sconce.',                    cat_wall, decor_id, '17investment', 0, 24, 5),
    ('A1721',        'A1721 Wall Sconce',                        '3CCT LED decorative wall sconce.',                               cat_wall, decor_id, '17investment', 0, 24, 5);

  -- ── CEILING TRACK BARS & LINEAR CEILING LIGHTS ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('7115-3AB',     '7115 3-Spot Ceiling Track Bar — Brass',    '3CCT LED 3-spotlight adjustable ceiling track bar. Brass.',      cat_ceil, decor_id, '17investment', 0, 24, 5),
    ('7115-3BK',     '7115 3-Spot Ceiling Track Bar — Black',    '3CCT LED 3-spotlight adjustable ceiling track bar. Black.',      cat_ceil, decor_id, '17investment', 0, 24, 5),
    ('7115-4AB',     '7115 4-Spot Ceiling Track Bar — Brass',    '3CCT LED 4-spotlight adjustable ceiling track bar. Brass.',      cat_ceil, decor_id, '17investment', 0, 24, 5),
    ('7115-4BK',     '7115 4-Spot Ceiling Track Bar — Black',    '3CCT LED 4-spotlight adjustable ceiling track bar. Black.',      cat_ceil, decor_id, '17investment', 0, 24, 5),
    ('A1185-100FGD', 'A1185 Linear Ceiling Bar 100cm — French Gold', '3CCT LED linear ceiling bar. 100cm. French Gold finish.',   cat_ceil, decor_id, '17investment', 0, 24, 5),
    ('7803BK-100',   '7803 Linear Ceiling Bar 100cm — Black',    '3CCT LED linear ceiling bar. 100cm. Black finish.',              cat_ceil, decor_id, '17investment', 0, 24, 5);

  -- ── CHANDELIERS ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('9288-3CH',     '9288 3-Light Chandelier — Chrome',         '3CCT LED 3-arm chandelier. Chrome finish.',                      cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9288-3BK',     '9288 3-Light Chandelier — Black',          '3CCT LED 3-arm chandelier. Black finish.',                       cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9510BK',       '9510 Chandelier — Black',                  '3CCT LED chandelier. Black finish.',                             cat_chan, decor_id, '17investment', 0, 24, 3),
    ('9533BK',       '9533 Chandelier — Black',                  '3CCT LED chandelier. Black finish.',                             cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9642BK',       '9642 Chandelier — Black',                  '3CCT LED chandelier. Black finish.',                             cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9641BK',       '9641 Linear Chandelier — Black',           '3CCT LED linear/calligraphy chandelier. Black finish.',          cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9694',         '9694 Orbital Chandelier',                  '3CCT LED orbital ring chandelier.',                              cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9278',         '9278 Chandelier',                          '3CCT LED decorative chandelier.',                                cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9664',         '9664 Ring Chandelier',                     '3CCT LED ring/spiral chandelier.',                               cat_chan, decor_id, '17investment', 0, 24, 3),
    ('9537BK',       '9537 Ring Chandelier — Black',             '3CCT LED ring chandelier. Black finish.',                        cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9240-3BK',     '9240 3-Light Chandelier — Black',          '3CCT LED 3-arm traditional chandelier. Black finish.',           cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9153-3FGD',    '9153 3-Light Chandelier — French Gold',    '3CCT LED 3-arm chandelier. French Gold finish.',                 cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9153-3BK',     '9153 3-Light Chandelier — Black',          '3CCT LED 3-arm chandelier. Black finish.',                       cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9539FGD',      '9539 Ring Chandelier — French Gold',       '3CCT LED ring chandelier. French Gold finish.',                  cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9539CH',       '9539 Ring Chandelier — Chrome',            '3CCT LED ring chandelier. Chrome finish.',                       cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9539BK',       '9539 Ring Chandelier — Black',             '3CCT LED ring chandelier. Black finish.',                        cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9628-5AB',     '9628 5-Light Chandelier — Brass',          '3CCT LED 5-arm traditional chandelier. Brass finish.',           cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9628-5CH',     '9628 5-Light Chandelier — Chrome',         '3CCT LED 5-arm traditional chandelier. Chrome finish.',          cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9189-5',       '9189 5-Light Chandelier',                  '3CCT LED 5-arm chandelier.',                                     cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9629-5',       '9629 5-Light Chandelier',                  '3CCT LED 5-arm chandelier.',                                     cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9057-3',       '9057 3-Light Chandelier',                  '3CCT LED 3-arm traditional chandelier with shades.',             cat_chan, decor_id, '17investment', 0, 24, 3),
    ('9057-5',       '9057 5-Light Chandelier',                  '3CCT LED 5-arm traditional chandelier with shades.',             cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9468-3FGD',    '9468 3-Light Chandelier — French Gold',    '3CCT LED 3-arm chandelier. French Gold finish.',                 cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9468-3BK',     '9468 3-Light Chandelier — Black',          '3CCT LED 3-arm chandelier. Black finish.',                       cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9442-BK',      '9442 Oval Ring Chandelier — Black',        '3CCT LED oval ring chandelier. Black finish.',                   cat_chan, decor_id, '17investment', 0, 15, 2),
    ('9290-10',      '9290 10-Light Grand Chandelier',           '3CCT LED 10-light grand chandelier with chain/bead detail.',     cat_chan, decor_id, '17investment', 0, 5,  1),
    ('9410-FGD',     '9410 Linear Chandelier — French Gold',     '3CCT LED linear loop chandelier. French Gold finish.',           cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9410-BK',      '9410 Linear Chandelier — Black',           '3CCT LED linear loop chandelier. Black finish.',                 cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9459FGD',      '9459 Linear Chandelier — French Gold',     '3CCT LED linear chandelier. French Gold finish.',                cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9459BK',       '9459 Linear Chandelier — Black',           '3CCT LED linear chandelier. Black finish.',                      cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9460BK',       '9460 Chandelier — Black',                  '3CCT LED chandelier. Black finish.',                             cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9412-3',       '9412 3-Globe Chandelier',                  '3CCT LED 3-globe chandelier.',                                   cat_chan, decor_id, '17investment', 0, 12, 2),
    ('9586-5',       '9586 5-Light Chandelier',                  '3CCT LED 5-arm traditional chandelier.',                         cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9213-5',       '9213 5-Light Chandelier',                  '3CCT LED 5-arm chandelier.',                                     cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9214-5',       '9214 5-Light Chandelier',                  '3CCT LED 5-arm chandelier.',                                     cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9649FGD',      '9649 Chandelier — French Gold',            '3CCT LED chandelier. French Gold finish.',                       cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9649BK',       '9649 Chandelier — Black',                  '3CCT LED chandelier. Black finish.',                             cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9652BK',       '9652 Ring Chandelier — Black',             '3CCT LED concentric ring chandelier. Black finish.',             cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9658-3',       '9658 3-Light Chandelier',                  '3CCT LED 3-tube chandelier.',                                    cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9274',         '9274 Linear Chandelier',                   '3CCT LED linear chandelier.',                                    cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9275BK',       '9275 Linear Chandelier — Black',           '3CCT LED linear chandelier. Black finish.',                      cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9613BK',       '9613 Chandelier — Black',                  '3CCT LED chandelier. Black finish.',                             cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9346',         '9346 Abstract Ring Chandelier',            '3CCT LED abstract ring chandelier.',                             cat_chan, decor_id, '17investment', 0, 20, 3),
    ('9676',         '9676 Ring Chandelier',                     '3CCT LED ring chandelier.',                                      cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9686BK',       '9686 Ring Chandelier — Black',             '3CCT LED ring chandelier. Black finish.',                        cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9672BK',       '9672 Sputnik Chandelier — Black',          '3CCT LED sputnik/starburst chandelier. Black finish.',           cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9525FGD',      '9525 Loop Chandelier — French Gold',       '3CCT LED loop/oval chandelier. French Gold finish.',             cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9525BK',       '9525 Loop Chandelier — Black',             '3CCT LED loop/oval chandelier. Black finish.',                   cat_chan, decor_id, '17investment', 0, 10, 2),
    ('9213-16',      '9213 16-Light Grand Chandelier',           '3CCT LED 16-arm grand chandelier with bead detail.',             cat_chan, decor_id, '17investment', 0, 1,  1),
    ('A1729',        'A1729 Looped Chandelier',                  '3CCT LED looped ring chandelier.',                               cat_chan, decor_id, '17investment', 0, 24, 3),
    ('9587',         '9587 Multi-Light Chandelier',              '3CCT LED multi-arm chandelier with globe shades.',               cat_chan, decor_id, '17investment', 0, 24, 3);

  -- ── PENDANT LIGHTS ──
  insert into products (sku, name, description, category_id, supplier_id, brand, unit_price, stock_qty, low_stock_threshold)
  values
    ('9565-2BK',     '9565 Tubular Pendant — Black',             '3CCT LED tubular pendant light. Black finish.',                  cat_pend, decor_id, '17investment', 0, 12, 2);

end $$;
