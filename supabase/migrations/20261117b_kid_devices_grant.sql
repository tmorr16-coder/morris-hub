-- 20261117_kid_devices.sql created the tables but did not grant the server's
-- role access, so the server was refused ("permission denied", 42501) as well
-- as the browser. Tables in hub need this explicitly; see child_tasks.
-- Only service_role: these tables are never read from a browser.
grant all on hub.child_kid_pins, hub.child_devices to service_role;
