-- =============================================
-- 17 Prime Home — Inventory Seed
-- Run this in Supabase SQL Editor AFTER schema.sql
-- Products sourced from KVI Lighting PI (2026.4.8) and Sinben order
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
