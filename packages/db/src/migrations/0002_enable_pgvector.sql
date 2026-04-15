-- Enable the pgvector extension. The pgvector/pgvector image already
-- ships the binary; this just registers it in the current database so
-- future schemas can use vector(N) columns and ANN indexes.
--
-- Refs: overnight 1b-001
CREATE EXTENSION IF NOT EXISTS vector;
