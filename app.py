from flask import Flask, render_template, request, jsonify, redirect, session, url_for, flash
from flask_migrate import Migrate
from dotenv import load_dotenv
from sqlalchemy import func, case, extract, and_
from collections import defaultdict, Counter
from datetime import datetime, timedelta
from extensions import db
from models import Post, Comment, Tweet, Contact
import json
import math
from extensions import db, login_manager, migrate
import smtplib
from email.message import EmailMessage
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash
import os

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = os.getenv('SQLALCHEMY_TRACK_MODIFICATIONS') == 'True'


# Init extensions
db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = 'login'
migrate = Migrate(app, db)



# Setup user loader
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Ensure database is created before handling requests
with app.app_context():
    db.create_all()



# ----------------------DATA ANALYSIS FUNCTIONS---------------------- #
def calculate_engagement(post):
    """Calculate engagement score for a post"""
    if not post.likes:
        return 0
    return (post.likes + (post.shares * 2)) / 100  # Simplified engagement formula

def get_sentiment_trend(days=30):
    """Generate sentiment trend data for the last N days"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Facebook data from comments
    fb_data = db.session.query(
        func.date(Comment.created_time).label('date'),
        func.sum(case((Comment.sentiment == 'Positive', 1), else_=0)).label('positive'),
        func.sum(case((Comment.sentiment == 'Neutral', 1), else_=0)).label('neutral'),
        func.sum(case((Comment.sentiment == 'Negative', 1), else_=0)).label('negative')
    ).filter(
        Comment.created_time.between(start_date, end_date)
    ).group_by(func.date(Comment.created_time)).all()
    
    # Twitter data from tweets
    tw_data = db.session.query(
        func.date(Tweet.created_time).label('date'),
        func.sum(case((Tweet.sentiment == 'Positive', 1), else_=0)).label('positive'),
        func.sum(case((Tweet.sentiment == 'Neutral', 1), else_=0)).label('neutral'),
        func.sum(case((Tweet.sentiment == 'Negative', 1), else_=0)).label('negative')
    ).filter(
        Tweet.created_time.between(start_date, end_date)
    ).group_by(func.date(Tweet.created_time)).all()
    
    # Combine data
    trend_data = defaultdict(lambda: {'positive': 0, 'neutral': 0, 'negative': 0})
    
    for entry in fb_data + tw_data:
        date_str = entry.date.strftime('%Y-%m-%d')
        trend_data[date_str]['positive'] += entry.positive
        trend_data[date_str]['neutral'] += entry.neutral
        trend_data[date_str]['negative'] += entry.negative
    
    # Convert to list sorted by date
    sorted_dates = sorted(trend_data.keys())
    return {
        'labels': sorted_dates,
        'datasets': [
            {
                'label': 'Positive',
                'data': [trend_data[date]['positive'] for date in sorted_dates],
                'borderColor': '#4cc9f0',
                'backgroundColor': 'rgba(76, 201, 240, 0.1)'
            },
            {
                'label': 'Neutral',
                'data': [trend_data[date]['neutral'] for date in sorted_dates],
                'borderColor': '#adb5bd',
                'backgroundColor': 'rgba(173, 181, 189, 0.1)'
            },
            {
                'label': 'Negative',
                'data': [trend_data[date]['negative'] for date in sorted_dates],
                'borderColor': '#f72585',
                'backgroundColor': 'rgba(247, 37, 133, 0.1)'
            }
        ]
    }

def get_platform_stats():
    """Get statistics for each social platform"""
    # Facebook stats from posts and comments
    fb_posts = Post.query.count()
    fb_comments = Comment.query.count()
    
    fb_sentiment = db.session.query(
        func.sum(case((Comment.sentiment == 'Positive', 1), else_=0)).label('positive'),
        func.sum(case((Comment.sentiment == 'Neutral', 1), else_=0)).label('neutral'),
        func.sum(case((Comment.sentiment == 'Negative', 1), else_=0)).label('negative')
    ).one()
    
    # Convert Decimal to float
    fb_positive = float(fb_sentiment.positive) if fb_sentiment.positive else 0.0
    fb_neutral = float(fb_sentiment.neutral) if fb_sentiment.neutral else 0.0
    fb_negative = float(fb_sentiment.negative) if fb_sentiment.negative else 0.0
    
    # Twitter stats
    tw_tweets = Tweet.query.count()
    tw_sentiment = db.session.query(
        func.sum(case((Tweet.sentiment == 'Positive', 1), else_=0)).label('positive'),
        func.sum(case((Tweet.sentiment == 'Neutral', 1), else_=0)).label('neutral'),
        func.sum(case((Tweet.sentiment == 'Negative', 1), else_=0)).label('negative')
    ).one()
    
    # Convert Decimal to float
    tw_positive = float(tw_sentiment.positive) if tw_sentiment.positive else 0.0
    tw_neutral = float(tw_sentiment.neutral) if tw_sentiment.neutral else 0.0
    tw_negative = float(tw_sentiment.negative) if tw_sentiment.negative else 0.0
    
    return {
        'facebook': {
            'posts': fb_posts,
            'comments': fb_comments,
            'positive': fb_positive,
            'neutral': fb_neutral,
            'negative': fb_negative,
            'positive_pct': round(fb_positive / fb_comments * 100) if fb_comments else 0,
            'neutral_pct': round(fb_neutral / fb_comments * 100) if fb_comments else 0,
            'negative_pct': round(fb_negative / fb_comments * 100) if fb_comments else 0
        },
        'twitter': {
            'tweets': tw_tweets,
            'positive': tw_positive,
            'neutral': tw_neutral,
            'negative': tw_negative,
            'positive_pct': round(tw_positive / tw_tweets * 100) if tw_tweets else 0,
            'neutral_pct': round(tw_neutral / tw_tweets * 100) if tw_tweets else 0,
            'negative_pct': round(tw_negative / tw_tweets * 100) if tw_tweets else 0
        }
    }

def get_keyword_insights():
    """Extract top keywords and sentiment drivers from actual data"""
    # Get most common hashtags from Twitter
    hashtags = [tweet.hashtag for tweet in Tweet.query.filter(
        Tweet.hashtag.isnot(None),
        Tweet.hashtag != ''
    ).all()]
    top_hashtags = Counter(hashtags).most_common(4)
    
    # Analyze comment messages for sentiment drivers
    positive_comments = Comment.query.filter_by(sentiment='Positive').limit(500).all()
    negative_comments = Comment.query.filter_by(sentiment='Negative').limit(500).all()
    
    # Simple keyword extraction (would use NLP in production)
    positive_keywords = Counter()
    negative_keywords = Counter()
    
    for comment in positive_comments:
        if comment.message:
            if 'service' in comment.message.lower():
                positive_keywords['Customer Service'] += 1
            if 'quality' in comment.message.lower():
                positive_keywords['Product Quality'] += 1
            if 'easy' in comment.message.lower() or 'simple' in comment.message.lower():
                positive_keywords['Ease of Use'] += 1
    
    for comment in negative_comments:
        if comment.message:
            if 'time' in comment.message.lower() or 'wait' in comment.message.lower():
                negative_keywords['Response Time'] += 1
            if 'price' in comment.message.lower() or 'cost' in comment.message.lower():
                negative_keywords['Pricing'] += 1
            if 'broken' in comment.message.lower() or 'issue' in comment.message.lower():
                negative_keywords['Product Issues'] += 1
    
    # Calculate confidence scores based on occurrence
    pos_confidence = min(90 + math.floor(len(positive_comments)/10), 98)
    neg_confidence = min(85 + math.floor(len(negative_comments)/10), 95)
    
    return {
        'top_keywords': [{'text': tag[0], 'count': tag[1]} for tag in top_hashtags],
        'positive_drivers': {
            'top': positive_keywords.most_common(2),
            'confidence': pos_confidence
        },
        'negative_drivers': {
            'top': negative_keywords.most_common(2),
            'confidence': neg_confidence
        },
        'emerging_trends': {
            'trend': "Sustainability",
            'growth': 34  # Placeholder - would calculate from trend analysis
        }
    }






# ----------------------ROUTING FUNCTIONS---------------------- #
@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        LOGIN_MAIL = os.getenv('LOGIN_MAIL')
        LOGIN_PASSWORD = os.getenv('LOGIN_PASSWORD')

        if username == LOGIN_MAIL and password == LOGIN_PASSWORD:
            session['logged_in'] = 'admin'
            session['username'] = username  # store username in session
            return redirect(url_for('home'))

        flash('Invalid username or password. Please try again.')
        return redirect(url_for('login'))
    return render_template('login.html')



@app.route('/logout')
def logout():
    session.pop('logged_in', None)  # Clear login session
    flash('You have been logged out successfully.')
    return redirect(url_for('login'))



@app.route('/home')
def home():
    username = session.get('username', 'Admin')  # fallback to 'Admin' if not found

    # Calculate global statistics
    total_posts = Post.query.count()
    total_comments = Comment.query.count()
    total_tweets = Tweet.query.count()
    total_analyzed = total_posts + total_comments + total_tweets
    
    # Get sentiment counts from both platforms
    fb_sentiment = db.session.query(
        func.sum(case((Comment.sentiment == 'Positive', 1), else_=0)).label('positive'),
        func.sum(case((Comment.sentiment == 'Neutral', 1), else_=0)).label('neutral'),
        func.sum(case((Comment.sentiment == 'Negative', 1), else_=0)).label('negative')
    ).one()
    
    tw_sentiment = db.session.query(
        func.sum(case((Tweet.sentiment == 'Positive', 1), else_=0)).label('positive'),
        func.sum(case((Tweet.sentiment == 'Neutral', 1), else_=0)).label('neutral'),
        func.sum(case((Tweet.sentiment == 'Negative', 1), else_=0)).label('negative')
    ).one()
    
    # Convert Decimal to float and handle None values
    fb_positive = float(fb_sentiment.positive) if fb_sentiment.positive else 0.0
    fb_neutral = float(fb_sentiment.neutral) if fb_sentiment.neutral else 0.0
    fb_negative = float(fb_sentiment.negative) if fb_sentiment.negative else 0.0
    
    tw_positive = float(tw_sentiment.positive) if tw_sentiment.positive else 0.0
    tw_neutral = float(tw_sentiment.neutral) if tw_sentiment.neutral else 0.0
    tw_negative = float(tw_sentiment.negative) if tw_sentiment.negative else 0.0
    
    # Combine sentiment data
    total_positive = fb_positive + tw_positive
    total_neutral = fb_neutral + tw_neutral
    total_negative = fb_negative + tw_negative
    total_sentiments = total_positive + total_neutral + total_negative
    
    # Calculate percentages
    positive_pct = round(total_positive / total_sentiments * 100) if total_sentiments else 0
    neutral_pct = round(total_neutral / total_sentiments * 100) if total_sentiments else 0
    negative_pct = round(total_negative / total_sentiments * 100) if total_sentiments else 0
    
    # Calculate sentiment score (0-10 scale)
    sentiment_score = round((total_positive + total_neutral * 0.5) / total_sentiments * 10, 1) if total_sentiments else 0
    
    # Calculate growth rates
    last_month = datetime.now() - timedelta(days=30)
    last_month_count = db.session.query(
        func.count(Comment.id)
    ).filter(Comment.created_time >= last_month).scalar() + \
    db.session.query(
        func.count(Tweet.id)
    ).filter(Tweet.created_time >= last_month).scalar()
    
    growth_rate = round((total_analyzed - last_month_count) / last_month_count * 100, 1) if last_month_count else 0
    
    # Calculate engagement metrics
    total_fb_engagement = float(db.session.query(
        func.sum(Post.likes + (Post.shares * 2))
    ).scalar() or 0)
    
    total_tw_engagement = float(db.session.query(
        func.sum(Tweet.likes + (Tweet.retweets * 2) + (Tweet.replies * 1.5))
    ).scalar() or 0)
    
    total_engagement = total_fb_engagement + total_tw_engagement
    avg_engagement = round(total_engagement / (total_posts + total_tweets) / 100, 1) if (total_posts + total_tweets) else 0
    
    # Get platform statistics
    platform_stats = get_platform_stats()
    
    # Get keyword insights
    keyword_insights = get_keyword_insights()
    
    # Get trend data for charts
    trend_data = get_sentiment_trend()
    
    return render_template(
        'home.html',
        username=username,
        # Global stats
        total_posts=total_posts,
        total_comments=total_comments,
        total_tweets=total_tweets,
        analyzed_posts=total_analyzed,
        analyzed_posts_growth=growth_rate,
        
        # Sentiment overview
        positive_pct=positive_pct,
        neutral_pct=neutral_pct,
        negative_pct=negative_pct,
        sentiment_score=sentiment_score,
        
        # Engagement stats
        engagement_rate=avg_engagement,
        engagement_change=-0.8,  # Would calculate from historical data
        brand_mentions=total_analyzed,  # Using total posts as proxy
        mentions_growth=growth_rate,
        
        # Platform data
        platform_stats=platform_stats,
        
        # Keyword insights
        keyword_insights=keyword_insights,
        
        # Chart data (as JSON)
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



@app.route('/submit-contact', methods=['POST'])
def submit_contact():
    try:
        name = request.form.get('name')
        email = request.form.get('email')
        subject = request.form.get('subject')
        message = request.form.get('message')

        new_contact = Contact(name=name, email=email, subject=subject, message=message)
        db.session.add(new_contact)
        db.session.commit()

        msg = EmailMessage()
        msg['Subject'] = f"New Contact Form Submission: {subject}"
        msg['From'] = os.getenv('MAIL_USERNAME')
        msg['To'] = os.getenv('MAIL_USERNAME')

        msg.set_content(f"""
        New Contact Submission:

        Name: {name}
        Email: {email}
        Subject: {subject}
        Message:
        {message}
        """)

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(os.getenv('MAIL_USERNAME'), os.getenv('MAIL_PASSWORD'))
            smtp.send_message(msg)

        # Return success response for AJAX
        
        return jsonify({'success': True, 'message': 'Your message has been sent successfully!'})

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    page_id = request.form.get('page_id', '1052601808104708')

    posts = Post.query.filter_by(page_id=page_id).order_by(Post.created_time.desc()).all()
    total_posts = len(posts)

    post_sentiment_data = defaultdict(
        lambda: {'Positive': 0, 'Negative': 0, 'Neutral': 0, 'Comments': [], 'Image URL': None, 'Likes': 0, 'Shares': 0})
    sentiment_time_data = defaultdict(list)
    total_comments = 0
    total_likes = 0
    total_shares = 0

    for post in posts:
        post_id = post.id
        image_url = post.image_url
        likes = post.likes
        shares = post.shares

        total_likes += likes
        total_shares += shares

        comments = Comment.query.filter_by(post_id=post_id).all()
        total_comments += len(comments)

        for comment in comments:
            sentiment = comment.sentiment
            post_sentiment_data[post_id][sentiment] += 1
            post_sentiment_data[post_id]['Comments'].append({
                'Comment Message': comment.message,
                'Sentiment': sentiment,
                'Created Time': comment.created_time
            })

        post_sentiment_data[post_id]['Image URL'] = image_url
        post_sentiment_data[post_id]['Likes'] = likes
        post_sentiment_data[post_id]['Shares'] = shares

        time_data = Comment.query.with_entities(
            func.date(Comment.created_time).label('created_time'),
            func.sum(case((Comment.sentiment == 'Positive', 1), else_=0)).label('Positive'),
            func.sum(case((Comment.sentiment == 'Negative', 1), else_=0)).label('Negative'),
            func.sum(case((Comment.sentiment == 'Neutral', 1), else_=0)).label('Neutral')
        ).filter_by(post_id=post_id).group_by(func.date(Comment.created_time)).all()

        for entry in time_data:
            sentiment_time_data[post_id].append({
                'created_time': entry.created_time,
                'Positive': entry.Positive,
                'Negative': entry.Negative,
                'Neutral': entry.Neutral
            })

    chart_data = [{'post_id': post_id, 'Positive': data['Positive'], 'Negative': data['Negative'], 'Neutral': data['Neutral']}
                    for post_id, data in post_sentiment_data.items()]

    return render_template(
        'dashboard.html',
        chart_data=chart_data,
        posts=posts,
        post_sentiment_data=post_sentiment_data,
        sentiment_time_data=sentiment_time_data,
        total_posts=total_posts,
        total_comments=total_comments,
        total_likes=total_likes,
        total_shares=total_shares
    )

@app.route('/tweets', methods=['GET'])
def tweet_analysis():
    search_query = request.args.get('search', '').strip()
    if search_query:
        tweets = Tweet.query.filter(
            (Tweet.hashtag.ilike(f'%{search_query}%')) |
            (Tweet.author_id.ilike(f'%{search_query}%'))
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
        'created_time': tweet.created_time.strftime('%Y-%m-%d %H:%M'),
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
        time_labels=[],  # Optional placeholder
        time_counts=[]
    )

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
