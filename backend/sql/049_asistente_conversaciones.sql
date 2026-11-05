-- Memoria del asistente de IA (SF-19, UF-16): conversaciones privadas de cada usuario
-- sobre una entidad (por ahora, un hallazgo). El usuario puede borrarlas desde el panel.
-- La bitácora no guarda el texto; solo esta tabla, y solo para su autor.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.

CREATE TABLE IF NOT EXISTS ai_conversations (
    id          INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_ai_conversations PRIMARY KEY,
    user_id     INT            NOT NULL CONSTRAINT fk_ai_conversations_user REFERENCES users (id),
    entity_type VARCHAR(30)    NOT NULL CONSTRAINT ck_ai_conversations_entity_type CHECK (entity_type IN ('hallazgo')),
    entity_id   VARCHAR(100)   NOT NULL,
    created_at  TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT uq_ai_conversations_entity UNIQUE (user_id, entity_type, entity_id)
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ai_messages (
    id              INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_ai_messages PRIMARY KEY,
    conversation_id INT            NOT NULL CONSTRAINT fk_ai_messages_conversation
                                   REFERENCES ai_conversations (id) ON DELETE CASCADE,
    role            VARCHAR(10)    NOT NULL CONSTRAINT ck_ai_messages_role CHECK (role IN ('usuario', 'asistente')),
    content         TEXT           NOT NULL,
    estado          VARCHAR(20)    NULL
                                   CONSTRAINT ck_ai_messages_estado
                                   CHECK (estado IN ('respondida', 'fuera_de_tema', 'sin_informacion')),
    created_at      TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_ai_messages_conversation ON ai_messages (conversation_id, id);
