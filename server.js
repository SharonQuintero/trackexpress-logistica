const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos simulada en memoria con contraseñas cifradas por defecto
let usuarios = [
    { 
        id: 1, 
        usuario: 'admin', 
        passwordHash: bcrypt.hashSync('123', 8), 
        razon_social: 'Administrador TrackExpress', 
        nit: '900000000-1', 
        rol: 'admin' 
    },
    { 
        id: 2, 
        usuario: 'cliente1', 
        passwordHash: bcrypt.hashSync('123', 8), 
        razon_social: 'Tecnología e Innovación S.A.S.', 
        nit: '900123456-2', 
        rol: 'cliente' 
    }
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

// API Autenticación: Login con verificación de Hash
app.post('/api/auth/login', (req, res) => {
    const { usuario, password } = req.body;
    const user = usuarios.find(u => u.usuario.trim().toLowerCase() === usuario.trim().toLowerCase());
    
    if (user && bcrypt.compareSync(password, user.passwordHash)) {
        // Excluimos el hash al enviar los datos del usuario al cliente
        const { passwordHash, ...userSafe } = user;
        res.json({ mensaje: 'Login exitoso', usuario: userSafe });
    } else {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
});

// API Autenticación: Registro con cifrado de contraseña
app.post('/api/auth/registro', (req, res) => {
    const { usuario, password, razon_social, nit } = req.body;
    
    if (!usuario || !password || !razon_social || !nit) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const existe = usuarios.find(u => u.usuario.trim().toLowerCase() === usuario.trim().toLowerCase());
    if (existe) {
        return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const nuevoUsuario = {
        id: usuarios.length + 1,
        usuario: usuario.trim(),
        passwordHash: bcrypt.hashSync(password, 8),
        razon_social: razon_social.trim(),
        nit: nit.trim(),
        rol: 'cliente'
    };

    usuarios.push(nuevoUsuario);
    const { passwordHash, ...userSafe } = nuevoUsuario;
    res.json({ mensaje: 'Registro exitoso', usuario: userSafe });
});

// API Inventario
app.get('/api/inventario', (req, res) => {
    res.json(inventario);
});

// API Obtener Tickets
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

// API Editar Solicitud (Solo si está en estado '1. Solicitado')
app.put('/api/tickets/:id/editar', (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    const data = req.body;
    const ticket = tickets.find(t => t.id === ticketId);

    if (!ticket) {
        return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    if (ticket.estado_logistico !== '1. Solicitado') {
        return res.status(400).json({ error: 'Solo se pueden editar solicitudes que se encuentren en estado Solicitado' });
    }

    ticket.ciudad_destino = data.ciudad_destino || ticket.ciudad_destino;
    ticket.direccion_entrega = data.direccion_entrega || ticket.direccion_entrega;
    ticket.persona_recibe = data.persona_recibe || ticket.persona_recibe;
    ticket.horario_recepcion = data.horario_recepcion || ticket.horario_recepcion;
    ticket.observaciones = data.observaciones || ticket.observaciones;
    ticket.prioridad = data.prioridad || ticket.prioridad;

    res.json({ mensaje: 'Solicitud actualizada con éxito', ticket });
});

// API Cancelar / Eliminar Solicitud (Solo si está en estado '1. Solicitado')
app.delete('/api/tickets/:id', (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);

    if (ticketIndex === -1) {
        return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    if (tickets[ticketIndex].estado_logistico !== '1. Solicitado') {
        return res.status(400).json({ error: 'Solo se pueden cancelar solicitudes en estado Solicitado' });
    }

    tickets.splice(ticketIndex, 1);
    res.json({ mensaje: 'Solicitud cancelada y eliminada con éxito' });
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

// API Agregar Comentario
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