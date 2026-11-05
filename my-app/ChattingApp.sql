CREATE TYPE "room_type" AS ENUM (
  'general',
  'dm'
);

CREATE TABLE "users" (
  "user_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "github_id" bigint UNIQUE NOT NULL,
  "username" varchar(30),
  "avatar_url" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "memberships" (
  "user_id" bigint NOT NULL,
  "room_id" bigint NOT NULL,
  PRIMARY KEY ("user_id", "room_id")
);

CREATE TABLE "messages" (
  "message_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "user_id" bigint NOT NULL,
  "room_id" bigint NOT NULL,
  "content" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "message_attachments" (
  "m_attach_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "message_id" bigint UNIQUE NOT NULL,
  "giphy_id" text NOT NULL,
  "url" text NOT NULL
);

CREATE TABLE "rooms" (
  "room_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar(100),
  "type" room_type NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "memberships" ("room_id");

CREATE INDEX ON "messages" ("room_id", "created_at");

ALTER TABLE "memberships" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "memberships" ADD FOREIGN KEY ("room_id") REFERENCES "rooms" ("room_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "messages" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "messages" ADD FOREIGN KEY ("room_id") REFERENCES "rooms" ("room_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "message_attachments" ADD FOREIGN KEY ("message_id") REFERENCES "messages" ("message_id") DEFERRABLE INITIALLY IMMEDIATE;
CREATE UNIQUE INDEX users_username_case_insensitive
ON users (lower(username));
