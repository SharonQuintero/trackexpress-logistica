const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos simulada en memoria
let usuarios = [
    { id: 1, usuario: 'admin', password: '123', razon_social: 'Administrador TrackExpress', nit: '900000000-1', rol: 'admin' },
    { id: 2, usuario: 'cliente1', password: '123', razon_social: 'Tecnología e Innovación S.A.S.', nit: '900123456-2', rol: 'cliente' }
];

let inventario = [
    { id: 1, serial: 'DL-784201', nombre: 'Laptop Dell Latitude', marca: 'Dell', modelo: 'Latitude 5420', estado: 'Disponible', empresa_actual: null },
    { id: 2, serial: 'DL-784202', nombre: 'Laptop Dell Latitude', marca: 'Dell', modelo: 'Latitude 5420', estado: 'Disponible', empresa_actual: null },
    { id: 3, serial: 'HP-992104', nombre: 'Workstation HP ProDesk', marca: 'HP', modelo: 'ProDesk 600', estado: 'Disponible', empresa_actual: null },
    { id: 4, serial: 'LN-331092', nombre: 'ThinkPad Lenovo', marca: 'Lenovo', modelo: 'T14 Gen 2', estado: 'Disponible', empresa_actual: null }
];

let tickets = [];

// API Autenticación: Login
app.post('/api/auth/login', (req, res) => {
    const { usuario, password } = req.body;
    const user = usuarios.find(u => u.usuario === usuario && u.password === password);
    if (user) {
        res.json({ mensaje: 'Login exitoso', usuario: user });
    } else {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
});

// API Autenticación: Registro
app.post('/api/auth/registro', (req, res) => {
    const { usuario, password, razon_social, nit } = req.body;
    if (usuarios.find(u => u.usuario === usuario)) {
        return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }
    const nuevoUsuario = {
        id: usuarios.length + 1,
        usuario,
        password,
        razon_social,
        nit,
        rol: 'cliente'
    };
    usuarios.push(nuevoUsuario);
    res.json({ mensaje: 'Registro exitoso', usuario: nuevoUsuario });
});

// API Inventario
app.get('/api/inventario', (req, res) => {
    res.json(inventario);
});

// API Obtener Tickets (Filtra por empresa si es cliente)
app.get('/api/tickets', (req, res) => {
    const { empresa } = req.query;
    if (empresa) {
        const filtrados = tickets.filter(t => t.cliente_empresa === empresa);
        return res.json(filtrados);
    }
    res.json(tickets);
});

// API Crear Ticket
app.post('/api/tickets', (req, res) => {
    const data = req.body;
    const nuevoTicket = {
        id: tickets.length + 1,
        codigo_ticket: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
        cliente_empresa: data.cliente_empresa,
        nit: data.nit,
        tipo_ticket: data.tipo_ticket,
        ciudad_destino: data.ciudad_destino || 'N/A',
        direccion_entrega: data.direccion_entrega || 'N/A',
        persona_recibe: data.persona_recibe || 'N/A',
        horario_recepcion: data.horario_recepcion || 'N/A',
        area_destino: data.area_destino || 'N/A',
        tiempo_alquiler: data.tiempo_alquiler || 'N/A',
        categoria_incidencia: data.categoria_incidencia || 'N/A',
        prioridad: data.prioridad || 'Normal',
        observaciones: data.observaciones || '',
        fecha_deseada: data.fecha_deseada || new Date().toISOString().split('T')[0],
        estado_logistico: '1. Solicitado',
        detalles: data.items || [],
        comentarios: [],
        fecha_creacion: new Date().toLocaleString()
    };

    tickets.push(nuevoTicket);
    res.json({ mensaje: 'Ticket creado con éxito', codigo: nuevoTicket.codigo_ticket, id: nuevoTicket.id });
});

// API Actualizar Estado Logístico (Admin)
app.put('/api/tickets/:id', (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    const { estado_logistico } = req.body;
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (ticket) {
        ticket.estado_logistico = estado_logistico;
        res.json({ mensaje: 'Estado actualizado con éxito', ticket });
    } else {
        res.status(404).json({ error: 'Ticket no encontrado' });
    }
});

// API Agregar Comentario a Ticket
app.post('/api/tickets/:id/comentarios', (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    const { autor, rol, comentario } = req.body;
    const ticket = tickets.find(t => t.id === ticketId);

    if (ticket) {
        if (!ticket.comentarios) ticket.comentarios = [];
        ticket.comentarios.push({
            autor,
            rol,
            comentario,
            fecha: new Date().toLocaleString()
        });
        res.json({ mensaje: 'Comentario agregado', ticket });
    } else {
        res.status(404).json({ error: 'Ticket no encontrado' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});