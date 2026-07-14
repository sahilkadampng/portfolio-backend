const SERIES_LENGTH = 56;

const toDayKey = (value) => new Date(value).toISOString().slice(0, 10);

const buildSeries = (countsByDay, length = SERIES_LENGTH) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const series = [];

    for (let index = length - 1; index >= 0; index -= 1) {
        const date = new Date(today);
        date.setDate(date.getDate() - index);
        const key = toDayKey(date);

        series.push({
            date: key,
            count: countsByDay.get(key) || 0,
        });
    }

    return series;
};

const getPeak = (series) => series.reduce((max, point) => Math.max(max, point.count), 0);

const getStreak = (series) => {
    let streak = 0;

    for (let index = series.length - 1; index >= 0; index -= 1) {
        if (series[index].count <= 0) {
            break;
        }

        streak += 1;
    }

    return streak;
};

const fetchJson = async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'RAW-Portfolio',
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
};

const fetchGitHubActivity = async (username) => {
    if (!username) {
        return null;
    }

    const events = await fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, {
        headers: {
            Accept: 'application/vnd.github+json',
        },
    });

    const countsByDay = new Map();

    for (const event of events) {
        const key = toDayKey(event.created_at);
        countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
    }

    const series = buildSeries(countsByDay);

    return {
        username,
        source: `https://github.com/${username}`,
        total: series.reduce((sum, point) => sum + point.count, 0),
        peak: getPeak(series),
        streak: getStreak(series),
        series,
        updatedAt: new Date().toISOString(),
    };
};

const parseSubmissionCalendar = (calendarValue) => {
    if (!calendarValue) {
        return new Map();
    }

    const raw = typeof calendarValue === 'string' ? JSON.parse(calendarValue) : calendarValue;
    const countsByDay = new Map();

    for (const [timestamp, count] of Object.entries(raw)) {
        const dayKey = toDayKey(Number(timestamp) * 1000);
        countsByDay.set(dayKey, (countsByDay.get(dayKey) || 0) + Number(count));
    }

    return countsByDay;
};

const fetchLeetCodeActivity = async (username) => {
    if (!username) {
        return null;
    }

    const query = `
        query userActivity($username: String!) {
            matchedUser(username: $username) {
                profile {
                    ranking
                }
                submitStats {
                    acSubmissionNum {
                        difficulty
                        count
                    }
                }
                submissionCalendar
            }
            userContestRanking(username: $username) {
                rating
                topPercentage
            }
        }
    `;

    const payload = await fetchJson('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Referer: 'https://leetcode.com',
        },
        body: JSON.stringify({ query, variables: { username } }),
    });

    const matchedUser = payload?.data?.matchedUser;
    const contestRanking = payload?.data?.userContestRanking;
    const acSubmissionNum = matchedUser?.submitStats?.acSubmissionNum || [];
    const countsByDay = parseSubmissionCalendar(matchedUser?.submissionCalendar);
    const series = buildSeries(countsByDay);

    const solvedByDifficulty = acSubmissionNum.reduce((accumulator, item) => {
        accumulator[item.difficulty?.toLowerCase?.() || item.difficulty || 'unknown'] = Number(item.count) || 0;
        return accumulator;
    }, {});

    return {
        username,
        source: `https://leetcode.com/u/${username}`,
        ranking: matchedUser?.profile?.ranking ?? null,
        contestRating: contestRanking?.rating ?? null,
        topPercentage: contestRanking?.topPercentage ?? null,
        totalSolved: Number(solvedByDifficulty.total || 0),
        easySolved: Number(solvedByDifficulty.easy || 0),
        mediumSolved: Number(solvedByDifficulty.medium || 0),
        hardSolved: Number(solvedByDifficulty.hard || 0),
        totalSubmissionDays: series.reduce((sum, point) => sum + point.count, 0),
        peak: getPeak(series),
        streak: getStreak(series),
        series,
        updatedAt: new Date().toISOString(),
    };
};

export const getProfileActivity = async ({ githubUsername, leetcodeUsername }) => {
    const [github, leetcode] = await Promise.allSettled([
        fetchGitHubActivity(githubUsername),
        fetchLeetCodeActivity(leetcodeUsername),
    ]);

    return {
        github: github.status === 'fulfilled' ? github.value : { username: githubUsername || '', error: github.reason?.message || 'Unable to load GitHub activity.' },
        leetcode: leetcode.status === 'fulfilled' ? leetcode.value : { username: leetcodeUsername || '', error: leetcode.reason?.message || 'Unable to load LeetCode activity.' },
    };
};