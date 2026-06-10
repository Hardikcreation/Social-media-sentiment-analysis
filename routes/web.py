"""
Web routes for rendering HTML pages
"""
import json
import smtplib
from collections import Counter
from email.message import EmailMessage

from flask import current_app, jsonify, redirect, render_template, request, session, url_for
from routes import web_bp

from extensions import db
from models import Contact, Tweet
from services.dashboard_service import FACEBOOK_PAGE_OPTIONS, build_facebook_dashboard_payload
from utils import get_global_stats, get_keyword_insights, get_platform_stats, get_sentiment_trend

DEFAULT_PAGE_ID = FACEBOOK_PAGE_OPTIONS[1]['id']


def _is_logged_in():
    return bool(session.get('logged_in'))


def _format_timestamp(value):
    if value is None:
        return ''
    return value.strftime('%Y-%m-%d %H:%M')

@web_bp.route('/home')
def home():
    """Render home dashboard page"""
    if not _is_logged_in():
        return redirect(url_for('auth.login'))

    username = session.get('username', 'Admin')
    stats = get_global_stats()
    platform_stats = get_platform_stats()
    keyword_insights = get_keyword_insights()
    trend_data = get_sentiment_trend()

    return render_template(
        'home.html',
        username=username,
        total_posts=stats['total_posts'],
        total_comments=stats['total_comments'],
        total_tweets=stats['total_tweets'],
        analyzed_posts=stats['analyzed_posts'],
        analyzed_posts_growth=stats['analyzed_posts_growth'],
        positive_pct=stats['positive_pct'],
        neutral_pct=stats['neutral_pct'],
        negative_pct=stats['negative_pct'],
        sentiment_score=stats['sentiment_score'],
        engagement_rate=stats['engagement_rate'],
        engagement_change=-0.8,
        brand_mentions=stats['brand_mentions'],
        mentions_growth=stats['mentions_growth'],
        platform_stats=platform_stats,
        keyword_insights=keyword_insights,
        trend_data=json.dumps(trend_data, default=str),
        platform_data=json.dumps({
            'facebook': [
                platform_stats['facebook']['positive_pct'],
                platform_stats['facebook']['neutral_pct'],
                platform_stats['facebook']['negative_pct']
            ],
            'twitter': [
                platform_stats['twitter']['positive_pct'],
                platform_stats['twitter']['neutral_pct'],
                platform_stats['twitter']['negative_pct']
            ]
        }),
        keyword_data=json.dumps({
            'labels': [kw['text'] for kw in keyword_insights['top_keywords']],
            'data': [kw['count'] for kw in keyword_insights['top_keywords']]
        }),
        drivers_data=json.dumps({
            'positive': {
                'labels': [d[0] for d in keyword_insights['positive_drivers']['top']],
                'data': [d[1] for d in keyword_insights['positive_drivers']['top']],
                'confidence': keyword_insights['positive_drivers']['confidence']
            },
            'negative': {
                'labels': [d[0] for d in keyword_insights['negative_drivers']['top']],
                'data': [d[1] for d in keyword_insights['negative_drivers']['top']],
                'confidence': keyword_insights['negative_drivers']['confidence']
            }
        })
    )

@web_bp.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    """Render Facebook dashboard page"""
    if not _is_logged_in():
        return redirect(url_for('auth.login'))

    page_id = request.form.get('page_id', DEFAULT_PAGE_ID)
    dashboard_data = build_facebook_dashboard_payload(page_id)

    return render_template(
        'dashboard.html',
        chart_data=[
            {
                'post_id': post['id'],
                'Positive': post['sentiment_counts']['Positive'],
                'Negative': post['sentiment_counts']['Negative'],
                'Neutral': post['sentiment_counts']['Neutral'],
            }
            for post in dashboard_data['posts']
        ],
        posts=dashboard_data['posts'],
        post_sentiment_data=dashboard_data['post_sentiment_data'],
        sentiment_time_data=dashboard_data['sentiment_time_data'],
        total_posts=dashboard_data['stats']['total_posts'],
        total_comments=dashboard_data['stats']['total_comments'],
        total_likes=dashboard_data['stats']['total_likes'],
        total_shares=dashboard_data['stats']['total_shares']
    )

@web_bp.route('/tweets', methods=['GET'])
def tweet_analysis():
    """Render tweets analysis page"""
    if not _is_logged_in():
        return redirect(url_for('auth.login'))

    search_query = request.args.get('search', '').strip()
    if search_query:
        tweets = Tweet.query.filter(
            (Tweet.hashtag.ilike(f'%{search_query}%')) |
            (Tweet.author_id.ilike(f'%{search_query}%')) |
            (Tweet.text.ilike(f'%{search_query}%'))
        ).order_by(Tweet.created_time.desc()).all()
    else:
        tweets = Tweet.query.order_by(Tweet.created_time.desc()).all()

    positive = sum(1 for tweet in tweets if tweet.sentiment == 'Positive')
    neutral = sum(1 for tweet in tweets if tweet.sentiment == 'Neutral')
    negative = sum(1 for tweet in tweets if tweet.sentiment == 'Negative')

    sentiment_data = {
        'positive': positive,
        'neutral': neutral,
        'negative': negative
    }

    hashtags = [tweet.hashtag for tweet in tweets if tweet.hashtag]
    hashtag_counter = Counter(hashtags)
    sorted_hashtags = sorted(hashtag_counter.items(), key=lambda x: x[1], reverse=True)
    hashtag_labels = [item[0] for item in sorted_hashtags]
    hashtag_counts = [item[1] for item in sorted_hashtags]

    serialized_tweets = [{
        'id': tweet.id,
        'author_id': tweet.author_id,
        'hashtag': tweet.hashtag,
        'text': tweet.text,
        'created_time': _format_timestamp(tweet.created_time),
        'likes': tweet.likes,
        'retweets': tweet.retweets,
        'replies': tweet.replies,
        'quotes': tweet.quotes,
        'sentiment': tweet.sentiment,
        'media_urls': tweet.media_urls
    } for tweet in tweets]

    return render_template(
        'tweets.html',
        tweets=tweets,
        sentiment_data=sentiment_data,
        hashtag_labels=hashtag_labels,
        hashtag_counts=hashtag_counts,
        serialized_tweets=serialized_tweets,
        time_labels=[],
        time_counts=[]
    )

@web_bp.route('/submit-contact', methods=['POST'])
def submit_contact():
    """Handle contact form submission"""
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    subject = request.form.get('subject', '').strip()
    message = request.form.get('message', '').strip()

    if not all([name, email, subject, message]):
        return jsonify({'success': False, 'error': 'All fields are required.'}), 400

    try:
        new_contact = Contact(name=name, email=email, subject=subject, message=message)
        db.session.add(new_contact)
        db.session.commit()

        try:
            mail_username = current_app.config.get('MAIL_USERNAME')
            mail_password = current_app.config.get('MAIL_PASSWORD')

            if mail_username and mail_password:
                msg = EmailMessage()
                msg['Subject'] = f'New Contact Form Submission: {subject}'
                msg['From'] = mail_username
                msg['To'] = mail_username
                msg.set_content(
                    f'New Contact Submission:\n\n'
                    f'Name: {name}\n'
                    f'Email: {email}\n'
                    f'Subject: {subject}\n'
                    f'Message:\n{message}\n'
                )

                with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                    smtp.login(mail_username, mail_password)
                    smtp.send_message(msg)
        except Exception:
            current_app.logger.exception('Failed to send contact notification email.')

        return jsonify({'success': True, 'message': 'Your message has been sent successfully!'})

    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception('Failed to store contact form submission.')
        return jsonify({'success': False, 'error': str(exc)}), 500
