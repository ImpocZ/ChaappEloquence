CREATE TYPE auth_provider AS ENUM (
    'github',
    'google',
    'discord'
);

CREATE TABLE auth_accounts (
    auth_account_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    provider auth_provider NOT NULL,
    provider_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (provider, provider_user_id)
);

-- Transfer existing GitHub identities, if any.
INSERT INTO auth_accounts (user_id, provider, provider_user_id)
SELECT user_id, 'github', github_id::text
FROM users;

-- External identities now live in auth_accounts.
ALTER TABLE users DROP COLUMN github_id;

CREATE INDEX auth_accounts_user_id_idx
ON auth_accounts (user_id);