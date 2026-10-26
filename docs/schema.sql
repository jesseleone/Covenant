-- Covenant: Postgres equivalent of lib/schema.ts (documentation; the
-- prototype stores the same records in the browser).
-- Rules: displayed numbers are computed from confirmed records; term sets are
-- copy-on-write and locked by IC approval; every write appends an audit_event.

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
  id text PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL,
  role user_role NOT NULL, title text NOT NULL, sso_id text
);

CREATE TABLE company (
  id text PRIMARY KEY, name text NOT NULL, aliases text[] NOT NULL DEFAULT '{}',
  domain text, types company_type[] NOT NULL CHECK (cardinality(types) > 0),
  sector text, hq_city text, hq_country text, description text,
  parent_id text REFERENCES company(id), owner_user_id text REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_name_trgm ON company USING gin (name gin_trgm_ops);

CREATE TABLE person (
  id text PRIMARY KEY, full_name text NOT NULL, email text, phone text,
  person_type person_type NOT NULL, relationship_owner_id text REFERENCES app_user(id), bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX person_email_uq ON person (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE affiliation (            -- role history
  id text PRIMARY KEY, person_id text NOT NULL REFERENCES person(id), company_id text NOT NULL REFERENCES company(id),
  title text NOT NULL, start_date date, end_date date, is_current boolean NOT NULL,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Deals ----------------------------------------------------------------------

CREATE TABLE deal (
  id text PRIMARY KEY, name text NOT NULL, codename text NOT NULL,
  borrower_company_id text NOT NULL REFERENCES company(id), sponsor_company_id text REFERENCES company(id),
  strategy strategy NOT NULL, deal_type deal_type NOT NULL, stage deal_stage NOT NULL, status deal_status NOT NULL,
  pass_reason pass_reason, pass_note text,
  requested_size numeric(12,2) NOT NULL, fund_hold_target numeric(12,2) NOT NULL,
  expected_close date, closed_at date, lead_user_id text NOT NULL REFERENCES app_user(id),
  risk_rating smallint, risk_rating_scale text,          -- ratings stored with their scale
  summary text, thesis text, sector text, sector_tags text[] NOT NULL DEFAULT '{}', tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), stage_entered_at timestamptz NOT NULL,
  CHECK (status NOT IN ('passed','lost') OR pass_reason IS NOT NULL),
  CHECK ((risk_rating IS NULL) = (risk_rating_scale IS NULL))
);

CREATE TABLE deal_team (deal_id text REFERENCES deal(id), user_id text REFERENCES app_user(id), PRIMARY KEY (deal_id, user_id));

CREATE TABLE stakeholder (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id),
  person_id text REFERENCES person(id), company_id text REFERENCES company(id),
  role text NOT NULL, side stakeholder_side NOT NULL,
  CHECK ((person_id IS NULL) <> (company_id IS NULL))
);

CREATE TABLE stage_event (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), from_stage deal_stage, to_stage deal_stage NOT NULL,
  user_id text NOT NULL REFERENCES app_user(id), at timestamptz NOT NULL, override_reason text
);

-- Documents and extraction ---------------------------------------------------

CREATE TABLE document (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), doc_type doc_type NOT NULL, title text NOT NULL,
  version int NOT NULL DEFAULT 1, source text NOT NULL, storage_uri text, content_hash text,
  extraction_status text NOT NULL DEFAULT 'none', uploaded_at timestamptz NOT NULL
);
CREATE TABLE document_page (document_id text REFERENCES document(id), n int, text text NOT NULL, PRIMARY KEY (document_id, n));

CREATE TABLE extracted_field (       -- AI proposes, a person confirms or corrects
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id),
  document_id text NOT NULL REFERENCES document(id), page int NOT NULL, quote text NOT NULL,
  field_key text NOT NULL, label text NOT NULL, value_num numeric, value_text text, unit field_unit NOT NULL, period text,
  confidence numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1), status field_status NOT NULL,
  corrected_from jsonb,                 -- {value, document_id, page}
  reviewed_by text REFERENCES app_user(id), reviewed_at timestamptz,
  UNIQUE (deal_id, field_key)
);

CREATE TABLE financial_period (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), company_id text NOT NULL REFERENCES company(id),
  label text NOT NULL, period_end date NOT NULL, period_type text NOT NULL, case_name period_case NOT NULL,
  revenue numeric(12,2) NOT NULL, adj_ebitda_field_key text, adj_ebitda numeric(12,2), capex numeric(12,2), interest numeric(12,2)
);

-- Terms (securities) ---------------------------------------------------------

CREATE TABLE term_set (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), version int NOT NULL,
  label term_set_label NOT NULL, status term_set_status NOT NULL, parent_id text REFERENCES term_set(id),
  created_by text NOT NULL REFERENCES app_user(id), created_at timestamptz NOT NULL, locked_by_ic_event_id text,
  UNIQUE (deal_id, version),
  CHECK (status <> 'locked' OR locked_by_ic_event_id IS NOT NULL)
);

CREATE TABLE tranche (
  id text PRIMARY KEY, term_set_id text NOT NULL REFERENCES term_set(id), key text NOT NULL, name text NOT NULL,
  instrument instrument NOT NULL, lien_rank lien_rank NOT NULL,
  commitment numeric(12,2) NOT NULL CHECK (commitment > 0),
  funded_at_close numeric(12,2) NOT NULL CHECK (funded_at_close BETWEEN 0 AND commitment),
  fund_hold numeric(12,2) NOT NULL CHECK (fund_hold BETWEEN 0 AND commitment),
  base_rate text NOT NULL DEFAULT 'SOFR', spread_bps int NOT NULL, floor_bps int NOT NULL, oid_pct numeric(5,2) NOT NULL,
  pik_bps int NOT NULL DEFAULT 0, call_protection text, maturity_date date NOT NULL, amort_pct_per_year numeric(5,2) NOT NULL,
  UNIQUE (term_set_id, key)
);

CREATE TABLE covenant (
  id text PRIMARY KEY, term_set_id text NOT NULL REFERENCES term_set(id), metric covenant_metric NOT NULL,
  operator text NOT NULL CHECK (operator IN ('max','min')), test_frequency text NOT NULL, notes text
);
CREATE TABLE covenant_level (covenant_id text REFERENCES covenant(id), from_date date, level numeric(6,2) NOT NULL, PRIMARY KEY (covenant_id, from_date));

-- Locked term sets are read-only.
CREATE FUNCTION forbid_locked_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM term_set WHERE id = COALESCE(NEW.term_set_id, OLD.term_set_id) AND status <> 'draft') THEN
    RAISE EXCEPTION 'term set is % and cannot be edited; create a new version', (SELECT status FROM term_set WHERE id = COALESCE(NEW.term_set_id, OLD.term_set_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER tranche_locked BEFORE INSERT OR UPDATE OR DELETE ON tranche FOR EACH ROW EXECUTE FUNCTION forbid_locked_terms();
CREATE TRIGGER covenant_locked BEFORE INSERT OR UPDATE OR DELETE ON covenant FOR EACH ROW EXECUTE FUNCTION forbid_locked_terms();

-- Diligence, memo, IC --------------------------------------------------------

CREATE TABLE ic_event (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), stage text NOT NULL CHECK (stage IN ('screening','final')),
  date timestamptz NOT NULL, memo_id text, term_set_id text REFERENCES term_set(id),
  status text NOT NULL CHECK (status IN ('pending','decided')), decision ic_decision,
  approved_hold numeric(12,2), decided_at timestamptz,
  CHECK ((status = 'decided') = (decision IS NOT NULL))
);
ALTER TABLE term_set ADD FOREIGN KEY (locked_by_ic_event_id) REFERENCES ic_event(id);

CREATE TABLE ic_vote (ic_event_id text REFERENCES ic_event(id), user_id text REFERENCES app_user(id), vote ic_vote_value NOT NULL, comment text, PRIMARY KEY (ic_event_id, user_id));
CREATE TABLE ic_question (id text PRIMARY KEY, ic_event_id text NOT NULL REFERENCES ic_event(id), question text NOT NULL, asked_by text NOT NULL REFERENCES app_user(id), answer text);

CREATE TABLE ic_condition (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), ic_event_id text REFERENCES ic_event(id),
  description text NOT NULL, type condition_type NOT NULL, owner_user_id text NOT NULL REFERENCES app_user(id),
  due_date date, status condition_status NOT NULL, source_dd_item_id text
);

CREATE TABLE dd_item (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), workstream workstream NOT NULL,
  kind text NOT NULL CHECK (kind IN ('request','finding')), title text NOT NULL, detail text,
  severity severity, status dd_status NOT NULL, mitigant text, memo_section_key text,
  ic_condition_id text REFERENCES ic_condition(id), owner_user_id text REFERENCES app_user(id), due_date date,
  CHECK (kind = 'request' OR severity IS NOT NULL)
);
ALTER TABLE ic_condition ADD FOREIGN KEY (source_dd_item_id) REFERENCES dd_item(id);

CREATE TABLE memo (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), memo_type memo_type NOT NULL, version int NOT NULL,
  status memo_status NOT NULL, term_set_id text NOT NULL REFERENCES term_set(id), created_at timestamptz NOT NULL,
  UNIQUE (deal_id, memo_type, version)
);
ALTER TABLE ic_event ADD FOREIGN KEY (memo_id) REFERENCES memo(id);

CREATE TABLE memo_section (
  id text PRIMARY KEY, memo_id text NOT NULL REFERENCES memo(id), key text NOT NULL, title text NOT NULL, ord int NOT NULL,
  content text NOT NULL,               -- Markdown with {{field:…}} / {{metric:…}} tokens and [[cite:…]] links; no typed figures
  dependencies text[] NOT NULL,        -- e.g. field:adj_ebitda_ltm, termset:active, dd:red_flags
  snapshot jsonb NOT NULL,             -- dependency values when written; stale when they differ
  generated_by text NOT NULL CHECK (generated_by IN ('ai','ai_offline','human')),
  reviewed_by text REFERENCES app_user(id), reviewed_at timestamptz, updated_at timestamptz NOT NULL,
  UNIQUE (memo_id, key)
);

CREATE TABLE devils_advocate (id text PRIMARY KEY, deal_id text NOT NULL REFERENCES deal(id), question text NOT NULL, rationale text, precedent_deal_ids text[] NOT NULL);

-- Notes, chat, audit ---------------------------------------------------------

CREATE TABLE note (
  id text PRIMARY KEY, subject_type entity_type NOT NULL, subject_id text NOT NULL,   -- polymorphic
  body text NOT NULL, note_type note_type NOT NULL, author_id text NOT NULL REFERENCES app_user(id),
  pinned boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL
);
CREATE TABLE note_mention (note_id text REFERENCES note(id), entity_type entity_type, entity_id text, PRIMARY KEY (note_id, entity_type, entity_id));

CREATE TABLE chat_thread (id text PRIMARY KEY, title text NOT NULL, owner_id text NOT NULL REFERENCES app_user(id), scope jsonb, created_at timestamptz NOT NULL);
CREATE TABLE chat_message (
  id text PRIMARY KEY, thread_id text NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')), content text NOT NULL,
  tool_calls jsonb, mode text CHECK (mode IN ('live','offline')), created_at timestamptz NOT NULL
);

CREATE TABLE audit_event (           -- append-only; feeds History and compliance
  id text PRIMARY KEY, actor_id text NOT NULL REFERENCES app_user(id), action text NOT NULL,
  entity_type text NOT NULL, entity_id text NOT NULL, deal_id text REFERENCES deal(id),
  field text, before text, after text, at timestamptz NOT NULL DEFAULT now(), summary text NOT NULL
);
CREATE INDEX audit_event_deal_at ON audit_event (deal_id, at DESC);
REVOKE UPDATE, DELETE ON audit_event FROM PUBLIC;

CREATE TABLE settings (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), coverage_cushion_guideline_pct numeric(5,2) NOT NULL DEFAULT 25);
