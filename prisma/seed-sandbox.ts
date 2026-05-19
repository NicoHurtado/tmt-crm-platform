/**
 * Seed script para la BD sandbox (nueva BD vacía de desarrollo)
 * Ejecutar con: DATABASE_URL="<sandbox_url>" npx ts-node prisma/seed-sandbox.ts
 * O usando el helper: npm run seed:sandbox
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed sandbox...');

    // ─── 0. LIMPIEZA (para poder re-ejecutar idempotente) ──────────
    console.log('🧹 Limpiando datos existentes...');
    await prisma.calificacion.deleteMany();
    await prisma.reservaAdicional.deleteMany();
    await prisma.asistente.deleteMany();
    await prisma.reserva.deleteMany();
    await prisma.pedido.deleteMany();
    await prisma.precioVehiculoAliado.deleteMany();
    await prisma.tarifaMunicipioAliado.deleteMany();
    await prisma.servicioAliado.deleteMany();
    await prisma.tarifaAliado.deleteMany();
    await prisma.aliado.deleteMany();
    await prisma.tarifaMunicipioServicio.deleteMany();
    await prisma.servicioAdicional.deleteMany();
    await prisma.servicioVehiculo.deleteMany();
    await prisma.servicio.deleteMany();
    await prisma.conductor.deleteMany();
    await prisma.vehiculo.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Limpieza completada\n');

    // ─── 1. ADMIN USER ─────────────────────────────────────────────
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@tmedellintravel.com' },
        update: {},
        create: {
            email: 'admin@tmedellintravel.com',
            password: adminPassword,
        },
    });
    console.log('✅ Usuario admin creado:', admin.email);

    // ─── 2. VEHÍCULOS ──────────────────────────────────────────────
    const vehiculos = await Promise.all([
        prisma.vehiculo.create({
            data: {
                nombre: 'Sedán Ejecutivo',
                capacidadMinima: 1,
                capacidadMaxima: 3,
                imagen: '/images/vehiculos/sedan.jpg',
                activo: true,
            },
        }),
        prisma.vehiculo.create({
            data: {
                nombre: 'SUV Familiar',
                capacidadMinima: 4,
                capacidadMaxima: 6,
                imagen: '/images/vehiculos/suv.jpg',
                activo: true,
            },
        }),
        prisma.vehiculo.create({
            data: {
                nombre: 'Van Ejecutiva',
                capacidadMinima: 7,
                capacidadMaxima: 10,
                imagen: '/images/vehiculos/van.jpg',
                activo: true,
            },
        }),
        prisma.vehiculo.create({
            data: {
                nombre: 'Bus Turístico',
                capacidadMinima: 11,
                capacidadMaxima: 30,
                imagen: '/images/vehiculos/bus.jpg',
                activo: true,
            },
        }),
    ]);
    console.log(`✅ ${vehiculos.length} vehículos creados`);

    const [sedan, suv, van, bus] = vehiculos;

    // ─── 3. CONDUCTORES ────────────────────────────────────────────
    const conductores = await Promise.all([
        prisma.conductor.create({
            data: {
                nombre: 'Carlos Andrés Gómez',
                whatsapp: '+573001234567',
                telefono: '+573001234567',
                documento: '1234567890',
                placa: 'ABC-123',
                disponible: true,
                activo: true,
                fotosVehiculo: ['/images/conductores/carlos-vehiculo.jpg'],
            },
        }),
        prisma.conductor.create({
            data: {
                nombre: 'Juan Pablo Restrepo',
                whatsapp: '+573109876543',
                telefono: '+573109876543',
                documento: '0987654321',
                placa: 'XYZ-456',
                disponible: true,
                activo: true,
                fotosVehiculo: ['/images/conductores/juan-vehiculo.jpg'],
            },
        }),
        prisma.conductor.create({
            data: {
                nombre: 'María Fernanda López',
                whatsapp: '+573205551234',
                telefono: '+573205551234',
                documento: '1122334455',
                placa: 'DEF-789',
                disponible: false,
                activo: true,
                fotosVehiculo: [],
            },
        }),
    ]);
    console.log(`✅ ${conductores.length} conductores creados`);

    const [carlos, juan] = conductores;

    // ─── 4. SERVICIOS ──────────────────────────────────────────────
    const servicioAeropuerto = await prisma.servicio.create({
        data: {
            tipo: 'TRANSPORTE_AEROPUERTO',
            nombre: { ES: 'Transporte Aeropuerto', EN: 'Airport Transfer' },
            descripcion: {
                ES: 'Transporte privado desde/hacia el aeropuerto José María Córdova u Olaya Herrera.',
                EN: 'Private transport to/from José María Córdova or Olaya Herrera airport.',
            },
            incluye: {
                ES: ['Conductor bilingüe', 'Agua mineral', 'Monitoreo de vuelo'],
                EN: ['Bilingual driver', 'Mineral water', 'Flight monitoring'],
            },
            imagen: '/images/servicios/aeropuerto.jpg',
            precioBase: 120000,
            duracion: '60-90 min',
            esAeropuerto: true,
            aplicaRecargoNocturno: true,
            recargoNocturnoInicio: '22:00',
            recargoNocturnoFin: '05:00',
            montoRecargoNocturno: 30000,
            orden: 1,
            activo: true,
            camposPersonalizados: [],
        },
    });

    const servicioTourGuatape = await prisma.servicio.create({
        data: {
            tipo: 'TOUR_GUATAPE',
            nombre: { ES: 'Tour Guatapé', EN: 'Guatapé Tour' },
            descripcion: {
                ES: 'Tour de día completo al embalse de Guatapé y la Piedra del Peñol.',
                EN: 'Full-day tour to Guatapé reservoir and El Peñol rock.',
            },
            incluye: {
                ES: ['Transporte privado', 'Guía turístico', 'Seguro de viaje'],
                EN: ['Private transport', 'Tour guide', 'Travel insurance'],
            },
            imagen: '/images/servicios/guatape.jpg',
            precioBase: 180000,
            duracion: '8-10 horas',
            esAeropuerto: false,
            aplicaRecargoNocturno: false,
            orden: 2,
            activo: true,
            camposPersonalizados: [],
        },
    });

    const servicioCityTour = await prisma.servicio.create({
        data: {
            tipo: 'CITY_TOUR',
            nombre: { ES: 'City Tour Medellín', EN: 'Medellín City Tour' },
            descripcion: {
                ES: 'Recorre los principales atractivos de la ciudad de Medellín.',
                EN: 'Explore the main attractions of the city of Medellín.',
            },
            incluye: {
                ES: ['Transporte privado', 'Guía certificado', 'Entrada a museos'],
                EN: ['Private transport', 'Certified guide', 'Museum entrance'],
            },
            imagen: '/images/servicios/citytour.jpg',
            precioBase: 150000,
            duracion: '4-5 horas',
            esAeropuerto: false,
            aplicaRecargoNocturno: false,
            orden: 3,
            activo: true,
            camposPersonalizados: [],
        },
    });

    const servicioTourCompartido = await prisma.servicio.create({
        data: {
            tipo: 'TOUR_COMPARTIDO',
            nombre: { ES: 'Tour Compartido Guatapé', EN: 'Shared Guatapé Tour' },
            descripcion: {
                ES: 'Tour compartido al embalse de Guatapé. Salidas todos los días.',
                EN: 'Shared tour to Guatapé reservoir. Daily departures.',
            },
            incluye: {
                ES: ['Transporte en bus turístico', 'Guía bilingüe'],
                EN: ['Tourist bus transport', 'Bilingual guide'],
            },
            imagen: '/images/servicios/tour-compartido.jpg',
            precioBase: 80000,
            duracion: '8 horas',
            esAeropuerto: false,
            aplicaRecargoNocturno: false,
            orden: 4,
            activo: true,
            camposPersonalizados: [],
        },
    });

    const servicioTransporteMunicipal = await prisma.servicio.create({
        data: {
            tipo: 'TRANSPORTE_MUNICIPAL',
            nombre: { ES: 'Transporte Municipal', EN: 'Municipal Transport' },
            descripcion: {
                ES: 'Transporte privado dentro del área metropolitana de Medellín.',
                EN: 'Private transport within the Medellín metropolitan area.',
            },
            incluye: {
                ES: ['Conductor', 'Combustible incluido'],
                EN: ['Driver', 'Fuel included'],
            },
            imagen: '/images/servicios/municipal.jpg',
            precioBase: 60000,
            duracion: 'Variable',
            esAeropuerto: false,
            aplicaRecargoNocturno: true,
            recargoNocturnoInicio: '22:00',
            recargoNocturnoFin: '05:00',
            montoRecargoNocturno: 20000,
            orden: 5,
            activo: true,
            camposPersonalizados: [],
        },
    });

    const servicioTransporteHoras = await prisma.servicio.create({
        data: {
            tipo: 'TRANSPORTE_POR_HORAS',
            nombre: { ES: 'Transporte por Horas', EN: 'Hourly Transport' },
            descripcion: {
                ES: 'Servicio de transporte privado por horas a tu disposición.',
                EN: 'Private transport service by the hour at your disposal.',
            },
            incluye: {
                ES: ['Conductor', 'Combustible', 'Espera incluida'],
                EN: ['Driver', 'Fuel', 'Waiting time included'],
            },
            imagen: '/images/servicios/horas.jpg',
            precioBase: 80000,
            duracion: 'Por hora',
            esPorHoras: true,
            esAeropuerto: false,
            aplicaRecargoNocturno: false,
            orden: 6,
            activo: true,
            camposPersonalizados: [],
        },
    });

    console.log('✅ 6 servicios creados');

    // ─── 5. SERVICIOS ADICIONALES ──────────────────────────────────
    await prisma.servicioAdicional.createMany({
        data: [
            {
                servicioId: servicioAeropuerto.id,
                nombre: 'Silla para bebé',
                precio: 15000,
                tipo: 'FIJO',
                activo: true,
            },
            {
                servicioId: servicioAeropuerto.id,
                nombre: 'Meet & Greet en aeropuerto',
                precio: 25000,
                tipo: 'FIJO',
                activo: true,
            },
            {
                servicioId: servicioTourGuatape.id,
                nombre: 'Almuerzo típico',
                precio: 35000,
                tipo: 'POR_PERSONA',
                activo: true,
            },
            {
                servicioId: servicioCityTour.id,
                nombre: 'Fotografía profesional',
                precio: 80000,
                tipo: 'FIJO',
                activo: false,
            },
        ],
    });
    console.log('✅ Servicios adicionales creados');

    // ─── 6. SERVICIOS-VEHÍCULOS (precios por vehículo) ─────────────
    await prisma.servicioVehiculo.createMany({
        data: [
            // Aeropuerto
            { servicioId: servicioAeropuerto.id, vehiculoId: sedan.id, precio: 120000 },
            { servicioId: servicioAeropuerto.id, vehiculoId: suv.id, precio: 160000 },
            { servicioId: servicioAeropuerto.id, vehiculoId: van.id, precio: 220000 },
            { servicioId: servicioAeropuerto.id, vehiculoId: bus.id, precio: 450000 },
            // Tour Guatapé
            { servicioId: servicioTourGuatape.id, vehiculoId: sedan.id, precio: 180000 },
            { servicioId: servicioTourGuatape.id, vehiculoId: suv.id, precio: 240000 },
            { servicioId: servicioTourGuatape.id, vehiculoId: van.id, precio: 350000 },
            { servicioId: servicioTourGuatape.id, vehiculoId: bus.id, precio: 700000 },
            // City Tour
            { servicioId: servicioCityTour.id, vehiculoId: sedan.id, precio: 150000 },
            { servicioId: servicioCityTour.id, vehiculoId: suv.id, precio: 200000 },
            { servicioId: servicioCityTour.id, vehiculoId: van.id, precio: 300000 },
            // Tour Compartido (precio fijo por persona)
            { servicioId: servicioTourCompartido.id, vehiculoId: bus.id, precio: 80000 },
            // Transporte Municipal
            { servicioId: servicioTransporteMunicipal.id, vehiculoId: sedan.id, precio: 60000 },
            { servicioId: servicioTransporteMunicipal.id, vehiculoId: suv.id, precio: 80000 },
            { servicioId: servicioTransporteMunicipal.id, vehiculoId: van.id, precio: 120000 },
            // Por Horas
            { servicioId: servicioTransporteHoras.id, vehiculoId: sedan.id, precio: 80000 },
            { servicioId: servicioTransporteHoras.id, vehiculoId: suv.id, precio: 100000 },
            { servicioId: servicioTransporteHoras.id, vehiculoId: van.id, precio: 140000 },
        ],
    });
    console.log('✅ Precios vehículo-servicio creados');

    // ─── 7. TARIFAS MUNICIPIO ──────────────────────────────────────
    await prisma.tarifaMunicipioServicio.createMany({
        data: [
            { servicioId: servicioAeropuerto.id, municipio: 'SABANETA', valorExtra: 15000 },
            { servicioId: servicioAeropuerto.id, municipio: 'ENVIGADO', valorExtra: 15000 },
            { servicioId: servicioAeropuerto.id, municipio: 'BELLO', valorExtra: 10000 },
            { servicioId: servicioAeropuerto.id, municipio: 'ITAGUI', valorExtra: 12000 },
            { servicioId: servicioTransporteMunicipal.id, municipio: 'SABANETA', valorExtra: 10000 },
            { servicioId: servicioTransporteMunicipal.id, municipio: 'ENVIGADO', valorExtra: 10000 },
            { servicioId: servicioTransporteMunicipal.id, municipio: 'BELLO', valorExtra: 8000 },
        ],
    });
    console.log('✅ Tarifas municipio creadas');

    // ─── 8. ALIADOS ────────────────────────────────────────────────
    const aliadoHotel = await prisma.aliado.create({
        data: {
            nombre: 'Hotel Poblado Grand',
            email: 'reservas@hotelpobladogrand.com',
            contacto: '+573001112222',
            codigo: 'HOTEL10',
            tipo: 'HOTEL',
            activo: true,
        },
    });

    const aliadoAirbnb = await prisma.aliado.create({
        data: {
            nombre: 'Airbnb Laureles Premium',
            email: 'host@airbnblaureles.com',
            contacto: '+573003334444',
            codigo: 'AIRBNB15',
            tipo: 'AIRBNB',
            activo: true,
        },
    });

    const aliadoAgencia = await prisma.aliado.create({
        data: {
            nombre: 'Viajes Colombia Tours',
            email: 'ops@viajescolombia.com',
            contacto: '+573005556666',
            codigo: 'AGENCIA20',
            tipo: 'AGENCIA',
            activo: true,
        },
    });
    console.log('✅ 3 aliados creados');

    // ─── 9. SERVICIOS-ALIADO + PRECIOS VEHÍCULO ALIADO ────────────
    const servicioAliadoHotelAeropuerto = await prisma.servicioAliado.create({
        data: {
            aliadoId: aliadoHotel.id,
            servicioId: servicioAeropuerto.id,
            activo: true,
        },
    });

    await prisma.precioVehiculoAliado.createMany({
        data: [
            {
                servicioAliadoId: servicioAliadoHotelAeropuerto.id,
                vehiculoId: sedan.id,
                precio: 108000,
                comision: 12000,
            },
            {
                servicioAliadoId: servicioAliadoHotelAeropuerto.id,
                vehiculoId: suv.id,
                precio: 144000,
                comision: 16000,
            },
            {
                servicioAliadoId: servicioAliadoHotelAeropuerto.id,
                vehiculoId: van.id,
                precio: 198000,
                comision: 22000,
            },
        ],
    });

    const servicioAliadoAgenciaTour = await prisma.servicioAliado.create({
        data: {
            aliadoId: aliadoAgencia.id,
            servicioId: servicioTourGuatape.id,
            activo: true,
        },
    });

    await prisma.precioVehiculoAliado.createMany({
        data: [
            {
                servicioAliadoId: servicioAliadoAgenciaTour.id,
                vehiculoId: suv.id,
                precio: 192000,
                comision: 24000,
            },
            {
                servicioAliadoId: servicioAliadoAgenciaTour.id,
                vehiculoId: van.id,
                precio: 280000,
                comision: 35000,
            },
        ],
    });
    console.log('✅ Servicios aliado + precios vehículo creados');

    // ─── 10. RESERVAS DUMMY ────────────────────────────────────────
    const hoy = new Date();
    const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
    const pasado = new Date(hoy); pasado.setDate(hoy.getDate() + 2);
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);

    const reservas = await Promise.all([
        // Reserva 1: Aeropuerto confirmada pendiente pago
        prisma.reserva.create({
            data: {
                codigo: 'RES00001',
                servicioId: servicioAeropuerto.id,
                vehiculoId: suv.id,
                fecha: manana,
                hora: '08:00',
                nombreCliente: 'John Smith',
                whatsappCliente: '+13015550123',
                emailCliente: 'john.smith@email.com',
                idioma: 'EN',
                municipio: 'POBLADO',
                numeroPasajeros: 2,
                aeropuertoTipo: 'HACIA',
                aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                numeroVuelo: 'AV204',
                precioBase: 160000,
                precioAdicionales: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                descuentoAliado: 0,
                precioTotal: 169600,
                comisionBold: 9600,
                estado: 'PENDING_PAYMENT',
                estadoPago: 'PENDIENTE',
                metodoPago: 'BOLD',
                esPedido: false,
                esReservaAliado: false,
                datosDinamicos: {},
            },
        }),
        // Reserva 2: Tour Guatapé asignada con conductor
        prisma.reserva.create({
            data: {
                codigo: 'RES00002',
                servicioId: servicioTourGuatape.id,
                vehiculoId: van.id,
                conductorId: carlos.id,
                fecha: pasado,
                hora: '06:30',
                nombreCliente: 'María García',
                whatsappCliente: '+573112223344',
                emailCliente: 'maria.garcia@gmail.com',
                idioma: 'ES',
                municipio: 'MEDELLIN',
                numeroPasajeros: 7,
                precioBase: 350000,
                precioAdicionales: 245000,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                descuentoAliado: 0,
                precioTotal: 595000,
                comisionBold: 0,
                estado: 'CONFIRMED_ASSIGNED',
                estadoPago: 'APROBADO',
                metodoPago: 'BOLD',
                esPedido: false,
                esReservaAliado: false,
                datosDinamicos: {},
            },
        }),
        // Reserva 3: Reserva de aliado hotel, efectivo
        prisma.reserva.create({
            data: {
                codigo: 'RES00003',
                servicioId: servicioAeropuerto.id,
                vehiculoId: sedan.id,
                aliadoId: aliadoHotel.id,
                fecha: manana,
                hora: '14:00',
                nombreCliente: 'Carlos Pérez',
                whatsappCliente: '+573104445566',
                emailCliente: 'carlos.perez@hotmail.com',
                idioma: 'ES',
                municipio: 'ENVIGADO',
                numeroPasajeros: 1,
                aeropuertoTipo: 'DESDE',
                aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                precioBase: 108000,
                precioAdicionales: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 15000,
                descuentoAliado: 0,
                precioTotal: 123000,
                comisionBold: 0,
                comisionAliado: 12000,
                estado: 'CONFIRMED_UNASSIGNED',
                estadoPago: null,
                metodoPago: 'EFECTIVO',
                esPedido: false,
                esReservaAliado: true,
                datosDinamicos: {},
            },
        }),
        // Reserva 4: Tour compartido confirmado
        prisma.reserva.create({
            data: {
                codigo: 'RES00004',
                servicioId: servicioTourCompartido.id,
                vehiculoId: bus.id,
                fecha: pasado,
                hora: '07:00',
                nombreCliente: 'Emily Johnson',
                whatsappCliente: '+447911123456',
                emailCliente: 'emily.j@outlook.com',
                idioma: 'EN',
                municipio: null,
                numeroPasajeros: 2,
                precioBase: 160000,
                precioAdicionales: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                descuentoAliado: 0,
                precioTotal: 169600,
                comisionBold: 9600,
                estado: 'PENDING_PAYMENT',
                estadoPago: 'PENDIENTE',
                metodoPago: 'BOLD',
                esPedido: false,
                esReservaAliado: false,
                datosDinamicos: {},
            },
        }),
        // Reserva 5: Completada (histórico)
        prisma.reserva.create({
            data: {
                codigo: 'RES00005',
                servicioId: servicioCityTour.id,
                vehiculoId: suv.id,
                conductorId: juan.id,
                fecha: ayer,
                hora: '09:00',
                nombreCliente: 'Luisa Martínez',
                whatsappCliente: '+573207778899',
                emailCliente: 'luisa.m@gmail.com',
                idioma: 'ES',
                municipio: 'SABANETA',
                numeroPasajeros: 4,
                precioBase: 200000,
                precioAdicionales: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 15000,
                descuentoAliado: 0,
                precioTotal: 228900,
                comisionBold: 13900,
                estado: 'COMPLETED',
                estadoPago: 'APROBADO',
                metodoPago: 'BOLD',
                esPedido: false,
                esReservaAliado: false,
                datosDinamicos: {},
                googleCalendarEventId: 'sandbox_cal_event_001',
            },
        }),
        // Reserva 6: Cotización pendiente (municipio OTRO)
        prisma.reserva.create({
            data: {
                codigo: 'RES00006',
                servicioId: servicioTourGuatape.id,
                vehiculoId: null,
                fecha: new Date(hoy.getTime() + 5 * 24 * 60 * 60 * 1000),
                hora: '07:00',
                nombreCliente: 'Roberto Díaz',
                whatsappCliente: '+573309990011',
                emailCliente: 'roberto.d@empresa.co',
                idioma: 'ES',
                municipio: 'OTRO',
                otroMunicipio: 'Rionegro',
                numeroPasajeros: 12,
                precioBase: 700000,
                precioAdicionales: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                descuentoAliado: 0,
                precioTotal: 700000,
                comisionBold: 0,
                estado: 'CONFIRMED_UNASSIGNED',
                estadoPago: null,
                metodoPago: 'BOLD',
                esPedido: false,
                esReservaAliado: false,
                datosDinamicos: {},
            },
        }),
        // Reserva 7: Transporte por horas, cancelada
        prisma.reserva.create({
            data: {
                codigo: 'RES00007',
                servicioId: servicioTransporteHoras.id,
                vehiculoId: sedan.id,
                fecha: ayer,
                hora: '10:00',
                nombreCliente: 'Ana Vargas',
                whatsappCliente: '+573151112233',
                emailCliente: 'ana.vargas@yahoo.com',
                idioma: 'ES',
                municipio: 'MEDELLIN',
                numeroPasajeros: 2,
                cantidadHoras: 4,
                precioBase: 320000,
                precioAdicionales: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                descuentoAliado: 0,
                precioTotal: 339200,
                comisionBold: 19200,
                estado: 'CANCELLED',
                estadoPago: 'RECHAZADO',
                metodoPago: 'BOLD',
                esPedido: false,
                esReservaAliado: false,
                datosDinamicos: {},
            },
        }),
    ]);
    console.log(`✅ ${reservas.length} reservas dummy creadas`);

    // ─── 11. PEDIDO CON MÚLTIPLES RESERVAS ────────────────────────
    const reservasPedido = await Promise.all([
        prisma.reserva.create({
            data: {
                codigo: 'PED0001A',
                servicioId: servicioAeropuerto.id,
                vehiculoId: suv.id,
                fecha: new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000),
                hora: '07:00',
                nombreCliente: 'Tour Group ABC',
                whatsappCliente: '+573401234567',
                emailCliente: 'groups@touroperator.com',
                idioma: 'EN',
                municipio: 'POBLADO',
                numeroPasajeros: 4,
                aeropuertoTipo: 'DESDE',
                aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
                precioBase: 160000,
                precioAdicionales: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                descuentoAliado: 0,
                precioTotal: 169600,
                comisionBold: 9600,
                estado: 'PENDING_PAYMENT',
                estadoPago: 'PENDIENTE',
                metodoPago: 'BOLD',
                esPedido: true,
                esReservaAliado: false,
                datosDinamicos: {},
            },
        }),
        prisma.reserva.create({
            data: {
                codigo: 'PED0001B',
                servicioId: servicioTourGuatape.id,
                vehiculoId: suv.id,
                fecha: new Date(hoy.getTime() + 4 * 24 * 60 * 60 * 1000),
                hora: '06:30',
                nombreCliente: 'Tour Group ABC',
                whatsappCliente: '+573401234567',
                emailCliente: 'groups@touroperator.com',
                idioma: 'EN',
                municipio: 'MEDELLIN',
                numeroPasajeros: 4,
                precioBase: 240000,
                precioAdicionales: 140000,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                descuentoAliado: 0,
                precioTotal: 380000,
                comisionBold: 22800,
                estado: 'PENDING_PAYMENT',
                estadoPago: 'PENDIENTE',
                metodoPago: 'BOLD',
                esPedido: true,
                esReservaAliado: false,
                datosDinamicos: {},
            },
        }),
    ]);

    const pedido = await prisma.pedido.create({
        data: {
            codigo: 'PED00001',
            nombreCliente: 'Tour Group ABC',
            whatsappCliente: '+573401234567',
            emailCliente: 'groups@touroperator.com',
            idioma: 'EN',
            subtotal: 549600,
            comisionBold: 32400,
            precioTotal: 582000,
            estadoPago: 'PENDIENTE',
            metodoPago: 'BOLD',
            esReservaAliado: false,
            reservas: {
                connect: reservasPedido.map(r => ({ id: r.id })),
            },
        },
    });
    console.log('✅ Pedido con 2 reservas creado:', pedido.codigo);

    // ─── 12. CALIFICACIONES ────────────────────────────────────────
    await prisma.calificacion.create({
        data: {
            reservaId: reservas[4].id,
            servicioId: servicioCityTour.id,
            estrellas: 5,
            nombreCliente: 'Luisa Martínez',
            comentario: 'Excelente servicio, el conductor fue muy amable y puntual.',
            esPublica: true,
            destacada: true,
        },
    });
    console.log('✅ Calificación creada');

    console.log('\n🎉 Seed sandbox completado exitosamente!');
    console.log('─────────────────────────────────────────');
    console.log('Resumen:');
    console.log(`  Admin user:    admin@tmedellintravel.com / admin123`);
    console.log(`  Vehículos:     ${vehiculos.length}`);
    console.log(`  Conductores:   ${conductores.length}`);
    console.log(`  Servicios:     6`);
    console.log(`  Aliados:       3`);
    console.log(`  Reservas:      ${reservas.length + reservasPedido.length}`);
    console.log(`  Pedidos:       1`);
    console.log('─────────────────────────────────────────');
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
