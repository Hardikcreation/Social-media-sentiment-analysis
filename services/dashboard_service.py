"""
Dashboard data assembly for the Facebook analytics page.
"""

from collections import defaultdict
from datetime import date, datetime

from sqlalchemy import case, func

from extensions import db
from models import Comment, Post

FACEBOOK_PAGE_OPTIONS = [
    {'id': '1448364408720250', 'label': 'ISRO'},
    {'id': '1052601808104708', 'label': 'Bhopal Smart City'},
    {'id': '368157233303532', 'label': 'Bhopal Municipal Corporation'},
    {'id': '27682782579', 'label': 'AajTak'},
    {'id': '717707264961942', 'label': 'CM Madhya Pradesh'},
    {'id': '1437145013080740', 'label': 'Republic Bharat'},
]


def _format_datetime(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if value is None:
        return ''
    return str(value)


def _normalize_sentiment(value):
    if value in {'Positive', 'Negative', 'Neutral'}:
        return value
    return 'Neutral'


def build_facebook_dashboard_payload(page_id=None):
    """Return the full dashboard payload for the selected page."""
    selected_page_id = page_id or FACEBOOK_PAGE_OPTIONS[1]['id']
    selected_page = next(
        (page for page in FACEBOOK_PAGE_OPTIONS if page['id'] == selected_page_id),
        FACEBOOK_PAGE_OPTIONS[1],
    )
    selected_page_id = selected_page['id']

    posts = Post.query.filter_by(page_id=selected_page_id).order_by(Post.created_time.desc()).all()
    post_ids = [post.id for post in posts]

    comments_by_post = defaultdict(list)
    sentiment_counts_by_post = {
        post_id: {'Positive': 0, 'Negative': 0, 'Neutral': 0}
        for post_id in post_ids
    }
    sentiment_time_data = {post_id: [] for post_id in post_ids}

    post_items = []
    post_sentiment_data = {}
    total_comments = 0
    total_likes = 0
    total_shares = 0
    total_sentiments = {'Positive': 0, 'Negative': 0, 'Neutral': 0}

    if post_ids:
        comments = Comment.query.filter(Comment.post_id.in_(post_ids)).order_by(Comment.created_time.desc()).all()
        time_series_rows = db.session.query(
            Comment.post_id,
            func.date(Comment.created_time).label('created_time'),
            func.sum(case((Comment.sentiment == 'Positive', 1), else_=0)).label('Positive'),
            func.sum(case((Comment.sentiment == 'Negative', 1), else_=0)).label('Negative'),
            func.sum(case((Comment.sentiment == 'Neutral', 1), else_=0)).label('Neutral'),
        ).filter(Comment.post_id.in_(post_ids)).group_by(
            Comment.post_id,
            func.date(Comment.created_time),
        ).order_by(Comment.post_id, func.date(Comment.created_time)).all()

        for comment in comments:
            sentiment = _normalize_sentiment(comment.sentiment)
            sentiment_counts_by_post[comment.post_id][sentiment] += 1
            total_sentiments[sentiment] += 1
            comments_by_post[comment.post_id].append(
                {
                    'id': comment.id,
                    'message': comment.message or '',
                    'sentiment': sentiment,
                    'created_time': _format_datetime(comment.created_time),
                }
            )

        for row in time_series_rows:
            sentiment_time_data[row.post_id].append(
                {
                    'created_time': _format_datetime(row.created_time),
                    'Positive': int(row.Positive or 0),
                    'Negative': int(row.Negative or 0),
                    'Neutral': int(row.Neutral or 0),
                }
            )

    for post in posts:
        likes = int(post.likes or 0)
        shares = int(post.shares or 0)
        comment_items = comments_by_post[post.id]
        sentiment_counts = sentiment_counts_by_post[post.id]
        time_series = sentiment_time_data[post.id]

        total_comments += len(comment_items)
        total_likes += likes
        total_shares += shares

        post_sentiment_data[post.id] = {
            'Positive': sentiment_counts['Positive'],
            'Negative': sentiment_counts['Negative'],
            'Neutral': sentiment_counts['Neutral'],
            'Comments': [
                {
                    'Comment Message': item['message'],
                    'Sentiment': item['sentiment'],
                    'Created Time': item['created_time'],
                }
                for item in comment_items
            ],
            'Image URL': post.image_url or '',
            'Likes': likes,
            'Shares': shares,
        }

        post_items.append(
            {
                'id': post.id,
                'message': post.message or '',
                'created_time': _format_datetime(post.created_time),
                'likes': likes,
                'shares': shares,
                'sentiment': post.sentiment or 'Neutral',
                'image_url': post.image_url or '',
                'comments': comment_items,
                'sentiment_counts': sentiment_counts,
                'sentiment_time_data': time_series,
            }
        )

    sentiment_total = sum(total_sentiments.values())
    sentiment_summary = {
        'positive': total_sentiments['Positive'],
        'negative': total_sentiments['Negative'],
        'neutral': total_sentiments['Neutral'],
        'total': sentiment_total,
        'positive_pct': round(total_sentiments['Positive'] / sentiment_total * 100, 1) if sentiment_total else 0,
        'negative_pct': round(total_sentiments['Negative'] / sentiment_total * 100, 1) if sentiment_total else 0,
        'neutral_pct': round(total_sentiments['Neutral'] / sentiment_total * 100, 1) if sentiment_total else 0,
    }

    total_sentiment_chart = {
        'labels': ['Positive', 'Negative', 'Neutral'],
        'values': [
            total_sentiments['Positive'],
            total_sentiments['Negative'],
            total_sentiments['Neutral'],
        ],
        'colors': {
            'Positive': '#1eb980',
            'Negative': '#ff5b6e',
            'Neutral': '#7a869a',
        },
    }

    active_post = post_items[0] if post_items else None

    return {
        'pages': FACEBOOK_PAGE_OPTIONS,
        'selected_page': {
            'id': selected_page_id,
            'label': selected_page['label'],
        },
        'stats': {
            'total_posts': len(posts),
            'total_comments': total_comments,
            'total_likes': total_likes,
            'total_shares': total_shares,
        },
        'sentiment_summary': sentiment_summary,
        'total_sentiment_chart': total_sentiment_chart,
        'posts': post_items,
        'post_sentiment_data': post_sentiment_data,
        'sentiment_time_data': sentiment_time_data,
        'active_post_id': active_post['id'] if active_post else None,
        'active_post': active_post,
    }
