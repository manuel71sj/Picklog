create table if not exists items (
  id text primary key,
  local_id text not null unique,
  remote_id text,
  user_id text,
  device_id text not null,
  sync_state text not null default 'local_only',
  version integer not null default 1,
  status text not null check (status in ('active', 'archived', 'deleted', 'permanently_deleted')),
  source_type text not null,
  source_url text,
  title text not null default '',
  summary text,
  category text,
  use_case text,
  tags_json text not null default '[]',
  thumbnail_url text,
  image_asset_id text,
  metadata_json text not null default '{}',
  confidence real,
  field_confidence_json text not null default '{}',
  field_state_json text not null default '{}',
  extraction_id text,
  user_note text,
  created_at text not null,
  updated_at text not null,
  archived_at text,
  deleted_at text,
  tombstone_until text
);

create table if not exists extractions (
  id text primary key,
  item_id text references items(id) on delete set null,
  input_type text not null check (input_type in ('url')),
  input_snapshot_json text not null,
  model_provider text not null,
  model_name text not null,
  schema_version text not null,
  raw_output_json text,
  normalized_output_json text,
  confidence real,
  error text,
  created_at text not null,
  expires_at text
);

create table if not exists price_observations (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  seller text,
  price real,
  currency text,
  observed_at text not null,
  source text not null check (source in ('metadata', 'ai', 'user')),
  needs_review integer not null default 0
);

create table if not exists attachments (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  type text not null check (type in ('thumbnail', 'photo', 'remote_image')),
  storage_url text not null,
  mime_type text,
  width integer,
  height integer,
  created_at text not null
);

create table if not exists sync_queue (
  id text primary key,
  schema_version text not null default 'sync_event_v1',
  queue_mode text not null default 'alpha_audit',
  entity_type text not null,
  entity_local_id text not null,
  operation text not null,
  payload_json text not null,
  status text not null default 'done',
  attempt_count integer not null default 0,
  last_error text,
  created_at text not null,
  updated_at text not null
);

create table if not exists usage_events (
  id text primary key,
  event_type text not null,
  item_local_id text,
  extraction_id text,
  occurred_at text not null,
  metadata_json text not null default '{}'
);

create index if not exists idx_items_status_created on items(status, created_at desc);
create index if not exists idx_items_source_type on items(source_type);
create index if not exists idx_items_category on items(category);
create index if not exists idx_sync_queue_entity on sync_queue(entity_type, entity_local_id);
