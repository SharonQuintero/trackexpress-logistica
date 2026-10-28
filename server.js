const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar la BD', err.message);
    } else {
        console.log('Conectado a la Base de Datos SQLite.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        rol TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS equipos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        codigo TEXT UNIQUE,
        ciudad TEXT,
        estado TEXT,
        localizador TEXT,
        empresa TEXT,
        area TEXT,
        tiempo_alquiler TEXT,
        cantidad INTEGER
    )`, () => {
        db.get(`SELECT COUNT(*) as count FROM equipos`, (err, row) => {
            if (!err && row?.count === 0) {
                const equiposIniciales = [
                    ['Laptop Dell Latitude', 'EQ-IT-001', 'Bogotá D.C.', '3. En Tránsito / Alquilado', 'Bodega Principal - Piso 3', 'Corferias', 'Área IT', '3 meses', 5],
                    ['Radio Comunicador Motorola', 'EQ-SEG-002', 'Medellín', '3. En Tránsito / Alquilado', 'Torre de Control', 'Ecopetrol', 'Seguridad', '6 meses', 12],
                    ['Tablet de Registro', 'EQ-REC-003', 'Cali', '1. Solicitud Recibida', 'Recepción Central', 'Bancolombia', 'Recepción', '1 mes', 3]
                ];
                
                const stmt = db.prepare(`INSERT INTO equipos (nombre, codigo, ciudad, estado, localizador, empresa, area, tiempo_alquiler, cantidad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                equiposIniciales.forEach(eq => stmt.run(eq));
                stmt.finalize();
                console.log('Equipos de ejemplo precargados exitosamente.');
            }
        });
    });
});

app.post('/api/registro', async (req, res) => {
    const { username, password, rol } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña obligatorios' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)`, 
            [username, hashedPassword, rol || 'cliente'], 
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'El usuario ya existe' });
                }
                return res.json({ success: true, id: this.lastID });
            }
        );
    } catch {
        return res.status(500).json({ error: 'Error interno en el servidor' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Credenciales incompletas' });
    }
    
    db.get(`SELECT * FROM usuarios WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const rolUser = (user.username.toLowerCase() === 'admin') ? 'admin' : 'cliente';
            return res.json({ success: true, username: user.username, rol: rolUser });
        }
        return res.status(400).json({ error: 'Credenciales inválidas' });
    });
});

app.get('/api/equipos', (req, res) => {
    db.all(`SELECT * FROM equipos`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        return res.json(rows);
    });
});

app.post('/api/equipos', (req, res) => {
    const { nombre, codigo, ciudad, estado, localizador, empresa, area, tiempo_alquiler, cantidad } = req.body;
    db.run(`INSERT INTO equipos (nombre, codigo, ciudad, estado, localizador, empresa, area, tiempo_alquiler, cantidad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre, codigo, ciudad, estado, localizador, empresa, area, tiempo_alquiler, cantidad || 1],
        function(err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            return res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/equipos/:id/estado', (req, res) => {
    const equipoId = req.params.id;
    const { estado, localizador } = req.body;
    db.run(`UPDATE equipos SET estado = ?, localizador = ? WHERE id = ?`,
        [estado, localizador, equipoId],
        function(err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            return res.json({ success: true });
        }
    );
});

app.put('/api/equipos/:id/liberar', (req, res) => {
    const equipoId = req.params.id;
    db.run(`UPDATE equipos SET estado = '4. Entregado al Cliente', empresa = 'Ninguna (En Stock)', tiempo_alquiler = 'Finalizado' WHERE id = ?`,
        [equipoId],
        function(err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            return res.json({ success: true });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});