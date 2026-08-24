-- ============================================================
-- 010_cal_booking.sql — Cal.com-booking → CRM, med Whereby-lenken
-- Rent tillegg på companies (den eksisterende "leads"-tabellen i dette
-- systemet). Ingen eksisterende kolonner røres.
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS cal_booking_uid TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS meeting_start_time TIMESTAMPTZ;

-- Hindrer duplikate selskaper hvis Cal.com sender samme webhook to ganger
CREATE UNIQUE INDEX IF NOT EXISTS companies_cal_booking_uid_idx
  ON companies (cal_booking_uid) WHERE cal_booking_uid IS NOT NULL;

COMMENT ON COLUMN companies.cal_booking_uid IS 'Cal.com booking-UID. Brukt til idempotens i lead-inbox — samme webhook sendt to ganger skal ikke opprette duplikat.';
COMMENT ON COLUMN companies.meeting_url IS 'Whereby-lenken til demomøtet, fra Cal.com sin BOOKING_CREATED-webhook (metadata.videoCallUrl eller location).';
COMMENT ON COLUMN companies.meeting_start_time IS 'Avtalt møtetidspunkt fra Cal.com. Kan avvike fra next_activity_at hvis noen har endret neste aktivitet manuelt etterpå.';
