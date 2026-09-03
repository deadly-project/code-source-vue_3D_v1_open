import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initializeDatabase } from './database.js';
import authRoutes from './routes/auth.js';
import dynamicElementsRoutes from './routes/dynamicElements.js';
import { authenticateToken } from './middleware/auth.js';
import { requireRole } from './middleware/roles.js';
import usersRoutes from "./routes/users.js"
const app = express();
const PORT = process.env.PORT || 3001;

initializeDatabase();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/admin/users', usersRoutes);
app.use('/api', dynamicElementsRoutes);
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Route protegee accessible', user: req.user });
});

app.get('/api/admin/dashboard', authenticateToken, requireRole('administrateur'), (req, res) => {
  res.json({ message: 'Tableau de bord administrateur', user: req.user });
});

app.get('/api/partenaire/dashboard', authenticateToken, requireRole('partenaire'), (req, res) => {
  res.json({ message: 'Tableau de bord partenaire', user: req.user });
});

app.get('/api/citoyen/dashboard', authenticateToken, requireRole('citoyen'), (req, res) => {
  res.json({ message: 'Tableau de bord citoyen', user: req.user });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Opencode API demarree sur http://localhost:${PORT}`);
});
