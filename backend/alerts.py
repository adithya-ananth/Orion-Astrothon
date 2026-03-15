import aiosqlite
import asyncio
import logging

logger = logging.getLogger("Alerts")

DB_FILE = "emails.db"

async def init_db():
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL
            )
        ''')
        await db.commit()

async def add_subscriber(email: str):
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            await db.execute('INSERT INTO subscribers (email) VALUES (?)', (email,))
            await db.commit()
            return True
    except aiosqlite.IntegrityError:
        return False # already exists
    except Exception as e:
        logger.error(f"Error adding subscriber: {e}")
        return False

async def get_all_subscribers():
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute('SELECT email FROM subscribers') as cursor:
            rows = await cursor.fetchall()
            return [row[0] for row in rows]

async def trigger_email_alert(subject: str, message: str):
    subscribers = await get_all_subscribers()
    if not subscribers:
        logger.info("No subscribers to email.")
        return

    logger.info(f"--- FAKE EMAIL DISPATCH ---")
    logger.info(f"To: {len(subscribers)} subscribers")
    logger.info(f"Subject: {subject}")
    logger.info(f"Message: {message}")
    logger.info(f"---------------------------")
