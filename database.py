import os

from datetime import datetime

from sqlalchemy import (
    create_engine,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker
from pgvector.sqlalchemy import Vector


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/chatbot")
EMBEDDING_DIMENSION = 384

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

Base = declarative_base()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer)
    role = Column(String)
    content = Column(Text)
    sources = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Memory(Base):
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, index=True)
    value = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    connected = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False, index=True)
    filename = Column(String, nullable=False, index=True)
    file_type = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    current_version_id = Column(Integer, nullable=True)
    status = Column(String, default="processing", index=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number = Column(Integer, nullable=False)
    content_hash = Column(String, nullable=False, index=True)
    status = Column(String, default="queued", index=True)
    total_units = Column(Integer, default=0)
    processed_units = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_id = Column(
        Integer,
        ForeignKey("document_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String, default="queued", index=True)
    current_unit = Column(Integer, default=0)
    total_units = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_id = Column(
        Integer,
        ForeignKey("document_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    unit_index = Column(Integer, nullable=False, index=True)
    unit_hash = Column(String, nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content_hash = Column(String, nullable=False, index=True)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    embedding = Column(Vector(EMBEDDING_DIMENSION), nullable=False)


# PGVector must exist in PostgreSQL before the Vector column can be used.
with engine.begin() as connection:
    connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

# Migrate existing databases so Source can persist connect/disconnect state.
with engine.begin() as connection:
    connection.execute(
        text("ALTER TABLE sources ADD COLUMN IF NOT EXISTS connected BOOLEAN NOT NULL DEFAULT FALSE")
    )

Base.metadata.create_all(bind=engine)

# Keep existing databases compatible with the old chatbot.
with engine.begin() as connection:
    connection.execute(
        text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sources TEXT")
    )

# Rename the original demo document metadata for existing local databases.
with engine.begin() as connection:
    connection.execute(
        text(
            "UPDATE documents "
            "SET filename = 'v1_Northstar_Medical_Systems_Knowledge_Base.pdf', "
            "file_path = REPLACE(file_path, "
            "'v1_Edwards_Lifesciences_Knowledge_Base.pdf', "
            "'v1_Northstar_Medical_Systems_Knowledge_Base.pdf') "
            "WHERE filename = 'v1_Edwards_Lifesciences_Knowledge_Base.pdf'"
        )
    )


def seed_default_sources():
    db = SessionLocal()

    defaults = [
        (
            "Northstar Documents",
            "northstar-documents",
            "Company documents, product material, annual reports and internal knowledge.",
        ),
        (
            "Clinical Research",
            "clinical-research",
            "Clinical studies, trials, publications and research material.",
        ),
        (
            "Regulatory Data",
            "regulatory-data",
            "Regulatory documents, device updates and approval-related material.",
        ),
    ]

    try:
        # Rename the original demo source for databases created before the
        # Northstar branding update.
        legacy_source = db.query(Source).filter(Source.slug == "edwards-documents").first()
        northstar_source = db.query(Source).filter(Source.slug == "northstar-documents").first()
        if legacy_source is not None and northstar_source is None:
            legacy_source.name = "Northstar Documents"
            legacy_source.slug = "northstar-documents"

        for name, slug, description in defaults:
            existing = db.query(Source).filter(Source.slug == slug).first()

            if existing is None:
                db.add(
                    Source(
                        name=name,
                        slug=slug,
                        description=description,
                        connected=False,
                    )
                )

        db.commit()
    finally:
        db.close()


seed_default_sources()
