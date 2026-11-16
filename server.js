const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos en memoria (Simulada)
let usuarios = [
    { id: 1, usuario: 'admin', password: bcrypt.hashSync('admin123', 8), razon_social: 'Administración TrackExpress', nit: '900000000-1', rol: 'admin' },
    { id: 2, usuario: 'bancolombia', password: bcrypt.hashSync('banco123', 8), razon_social: 'Bancolombia S.A.', nit: '890903938-1', rol: 'cliente' }
];

let inventario = [
    { id: 1, serial: 'DL-784201', nombre: 'Laptop Dell Latitude 5420', marca: 'Dell', modelo: '14" 8GB RAM SSD 256GB', estado: 'Disponible', empresa_actual: null },
    { id: 2, serial: 'DL-784202', nombre: 'Laptop Dell Latitude 3420', marca: 'Dell', modelo: 'Compacta 14" 8GB RAM', estado: 'Disponible', empresa_actual: null },
    { id: 3, serial: 'HP-992104', nombre: 'Workstation HP ProBook 440', marca: 'HP', modelo: '14" 8GB RAM Core i5', estado: 'Disponible', empresa_actual: null },
    { id: 4, serial: 'LN-331092', nombre: 'ThinkPad Lenovo T14 Gen 2', marca: 'Lenovo', modelo: 'Ultrabook 14" 8GB RAM', estado: 'Disponible', empresa_actual: null },
    { id: 5, serial: 'AP-110293', nombre: 'Apple MacBook Air M1', marca: 'Apple', modelo: 'Retina 13" 8GB RAM', estado: 'Disponible', empresa_actual: null },
    { id: 6, serial: 'AS-554821', nombre: 'Asus ExpertBook B1', marca: 'Asus', modelo: 'Liviana 15.6" 8GB RAM', estado: 'Disponible', empresa_actual: null },
    { id: 7, serial: 'AC-883920', nombre: 'Acer TravelMate P2', marca: 'Acer', modelo: 'Corporativa 14" 8GB RAM', estado: 'Disponible', empresa_actual: null },
    { id: 8, serial: 'DL-784203', nombre: 'Mini PC Dell OptiPlex 3090', marca: 'Dell', modelo: 'Micro Form Factor 8GB', estado: 'Disponible', empresa_actual: null },
    { id: 9, serial: 'HP-992105', nombre: 'Mini Desktop HP ProDesk 400', marca: 'HP', modelo: 'Compacto G6 8GB RAM', estado: 'Disponible', empresa_actual: null },
    { id: 10, serial: 'LN-331093', nombre: 'Lenovo ThinkCentre M75q', marca: 'Lenovo', modelo: 'Tiny Desktop 8GB RAM', estado: 'Disponible', empresa_actual: null }
];

let tickets = [];
let contadorTickets = 100;

// API: Autenticación
app.post('/api/auth/login', (req, res) => {
    const { usuario, password } = req.body;
    const user = usuarios.find(u => u.usuario === usuario);
    if (user && bcrypt.compareSync(password, user.password)) {
        res.json({ usuario: { id: user.id, usuario: user.usuario, razon_social: user.razon_social, nit: user.nit, rol: user.rol } });
    } else {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
});

app.post('/api/auth/registro', (req, res) => {
    const { usuario, password, razon_social, nit } = req.body;
    if (usuarios.find(u => u.usuario === usuario)) {
        return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }
    const hashedPassword = bcrypt.hashSync(password, 8);
    const nuevoUsuario = { id: usuarios.length + 1, usuario, password: hashedPassword, razon_social, nit, rol: 'cliente' };
    usuarios.push(nuevoUsuario);
    res.json({ mensaje: 'Usuario registrado con éxito' });
});

// API: Inventario
app.get('/api/inventario', (req, res) => {
    res.json(inventario);
});

// API: Obtener Tickets
app.get('/api/tickets', (req, res) => {
    const { empresa } = req.query;
    if (empresa) {
        const filtrados = tickets.filter(t => t.cliente_empresa.toLowerCase() === empresa.toLowerCase());
        return res.json(filtrados);
    }
    res.json(tickets);
});

// API: Crear Ticket (Actualiza inventario a "Alquilado/Ocupado")
app.post('/api/tickets', (req, res) => {
    const { cliente_empresa, nit, tipo_ticket, ciudad_destino, direccion_entrega, persona_recibe, horario_recepcion, area_destino, tiempo_alquiler, categoria_incidencia, prioridad, observaciones, fecha_deseada, items } = req.body;
    
    contadorTickets++;
    const codigo = `TKT-${new Date().getFullYear()}-${contadorTickets}`;

    // Si es un ticket de alquiler, actualizamos el inventario de los equipos seleccionados
    if (tipo_ticket === 'Alquiler' && items && items.length > 0) {
        items.forEach(item => {
            const eq = inventario.find(e => e.nombre === item.equipo_nombre && e.estado === 'Disponible');
            if (eq) {
                eq.estado = 'Alquilado';
                eq.empresa_actual = cliente_empresa;
            }
        });
    }

    const nuevoTicket = {
        id: contadorTickets,
        codigo_ticket: codigo,
        cliente_empresa,
        nit,
        tipo_ticket,
        ciudad_destino,
        direccion_entrega,
        persona_recibe,
        horario_recepcion,
        area_destino,
        tiempo_alquiler,
        categoria_incidencia,
        prioridad: prioridad || 'Normal',
        observaciones,
        fecha_deseada,
        estado_logistico: '1. Solicitado',
        fecha_creacion: new Date().toLocaleDateString(),
        detalles: items || [],
        comentarios: []
    };

    tickets.push(nuevoTicket);
    res.json({ mensaje: 'Ticket creado exitosamente', codigo: codigo });
});

// API: Actualizar Estado Logístico (REGLA: Requiere al menos 1 comentario previo y libera inventario si se Cierra)
app.put('/api/tickets/:id', (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    const { estado_logistico } = req.body;
    const ticket = tickets.find(t => t.id === ticketId);

    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    // REGLA OBLIGATORIA: Debe tener al menos un comentario registrado antes de cambiar de estado
    if (!ticket.comentarios || ticket.comentarios.length === 0) {
        return res.status(400).json({ error: '⚠️ REGLA OBLIGATORIA: Debe registrar al menos un comentario/observación en el ticket antes de cambiar su estado o cerrarlo.' });
    }

    ticket.estado_logistico = estado_logistico;

    // Si el estado pasa a "7. Cerrado", liberamos los equipos del inventario para que vuelvan a estar disponibles
    if (estado_logistico === '7. Cerrado' && ticket.detalles) {
        ticket.detalles.forEach(d => {
            const eq = inventario.find(e => e.nombre === d.equipo_nombre && e.empresa_actual === ticket.cliente_empresa);
            if (eq) {
                eq.estado = 'Disponible';
                eq.empresa_actual = null;
            }
        });
    }

    res.json({ mensaje: 'Estado actualizado con éxito', ticket });
});

// API: Agregar Comentario a un Ticket
app.post('/api/tickets/:id/comentarios', (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    const { autor, rol, comentario } = req.body;
    const ticket = tickets.find(t => t.id === ticketId);

    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    ticket.comentarios.push({
        autor,
        rol,
        comentario,
        fecha: new Date().toLocaleString()
    });

    res.json({ mensaje: 'Comentario agregado con éxito', ticket });
});

// API: Cancelar Ticket (Solo si está en estado 1 y libera inventario)
app.delete('/api/tickets/:id', (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    const index = tickets.findIndex(t => t.id === ticketId);
    if (index === -1) return res.status(404).json({ error: 'Ticket no encontrado' });

    const ticket = tickets[index];
    if (ticket.estado_logistico !== '1. Solicitado') {
        return res.status(400).json({ error: 'No se puede cancelar un ticket que ya está en proceso logístico' });
    }

    // Liberar equipos del inventario si se cancela
    if (ticket.detalles) {
        ticket.detalles.forEach(d => {
            const eq = inventario.find(e => e.nombre === d.equipo_nombre && e.empresa_actual === ticket.cliente_empresa);
            if (eq) {
                eq.estado = 'Disponible';
                eq.empresa_actual = null;
            }
        });
    }

    tickets.splice(index, 1);
    res.json({ mensaje: 'Ticket cancelado correctamente' });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});