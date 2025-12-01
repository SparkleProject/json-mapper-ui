import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const SESSIONS_DIR = path.join(__dirname, '../sessions');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure sessions directory exists
try {
    await fs.access(SESSIONS_DIR);
} catch {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

// GET /api/sessions - List all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const files = await fs.readdir(SESSIONS_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        const sessions = await Promise.all(jsonFiles.map(async (file) => {
            const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8');
            try {
                const data = JSON.parse(content);
                // Return full data to match localStorage behavior for now
                // In a real app, we might just return metadata
                return {
                    id: data.id || file.replace('.json', ''),
                    name: data.name || file.replace('.json', ''),
                    date: data.date,
                    ...data
                };
            } catch (e) {
                console.error(`Error parsing ${file}`, e);
                return null;
            }
        }));

        const validSessions = sessions.filter(s => s !== null);
        // Sort by timestamp descending (newest first)
        validSessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        res.json(validSessions);
    } catch (error) {
        console.error('Error listing sessions:', error);
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});

// POST /api/sessions - Save a session
app.post('/api/sessions', async (req, res) => {
    try {
        const session = req.body;
        if (!session.name) {
            return res.status(400).json({ error: 'Session name is required' });
        }

        // Sanitize filename
        const filename = `${session.name.replace(/[^a-z0-9]/gi, '_')}.json`;
        const filePath = path.join(SESSIONS_DIR, filename);

        await fs.writeFile(filePath, JSON.stringify(session, null, 2));
        res.json({ success: true, filename });
    } catch (error) {
        console.error('Error saving session:', error);
        res.status(500).json({ error: 'Failed to save session' });
    }
});

// DELETE /api/sessions/:id - Delete a session
// Note: ID here is expected to be the filename or we need to find the file by ID
// For simplicity, let's assume the ID passed from frontend is the ID stored in the JSON
// But deleting by filename is safer if we have it.
// The frontend currently uses a UUID as ID.
// We need to find the file that contains this ID.
app.delete('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const files = await fs.readdir(SESSIONS_DIR);

        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const filePath = path.join(SESSIONS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            try {
                const data = JSON.parse(content);
                if (data.id === id) {
                    await fs.unlink(filePath);
                    return res.json({ success: true });
                }
            } catch (e) {
                // ignore parse errors
            }
        }

        res.status(404).json({ error: 'Session not found' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
});
