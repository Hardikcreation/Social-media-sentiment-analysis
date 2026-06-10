"""
API endpoints for frontend data retrieval
"""
from datetime import datetime, timedelta

from flask import current_app, jsonify, request
from sqlalchemy import func

from routes import api_bp
from extensions import db
from models import Post, Comment, Tweet
from services.dashboard_service import FACEBOOK_PAGE_OPTIONS, build_facebook_dashboard_payload
from utils import (
    get_sentiment_trend,
    get_sentiment_data_for_period,
    get_platform_stats,
    get_keyword_insights,
    get_global_stats
)

DEFAULT_PAGE_ID = FACEBOOK_PAGE_OPTIONS[1]['id']
data_rotation_counter = 0


def _serialize_datetime(value):
    return value.isoformat() if value else ''

@api_bp.route('/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        stats = get_global_stats()
        platform_stats = get_platform_stats()
        keyword_insights = get_keyword_insights()
        trend_data = get_sentiment_trend()
        
        return jsonify({
            'success': True,
            'data': {
                'stats': stats,
                'platform_stats': platform_stats,
                'keyword_insights': keyword_insights,
                'trend_data': trend_data
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/facebook-dashboard', methods=['GET'])
def get_facebook_dashboard():
    """Get the full Facebook dashboard payload for React."""
    try:
        page_id = request.args.get('page_id')
        payload = build_facebook_dashboard_payload(page_id)
        return jsonify({'success': True, 'data': payload})
    except Exception as exc:
        current_app.logger.exception('Failed to build Facebook dashboard payload.')
        return jsonify({'success': False, 'error': str(exc)}), 500

@api_bp.route('/sentiment-data', methods=['GET'])
def get_sentiment_data():
    """Get sentiment data with rotating date periods"""
    global data_rotation_counter
    
    try:
        # Define different date periods to rotate through
        periods = [
            (datetime.now() - timedelta(days=1), datetime.now()),
            (datetime.now() - timedelta(days=3), datetime.now() - timedelta(days=2)),
            (datetime.now() - timedelta(days=5), datetime.now() - timedelta(days=4)),
            (datetime.now() - timedelta(days=7), datetime.now() - timedelta(days=6)),
            (datetime.now() - timedelta(days=9), datetime.now() - timedelta(days=8)),
            (datetime.now() - timedelta(days=11), datetime.now() - timedelta(days=10)),
        ]
        
        # Get current period based on rotation counter
        current_period = periods[data_rotation_counter % len(periods)]
        start_date, end_date = current_period
        
        # Get data for the specific period
        positive_count = Comment.query.filter(
            Comment.sentiment == 'Positive',
            Comment.created_time.between(start_date, end_date)
        ).count() + Tweet.query.filter(
            Tweet.sentiment == 'Positive',
            Tweet.created_time.between(start_date, end_date)
        ).count()
        
        neutral_count = Comment.query.filter(
            Comment.sentiment == 'Neutral',
            Comment.created_time.between(start_date, end_date)
        ).count() + Tweet.query.filter(
            Tweet.sentiment == 'Neutral',
            Tweet.created_time.between(start_date, end_date)
        ).count()
        
        negative_count = Comment.query.filter(
            Comment.sentiment == 'Negative',
            Comment.created_time.between(start_date, end_date)
        ).count() + Tweet.query.filter(
            Tweet.sentiment == 'Negative',
            Tweet.created_time.between(start_date, end_date)
        ).count()
        
        total_items = positive_count + neutral_count + negative_count
        
        if total_items > 0:
            positive_pct = round((positive_count / total_items) * 100, 1)
            neutral_pct = round((neutral_count / total_items) * 100, 1)
            negative_pct = round((negative_count / total_items) * 100, 1)
        else:
            positive_pct = neutral_pct = negative_pct = 0
        
        # Get trend data
        trend_data = get_sentiment_data_for_period(start_date, end_date)
        
        # Get analyzed posts
        analyzed_posts = Post.query.filter(
            Post.created_time.between(start_date, end_date)
        ).count() + Tweet.query.filter(
            Tweet.created_time.between(start_date, end_date)
        ).count()
        
        brand_mentions = Comment.query.filter(
            Comment.created_time.between(start_date, end_date)
        ).count() + Tweet.query.filter(
            Tweet.created_time.between(start_date, end_date)
        ).count()
        
        # Calculate engagement rate
        total_likes = db.session.query(func.sum(Post.likes)).filter(
            Post.created_time.between(start_date, end_date)
        ).scalar() or 0
        total_shares = db.session.query(func.sum(Post.shares)).filter(
            Post.created_time.between(start_date, end_date)
        ).scalar() or 0
        total_posts_period = Post.query.filter(
            Post.created_time.between(start_date, end_date)
        ).count()
        engagement_rate = round((total_likes + total_shares) / max(total_posts_period, 1) / 100, 1)
        
        # Calculate sentiment score
        if total_items > 0:
            sentiment_score = round(((positive_count * 2) + neutral_count) / total_items * 5, 1)
        else:
            sentiment_score = 5.0
        
        # Increment rotation counter
        data_rotation_counter += 1
        
        return jsonify({
            'success': True,
            'data': {
                'positive_pct': positive_pct,
                'neutral_pct': neutral_pct,
                'negative_pct': negative_pct,
                'trend_data': trend_data,
                'analyzed_posts': analyzed_posts,
                'brand_mentions': brand_mentions,
                'engagement_rate': engagement_rate,
                'sentiment_score': sentiment_score,
                'period_info': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d'),
                    'period_number': data_rotation_counter
                }
            }
        })
        
    except Exception as e:
        current_app.logger.exception('Failed to build sentiment data response.')
        return jsonify({'success': False, 'error': 'Failed to fetch sentiment data'}), 500

@api_bp.route('/posts', methods=['GET'])
def get_posts():
    """Get all posts with pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        page_id = request.args.get('page_id', DEFAULT_PAGE_ID)

        query = Post.query.filter_by(page_id=page_id).order_by(Post.created_time.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        posts_data = [{
            'id': post.id,
            'page_id': post.page_id,
            'message': post.message,
            'image_url': post.image_url,
            'likes': post.likes,
            'shares': post.shares,
            'created_time': _serialize_datetime(post.created_time)
        } for post in pagination.items]

        return jsonify({
            'success': True,
            'data': posts_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        })
    except Exception as exc:
        current_app.logger.exception('Failed to fetch posts.')
        return jsonify({'success': False, 'error': str(exc)}), 500

@api_bp.route('/posts/<post_id>/comments', methods=['GET'])
def get_post_comments(post_id):
    """Get comments for a specific post"""
    try:
        if not db.session.get(Post, post_id):
            return jsonify({'success': False, 'error': 'Post not found'}), 404

        comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.created_time.desc()).all()

        comments_data = [{
            'id': comment.id,
            'post_id': comment.post_id,
            'message': comment.message,
            'sentiment': comment.sentiment,
            'created_time': _serialize_datetime(comment.created_time)
        } for comment in comments]

        sentiment_counts = {
            'positive': sum(1 for c in comments if c.sentiment == 'Positive'),
            'neutral': sum(1 for c in comments if c.sentiment == 'Neutral'),
            'negative': sum(1 for c in comments if c.sentiment == 'Negative')
        }

        return jsonify({
            'success': True,
            'data': {
                'comments': comments_data,
                'sentiment_counts': sentiment_counts,
                'total': len(comments)
            }
        })
    except Exception as exc:
        current_app.logger.exception('Failed to fetch post comments.')
        return jsonify({'success': False, 'error': str(exc)}), 500

@api_bp.route('/tweets', methods=['GET'])
def get_tweets():
    """Get tweets with search and pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '').strip()
        
        query = Tweet.query
        
        if search:
            query = query.filter(
                (Tweet.hashtag.ilike(f'%{search}%')) |
                (Tweet.author_id.ilike(f'%{search}%')) |
                (Tweet.text.ilike(f'%{search}%'))
            )
        
        pagination = query.order_by(Tweet.created_time.desc()).paginate(page=page, per_page=per_page, error_out=False)

        tweets_data = [{
            'id': tweet.id,
            'author_id': tweet.author_id,
            'text': tweet.text,
            'hashtag': tweet.hashtag,
            'likes': tweet.likes,
            'retweets': tweet.retweets,
            'replies': tweet.replies,
            'quotes': tweet.quotes,
            'sentiment': tweet.sentiment,
            'media_urls': tweet.media_urls,
            'created_time': _serialize_datetime(tweet.created_time)
        } for tweet in pagination.items]

        return jsonify({
            'success': True,
            'data': tweets_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        })
    except Exception as exc:
        current_app.logger.exception('Failed to fetch tweets.')
        return jsonify({'success': False, 'error': str(exc)}), 500

@api_bp.route('/tweets/sentiment-summary', methods=['GET'])
def get_tweets_sentiment_summary():
    """Get sentiment summary for all tweets"""
    try:
        tweets = Tweet.query.all()
        
        positive = sum(1 for tweet in tweets if tweet.sentiment == 'Positive')
        neutral = sum(1 for tweet in tweets if tweet.sentiment == 'Neutral')
        negative = sum(1 for tweet in tweets if tweet.sentiment == 'Negative')
        
        return jsonify({
            'success': True,
            'data': {
                'positive': positive,
                'neutral': neutral,
                'negative': negative,
                'total': len(tweets)
            }
        })
    except Exception as exc:
        current_app.logger.exception('Failed to summarize tweet sentiment.')
        return jsonify({'success': False, 'error': str(exc)}), 500
