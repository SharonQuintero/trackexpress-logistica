const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dbFile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Error al conectar a la Base de Datos SQLite:', err.message);
    } else {
        console.log('Conectado a la Base de Datos SQLite.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        password TEXT,
        rol TEXT DEFAULT 'cliente',
        nit TEXT,
        razon_social TEXT,
        contacto_persona TEXT,
        telefono TEXT,
        correo TEXT,
        direccion TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS equipos_inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial TEXT UNIQUE,
        nombre TEXT,
        marca TEXT,
        modelo TEXT,
        estado TEXT DEFAULT 'Disponible',
        empresa_actual TEXT DEFAULT NULL,
        fecha_vencimiento TEXT DEFAULT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_empresa TEXT NOT NULL,
        nit TEXT,
        direccion_entrega TEXT NOT NULL,
        horario_recepcion TEXT,
        persona_recibe TEXT,
        ciudad_destino TEXT NOT NULL,
        area_destino TEXT NOT NULL,
        tiempo_alquiler TEXT DEFAULT '1 Mes',
        estado_logistico TEXT DEFAULT '1. Solicitado',
        asignado_a TEXT DEFAULT 'Sin Asignar',
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ticket_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        equipo_nombre TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS comentarios_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        autor TEXT NOT NULL,
        rol TEXT NOT NULL,
        comentario TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )`);

    db.get("SELECT * FROM usuarios WHERE usuario = 'admin'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO usuarios (usuario, password, rol) VALUES ('admin', 'admin123', 'admin')");
        }
    });

    db.get("SELECT COUNT(*) as count FROM equipos_inventario", (err, row) => {
        if (row?.count === 0) {
            const inventarioInicial = [
                ['DL-784201', 'Laptop Dell Latitude', 'Dell', 'Latitude 5420', 'Disponible'],
                ['DL-784202', 'Laptop Dell Latitude', 'Dell', 'Latitude 5420', 'Disponible'],
                ['HP-991201', 'Laptop HP ProBook', 'HP', 'ProBook 450 G8', 'Disponible'],
                ['HP-991202', 'Laptop HP ProBook', 'HP', 'ProBook 450 G8', 'Disponible'],
                ['LN-332101', 'Workstation Lenovo', 'Lenovo', 'ThinkPad P15', 'Disponible'],
                ['HP-ESC-01', 'Computador Escritorio HP', 'HP', 'EliteDesk 800', 'Disponible']
            ];
            const stmt = db.prepare("INSERT INTO equipos_inventario (serial, nombre, marca, modelo, estado) VALUES (?, ?, ?, ?, ?)");
            inventarioInicial.forEach(eq => stmt.run(eq));
            stmt.finalize();
        }
    });
});

app.post('/api/auth/login', (req, res) => {
    const { usuario, password } = req.body;
    db.get("SELECT * FROM usuarios WHERE usuario = ? AND password = ?", [usuario, password], (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        res.json({ message: "Login exitoso", usuario: user });
    });
});

app.post('/api/auth/registro', (req, res) => {
    const { usuario, password, nit, razon_social, contacto_persona, telefono, correo, direccion } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: "Completa los campos obligatorios" });
    
    const sql = `INSERT INTO usuarios (usuario, password, rol, nit, razon_social, contacto_persona, telefono, correo, direccion) 
                 VALUES (?, ?, 'cliente', ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [usuario, password, nit, razon_social, contacto_persona, telefono, correo, direccion], function(err) {
        if (err) return res.status(400).json({ error: "El usuario ya existe" });
        res.json({ message: "Registrado con éxito", id: this.lastID });
    });
});

app.get('/api/inventario', (req, res) => {
    db.all("SELECT * FROM equipos_inventario", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/tickets', (req, res) => {
    const empresa = req.query.empresa;
    let sql = "SELECT * FROM tickets";
    let params = [];
    if (empresa) {
        sql += " WHERE cliente_empresa = ?";
        params.push(empresa);
    }
    sql += " ORDER BY fecha_creacion DESC";

    db.all(sql, params, (err, tickets) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const promesas = tickets.map(t => {
            return new Promise((resolve, reject) => {
                db.all("SELECT * FROM ticket_detalles WHERE ticket_id = ?", [t.id], (err2, detalles) => {
                    if (err2) return reject(err2);
                    t.detalles = detalles || [];
                    resolve(t);
                });
            });
        });

        Promise.all(promesas)
            .then(ticketsConDetalles => res.json(ticketsConDetalles))
            .catch(error => res.status(500).json({ error: error.message }));
    });
});

app.post('/api/tickets', (req, res) => {
    const { cliente_empresa, nit, direccion_entrega, horario_recepcion, persona_recibe, ciudad_destino, area_destino, tiempo_alquiler, items } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "Debe seleccionar al menos un equipo." });
    }

    const sqlTicket = `INSERT INTO tickets (cliente_empresa, nit, direccion_entrega, horario_recepcion, persona_recibe, ciudad_destino, area_destino, tiempo_alquiler, estado_logistico) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1. Solicitado')`;
    
    db.run(sqlTicket, [cliente_empresa, nit, direccion_entrega, horario_recepcion, persona_recibe, ciudad_destino, area_destino, tiempo_alquiler || '1 Mes'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const ticketId = this.lastID;

        const stmt = db.prepare("INSERT INTO ticket_detalles (ticket_id, equipo_nombre, cantidad) VALUES (?, ?, ?)");
        items.forEach(item => {
            stmt.run([ticketId, item.equipo_nombre, item.cantidad]);
        });
        stmt.finalize(() => {
            res.json({ message: "Solicitud creada exitosamente", id: ticketId });
        });
    });
});

app.put('/api/tickets/:id', (req, res) => {
    const ticketId = req.params.id;
    const { estado_logistico, asignado_a, comentario, admin_nombre } = req.body;

    const sqlUpdate = `UPDATE tickets SET 
        estado_logistico = COALESCE(?, estado_logistico), 
        asignado_a = COALESCE(?, asignado_a) 
        WHERE id = ?`;

    db.run(sqlUpdate, [estado_logistico, asignado_a, ticketId], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        if (comentario) {
            db.run("INSERT INTO comentarios_tickets (ticket_id, autor, rol, comentario) VALUES (?, ?, 'Administrador', ?)",
                [ticketId, admin_nombre || 'Soporte Logístico', comentario]);
        }
        res.json({ message: "Actualizado correctamente" });
    });
});

app.get('/api/tickets/:id/detalle', (req, res) => {
    const ticketId = req.params.id;
    db.get("SELECT * FROM tickets WHERE id = ?", [ticketId], (err, ticket) => {
        if (err || !ticket) return res.status(404).json({ error: "No encontrado" });
        
        db.all("SELECT * FROM ticket_detalles WHERE ticket_id = ?", [ticketId], (errDet, detalles) => {
            ticket.detalles = detalles || [];
            db.all("SELECT * FROM comentarios_tickets WHERE ticket_id = ? ORDER BY fecha ASC", [ticketId], (err2, comentarios) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ ticket, comentarios });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});