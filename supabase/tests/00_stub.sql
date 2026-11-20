-- Minimal stand-ins for what Supabase provides (roles + auth schema) so the migration runs on plain PostgreSQL.
create role anon nologin;

create role authenticated nologin;

create role service_role nologin bypassrls;

create schema auth;

create table auth.users (id uuid primary key);

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
