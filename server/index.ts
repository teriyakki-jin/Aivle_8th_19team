import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { initDb, getDb } from './database.ts';

const app = express();
const PORT = 3001;
const SECRET_KEY = 'your-secret-key'; // In production, use environment variable

app.use(cors());
app.use(express.json());

// Initialize Database
initDb();

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const db = await getDb();
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run('INSERT INTO users (username, password, start_date) VALUES (?, ?, ?)', [username, hashedPassword, new Date().toISOString()]);
    res.status(201).json({ message: 'User created successfully' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Board Routes ---

// Get all posts
app.get('/api/board', async (req, res) => {
  try {
    const db = await getDb();
    const posts = await db.all('SELECT * FROM posts ORDER BY created_at DESC');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Create a post
app.post('/api/board', authenticateToken, async (req: any, res) => {
  const { title, content } = req.body;
  const { id, username } = req.user;

  try {
    const db = await getDb();
    await db.run('INSERT INTO posts (title, content, author_id, author_name) VALUES (?, ?, ?, ?)',
      [title, content, id, username]);
    res.status(201).json({ message: 'Post created' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get single post
app.get('/api/board/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const post = await db.get('SELECT * FROM posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Delete post
app.delete('/api/board/:id', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = await getDb();
    const post = await db.get('SELECT * FROM posts WHERE id = ?', [id]);

    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== userId) return res.status(403).json({ error: 'Not authorized' });

    await db.run('DELETE FROM posts WHERE id = ?', [id]);
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});


// Mock data based on MainDashboard.tsx
const getMainDashboardData = () => {
  const anomalyData = [
    { process: '프레스', count: 5, avgDelayPerIssue: 2.5 },
    { process: '엔진', count: 3, avgDelayPerIssue: 4.0 },
    { process: '차체', count: 7, avgDelayPerIssue: 3.2 },
    { process: '도장', count: 4, avgDelayPerIssue: 2.8 },
    { process: '설비', count: 3, avgDelayPerIssue: 5.0 },
  ];

  const warningData = [
    { process: '프레스', count: 10, avgDelayPerIssue: 0.5 },
    { process: '엔진', count: 7, avgDelayPerIssue: 0.8 },
    { process: '차체', count: 15, avgDelayPerIssue: 0.6 },
    { process: '도장', count: 8, avgDelayPerIssue: 0.4 },
    { process: '설비', count: 5, avgDelayPerIssue: 1.0 },
  ];

  const totalAnomalies = anomalyData.reduce((sum, item) => sum + item.count, 0);
  const totalWarnings = warningData.reduce((sum, item) => sum + item.count, 0);

  const totalDelayHours =
    anomalyData.reduce((sum, item) => sum + (item.count * item.avgDelayPerIssue), 0) +
    warningData.reduce((sum, item) => sum + (item.count * item.avgDelayPerIssue), 0);

  const originalDeadline = '2026-01-20T18:00:00';

  return {
    anomalyData,
    warningData,
    totalAnomalies,
    totalWarnings,
    totalDelayHours,
    originalDeadline,
    overallEfficiency: 86.6,
    productionEfficiency: 94.2
  };
};

app.get('/api/dashboard/main', (req, res) => {
  res.json(getMainDashboardData());
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
