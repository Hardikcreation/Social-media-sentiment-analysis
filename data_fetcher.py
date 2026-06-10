import os
import json
import requests
import hashlib
import asyncio
import aiohttp
from urllib.parse import urlparse
from mimetypes import guess_extension
from flask import Flask
from datetime import datetime
from models import db, Post, Comment
from dotenv import load_dotenv
from transformers import AutoModelForSequenceClassification, XLMRobertaTokenizer, pipeline

# Load environment variables
load_dotenv()

# Flask setup
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = os.getenv('SQLALCHEMY_TRACK_MODIFICATIONS') == 'True'

# Initialize DB
db.init_app(app)

# Fetch JSON from URL
async def fetch_url(session, url):
    try:
        async with session.get(url) as response:
            return await response.json()
    except Exception as e:
        print(f"Error fetching URL {url}: {e}")
        return {}

# Main async function to fetch and store posts and comments
async def fetch_and_store_data(page_id, access_token):
    async with aiohttp.ClientSession() as session:
        # Facebook API endpoints
        def get_posts_url():
            return f"https://graph.facebook.com/v20.0/{page_id}/posts?limit=20&fields=message,created_time,attachments{{media}},likes.summary(true),shares&access_token={access_token}"

        def get_comments_url(post_id):
            return f"https://graph.facebook.com/v20.0/{post_id}/comments?limit=30&access_token={access_token}"

        # Load sentiment model
        model_name = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
        tokenizer = XLMRobertaTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        sentiment_pipeline = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer)

        # Sentiment analysis helper
        def analyze_sentiment(text):
            if not text:
                return 'Neutral'
            try:
                result = sentiment_pipeline(text[:512])[0]
                label = result['label'].lower()
                if 'positive' in label:
                    return 'Positive'
                elif 'negative' in label:
                    return 'Negative'
                return 'Neutral'
            except Exception as e:
                print(f"Sentiment analysis error: {e}")
                return 'Neutral'

        # Convert datetime from Facebook format
        def convert_datetime(dt_str):
            try:
                dt = datetime.strptime(dt_str, '%Y-%m-%dT%H:%M:%S%z')
                return dt.replace(tzinfo=None)
            except Exception as e:
                print(f"Datetime conversion error: {e}")
                return datetime.utcnow()

        # Generate unique comment ID
        def generate_synthetic_id(post_id, created_time, message):
            data = f"{post_id}_{created_time}_{message}"
            return hashlib.md5(data.encode()).hexdigest()

        # Save remote image locally and return web path
        def save_image_locally(remote_url: str, post_id: str) -> str:
            if not remote_url:
                return ""
            try:
                uploads_dir = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
                os.makedirs(uploads_dir, exist_ok=True)

                # derive extension from content-type or URL
                resp = requests.get(remote_url, timeout=10, stream=True)
                resp.raise_for_status()
                content_type = resp.headers.get('Content-Type', '')
                ext = ''
                if content_type:
                    ext_guess = guess_extension(content_type.split(';')[0].strip()) or ''
                    # common fix: mimetypes may return .jpe for image/jpeg
                    if ext_guess in ('.jpe', '.jpeg', '.jpg'):
                        ext = '.jpg'
                    elif ext_guess in ('.png', '.webp', '.gif'):
                        ext = ext_guess
                if not ext:
                    path = urlparse(remote_url).path
                    for candidate in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
                        if path.lower().endswith(candidate):
                            ext = '.jpg' if candidate == '.jpeg' else candidate
                            break
                if not ext:
                    ext = '.jpg'

                filename = f"{post_id}{ext}"
                file_path = os.path.join(uploads_dir, filename)
                with open(file_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)

                # Return a web path that Flask can serve via static
                return f"/static/uploads/{filename}"
            except Exception as e:
                print(f"Image save error for {remote_url}: {e}")
                return ""

        # Fetch posts
        posts_url = get_posts_url()
        print(f"Fetching posts from: {posts_url}")
        posts_response = await fetch_url(session, posts_url)
        posts = posts_response.get('data', [])

        if not posts:
            print("No posts found.")
            return

        comment_tasks = []

        for post in posts:
            post_id = post.get('id')
            message = post.get('message', "")
            created_time = convert_datetime(post.get('created_time'))
            image_url = ""
            likes = post.get('likes', {}).get('summary', {}).get('total_count', 0)
            shares = post.get('shares', {}).get('count', 0)

            # Get image if available
            attachments = post.get('attachments', {}).get('data', [])
            if attachments and 'media' in attachments[0]:
                remote_image_url = attachments[0]['media'].get('image', {}).get('src', "")
                image_url = save_image_locally(remote_image_url, post_id)

            sentiment = analyze_sentiment(message)

            print(f"Post ID: {post_id} | Sentiment: {sentiment}")

            # Insert Post if not exists
            if not db.session.get(Post, post_id):
                db.session.add(Post(
                    id=post_id,
                    page_id=page_id,
                    message=message,
                    created_time=created_time,
                    image_url=image_url,
                    likes=likes,
                    shares=shares,
                    sentiment=sentiment
                ))

            # Prepare comment fetch tasks
            comment_url = get_comments_url(post_id)
            comment_tasks.append(fetch_url(session, comment_url))

        # Fetch all comments
        comment_responses = await asyncio.gather(*comment_tasks)

        # Process and insert comments
        for post, comment_data in zip(posts, comment_responses):
            post_id = post['id']
            comments = comment_data.get('data', [])

            for comment in comments:
                message = comment.get('message')
                created_time = convert_datetime(comment.get('created_time'))

                if not message:
                    continue

                sentiment = analyze_sentiment(message)
                comment_id = generate_synthetic_id(post_id, str(created_time), message)

                if not db.session.get(Comment, comment_id):
                    db.session.add(Comment(
                        id=comment_id,
                        post_id=post_id,
                        message=message,
                        created_time=created_time,
                        sentiment=sentiment
                    ))

        # Commit all changes
        try:
            db.session.commit()
            print("Data fetched and stored successfully.")
        except Exception as e:
            db.session.rollback()
            print(f"Database commit error: {e}")

# Run the script
with app.app_context():
    db.create_all()
    page_id = os.getenv('FACEBOOK_PAGE_ID')
    access_token = os.getenv('FACEBOOK_ACCESS_TOKEN')
    asyncio.run(fetch_and_store_data(page_id, access_token))
