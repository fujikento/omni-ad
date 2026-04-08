-- Add encrypted API key columns for OpenAI, Runway, and ElevenLabs
ALTER TABLE "ai_settings" ADD COLUMN "openai_api_key_encrypted" text;
ALTER TABLE "ai_settings" ADD COLUMN "runway_api_key_encrypted" text;
ALTER TABLE "ai_settings" ADD COLUMN "elevenlabs_api_key_encrypted" text;
