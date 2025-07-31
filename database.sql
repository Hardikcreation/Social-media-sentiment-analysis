-- 1. Create the Database
CREATE DATABASE IF NOT EXISTS sentiment_analysis
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 2. Use the Database
USE sentiment_analysis;

-- 3. Drop tables if they already exist (order matters due to foreign key constraints)
DROP TABLE IF EXISTS Comment;
DROP TABLE IF EXISTS Post;
DROP TABLE IF EXISTS Tweet;

-- 4. Create TWEET Table
CREATE TABLE Tweet (
    id VARCHAR(100) PRIMARY KEY,
    author_id VARCHAR(100),
    hashtag TEXT,
    text LONGTEXT,
    created_time DATETIME,
    likes INT,
    retweets INT,
    replies INT,
    quotes INT,
    sentiment VARCHAR(50),
    media_urls LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Create POST Table
CREATE TABLE Post (
    id VARCHAR(255) PRIMARY KEY,
    page_id VARCHAR(255) NOT NULL,
    message LONGTEXT,
    created_time DATETIME,
    image_url TEXT,
    likes INT DEFAULT 0,
    shares INT DEFAULT 0,
    sentiment VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Create COMMENT Table (includes page_id)
CREATE TABLE Comment (
    id VARCHAR(255) PRIMARY KEY,
    post_id VARCHAR(255),
    page_id VARCHAR(255) NOT NULL,
    message LONGTEXT,
    created_time DATETIME,
    sentiment VARCHAR(50),
    FOREIGN KEY (post_id) REFERENCES Post(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
