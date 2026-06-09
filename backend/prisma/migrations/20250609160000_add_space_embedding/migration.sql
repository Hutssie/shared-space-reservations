-- Enable pgvector for semantic similarity search on space listings.
CREATE EXTENSION IF NOT EXISTS vector;

-- Add the 768-dim embedding column (matches gemini-embedding-001 @ outputDimensionality 768).
ALTER TABLE "Space" ADD COLUMN "embedding" vector(768);

-- Approximate nearest-neighbour index using cosine distance for fast top-k retrieval.
CREATE INDEX "Space_embedding_hnsw_idx" ON "Space" USING hnsw ("embedding" vector_cosine_ops);
