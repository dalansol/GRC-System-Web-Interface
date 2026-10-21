-- Nombres reales de prueba (SF-03) para las unidades y divisiones de 018.
-- INFERIDOS: el Consolidado solo trae códigos (UDN-0003…) y 02_Estructura.pptx solo nombres;
-- el mapeo se dedujo del departamento, el número de divisiones, los países y los nombres de
-- las evidencias. Las subdivisiones no tienen nombre real en ningún archivo y se quedan con
-- su código. Solo se llena si está vacío, para no pisar lo que se corrija desde la vista.
-- Solo con --datos-prueba. Requiere 018 y 021. Se puede ejecutar más de una vez sin efecto.
--
-- Confianza del mapeo:
--   UDN-0001 = Deportes: alta: tiene el área 'Deportiva'
--   UDN-0002 = Spin: SIN CONFIRMAR: podría ser FEMSA Servicios
--   UDN-0003 = KOF: alta: Beverage con divisiones en Brasil, Corporativo (KFS), Latam y México
--   UDN-0004 = Proximidad y Salud: alta: cuatro divisiones, una en Suiza y Alemania (Europa)
--   UDN-0005 = FEMSA Servicios: SIN CONFIRMAR: podría ser Spin
--   UDN-0006 = Tragetta: alta: la otra unidad Beverage, en Brasil
--   UDN-0001 / DIVISION-0004 = Deportes: alta
--   UDN-0002 / DIVISION-0006 = Spin: SIN CONFIRMAR, igual que su unidad
--   UDN-0003 / DIVISION-0002 = Brasil: alta: su subdivisión está en Brasil
--   UDN-0003 / DIVISION-0003 = Corporativo: alta: Corporativo y KFS
--   UDN-0003 / DIVISION-0007 = Latam: alta: de Argentina a Venezuela
--   UDN-0003 / DIVISION-0008 = México: alta: su subdivisión está en México
--   UDN-0004 / DIVISION-0005 = Europa: alta: Suiza y Alemania
--   UDN-0004 / DIVISION-0009 = Oxxo México: media: solo México
--   UDN-0004 / DIVISION-0010 = Salud y Multiformatos: media: Chile, Colombia, Ecuador y México
--   UDN-0004 / DIVISION-0001 = Américas y Movilidad: media: incluye Perú y Estados Unidos
--   UDN-0006 / DIVISION-0012 = Tragetta: alta

UPDATE business_units bu SET display_name = v.nombre_real
FROM (VALUES ('UDN-0001', 'Deportes'),
       ('UDN-0002', 'Spin'),
       ('UDN-0003', 'KOF'),
       ('UDN-0004', 'Proximidad y Salud'),
       ('UDN-0005', 'FEMSA Servicios'),
       ('UDN-0006', 'Tragetta')) AS v (codigo, nombre_real)
WHERE bu.name = v.codigo AND bu.display_name IS NULL;

UPDATE division d SET display_name = v.nombre_real
FROM (VALUES ('UDN-0001', 'DIVISION-0004', 'Deportes'),
       ('UDN-0002', 'DIVISION-0006', 'Spin'),
       ('UDN-0003', 'DIVISION-0002', 'Brasil'),
       ('UDN-0003', 'DIVISION-0003', 'Corporativo'),
       ('UDN-0003', 'DIVISION-0007', 'Latam'),
       ('UDN-0003', 'DIVISION-0008', 'México'),
       ('UDN-0004', 'DIVISION-0005', 'Europa'),
       ('UDN-0004', 'DIVISION-0009', 'Oxxo México'),
       ('UDN-0004', 'DIVISION-0010', 'Salud y Multiformatos'),
       ('UDN-0004', 'DIVISION-0001', 'Américas y Movilidad'),
       ('UDN-0006', 'DIVISION-0012', 'Tragetta')) AS v (unidad, codigo, nombre_real),
     business_units bu
WHERE bu.name = v.unidad AND d.business_unit_id = bu.id AND d.name = v.codigo AND d.display_name IS NULL;
