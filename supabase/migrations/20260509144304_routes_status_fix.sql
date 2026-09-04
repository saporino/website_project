UPDATE public.route_stops SET visit_status = 'completed'    WHERE visit_status = 'closed';
UPDATE public.route_stops SET visit_status = 'completed'    WHERE visit_status = 'visited';

ALTER TABLE public.route_stops 
DROP CONSTRAINT IF EXISTS route_stops_visit_status_check;

ALTER TABLE public.route_stops 
ADD CONSTRAINT route_stops_visit_status_check 
CHECK (visit_status IN ('pending', 'in_progress', 'completed', 'not_attended'));
