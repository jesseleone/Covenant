-- Covenant schema, from docs/schema.sql (the Task 1 design) with the changes
-- the running app needs:
--   * every table has `seq` (insertion order), so records load in the order
--     the app created them;
--   * foreign keys are DEFERRABLE INITIALLY DEFERRED, so one action's writes
--     are checked together at commit (several tables reference each other);
--   * columns the app model carries that the design left out: app_user.initials,
--     term_set.note, settings.today; risk_rating is numeric.

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy name search for duplicate checks

CREATE TYPE user_role       AS ENUM ('analyst','associate','vp','md','ic_member','compliance');
CREATE TYPE deal_stage      AS ENUM ('sourced','screening','term_sheet','diligence','ic','documentation','closed');
CREATE TYPE deal_status     AS ENUM ('active','passed','lost','on_hold','closed');
CREATE TYPE pass_reason     AS ENUM ('pricing','structure','credit_quality','sponsor','sector','lost_to_competitor','other');
CREATE TYPE strategy        AS ENUM ('cash_flow','abl','nav','special_sits');
CREATE TYPE deal_type       AS ENUM ('lbo','add_on','refi','recap','growth');
CREATE TYPE company_type    AS ENUM ('borrower','sponsor','lender','advisor','law_firm','qoe_provider','agent');
CREATE TYPE person_type     AS ENUM ('management','sponsor','banker','advisor','lender','internal');
CREATE TYPE stakeholder_side AS ENUM ('internal','borrower','sponsor','lender','advisor');
CREATE TYPE entity_type     AS ENUM ('deal','company','person');
CREATE TYPE note_type       AS ENUM ('meeting','call','screening','ic','general');
CREATE TYPE doc_type        AS ENUM ('cim','qoe','model','term_sheet','credit_agreement','other');
CREATE TYPE field_unit      AS ENUM ('usd_m','pct','x','text','count');
CREATE TYPE field_status    AS ENUM ('proposed','confirmed','corrected');
CREATE TYPE period_case     AS ENUM ('actual','sponsor','lender_base','downside');
CREATE TYPE term_set_label  AS ENUM ('proposal','term_sheet','ic_approved','closing');
CREATE TYPE term_set_status AS ENUM ('draft','issued','locked');
CREATE TYPE instrument      AS ENUM ('term_loan','ddtl','revolver','second_lien','mezz');
CREATE TYPE lien_rank       AS ENUM ('1L','1L_FO','1L_LO','2L','unsecured');
CREATE TYPE covenant_metric AS ENUM ('total_leverage','interest_coverage','min_liquidity');
CREATE TYPE workstream      AS ENUM ('qoe','commercial','legal','tax','insurance','environmental','it','background','kyc','collateral');
CREATE TYPE severity        AS ENUM ('red_flag','high','medium','low');
CREATE TYPE dd_status       AS ENUM ('open','received','mitigated','accepted','closed');
CREATE TYPE memo_type       AS ENUM ('screening','dd_update','final','closing');
CREATE TYPE memo_status     AS ENUM ('draft','ready_for_ic','final');
CREATE TYPE ic_decision     AS ENUM ('approve','approve_with_conditions','defer','decline');
CREATE TYPE ic_vote_value   AS ENUM ('approve','approve_with_conditions','decline','abstain');
CREATE TYPE condition_type  AS ENUM ('pre_close','post_close','terms');
CREATE TYPE condition_status AS ENUM ('proposed','open','satisfied');

-- Relationship layer ---------------------------------------------------------

CREATE TABLE app_user (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL, email text UNIQUE NOT NULL,
  role user_role NOT NULL, title text NOT NULL, initials text NOT NULL, sso_id text
);

CREATE TABLE company (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL, aliases text[] NOT NULL DEFAULT '{}',
  domain text, types company_type[] NOT NULL CHECK (cardinality(types) > 0),
  sector text, hq_city text, hq_country text, description text,
  parent_id text REFERENCES company(id) DEFERRABLE INITIALLY DEFERRED,
  owner_user_id text REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_name_trgm ON company USING gin (name gin_trgm_ops);

CREATE TABLE person (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  full_name text NOT NULL, email text, phone text,
  person_type person_type NOT NULL,
  relationship_owner_id text REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED, bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX person_email_uq ON person (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE affiliation (            -- role history
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  person_id text NOT NULL REFERENCES person(id) DEFERRABLE INITIALLY DEFERRED,
  company_id text NOT NULL REFERENCES company(id) DEFERRABLE INITIALLY DEFERRED,
  title text NOT NULL, start_date date, end_date date, is_current boolean NOT NULL,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Deals ----------------------------------------------------------------------

CREATE TABLE deal (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL, codename text NOT NULL,
  borrower_company_id text NOT NULL REFERENCES company(id) DEFERRABLE INITIALLY DEFERRED,
  sponsor_company_id text REFERENCES company(id) DEFERRABLE INITIALLY DEFERRED,
  strategy strategy NOT NULL, deal_type deal_type NOT NULL, stage deal_stage NOT NULL, status deal_status NOT NULL,
  pass_reason pass_reason, pass_note text,
  requested_size numeric(12,2) NOT NULL, fund_hold_target numeric(12,2) NOT NULL,
  expected_close date, closed_at date,
  lead_user_id text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  risk_rating numeric, risk_rating_scale text,          -- ratings stored with their scale
  summary text, thesis text, sector text NOT NULL DEFAULT '', sector_tags text[] NOT NULL DEFAULT '{}', tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), stage_entered_at timestamptz NOT NULL,
  CHECK (status NOT IN ('passed','lost') OR pass_reason IS NOT NULL),
  CHECK ((risk_rating IS NULL) = (risk_rating_scale IS NULL))
);

CREATE TABLE deal_team (
  deal_id text REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  user_id text REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  PRIMARY KEY (deal_id, user_id)
);

CREATE TABLE stakeholder (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  person_id text REFERENCES person(id) DEFERRABLE INITIALLY DEFERRED,
  company_id text REFERENCES company(id) DEFERRABLE INITIALLY DEFERRED,
  role text NOT NULL, side stakeholder_side NOT NULL,
  CHECK ((person_id IS NULL) <> (company_id IS NULL))
);

CREATE TABLE stage_event (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  from_stage deal_stage, to_stage deal_stage NOT NULL,
  user_id text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  at timestamptz NOT NULL, override_reason text
);

-- Documents and extraction ---------------------------------------------------

CREATE TABLE document (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  doc_type doc_type NOT NULL, title text NOT NULL,
  version int NOT NULL DEFAULT 1, source text NOT NULL, storage_uri text, content_hash text,
  extraction_status text NOT NULL DEFAULT 'none', uploaded_at timestamptz NOT NULL
);
CREATE TABLE document_page (
  document_id text REFERENCES document(id) DEFERRABLE INITIALLY DEFERRED, n int, text text NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  PRIMARY KEY (document_id, n)
);

CREATE TABLE extracted_field (       -- AI proposes, a person confirms or corrects
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  document_id text NOT NULL REFERENCES document(id) DEFERRABLE INITIALLY DEFERRED, page int NOT NULL, quote text NOT NULL,
  field_key text NOT NULL, label text NOT NULL, value_num numeric, value_text text, unit field_unit NOT NULL, period text,
  confidence numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1), status field_status NOT NULL,
  corrected_from jsonb,                 -- {value, documentId, page}
  reviewed_by text REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED, reviewed_at timestamptz,
  UNIQUE (deal_id, field_key),
  CHECK ((value_num IS NULL) <> (value_text IS NULL))
);

CREATE TABLE financial_period (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  company_id text NOT NULL REFERENCES company(id) DEFERRABLE INITIALLY DEFERRED,
  label text NOT NULL, period_end date NOT NULL, period_type text NOT NULL, case_name period_case NOT NULL,
  revenue numeric(12,2) NOT NULL, adj_ebitda_field_key text, adj_ebitda numeric(12,2) NOT NULL, capex numeric(12,2) NOT NULL, interest numeric(12,2)
);

-- Terms (securities) ---------------------------------------------------------

CREATE TABLE term_set (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED, version int NOT NULL,
  label term_set_label NOT NULL, status term_set_status NOT NULL,
  parent_id text REFERENCES term_set(id) DEFERRABLE INITIALLY DEFERRED,
  created_by text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED, created_at timestamptz NOT NULL,
  locked_by_ic_event_id text, note text,
  UNIQUE (deal_id, version) DEFERRABLE INITIALLY DEFERRED,
  CHECK (status <> 'locked' OR locked_by_ic_event_id IS NOT NULL)
);

CREATE TABLE tranche (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  term_set_id text NOT NULL REFERENCES term_set(id) DEFERRABLE INITIALLY DEFERRED, key text NOT NULL, name text NOT NULL,
  instrument instrument NOT NULL, lien_rank lien_rank NOT NULL,
  commitment numeric(12,2) NOT NULL CHECK (commitment > 0),
  funded_at_close numeric(12,2) NOT NULL CHECK (funded_at_close BETWEEN 0 AND commitment),
  fund_hold numeric(12,2) NOT NULL CHECK (fund_hold BETWEEN 0 AND commitment),
  base_rate text NOT NULL DEFAULT 'SOFR', spread_bps int NOT NULL, floor_bps int NOT NULL, oid_pct numeric(5,2) NOT NULL,
  pik_bps int NOT NULL DEFAULT 0, call_protection text NOT NULL, maturity_date date NOT NULL, amort_pct_per_year numeric(5,2) NOT NULL,
  UNIQUE (term_set_id, key) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE covenant (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  term_set_id text NOT NULL REFERENCES term_set(id) DEFERRABLE INITIALLY DEFERRED, metric covenant_metric NOT NULL,
  operator text NOT NULL CHECK (operator IN ('max','min')), test_frequency text NOT NULL, notes text
);
CREATE TABLE covenant_level (
  covenant_id text REFERENCES covenant(id) DEFERRABLE INITIALLY DEFERRED, from_date date, level numeric(8,2) NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  PRIMARY KEY (covenant_id, from_date)
);

-- Issued and locked term sets are read-only. Loading the demo data sets
-- covenant.seeding for its own transaction, because seeded term sets arrive
-- already issued or locked.
CREATE FUNCTION forbid_locked_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('covenant.seeding', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF EXISTS (SELECT 1 FROM term_set WHERE id = COALESCE(NEW.term_set_id, OLD.term_set_id) AND status <> 'draft') THEN
    RAISE EXCEPTION 'term set is % and cannot be edited; create a new version', (SELECT status FROM term_set WHERE id = COALESCE(NEW.term_set_id, OLD.term_set_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER tranche_locked BEFORE INSERT OR UPDATE OR DELETE ON tranche FOR EACH ROW EXECUTE FUNCTION forbid_locked_terms();
CREATE TRIGGER covenant_locked BEFORE INSERT OR UPDATE OR DELETE ON covenant FOR EACH ROW EXECUTE FUNCTION forbid_locked_terms();

-- Diligence, memo, IC --------------------------------------------------------

CREATE TABLE ic_event (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  stage text NOT NULL CHECK (stage IN ('screening','final')),
  date timestamptz NOT NULL, memo_id text, term_set_id text REFERENCES term_set(id) DEFERRABLE INITIALLY DEFERRED,
  status text NOT NULL CHECK (status IN ('pending','decided')), decision ic_decision,
  approved_hold numeric(12,2), decided_at timestamptz,
  CHECK ((status = 'decided') = (decision IS NOT NULL))
);
ALTER TABLE term_set ADD FOREIGN KEY (locked_by_ic_event_id) REFERENCES ic_event(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE ic_vote (
  ic_event_id text REFERENCES ic_event(id) DEFERRABLE INITIALLY DEFERRED,
  user_id text REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  vote ic_vote_value NOT NULL, comment text,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  PRIMARY KEY (ic_event_id, user_id)
);
CREATE TABLE ic_question (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  ic_event_id text NOT NULL REFERENCES ic_event(id) DEFERRABLE INITIALLY DEFERRED,
  question text NOT NULL, asked_by text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED, answer text
);

CREATE TABLE ic_condition (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  ic_event_id text REFERENCES ic_event(id) DEFERRABLE INITIALLY DEFERRED,
  description text NOT NULL, type condition_type NOT NULL,
  owner_user_id text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  due_date date, status condition_status NOT NULL, source_dd_item_id text
);

CREATE TABLE dd_item (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED, workstream workstream NOT NULL,
  kind text NOT NULL CHECK (kind IN ('request','finding')), title text NOT NULL, detail text NOT NULL,
  severity severity, status dd_status NOT NULL, mitigant text, memo_section_key text,
  ic_condition_id text REFERENCES ic_condition(id) DEFERRABLE INITIALLY DEFERRED,
  owner_user_id text REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED, due_date date,
  CHECK (kind = 'request' OR severity IS NOT NULL)
);
ALTER TABLE ic_condition ADD FOREIGN KEY (source_dd_item_id) REFERENCES dd_item(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE memo (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED, memo_type memo_type NOT NULL, version int NOT NULL,
  status memo_status NOT NULL, term_set_id text NOT NULL REFERENCES term_set(id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  UNIQUE (deal_id, memo_type, version)
);
ALTER TABLE ic_event ADD FOREIGN KEY (memo_id) REFERENCES memo(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE memo_section (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  memo_id text NOT NULL REFERENCES memo(id) DEFERRABLE INITIALLY DEFERRED, key text NOT NULL, title text NOT NULL, ord int NOT NULL,
  content text NOT NULL,               -- Markdown with {{field:…}} / {{metric:…}} tokens and [[cite:…]] links; no typed figures
  dependencies text[] NOT NULL,        -- e.g. field:adj_ebitda_ltm, termset:active, dd:red_flags
  snapshot jsonb NOT NULL,             -- dependency values when written; stale when they differ
  generated_by text NOT NULL CHECK (generated_by IN ('ai','ai_offline','human')),
  reviewed_by text REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED, reviewed_at timestamptz, updated_at timestamptz NOT NULL,
  UNIQUE (memo_id, key)
);

CREATE TABLE devils_advocate (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  deal_id text NOT NULL REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  question text NOT NULL, rationale text NOT NULL, precedent_deal_ids text[] NOT NULL
);

-- Notes, chat, audit ---------------------------------------------------------

CREATE TABLE note (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  subject_type entity_type NOT NULL, subject_id text NOT NULL,   -- polymorphic
  body text NOT NULL, note_type note_type NOT NULL,
  author_id text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  pinned boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL
);
CREATE TABLE note_mention (
  note_id text REFERENCES note(id) DEFERRABLE INITIALLY DEFERRED, entity_type entity_type, entity_id text,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  PRIMARY KEY (note_id, entity_type, entity_id)
);

CREATE TABLE chat_thread (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  title text NOT NULL, owner_id text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED,
  scope jsonb, created_at timestamptz NOT NULL
);
CREATE TABLE chat_message (
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  thread_id text NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  role text NOT NULL CHECK (role IN ('user','assistant')), content text NOT NULL,
  tool_calls jsonb, mode text CHECK (mode IN ('live','offline')), created_at timestamptz NOT NULL
);

CREATE TABLE audit_event (           -- append-only; feeds History and compliance
  id text PRIMARY KEY, seq bigint GENERATED ALWAYS AS IDENTITY,
  actor_id text NOT NULL REFERENCES app_user(id) DEFERRABLE INITIALLY DEFERRED, action text NOT NULL,
  entity_type text NOT NULL, entity_id text NOT NULL, deal_id text REFERENCES deal(id) DEFERRABLE INITIALLY DEFERRED,
  field text, before text, after text, at timestamptz NOT NULL DEFAULT now(), summary text NOT NULL
);
CREATE INDEX audit_event_deal_at ON audit_event (deal_id, at DESC);

-- Audit rows are never edited or removed by the app. (Reset demo data
-- truncates every table, which this trigger does not fire on.)
CREATE FUNCTION forbid_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END $$;
CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();

CREATE TABLE settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coverage_cushion_guideline_pct numeric(5,2) NOT NULL DEFAULT 25, today date NOT NULL
);
