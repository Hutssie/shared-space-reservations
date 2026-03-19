import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { spacesRouter } from './routes/spaces.js';
import { bookingsRouter } from './routes/bookings.js';
import { favoritesRouter } from './routes/favorites.js';
import { hostRouter } from './routes/host.js';
import { uploadRouter } from './routes/upload.js';
import { placesRouter } from './routes/places.js';
import { statsRouter } from './routes/stats.js';
import { messagesRouter } from './routes/messages.js';
import { notificationsRouter } from './routes/notifications.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/spaces', spacesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/host', hostRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/places', placesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
}
