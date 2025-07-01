window.onload = function () {

    const canvas = document.getElementById('lineChart');
    const context = canvas.getContext('2d');

    // Fix for high-DPI screens
    const dpi = window.devicePixelRatio || 1;
    const style = getComputedStyle(canvas);
    const cssWidth = parseInt(style.getPropertyValue('width'));
    const cssHeight = parseInt(style.getPropertyValue('height'));

    canvas.setAttribute('width', cssWidth * dpi);
    canvas.setAttribute('height', cssHeight * dpi);
    context.scale(dpi, dpi);

    // Sentiment Bar Chart
    new Chart(document.getElementById('barChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [{
                label: 'Tweet Count',
                data: [sentimentData.positive, sentimentData.neutral, sentimentData.negative],
                backgroundColor: ['rgba(40, 167, 69, 0.6)', 'rgba(147, 146, 143, 0.6)', 'rgba(220, 53, 69, 0.6)'],
                borderColor: ['rgb(10, 11, 10)', 'rgb(11, 11, 11)', 'rgb(14, 14, 14)'],
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'x',
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Blend two RGBA colors
    function blendColors(color1, color2, percentage) {
        const parseRGBA = (rgba) => rgba.match(/\d+/g).map(Number);
        const [r1, g1, b1, a1] = parseRGBA(color1);
        const [r2, g2, b2, a2] = parseRGBA(color2);

        const r = Math.round(r1 + (r2 - r1) * percentage);
        const g = Math.round(g1 + (g2 - g1) * percentage);
        const b = Math.round(b1 + (b2 - b1) * percentage);
        const a = 0.95; // High opacity for visible fill

        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    const startColor = 'rgba(54, 162, 235, 1)';    // Blue
    const endColor = 'rgba(153, 102, 255, 1)';     // Purple

    const backgroundColor = hashtagLabels.map((_, i) => {
        const t = i / (hashtagLabels.length - 1 || 1);
        return blendColors(startColor, endColor, t);
    });

    const borderColor = hashtagLabels.map((_, i) => {
        const t = i / (hashtagLabels.length - 1 || 1);
        return blendColors(startColor, endColor, t); // Match fill, or use stronger alpha
    });

    new Chart(document.getElementById('hashtagBarChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: hashtagLabels,
            datasets: [{
                label: "Frequency",
                data: hashtagCounts,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true },
                y: {}
            }
        }
    });


    // Hashtag List
    const list = document.getElementById("hashtagList");
    hashtagLabels.forEach((label, i) => {
        const item = document.createElement("li");
        item.className = "list-group-item d-flex justify-content-between align-items-center";
        item.textContent = label;
        const badge = document.createElement("span");
        badge.className = "badge bg-primary rounded-pill";
        badge.textContent = hashtagCounts[i];
        item.appendChild(badge);
        list.appendChild(item);
    });

    const likesPerHashtag = hashtagLabels.map(label => {
        const total = tweets
            .filter(tweet => tweet.hashtag === label)
            .reduce((sum, tweet) => sum + tweet.likes, 0);
        return total;
    });

    new Chart(document.getElementById('lineChart').getContext('2d'), {
        type: 'polarArea',
        data: {
            labels: hashtagLabels,
            datasets: [{
                label: 'Likes per Hashtag',
                data: likesPerHashtag,
                backgroundColor: transparentColors,
                borderColor: '#fff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                title: {
                    display: true,
                    text: 'Likes per Hashtag'
                }
            },
            scales: {
                r: {
                    ticks: {
                        beginAtZero: true
                    }
                }
            }
        }
    });

    // Totals Box Calculation
    let totalLikes = 0, totalRetweets = 0, totalReplies = 0, totalQuotes = 0;
    tweets.forEach(tweet => {
        totalLikes += tweet.likes;
        totalRetweets += tweet.retweets;
        totalReplies += tweet.replies;
        totalQuotes += tweet.quotes;
    });

    document.getElementById("totalLikes").textContent = totalLikes;
    document.getElementById("totalRetweets").textContent = totalRetweets;
    document.getElementById("totalReplies").textContent = totalReplies;
    document.getElementById("totalQuotes").textContent = totalQuotes;
};
