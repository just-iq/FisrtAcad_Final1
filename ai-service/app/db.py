from contextlib import contextmanager

import psycopg2

from app.config import settings


@contextmanager
def get_conn():
    conn = psycopg2.connect(settings.db_url)
    try:
        yield conn
    finally:
        conn.close()

