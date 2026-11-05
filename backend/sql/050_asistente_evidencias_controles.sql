-- Memoria del asistente también para evidencias y para controles dentro de un plan (SF-19, UF-16).
--   * evidencia: entity_id = id de la evidencia (una conversación por usuario y archivo).
--   * control:   entity_id = '<id del plan>:<id del control>' (el mismo control en otro plan es otra conversación).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.

ALTER TABLE ai_conversations DROP CONSTRAINT IF EXISTS ck_ai_conversations_entity_type;
ALTER TABLE ai_conversations
    ADD CONSTRAINT ck_ai_conversations_entity_type CHECK (entity_type IN ('hallazgo', 'evidencia', 'control'));
