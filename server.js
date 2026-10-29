const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const bcrypt = require('bcryptjs');
const util = require('node:util');

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
        console.log('Conectado al motor de base de datos SQLite.');
    }
});

const dbAll = util.promisify(db.all.bind(db));
const dbRun = util.promisify(db.run.bind(db));

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
        codigo_ticket TEXT UNIQUE,
        cliente_empresa TEXT NOT NULL,
        nit TEXT,
        direccion_entrega TEXT NOT NULL,
        horario_recepcion TEXT,
        persona_recibe TEXT,
        ciudad_destino TEXT NOT NULL,
        area_destino TEXT NOT NULL,
        tiempo_alquiler TEXT DEFAULT '1 Mes',
        tipo_ticket TEXT DEFAULT 'Alquiler',
        categoria_incidencia TEXT DEFAULT 'N/A',
        estado_logistico TEXT DEFAULT '1. Solicitado',
        prioridad TEXT DEFAULT 'Normal',
        asignado_a TEXT DEFAULT 'Sin Asignar',
        observaciones TEXT,
        fecha_deseada TEXT,
        fecha_vencimiento TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        db.run(`ALTER TABLE tickets ADD COLUMN codigo_ticket TEXT`, () => {});
        db.run(`ALTER TABLE tickets ADD COLUMN prioridad TEXT DEFAULT 'Normal'`, () => {});
        db.run(`ALTER TABLE tickets ADD COLUMN observaciones TEXT`, () => {});
        db.run(`ALTER TABLE tickets ADD COLUMN fecha_deseada TEXT`, () => {});
    });

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

    db.get("SELECT * FROM usuarios WHERE usuario = 'admin'", async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            db.run("INSERT INTO usuarios (usuario, password, rol, razon_social) VALUES ('admin', ?, 'admin', 'Administración Central')", [hashedPassword]);
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
    if (!usuario || !password) {
        return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    }

    db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;
        res.json({ message: "Login exitoso", usuario: userWithoutPassword });
    });
});

app.post('/api/auth/registro', async (req, res) => {
    const { usuario, password, nit, razon_social, contacto_persona, telefono, correo, direccion } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: "Completa los campos obligatorios" });
    
    db.get("SELECT id FROM usuarios WHERE usuario = ?", [usuario], async (err, row) => {
        if (row) {
            return res.status(400).json({ error: "El nombre de usuario ya está en uso." });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = `INSERT INTO usuarios (usuario, password, rol, nit, razon_social, contacto_persona, telefono, correo, direccion) 
                         VALUES (?, ?, 'cliente', ?, ?, ?, ?, ?, ?)`;
            
            db.run(sql, [usuario, hashedPassword, nit, razon_social || nit, contacto_persona, telefono, correo, direccion], function(err2) {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ message: "Registrado con éxito", id: this.lastID });
            });
        } catch (hashError) {
            console.error("Error al procesar seguridad:", hashError);
            res.status(500).json({ error: "Error interno al procesar la seguridad" });
        }
    });
});

app.get('/api/inventario', (req, res) => {
    db.all("SELECT * FROM equipos_inventario", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/tickets', async (req, res) => {
    try {
        const empresa = req.query.empresa;
        let sql = "SELECT * FROM tickets";
        let params = [];
        if (empresa) {
            sql += " WHERE cliente_empresa = ?";
            params.push(empresa);
        }
        sql += " ORDER BY fecha_creacion DESC";

        const tickets = await dbAll(sql, params);

        // CORREGIDO: Uso de Promise.all en lugar de await dentro de bucle for...of
        const ticketsCompletos = await Promise.all(
            tickets.map(async (t) => {
                const detalles = await dbAll("SELECT * FROM ticket_detalles WHERE ticket_id = ?", [t.id]);
                const comentarios = await dbAll("SELECT * FROM comentarios_tickets WHERE ticket_id = ? ORDER BY fecha ASC", [t.id]);
                return {
                    ...t,
                    detalles: detalles || [],
                    comentarios: comentarios || []
                };
            })
        );

        res.json(ticketsCompletos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const { cliente_empresa, nit, direccion_entrega, horario_recepcion, persona_recibe, ciudad_destino, area_destino, tiempo_alquiler, tipo_ticket, categoria_incidencia, prioridad, observaciones, fecha_deseada, items } = req.body;
        
        if (tipo_ticket === 'Alquiler' && (!items || items.length === 0)) {
            return res.status(400).json({ error: "Debe seleccionar al menos un equipo." });
        }

        let diasAdd = 30;
        if (tiempo_alquiler === '3 Meses') diasAdd = 90;
        if (tiempo_alquiler === '6 Meses') diasAdd = 180;
        if (tiempo_alquiler === '1 Año') diasAdd = 365;

        const fechaVenc = new Date();
        fechaVenc.setDate(fechaVenc.getDate() + diasAdd);
        const fechaVencStr = fechaVenc.toISOString().split('T')[0];

        const sqlTicket = `INSERT INTO tickets (cliente_empresa, nit, direccion_entrega, horario_recepcion, persona_recibe, ciudad_destino, area_destino, tiempo_alquiler, tipo_ticket, categoria_incidencia, estado_logistico, prioridad, observaciones, fecha_deseada, fecha_vencimiento) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1. Solicitado', ?, ?, ?, ?)`;
        
        const result = await dbRun(sqlTicket, [
            cliente_empresa, nit, direccion_entrega || 'N/A', horario_recepcion || 'N/A', persona_recibe || 'N/A', 
            ciudad_destino || 'Bogotá', area_destino || 'General', tiempo_alquiler || '1 Mes', tipo_ticket || 'Alquiler', 
            categoria_incidencia || 'N/A', prioridad || 'Normal', observaciones || '', 
            fecha_deseada || new Date().toISOString().split('T')[0], fechaVencStr
        ]);

        const ticketId = result.lastID;
        const codigoFormateado = `TKT-2026-${String(ticketId).padStart(4, '0')}`;
        await dbRun("UPDATE tickets SET codigo_ticket = ? WHERE id = ?", [codigoFormateado, ticketId]);

        if (items && items.length > 0) {
            // CORREGIDO: Uso de Promise.all para inserciones concurrentes seguras
            await Promise.all(
                items.map(async (item) => {
                    await dbRun("INSERT INTO ticket_detalles (ticket_id, equipo_nombre, cantidad) VALUES (?, ?, ?)", [ticketId, item.equipo_nombre, item.cantidad]);
                })
            );
        }

        res.json({ message: "Solicitud creada exitosamente", id: ticketId, codigo: codigoFormateado });
    } catch (err) {
        console.error("ERROR SQL TICKET:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tickets/:id', (req, res) => {
    const ticketId = req.params.id;
    const { estado_logistico, asignado_a } = req.body;

    const sqlUpdate = `UPDATE tickets SET 
        estado_logistico = COALESCE(?, estado_logistico), 
        asignado_a = COALESCE(?, asignado_a) 
        WHERE id = ?`;

    db.run(sqlUpdate, [estado_logistico, asignado_a, ticketId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Actualizado correctamente" });
    });
});

app.post('/api/tickets/:id/comentarios', (req, res) => {
    const ticketId = req.params.id;
    const { autor, rol, comentario } = req.body;

    if (!comentario) return res.status(400).json({ error: "El comentario no puede estar vacío" });

    db.run("INSERT INTO comentarios_tickets (ticket_id, autor, rol, comentario) VALUES (?, ?, ?, ?)",
        [ticketId, autor || 'Usuario', rol || 'Cliente', comentario], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Comentario agregado con éxito", id: this.lastID });
        });
});

app.listen(PORT, () => {
    console.log(`Servidor logístico corriendo en puerto ${PORT}`);
});