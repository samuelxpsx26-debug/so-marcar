-- Intervalo dos horários personalizável (antes só 5, 10, 15, 20, 30 ou 60 minutos)
alter table public.businesses drop constraint if exists businesses_slot_step_minutes_check;
alter table public.businesses add constraint businesses_slot_step_minutes_check
  check (slot_step_minutes between 5 and 240 and slot_step_minutes % 5 = 0);
